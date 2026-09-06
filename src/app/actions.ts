"use server";

import { redirect } from "next/navigation";
import { clientInfo } from "@/lib/requestInfo";
import { readVoterKey, issueVoterKey } from "@/lib/voter";
import { verifyAdminKey } from "@/lib/adminKey";
import { allowCreate, allowSubmit } from "@/server/rateLimit";
import {
  createPoll,
  getPollBySlug,
  getPollRowForAdmin,
  submitBallot,
  closePoll,
  ensureClosedIfDue,
  publishResultsNow,
  getFinalResult,
  logSubmit,
  LIMITS,
  type SubmitResult,
} from "@/server/polls";

// ── 作成 ────────────────────────────────────────────

export type CreateActionInput = {
  title: string;
  description?: string;
  options: string[];
  showLiveCount: boolean;
  /** 締切（ISO 8601）。未指定・null なら締切なし（管理URLから手動で締め切る）。 */
  closeAt?: string | null;
  /** 結果公開（ISO 8601）。未指定・null なら締切と同時に公開する。 */
  resultsOpenAt?: string | null;
};

/**
 * 投票を作成して管理ページ（共有 URL と管理 URL が出る）へ遷移する。
 * 失敗（レート制限・入力上限）はエラーメッセージを返してフォーム側で表示する。
 */
export async function createPollAction(
  input: CreateActionInput
): Promise<{ error: string } | undefined> {
  const { ipHash } = await clientInfo();

  // レート制限（同一 IP の直近作成数）。荒らしの大量作成＝DB 枯渇を止める。
  if (!(await allowCreate(ipHash))) {
    return {
      error: "作成の回数が上限に達しました。しばらく時間をおいてからお試しください。",
    };
  }

  let slug: string;
  let adminKey: string;
  try {
    ({ slug, adminKey } = await createPoll({
      title: input?.title,
      description: input?.description,
      options: input?.options,
      showLiveCount: input?.showLiveCount !== false,
      closeAt: input?.closeAt ?? null,
      resultsOpenAt: input?.resultsOpenAt ?? null,
      createdIpHash: ipHash,
    }));
  } catch (e) {
    // createPoll の検証エラーはそのまま返す（利用者が直せる内容のため）。
    return { error: e instanceof Error ? e.message : "作成に失敗しました" };
  }

  redirect(`/p/${slug}/manage?key=${adminKey}&created=1`);
}

// ── 受理 ───────────────────────────────────────────

/** 送信前の安価な形式チェック。DB へ巨大な配列を渡さないための足切り。 */
function rankingsLookValid(rankings: unknown): rankings is string[] {
  return (
    Array.isArray(rankings) &&
    rankings.length > 0 &&
    rankings.length <= LIMITS.options &&
    rankings.every((r) => typeof r === "string" && r.length <= 64)
  );
}

export async function submitBallotAction(
  slug: string,
  rankings: string[]
): Promise<{ result: SubmitResult }> {
  // ── 1. Cookie ゲート（DB に触る前に判定する）────────────────────────────
  // voter_key の Cookie を提示しないリクエストは受理せず、Cookie の発行だけして返す。
  // クライアントは 1 回だけ再送する。Cookie を保持しない素の HTTP クライアント
  // （curl のループ等）は、ここで「1 リクエスト＝1 票」を積めなくなる。
  // ※ Cookie jar を持てば回避できる。あくまでレート制限と併用しての足切り。
  const voterKey = await readVoterKey();
  if (!voterKey) {
    await issueVoterKey();
    return { result: "cookie_issued" };
  }

  if (!rankingsLookValid(rankings)) return { result: "invalid_rankings" };

  const found = await getPollBySlug(slug);
  if (!found) return { result: "poll_not_found" };

  const { ipHash: ih, userAgent: ua } = await clientInfo();

  // ── 2. レート制限（同一 IP の直近送信数）────────────────────────────────
  // 会場の NAT で多人数が同一 IP になる想定なので既定値は緩め（rateLimit.ts）。
  // 拒否した試行は submit_log に積まない——積むと荒らし自身がログを膨らませられるうえ、
  // 窓のカウント対象がその拒否ログで埋まってしまうため。
  if (!(await allowSubmit(ih))) {
    return { result: "rate_limited" };
  }

  // L1（captcha）は未実装。require_captcha の poll は誤って素通しにせず明示的に拒否。
  if (found.poll.require_captcha) {
    await logSubmit({
      pollId: found.poll.id, voterKey, rankings,
      result: "captcha_required", verification: "none", ipHash: ih, userAgent: ua,
    });
    return { result: "captcha_required" };
  }

  const result = await submitBallot(found.poll.id, voterKey, rankings);
  await logSubmit({
    pollId: found.poll.id, voterKey, rankings,
    result, verification: "none", ipHash: ih, userAgent: ua,
  });
  return { result };
}

// ── 締切（管理者）───────────────────────────────────

export async function closePollAction(slug: string, key: string): Promise<void> {
  const row = await getPollRowForAdmin(slug);
  if (!row) redirect(`/p/${slug}`);
  if (!verifyAdminKey(key, row.admin_key_hash)) {
    redirect(`/p/${slug}/manage?key=${encodeURIComponent(key)}&err=auth`);
  }
  await closePoll(row.id);
  // 締切後の不変データからスナップショットを確定させておく（冪等）。
  const pub = await getPollBySlug(slug);
  if (pub) await getFinalResult(pub.poll);
  redirect(`/p/${slug}/results`);
}

/**
 * 結果公開を「いま」に前倒しする（管理者）。締切そのものは動かさない。
 *
 * 予約した公開時刻を待たずに発表したくなったとき用。まだ受付中の poll では何もしない
 * （受付中の票が結果に入ってしまうため。先に締め切ってから公開する）。
 */
export async function publishResultsAction(slug: string, key: string): Promise<void> {
  const row = await getPollRowForAdmin(slug);
  if (!row) redirect(`/p/${slug}`);
  if (!verifyAdminKey(key, row.admin_key_hash)) {
    redirect(`/p/${slug}/manage?key=${encodeURIComponent(key)}&err=auth`);
  }
  const status = await ensureClosedIfDue(row);
  if (status !== "closed") {
    redirect(`/p/${slug}/manage?key=${encodeURIComponent(key)}`);
  }
  await publishResultsNow(row.id);
  const pub = await getPollBySlug(slug);
  if (pub) await getFinalResult(pub.poll);
  redirect(`/p/${slug}/results`);
}
