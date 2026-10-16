/** 未設定時の GA4 測定 ID。本番はこの値で計測できる。 */
export const DEFAULT_GA_MEASUREMENT_ID = "G-7WCR569WS3";

/**
 * `NEXT_PUBLIC_GA_MEASUREMENT_ID`。空なら既定の測定 ID。
 * タグ自体は `VERCEL_ENV === "production"` のときだけ描画する。
 */
export function gaMeasurementId(
  fromEnv: string | undefined = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
): string {
  const value = fromEnv?.trim();
  return value ? value : DEFAULT_GA_MEASUREMENT_ID;
}

/** `/admin` とその配下。計測対象から外す。 */
export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * gtag を出す条件。本番かつ管理画面以外。
 * cookie_domain はアプリ側では設定しない（gtag の config は測定 ID のみ）。
 */
export function shouldLoadGoogleAnalytics(
  vercelEnv: string | undefined,
  pathname: string,
): boolean {
  return vercelEnv === "production" && !isAdminPath(pathname);
}
