import "server-only";
import { admin } from "@/lib/supabase";
import { generateSlug } from "@/lib/slug";
import { generateAdminKey, hashAdminKey } from "@/lib/adminKey";
import { normalizeCloseAt, normalizeResultsOpenAt } from "@/lib/closeAt";
import { tallyRcv, type RcvTallyResult } from "@/features/rcv/tally";

// ── 型 ──────────────────────────────────────────────────────────────────────

export type PollStatus = "open" | "closed";

export type PublicPoll = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: PollStatus;
  close_at: string | null;
  /** 結果を公開する時刻。null なら締切と同時に公開する（lib/closeAt.ts の isResultsOpen）。 */
  results_open_at: string | null;
  require_captcha: boolean;
  show_live_count: boolean;
  created_at: string;
};

export type PollOption = {
  id: string;
  label: string;
  color: string | null;
  sort_order: number;
};

export type PollWithOptions = { poll: PublicPoll; options: PollOption[] };

export type SubmitResult =
  | "ok"
  | "poll_not_found"
  | "poll_closed"
  | "invalid_rankings"
  | "captcha_required"
  // ここから下はアプリ層で弾いた結果コード（submit_ballot RPC からは返らない）。
  /** voter_key の Cookie が無いので発行だけした。クライアントは 1 回だけ再送する（lib/voter.ts） */
  | "cookie_issued"
  /** 同一 IP の送信が短時間に集中した（src/server/rateLimit.ts） */
  | "rate_limited";

const PUBLIC_COLS =
  "id, slug, title, description, status, close_at, results_open_at, require_captcha, show_live_count, created_at";

// 会場スクリーン/バー用のパレット（選択肢に順に割り当てる）。
const PALETTE = [
  "#2AA693", "#F59E0B", "#6366F1", "#EF4444", "#14B8A6",
  "#EC4899", "#8B5CF6", "#F97316", "#0EA5E9", "#84CC16",
];

// ── 作成 ────────────────────────────────────────────────────────────────────

export type CreatePollInput = {
  title: string;
  description?: string | null;
  options: string[];
  requireCaptcha?: boolean;
  showLiveCount?: boolean;
  closeAt?: string | null;
  /** 結果公開（ISO 8601）。未指定・null なら締切と同時に公開する。 */
  resultsOpenAt?: string | null;
  /** 作成者 IP の HMAC ハッシュ（レート制限用・平文 IP は保存しない） */
  createdIpHash?: string | null;
};

/** 入力上限。CreatePollForm の maxLength と必ず同じ値にする。 */
export const LIMITS = { title: 140, description: 1000, label: 120, options: 40 } as const;

/** poll と選択肢を作成し、公開 slug と（作成者にだけ渡す）管理キーを返す。 */
export async function createPoll(
  input: CreatePollInput
): Promise<{ slug: string; adminKey: string }> {
  // 型は Server Action 境界では保証されない（直接 POST できる）。実行時に必ず検証する。
  if (typeof input?.title !== "string" || !Array.isArray(input?.options)) {
    throw new Error("入力の形式が不正です");
  }
  const title = input.title.trim();
  const description =
    typeof input.description === "string" ? input.description.trim() || null : null;
  const labels = input.options
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // クライアントの maxLength と同じ上限をサーバ側でも検証する（フォームを経由しない
  // 直接 POST では maxLength が一切効かないため。ここが唯一の実効的な上限）。
  if (!title) throw new Error("タイトルは必須です");
  if (title.length > LIMITS.title) {
    throw new Error(`タイトルが長すぎます（最大 ${LIMITS.title} 文字）`);
  }
  if (description && description.length > LIMITS.description) {
    throw new Error(`説明が長すぎます（最大 ${LIMITS.description} 文字）`);
  }
  if (labels.length < 2) throw new Error("選択肢は 2 つ以上必要です");
  if (labels.length > LIMITS.options) {
    throw new Error(`選択肢が多すぎます（最大 ${LIMITS.options}）`);
  }
  if (labels.some((s) => s.length > LIMITS.label)) {
    throw new Error(`選択肢が長すぎます（最大 ${LIMITS.label} 文字）`);
  }
  // 締切（任意）。空なら null＝締切なし。過去・遠すぎる指定はここで弾く。
  const closeAt = normalizeCloseAt(input.closeAt);
  // 結果公開（任意）。空なら null＝締切と同時に公開。締切より前は弾く。
  const resultsOpenAt = normalizeResultsOpenAt(input.resultsOpenAt, closeAt);

  const adminKey = generateAdminKey();
  const admin_key_hash = hashAdminKey(adminKey);

  // slug の unique 衝突は採り直し（実質起きないが保険）。
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateSlug();
    const { data, error } = await admin()
      .from("poll")
      .insert({
        slug,
        title,
        description,
        require_captcha: input.requireCaptcha ?? false,
        show_live_count: input.showLiveCount ?? true,
        close_at: closeAt,
        results_open_at: resultsOpenAt,
        admin_key_hash,
        created_ip_hash: input.createdIpHash ?? null,
      })
      .select("id")
      .single();

    if (error) {
      // 23505 = unique_violation（slug 衝突）→ 採り直し
      if ((error as { code?: string }).code === "23505") continue;
      throw error;
    }

    const pollId = (data as { id: string }).id;
    const rows = labels.map((label, i) => ({
      poll_id: pollId,
      label,
      color: PALETTE[i % PALETTE.length],
      sort_order: i,
    }));
    const { error: oerr } = await admin().from("poll_option").insert(rows);
    if (oerr) throw oerr;
    return { slug, adminKey };
  }
  throw new Error("slug の採番に失敗しました。もう一度お試しください");
}

