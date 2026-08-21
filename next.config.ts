import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content-Security-Policy。
 *
 * script-src に 'unsafe-inline' が残っているのは、App Router が RSC のフライトデータを
 * インライン <script> で埋め込むため（外すには middleware で nonce を配る必要がある）。
 * このアプリは dangerouslySetInnerHTML / eval を一切使わず、ユーザー入力はすべて React の
 * 既定エスケープを通るので XSS の主戦場は元々狭い。ここで効かせたいのはむしろ
 * frame-ancestors（クリックジャッキング）・base-uri・form-action・object-src の方。
 * 将来 nonce 方式へ移すときに 'unsafe-inline' を落とす。
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:", // data: は管理ページの QR コード（qrcode の DataURL）
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  // このアプリはフル BFF（service_role のみ）で、ブラウザからの Supabase 直叩きは無い。

  // バージョン特定の手がかりを減らす（x-powered-by: Next.js を出さない）。
  poweredByHeader: false,

  // OG 画像生成（next/og）が process.cwd() 経由で読む日本語フォントは、静的解析では
  // 依存として辿れない。明示しないと本番バンドルに入らず、OG 画像が 500 になる。
  outputFileTracingIncludes: {
    "/**": ["./assets/fonts/**"],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          // frame-ancestors を解さない古いブラウザ向けの保険。
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // 管理 URL は ?key=... を含むので、外部へは origin までしか送らない。
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
