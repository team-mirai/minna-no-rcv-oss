/**
 * このサイトの絶対 URL（オリジンまで、末尾スラッシュなし）。
 *
 * OGP の `metadataBase` に使う。og:image は相対パスを許さない仕様なので、
 * ここが間違っていると SNS 側で画像が出ない（＝落ちずに静かに壊れる）種類の設定。
 *
 * 優先順位:
 *   1. NEXT_PUBLIC_SITE_URL … 独自ドメインが決まったらこれを入れる。常にこれが勝つ。
 *   2. 本番デプロイなら VERCEL_PROJECT_PRODUCTION_URL（プレビューから見ても本番ドメイン）
 *   3. プレビューデプロイなら VERCEL_URL（そのデプロイ固有のURL。プレビューの
 *      OG 画像がプレビュー自身を指すようにする）
 *   4. ローカル開発
 */
function normalize(raw: string): string {
  const withProtocol = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, "");
}

export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return normalize(explicit);

  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return normalize(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  }
  if (process.env.VERCEL_URL) return normalize(process.env.VERCEL_URL);

  return "http://localhost:3000";
}
