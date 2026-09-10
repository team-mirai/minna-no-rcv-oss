# SNS シェア（OGP）

チャットや SNS に URL を貼ったときのカードは、`next/og` で毎回サーバ描画している
（画像アセットを持たない＝文言を変えてもデザイナー往復が要らない）。

- 絵づくりは `src/features/og/card.tsx` 一箇所。各 `opengraph-image.tsx` は
  「ラベル・見出し・説明」を渡すだけ。
- 見出し（`og:title`）と説明は、各ページの `metadata.title` / `description` が
  そのまま流れ込む。ページ側で `openGraph` オブジェクトは**定義しないこと**
  （定義するとルートの `siteName` / `type` / `locale` が丸ごと消える）。詳細は
  `src/app/layout.tsx` のコメント。
- `/p/<slug>` と `/p/<slug>/results` は、お題をカード画像にも焼き込む。DB が引けなくても
  汎用カードに倒して画像は必ず出す（`ogPollTitle`）。
- 日本語は `assets/fonts/` のサブセットフォントで描く。`next.config.ts` の
  `outputFileTracingIncludes` で本番バンドルに同梱している（外すと本番だけ 500）。
- 独自ドメインが決まったら `NEXT_PUBLIC_SITE_URL` を設定する（`src/lib/siteUrl.ts`）。
  未設定でも Vercel の環境変数から自動で決まる。

確認は `npm run dev` して、`curl -o og.png localhost:3000/opengraph-image` で PNG を
直接叩くのが早い。
