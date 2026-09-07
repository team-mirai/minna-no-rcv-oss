import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getPollBySlug,
  getPollRowForAdmin,
  ensureClosedIfDue,
  getFinalResult,
  getLiveResult,
} from "@/server/polls";
import { verifyAdminKey } from "@/lib/adminKey";
import { formatCloseAt, isResultsOpen, resolvePresentMode } from "@/lib/closeAt";
import { RcvResultsPresenter } from "@/features/rcv/presenter/RcvResultsPresenter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "結果発表（プレゼンモード）",
  // /p/ 配下は非公開リンク前提（/p/[slug]/page.tsx 参照）。
  robots: { index: false, follow: false },
};

function firstParam(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/**
 * 結果発表のプレゼンモード（16:9投影・全画面）。
 *
 * - 参加者は締切後・結果公開後のみ。それまでは待機画面を出す（締切前の暫定を映さない・
 *   発表の驚きを保つ、という 移植元アプリの会場スクリーンと同じ判断）。
 * - 主催者（?key= に管理キーを付けて開いた人）はいつでも開ける。結果公開の前に会場・配信で
 *   こちらから発表するには、参加者に見せないまま主催者だけが開票を映せる必要があるため。
 *   受付中に開いた場合は暫定（途中経過）である旨をバッジで明示する。
 * - 集計はサーバ側で実行し、クライアントへは Tally だけを渡す（生の個票は送らない）。
 * - 進行はクリック / ← → Space / Home / P（自動再生）。
 */
export default async function PresentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ key?: string | string[] }>;
}) {
  const { slug } = await params;
  const key = firstParam((await searchParams).key);

  const found = await getPollBySlug(slug);
  if (!found) notFound();
  const { poll, options } = found;

  // 管理キーが付いているときだけハッシュを引く（通常の閲覧に余計なクエリを足さない）。
  let isAdmin = false;
  if (key) {
    const row = await getPollRowForAdmin(slug);
    isAdmin = verifyAdminKey(key, row?.admin_key_hash ?? "");
  }

  const status = await ensureClosedIfDue(poll);
  const publiclyOpen = isResultsOpen(status, poll.results_open_at);
  const mode = resolvePresentMode(status, poll.results_open_at, isAdmin);

  if (mode === "standby") {
    // 締切済みで公開待ち（結果公開の時刻を別に決めてある）か、まだ受付中か。
    const waitingForPublish = status === "closed";
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
          <div className="text-6xl font-bold text-[#cbd5e1]">
            {waitingForPublish ? "まもなく結果発表" : "投票受付中"}
          </div>
          <p className="text-3xl font-semibold text-[#64748b]">
            {waitingForPublish
              ? `${poll.results_open_at ? `${formatCloseAt(poll.results_open_at)} に` : ""}結果を公開します（管理ページから前倒しもできます）`
              : "締め切ると、ここで結果発表が始まります（管理ページから締め切れます）"}
          </p>
        </div>
      </main>
    );
  }

  const resolved = mode === "live" ? await getLiveResult(poll) : await getFinalResult(poll);
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

  // 主催者だけが見えている状態は画面で明示する（配信・投影中の取り違えを防ぐ）。
  const notice = publiclyOpen
    ? undefined
    : mode === "live"
      ? "途中経過（暫定）・主催者のみ"
      : "結果公開前・主催者のみ";

  return (
    <>
      <RcvResultsPresenter
        title={poll.title}
        options={options.map((o) => ({ id: o.id, label: o.label }))}
        tally={resolved.result}
      />
      {notice && (
        // プレゼンターの上に重ねる（16:9カードの外＝黒帯側に出るので演出を壊さない）。
        // pointer-events-none: プレゼンはクリックで進むので、バッジがクリックを食わないようにする。
        <span className="pointer-events-none fixed right-4 top-3 z-[60] rounded-full bg-[var(--tm-yellow,#facc15)] px-3 py-1 text-[13px] font-bold text-black shadow">
          {notice}
        </span>
      )}
    </>
  );
}
