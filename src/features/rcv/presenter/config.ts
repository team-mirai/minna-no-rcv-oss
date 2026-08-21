/**
 * RCV結果発表プレゼンテーションの演出パラメータと文言。
 * （移植元アプリの features/rcv-results/config.ts の移植・文言を汎用化）
 */

export type RcvResultsConfig = {
  /** バー伸縮アニメーションの時間（秒）。 */
  barSpeedSec: number;
  /** ラウンド演出の第1フェーズ（除外発表）から票移動までの間（ms）。 */
  elimDwellMs: number;
  /** 第1ラウンドだけは除外発表が無いので短い間で開票する（ms）。 */
  round1DwellMs: number;
  /** 自動再生時のスライド送り間隔（ms）。 */
  autoIntervalMs: number;
  /** 勝者決定スタンプを出すまでの追加ディレイ（ms）。バー到達を見せてから押す。 */
  winnerStampDelayMs: number;

  /** 決定スライドの見出し（勝者名の上）。 */
  closingKicker: string;
  /** 決定スライドの結び（勝者名の下）。 */
  closingNote: string;
};

export const DEFAULT_RCV_RESULTS_CONFIG: RcvResultsConfig = {
  barSpeedSec: 0.9,
  elimDwellMs: 1600,
  round1DwellMs: 140,
  autoIntervalMs: 4200,
  winnerStampDelayMs: 450,

  closingKicker: "みんなで順位をつけて選んだ結果",
  closingNote: "投票ありがとうございました！",
};
