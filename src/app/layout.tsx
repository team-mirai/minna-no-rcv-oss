import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { BrandLockup } from "@/components/Brand";
import { siteUrl } from "@/lib/siteUrl";

const DESCRIPTION =
  "誰でも優先順位付投票（Ranked Choice Voting）を無料で開催できるツール。アカウント不要、候補を並べるだけ。開票のドラマつきで結果発表。";

/** ソースコード（AGPL-3.0 第13条：ネットワーク越しの利用者にソース取得の機会を提供する）。 */
const SOURCE_URL = "https://github.com/team-mirai/minna-no-rcv-oss";

/**
 * SNS シェア時のカード（OGP）について。
 *
 * openGraph / twitter に title・description をあえて書いていないのは、Next が
 * 「og に無ければ、テンプレート適用後の title / description を流し込む」ため
 * （resolve-metadata の inheritFromMetadata）。ここに書くと逆に各ページの
 * title が og に伝わらなくなるので、各ページは title と description だけ書けばよい。
 *
 * 同じ理由で、子ページでは openGraph オブジェクトを定義しないこと。定義すると
 * この階層の openGraph は丸ごと置き換わり、siteName / type / locale が消える。
 *
 * 画像は opengraph-image.tsx（ファイル規約）が階層ごとに面倒を見る。
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "みんなのRCV — 順位で選ぶ、票割れしない投票",
    template: "%s — みんなのRCV",
  },
  description: DESCRIPTION,
  applicationName: "みんなのRCV",
  // "./" は「今いるパス」に解決される（ページごとに正しい URL になる）。
  alternates: { canonical: "./" },
  openGraph: {
    type: "website",
    siteName: "みんなのRCV",
    locale: "ja_JP",
    url: "./",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#30BCA7",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700;900&family=Poppins:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-white">
        <header className="sticky top-0 z-40 border-b border-tm-border-soft bg-white/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[560px] items-center justify-between px-[18px] py-2.5">
            <Link href="/" className="no-underline text-tm-black">
              <BrandLockup />
            </Link>
            <Link
              href="/new"
              className="inline-flex items-center gap-1.5 rounded-full bg-tm-teal px-4 py-2 text-[13px] font-bold tracking-[0.04em] text-white transition-[background-color,transform] duration-150 ease-out hover:bg-tm-teal-hover active:scale-[0.96]"
            >
              投票をつくる
            </Link>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-tm-border-soft bg-tm-gray-50">
          <div className="mx-auto w-full max-w-[560px] px-[18px] py-5 text-center text-[12.5px] leading-[1.8] text-tm-fg-muted">
            <p className="m-0">
              みんなのRCV は、優先順位付投票を誰でも開催できる無料ツール（プロトタイプ）です。
            </p>
            <p className="m-0 mt-2">
              <Link
                href="/terms"
                className="text-tm-teal-deep underline underline-offset-2"
              >
                利用規約・プライバシー
              </Link>
              <span className="mx-2" aria-hidden>
                ·
              </span>
              <a
                href="mailto:support@team-mir.ai?subject=%5B%E3%81%BF%E3%82%93%E3%81%AA%E3%81%AERCV%5D%20%E9%80%9A%E5%A0%B1%E3%83%BB%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B"
                className="text-tm-teal-deep underline underline-offset-2"
              >
                通報・お問い合わせ
              </a>
              <span className="mx-2" aria-hidden>
                ·
              </span>
              {/* AGPL-3.0 第13条。フォークして自前ホストする人がここを差し替えられるよう、
                  URL は SOURCE_URL 一箇所にまとめてある。 */}
              <a
                href={SOURCE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-tm-teal-deep underline underline-offset-2"
              >
                ソースコード
              </a>
            </p>
            {/* 提供者の帰属はヘッダーに出さずフッターに留める。 */}
            <p className="m-0 mt-4 font-[family-name:var(--tm-font-latin)] text-[11px] font-semibold tracking-[0.08em] text-tm-gray-500">
              Powered by <span className="text-tm-teal-hover">チームみらい</span>
            </p>
            <p className="m-0 text-[10.5px] text-tm-fg-faint">
              RCVを社会に広める活動の一環として、無料で提供しています。
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