// ── 取得 ────────────────────────────────────────────────────────────────────

export async function getPollBySlug(slug: string): Promise<PollWithOptions | null> {
  const { data: poll, error } = await admin()
    .from("poll")
    .select(PUBLIC_COLS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!poll) return null;

  const { data: options, error: oerr } = await admin()
    .from("poll_option")
    .select("id, label, color, sort_order")
    .eq("poll_id", (poll as PublicPoll).id)
    .order("sort_order", { ascending: true });
  if (oerr) throw oerr;

  return { poll: poll as PublicPoll, options: (options as PollOption[]) ?? [] };
}

/** 管理キー検証用に admin_key_hash を含めて取得（サーバ内部のみ・クライアントへ渡さない）。 */
export async function getPollRowForAdmin(
  slug: string
): Promise<(PublicPoll & { admin_key_hash: string }) | null> {
  const { data, error } = await admin()
    .from("poll")
    .select(`${PUBLIC_COLS}, admin_key_hash`)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as (PublicPoll & { admin_key_hash: string }) | null) ?? null;
}

export async function getMyBallot(
  pollId: string,
  voterKey: string
): Promise<string[] | null> {
  const { data, error } = await admin()
    .from("ballot")
    .select("rankings")
    .eq("poll_id", pollId)
    .eq("voter_key", voterKey)
    .maybeSingle();
  if (error) throw error;
  return (data?.rankings as string[]) ?? null;
}

export async function getBallotCount(pollId: string): Promise<number> {
  const { count, error } = await admin()
    .from("ballot")
    .select("voter_key", { count: "exact", head: true })
    .eq("poll_id", pollId);
  if (error) throw error;
  return count ?? 0;
}

/** 集計への入力。個票の集合はサーバ内でのみ扱い、クライアントへ渡さない。 */
export async function getBallots(pollId: string): Promise<string[][]> {
  const PAGE = 1000;
  const out: string[][] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin()
      .from("ballot")
      .select("rankings")
      .eq("poll_id", pollId)
      .order("voter_key", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as { rankings: unknown }[];
    for (const r of rows) {
      if (Array.isArray(r.rankings)) {
        out.push(r.rankings.filter((x): x is string => typeof x === "string"));
      }
    }
    if (rows.length < PAGE) break;
  }
  return out;
}

// ── 受理・締切（原子的 RPC）─────────────────────────────────────────────────

/** 投票受理。単一 RPC（1 tx）。締切と直列化される（supabase/migrations の submit_ballot）。 */
export async function submitBallot(
  pollId: string,
  voterKey: string,
  rankings: string[]
): Promise<SubmitResult> {
  const { data, error } = await admin().rpc("submit_ballot", {
    p_poll_id: pollId,
    p_voter_key: voterKey,
    p_rankings: rankings,
  });
  if (error) throw error;
  return data as SubmitResult;
}

