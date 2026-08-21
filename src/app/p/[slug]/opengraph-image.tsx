import { OG_CONTENT_TYPE, OG_SIZE, ogPollTitle, renderOgImage } from "@/features/og/card";

/**
 * 投票ページの OG 画像。お題を画像にも焼き込む（チャットに貼ったとき、何の投票かが
 * 一目で分かるように）。
 *
 * ここは /p/ 配下の既定になるので、manage / present から共有された場合も同じ絵が出る。
 * /p/ の URL 自体が「知っている人だけが開く」非公開リンクなので、URL を持っていない人に
 * お題が漏れることはない（ページ本文は noindex。/p/[slug]/page.tsx のコメント参照）。
 */
export const alt = "みんなのRCV の投票";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/**
 * お題は作成後に変更できない（server/polls.ts の更新系は close_poll と submit_ballot だけ）
 * ので、生成した PNG は使い回してよい。クローラは同じ URL を何度も叩くうえ、1枚あたり
 * 2.4MB のフォント読み込み + satori のラスタライズが走るため、都度生成は割に合わない。
 */
export const revalidate = 3600;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const title = await ogPollTitle(slug);

  return renderOgImage({
    eyebrow: "投票を受付中",
    title: title ?? "投票に参加しよう",
    lead: "候補を良い順に並べるだけ。優先順位付投票（RCV）で、みんなが納得できる結論を探します。",
  });
}
