import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/features/og/card";

// このファイルは配下の全ルートの既定の OG 画像になる（/new・/demo・/p/... は各自で上書き）。
export const alt = "みんなのRCV — 順位で選ぶ、票割れしない投票";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "無料・アカウント不要",
    title: "みんなの納得で、決めよう。",
    lead: "旅行先も、打ち上げの店も。候補を良い順に並べるだけの優先順位付投票（RCV）を、誰でもすぐ開催できます。",
  });
}
