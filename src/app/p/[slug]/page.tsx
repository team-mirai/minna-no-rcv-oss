import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPollBySlug, getMyBallot, getBallotCount } from "@/server/polls";
import { readVoterKey } from "@/lib/voter";
import { formatCloseAt } from "@/lib/closeAt";
import { RcvExplainer } from "@/components/RcvExplainer";
import VoteClient from "./VoteClient";
import {
  Clock,
  HandTap,
  ListNumbers,
  Users,
} from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

/**
 * poll の URL は「知っている人だけが開く」前提の非公開リンク。検索インデックスに載ると、
 * 身内のお題が検索に出たり、不適切な poll が検索結果でドメインごと提供者に紐づいたりする。
 * /p/ 配下は robots.txt で遮断せず noindex を返す（遮断するとこのメタを読ませられない）。
 */
const NOINDEX = { index: false, follow: false } as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const found = await getPollBySlug(slug);
  if (!found) return { robots: NOINDEX };
  return {
    title: found.poll.title,
    description: `「${found.poll.title}」に投票しよう。候補を良い順に並べるだけ（優先順位付投票）。`,
    robots: NOINDEX,
  };
}

export default async function VotePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const found = await getPollBySlug(slug);
  if (!found) notFound();

  const { poll, options } = found;

  const closedByTime = poll.close_at && new Date(poll.close_at).getTime() <= Date.now();
  if (poll.status === "closed" || closedByTime) {
    redirect(`/p/${slug}/results`);
  }

  const voterKey = await readVoterKey();
  const myBallot = voterKey ? await getMyBallot(poll.id, voterKey) : null;
  const ballotCount = poll.show_live_count ? await getBallotCount(poll.id) : null;

  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-col gap-3.5 px-[18px] py-5 pb-16">
      {/* ── タイトル＋メタ行 ──── */}
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-3 px-0.5">
          <span className="inline-flex items-center gap-[5px] rounded-full bg-tm-teal-100 px-3 py-1 text-[13px] font-semibold text-tm-teal-deep">
            <HandTap size={14} />
            投票受付中
          </span>
          {ballotCount !== null && ballotCount > 0 && (
            <span className="inline-flex items-center gap-[5px] text-[13.5px] text-tm-fg-muted">
              <Users size={14} className="text-tm-teal-hover" />
              {ballotCount.toLocaleString()}人が投票済み
            </span>
          )}
          {poll.close_at && (
            <span className="inline-flex items-center gap-[5px] text-[13.5px] text-tm-fg-muted">
              <Clock size={14} className="text-tm-teal-hover" />
              {formatCloseAt(poll.close_at)} まで
            </span>
          )}
        </div>
      </div>

      {/* ── テーマヒーロー（ミントカード）──── */}
      <div className="relative flex flex-col gap-3 overflow-hidden rounded-[16px] bg-tm-teal-100 px-4 py-[18px]">
        <div className="pointer-events-none absolute -right-3.5 -top-3.5 h-24 w-24 rounded-full bg-tm-teal-200 opacity-50" />
        <div className="pointer-events-none absolute right-5 -bottom-[18px] h-[52px] w-[52px] rounded-full bg-tm-teal-200 opacity-45" />
        <div className="relative flex items-start gap-3.5">
          <div className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-[14px] bg-white shadow-[var(--tm-shadow-card)]">
            <ListNumbers size={30} className="text-tm-teal" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
            <span className="text-[13px] font-bold tracking-[0.06em] text-tm-teal-deep">お題</span>
            <b
              className="font-[family-name:var(--tm-font-jp-display)] text-[21px] leading-[1.4] tracking-[0.02em]"
              style={{ fontWeight: 900 }}
            >
              {poll.title}
            </b>
          </div>
        </div>
        {poll.description && (
          <span className="relative whitespace-pre-wrap text-[14px] leading-[1.75] text-tm-teal-deep">
            {poll.description}
          </span>
        )}
      </div>

      {/* ── RCV 説明（折りたたみ・デフォルト閉）──── */}
      <RcvExplainer />

      {/* ── 「あなたの投票」ミント箱 ──── */}
      <VoteClient
        slug={slug}
        options={options}
        submittedRankings={myBallot}
        showLiveCount={poll.show_live_count}
      />
    </main>
  );
}
