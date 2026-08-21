import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/features/og/card";

export const alt = "開票デモ — みんなのRCV";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "開票デモ",
    title: "開票のドラマを、体験する。",
    lead: "サンプルデータで、RCV（優先順位付投票）の結果発表をそのまま再生します。登録も準備も不要です。",
  });
}
