import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/features/og/card";

export const alt = "投票をつくる — みんなのRCV";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "投票をつくる",
    title: "お題と選択肢を入れるだけ。",
    lead: "アカウント登録は不要。参加URLと、あなただけの管理URLがその場で発行されます。",
  });
}
