import Link from "next/link";
import { ChartBar, HandTap, LinkSimple, ListNumbers } from "@phosphor-icons/react/dist/ssr";
import { BokehBackdrop } from "@/components/BokehBackdrop";
import { HeroCta, LiveTallyDemo } from "@/features/top/LiveTallyDemo";
import { WhyRcvStory } from "@/features/top/WhyRcvStory";

/**
 * トップページ。
 *
 * 見た目の正: デザイン案「みんなのRCVトップ v3 背景つき」。
 * ファーストビューは「言葉で説明する」のをやめ、18秒で1周する開票デモ
 * （LiveTallyDemo）に語らせる。仕組みの説明は下の Why RCV セクションに送った。
 *
 * FV だけ背景を全幅に敷くため、シェル側の横パディングに乗らず
 * セクションごとに max-width コンテナを持つ構成にしている。
 */

/** 各セクションの内側幅。ヘッダー・フッターの max-w-[560px] と揃える。 */
const CONTAINER = "mx-auto w-full max-w-[560px]";

const STEPS = [
  {
    icon: <ListNumbers size={22} className="text-tm-teal" />,
    n: 1,
    title: "お題と選択肢を入れてつくる",
    body: "アカウント登録は不要。参加URLと、あなただけの管理URLが発行されます。",
  },
  {
    icon: <LinkSimple size={22} className="text-tm-teal" />,
    n: 2,
    title: "参加URLを配る",
    body: "チャットに貼るだけ。参加者は候補を良い順にタップ＆ドラッグで並べて投票（受付中は何度でも変更OK）。",
  },
  {
    icon: <ChartBar size={22} className="text-tm-teal" />,
    n: 3,
    title: "締め切って、結果発表",
    body: "最下位の除外と票の移動をラウンドごとに再生する「開票のドラマ」つき。スクリーン投影用のプレゼンモードも。",
  },
];

export default function Home() {
  return (
    <main className="flex flex-col">
      {/* ── ファーストビュー ──── */}
      <section className="relative overflow-hidden">
        <BokehBackdrop />
        {/* 本文が乗るカラムにだけ白を薄く重ねてコントラストを確保する。
            カラムの外は背景がそのまま出て、広い画面ほど色が見える。 */}
        <div className="relative">
          <div className={`${CONTAINER} bg-white/[0.42] px-6 pb-9 pt-[38px]`}>
            <div className="text-center font-[family-name:var(--tm-font-jp-display)] text-[14.5px] font-black leading-[1.8] tracking-[0.1em]">
              旅行先も、打ち上げの店も。
            </div>
            <h1 className="mt-1.5 text-center font-[family-name:var(--tm-font-jp-display)] text-[31px] font-black leading-[1.75] tracking-[0.05em]">
              みんなの
              <span className="relative">
                納得
                {/* 「納得」に打つ圏点 */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-2 left-0 right-0 flex justify-around"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-tm-teal" />
                  <span className="h-1.5 w-1.5 rounded-full bg-tm-teal" />
                </span>
              </span>
              で
              <br />
              決めよう。
            </h1>
            <p className="mb-6 mt-3.5 text-center text-[12px] leading-[2] tracking-[0.06em] text-tm-gray-600">
              なるべく皆が納得できる答えを探す、
              <span
                className="font-bold"
                style={{
                  background:
                    "linear-gradient(transparent 58%, var(--tm-teal-soft) 58%, var(--tm-teal-soft) 94%, transparent 94%)",
                }}
              >
                あたらしい決め方
              </span>
              。
            </p>

            <LiveTallyDemo />
            <HeroCta />
          </div>
        </div>
      </section>

      {/* ── セカンドビュー：Why RCV? ──── */}
      <div className={CONTAINER}>
        <WhyRcvStory />
      </div>

      {/* ── 使い方 3ステップ ──── */}
      <div className={`${CONTAINER} flex flex-col gap-2.5 px-6 pb-10`}>
        <b className="px-0.5 text-[15px] tracking-[0.04em]">使い方はかんたん</b>
        <div className="flex flex-col gap-2">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="flex items-start gap-3.5 rounded-[14px] border border-tm-border-soft bg-white p-4"
            >
              <div className="relative flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[12px] bg-tm-teal-100">
                {s.icon}
                <span className="absolute -left-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-tm-teal font-[family-name:var(--tm-font-latin)] text-[11px] font-bold text-white">
                  {s.n}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <b className="text-[14.5px]">{s.title}</b>
                <span className="text-[13px] leading-[1.75] text-tm-fg-muted">{s.body}</span>
              </div>
            </div>
          ))}
        </div>

        <p className="m-0 mt-1 text-[13px] leading-[1.8] text-tm-fg-muted">
          飲み会のお店選び、チーム名決め、イベントの企画選び、コンテストの審査に。はじめての人は
          <Link href="/demo" className="mx-1 text-tm-teal-deep underline underline-offset-2">
            開票デモ
          </Link>
          から。
        </p>
      </div>

      {/* ── 注意（信頼モデル） ──── */}
      <div className={`${CONTAINER} px-6 pb-16`}>
        <p className="m-0 flex items-start justify-center gap-1.5 text-center text-[12.5px] leading-[1.8] text-tm-fg-muted">
          <HandTap size={15} className="mt-0.5 flex-none" />
          <span>
            本人確認をしないゆるい一意性（1ブラウザ1票）のプロトタイプです。
            正式な選挙・議決には使えません。
          </span>
        </p>
      </div>
    </main>
  );
}
