import type { Metadata } from "next";
import { tallyRcv } from "@/features/rcv/tally";
import {
  DEMO_RCV_LOT_SEED,
  DEMO_RCV_OPTIONS,
  DEMO_RCV_TITLE,
  demoRcvBallots,
} from "@/features/rcv/presenter/demo";
import { RcvResultsPresenter } from "@/features/rcv/presenter/RcvResultsPresenter";

export const metadata: Metadata = {
  title: "開票デモ",
  description: "RCV（優先順位付投票）の開票発表を、サンプルデータで体験できます。",
};

/**
 * 開票プレゼンのデモ（DB非依存・サンプル票束）。
 * サンプル票束を本番と同じ tallyRcv に通して再生する（数字のハードコード禁止の原則を
 * デモでも守る）。全スライドに「サンプルデータ」バッジが出る。
 */
export default function DemoPage() {
  const tally = tallyRcv(
    demoRcvBallots(),
    DEMO_RCV_OPTIONS.map((o) => o.id),
    { lotSeed: DEMO_RCV_LOT_SEED }
  );
  return (
    <RcvResultsPresenter title={DEMO_RCV_TITLE} options={DEMO_RCV_OPTIONS} tally={tally} demo />
  );
}
