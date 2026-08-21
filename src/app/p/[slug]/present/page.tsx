import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPollBySlug, ensureClosedIfDue, getFinalResult } from "@/server/polls";
import { RcvResultsPresenter } from "@/features/rcv/presenter/RcvResultsPresenter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "結果発表（プレゼンモード）",
  // /p/ 配下は非公開リンク前提（/p/[slug]/page.tsx 参照）。
  robots: { index: false, follow: false },
};

/**
 * 結果発表のプレゼンモード（16:9投影・全画面）。
 *
 * - 締切後のみ。受付中は待機画面を出す（締切前の暫定を映さない・発表の驚きを保つ、
 *   という 移植元アプリの会場スクリーンと同じ判断）。
 * - 集計はサーバ側で実行し、クライアントへは Tally だけを渡す（生の個票は送らない）。
 * - 進行はクリック / ← → Space / Home / P（自動再生）。
 */
export default async function PresentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const found = await getPollBySlug(slug);
  if (!found) notFound();
  const { poll, options } = found;

  const status = await ensureClosedIfDue(poll);
  if (status !== "closed") {
    return (
      <main className="fixed inset-0 z-50 flex min-h-screen flex-col bg-black px-12 py-10 text-white">
        <header className="mb-12 flex items-start justify-between gap-8 border-b border-white/10 pb-8">
          <div className="text-2xl font-semibold uppercase tracking-[0.2em] text-[#94a3b8]">
            優先順位付投票（RCV）— {poll.title}
          </div>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <span className="inline-flex items-center gap-3 rounded-full bg-white/5 px-6 py-3 text-2xl font-semibold uppercase tracking-widest text-[#94a3b8] ring-1 ring-inset ring-white/10">
            <span className="h-3 w-3 animate-pulse rounded-full bg-[#94a3b8]" />
            STANDBY
          </span>
          <div className="text-6xl font-bold text-[#cbd5e1]">投票受付中</div>
          <p className="text-3xl font-semibold text-[#64748b]">
            締め切ると、ここで結果発表が始まります（管理ページから締め切れます）
          </p>
        </div>
      </main>
    );
  }

  const resolved = await getFinalResult(poll);
  if (!resolved || resolved.ballotCount === 0) {
    return (
      <main className="fixed inset-0 z-50 flex min-h-screen flex-col items-center justify-center gap-6 bg-black text-center text-white">
        <div className="text-5xl font-bold text-[#cbd5e1]">有効票がありません</div>
        <a href={`/p/${slug}/results`} className="text-xl text-[#64748b] underline">
          結果ページへ戻る
        </a>
      </main>
    );
  }

  return (
    <RcvResultsPresenter
      title={poll.title}
      options={options.map((o) => ({ id: o.id, label: o.label }))}
      tally={resolved.result}
    />
  );
}
