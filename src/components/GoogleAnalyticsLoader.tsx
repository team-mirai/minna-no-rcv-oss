"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { isAdminPath } from "@/lib/googleAnalytics";

// サーバ HTML には出さない。静的な not-found は URL を知らないので、
// ここで SSR すると /admin の 404 まで gtag.js を preload してしまう。
const GoogleAnalytics = dynamic(
  () => import("@next/third-parties/google").then((mod) => mod.GoogleAnalytics),
  { ssr: false },
);

/**
 * ルートレイアウトが `VERCEL_ENV === "production"` のときだけ描画する。
 * cookie_domain は渡さない。gtag の config は測定 ID だけになる。
 * /admin ではマウントしない。
 */
export function GoogleAnalyticsLoader({ gaId }: { gaId: string }) {
  const pathname = usePathname();
  if (isAdminPath(pathname)) return null;
  return <GoogleAnalytics gaId={gaId} />;
}
