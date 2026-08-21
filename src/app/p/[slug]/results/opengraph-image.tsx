import { OG_CONTENT_TYPE, OG_SIZE, ogPollTitle, renderOgImage } from "@/features/og/card";

/**
 * 結果ページの OG 画像。1位は出さない（結果はページを開いて、開票の経過つきで
 * 見てもらう。カードでネタバレさせない）。
 */
export const alt = "みんなのRCV の結果発表";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// お題は不変で、1位も載せていないので生成結果を使い回せる（/p/[slug]/opengraph-image.tsx 参照）。
export const revalidate = 3600;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const title = await ogPollTitle(slug);

  return renderOgImage({
    eyebrow: "結果発表",
    title: title ?? "投票の結果発表",
    lead: "ラウンドごとの除外と、票の移動。開票の経過を最初から再生します。",
  });
}