/** 締切。行ロックで受理と直列化し、締切後の票が入らないことを保証する。 */
export async function closePoll(pollId: string): Promise<boolean> {
  const { data, error } = await admin().rpc("close_poll", { p_poll_id: pollId });
  if (error) throw error;
  return data as boolean;
}

/** close_at を過ぎていれば締切る（遅延クローズ）。到達後は submit_ballot が既に受理を拒否
 *  しているので、結果表示の直前にここで status を確定させて不変スナップショットを作れる。 */
export async function ensureClosedIfDue(poll: PublicPoll): Promise<PollStatus> {
  if (poll.status === "closed") return "closed";
  if (poll.close_at && new Date(poll.close_at).getTime() <= Date.now()) {
    await closePoll(poll.id);
    return "closed";
  }
  return "open";
}

/**
 * 結果公開を「いま」に前倒しする（管理ページの「いま結果を公開する」）。
 *
 * 予約した公開時刻より早く発表したくなる場面（配信の進行が前後した等）のための操作。
 * 締切そのものは動かさない（受付の締切と結果公開は別）。
 */
export async function publishResultsNow(pollId: string): Promise<void> {
  const { error } = await admin()
    .from("poll")
    .update({ results_open_at: new Date().toISOString() })
    .eq("id", pollId);
  if (error) throw error;
}

// ── 集計 ────────────────────────────────────────────────────────────────────

export type ResolvedResult = {
  result: RcvTallyResult;
  ballotCount: number;
  /** false = 締切後の確定スナップショット、true = 受付中の途中経過（暫定）。 */
  live: boolean;
};

/**
 * 締切後の確定結果。snapshot が無ければ締切後の不変データから計算して poll_result に
 * 保存する（tallyRcv は決定的なので冪等）。まだ受付中なら null。
 */
export async function getFinalResult(poll: PublicPoll): Promise<ResolvedResult | null> {
  const status = await ensureClosedIfDue(poll);
  if (status !== "closed") return null;

  const { data: snap } = await admin()
    .from("poll_result")
    .select("result, ballot_count")
    .eq("poll_id", poll.id)
    .maybeSingle();
  if (snap) {
    return {
      result: snap.result as RcvTallyResult,
      ballotCount: (snap as { ballot_count: number }).ballot_count,
      live: false,
    };
  }

  const { result, ballotCount } = await computeResult(poll.id);
  await admin()
    .from("poll_result")
    .upsert(
      { poll_id: poll.id, result, ballot_count: ballotCount },
      { onConflict: "poll_id" }
    );
  return { result, ballotCount, live: false };
}

/** 受付中の途中経過（show_live_count のときだけ画面に出す。保存しない・暫定）。 */
export async function getLiveResult(poll: PublicPoll): Promise<ResolvedResult> {
  const { result, ballotCount } = await computeResult(poll.id);
  return { result, ballotCount, live: true };
}

async function computeResult(
  pollId: string
): Promise<{ result: RcvTallyResult; ballotCount: number }> {
  const { data: opts } = await admin()
    .from("poll_option")
    .select("id, sort_order")
    .eq("poll_id", pollId)
    .order("sort_order", { ascending: true });
  const optionIds = ((opts as { id: string }[]) ?? []).map((o) => o.id);
  const ballots = await getBallots(pollId);
  // lotSeed = poll_id（同じ poll なら常に同じくじ順・監査可能）。
  const result = tallyRcv(ballots, optionIds, { lotSeed: pollId });
  return { result, ballotCount: ballots.length };
}

// ── 送信ログ（追記専用・best-effort）────────────────────────────────────────

export async function logSubmit(entry: {
  pollId: string | null;
  voterKey: string | null;
  rankings: unknown;
  result: string;
  verification: string;
  ipHash: string | null;
  userAgent: string | null;
}): Promise<void> {
  try {
    const { error } = await admin().from("submit_log").insert({
      poll_id: entry.pollId,
      voter_key: entry.voterKey,
      rankings: entry.rankings,
      result: entry.result,
      verification: entry.verification,
      ip_hash: entry.ipHash,
      user_agent: entry.userAgent,
    });
    if (error) console.error("submit_log insert failed:", error.message);
  } catch (e) {
    console.error("submit_log insert failed:", e);
  }
}
