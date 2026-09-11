/**
 * 受付中の途中経過を公開の結果ページへ渡すときの伏せ字。
 *
 * 結果ページ（ResultsView）の受付中の分岐は rounds[0].snap と order しか描画していないが、
 * Server Component から Client Component へ渡した props は RSC のフライトデータとして
 * HTML に載るため、描画していなくても DevTools から読める。全ラウンドぶんの集計を渡すと
 * 受付中に次が読めてしまう。
 *
 * - 暫定勝者（rounds[n].winner）
 * - 除外された候補と票の移動先（elim / transfers / elimRound）
 * - 順位切れの累計（exhausted）
 *
 * これは画面に出している「順位の移し替え（RCVの決選）は締切後に確定します」という説明と
 * 食い違う。加えて RCV の売りは「戦略投票をしなくて済む」ことなので、受付中に暫定勝者が
 * 読めると前提が崩れ、しかも DevTools を開ける人だけが有利になる情報の非対称が生まれる。
 * 1位票の首位と最終勝者が入れ替わる場面（RCV が一番価値を出す場面）ほど差が効く。
 *
 * 対策は「画面に出さない」ではなく「そもそもクライアントへ送らない」。
 */

import type { RcvTallyResult } from "./tally";

/**
 * 集計結果を「第1ラウンドの1位票だけ」に落とす。
 *
 * 第1ラウンドは定義上 elim / transfers / exhausted が空なので、落とす必要があるのは
 * winner（第1ラウンドで過半数に届くと埋まる）と、後続ラウンド由来の elimRound・maxV。
 */
export function firstRoundOnly(result: RcvTallyResult): RcvTallyResult {
  const r1 = result.rounds[0];
  let maxV = 0;
  for (const id of Object.keys(r1.snap)) maxV = Math.max(maxV, r1.snap[id]);
  return {
    // 第1ラウンドで決着していても勝者は伏せる（暫定勝者を送らない）。
    rounds: [{ ...r1, winner: null }],
    total: result.total,
    order: result.order,
    elimRound: {},
    // バーのスケールは第1ラウンドの最大値で足りる（後続ラウンドの票数を渡さない）。
    maxV,
  };
}
