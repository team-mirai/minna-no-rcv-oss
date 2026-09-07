import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getPollBySlug,
  ensureClosedIfDue,
  getFinalResult,
  getLiveResult,
} from "@/server/polls";
import { formatCloseAt, isResultsOpen } from "@/lib/closeAt";
import ResultsView from "./ResultsView";

// 集計は常に最新の票を反映させたいので毎回サーバで計算する。
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const found = await getPollBySlug(slug);
  // /p/ 配下は非公開リンク前提なので検索インデックスに載せない（/p/[slug]/page.tsx 参照）。
  if (!found) return { robots: { index: false, follow: false } };
  return {
    title: `結果: ${found.poll.title}`,
    description: `「${found.poll.title}」の優先順位付投票（RCV）の結果発表。開票のドラマつき。`,
    robots: { index: false, follow: false },
  };
}

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const found = await getPollBySlug(slug);
  if (!found) notFound();
  const { poll, options } = found;

  const status = await ensureClosedIfDue(poll);

  // 締切済みでも、結果公開の時刻までは結果を見せない（締切＝受付の終了、結果公開＝発表）。
  // 待機画面では集計を一切呼ばない。画面に出さないだけでは、Server → Client の props が
  // RSC のフライトデータとして HTML に載り、DevTools から読めてしまうため。
  if (status === "closed" && !isResultsOpen(status, poll.results_open_at)) {
    return (
      <main className="mx-auto flex w-full max-w-[560px] flex-col gap-3.5 px-[18px] py-5 pb-16">
        <b
          className="font-[family-name:var(--tm-font-jp-display)] text-[22px] leading-[1.4]"
          style={{ fontWeight: 900 }}
        >
          {poll.title}
        </b>
        <div className="rounded-[14px] bg-tm-teal-100 px-4 py-3.5 text-[14px] leading-[1.75] text-tm-teal-deep">
          投票は締め切りました。結果は
          {poll.results_open_at && ` ${formatCloseAt(poll.results_open_at)} に`}
          発表されます。もう少しお待ちください。
        </div>
      </main>
    );
  }

  if (status !== "closed" && !poll.show_live_count) {
    return (
      <main className="mx-auto flex w-full max-w-[560px] flex-col gap-3.5 px-[18px] py-5 pb-16">
        <b
          className="font-[family-name:var(--tm-font-jp-display)] text-[22px] leading-[1.4]"
          style={{ fontWeight: 900 }}
        >
          {poll.title}
        </b>
        <div className="rounded-[14px] bg-tm-teal-100 px-4 py-3.5 text-[14px] leading-[1.75] text-tm-teal-deep">
          この投票は受付中です。結果は締切後に、開票の経過つきで発表されます。
          {poll.close_at && `締切は ${formatCloseAt(poll.close_at)} です。`}
          {poll.results_open_at &&
            `結果の発表は ${formatCloseAt(poll.results_open_at)} です。`}
        </div>
        <a
          href={`/p/${slug}`}
          className="flex items-center justify-center gap-2 rounded-full bg-tm-teal px-4 py-3 text-[15px] font-bold text-white transition-colors hover:bg-tm-teal-hover"
        >
          投票ページへ
        </a>
      </main>
    );
  }

  const resolved =
    status === "closed" ? await getFinalResult(poll) : await getLiveResult(poll);

  if (!resolved) notFound();

  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-col gap-3.5 px-[18px] py-5 pb-16">
      <ResultsView
        slug={slug}
        title={poll.title}
        options={options}
        result={resolved.result}
        ballotCount={resolved.ballotCount}
        live={resolved.live}
      />
    </main>
  );
}
