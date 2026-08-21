import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getPollBySlug } from "@/server/polls";

/**
 * SNS シェア用 OG 画像（1200×630）の共通レイアウト。
 *
 * 各ページの `opengraph-image.tsx` は「アイキャッチの一行・見出し・説明」を渡すだけで、
 * 絵づくりはここに集約する。デザインの正はトップページ（tm-teal 基調・角丸・順位バーの
 * モチーフ）。
 *
 * satori（next/og の描画エンジン）の制約に注意:
 *   - CSS 変数は解決されないので色はリテラルで書く（globals.css とは二重管理になる）
 *   - Grid は使えない。子が複数ある要素には必ず display:flex を明示する
 *   - フォントは自前で渡す。渡さないと日本語が全部豆腐になる
 */

const C = {
  teal: "#30BCA7",
  tealHover: "#089781",
  tealDeep: "#0F8472",
  tealSoft: "#64D8C6",
  teal200: "#BCECD3",
  teal100: "#E2F6F3",
  yellow: "#F7F741",
  black: "#000000",
  gray600: "#4C4C4C",
  gray500: "#666666",
  border: "#E5E5E5",
  white: "#FFFFFF",
} as const;

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

/** 画像内に出せるお題の上限。これを超えたら末尾を省略する（レイアウト崩れ防止）。 */
const TITLE_MAX = 64;

const FONT_PATH = join(process.cwd(), "assets", "fonts", "NotoSansJP-Bold-subset.ttf");

// 2.4MB のフォントをリクエストごとに読み直さない（同一 Lambda 内で使い回す）。
let fontPromise: Promise<Buffer> | null = null;
function loadFont(): Promise<Buffer> {
  fontPromise ??= readFile(FONT_PATH);
  return fontPromise;
}

/** 文字数に応じて見出しを詰める。日本語の全角前提のざっくり調整。 */
function titleFontSize(length: number): number {
  if (length <= 12) return 72;
  if (length <= 20) return 60;
  if (length <= 32) return 50;
  if (length <= 48) return 42;
  return 36;
}

function clampTitle(raw: string): string {
  // 改行はレイアウトを壊すだけなので潰す。
  const flat = raw.replace(/\s+/g, " ").trim();
  return flat.length > TITLE_MAX ? `${flat.slice(0, TITLE_MAX - 1)}…` : flat;
}

/** ブランドマーク（components/Brand.tsx の SVG を、CSS 変数なしで書き直したもの）。 */
function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="12" fill={C.teal} />
      <rect x="10" y="11" width="28" height="6" rx="3" fill={C.white} />
      <rect x="10" y="21" width="20" height="6" rx="3" fill={C.white} opacity="0.85" />
      <rect x="10" y="31" width="12" height="6" rx="3" fill={C.white} opacity="0.7" />
      <circle cx="36" cy="34" r="4" fill={C.yellow} stroke={C.black} strokeWidth="1.5" />
    </svg>
  );
}

export type OgCardProps = {
  /** 見出しの上に出す小さなラベル（例: 「投票を受付中」）。 */
  eyebrow: string;
  /** 主役の一行。お題タイトルなど。 */
  title: string;
  /** 見出しの下の補足。1〜2行に収まる長さで。 */
  lead: string;
};

function OgCard({ eyebrow, title, lead }: OgCardProps) {
  const shown = clampTitle(title);
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: "100%",
        height: "100%",
        backgroundColor: C.white,
        fontFamily: "Noto Sans JP",
        color: C.black,
      }}
    >
      {/* 背景の光（トップページの BokehBackdrop の名残） */}
      <div
        style={{
          position: "absolute",
          top: -260,
          right: -180,
          width: 760,
          height: 760,
          borderRadius: 9999,
          background:
            "radial-gradient(circle, rgba(48,188,167,0.32) 0%, rgba(48,188,167,0.10) 45%, rgba(48,188,167,0) 70%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -240,
          left: -140,
          width: 620,
          height: 620,
          borderRadius: 9999,
          background:
            "radial-gradient(circle, rgba(247,247,65,0.30) 0%, rgba(247,247,65,0) 70%)",
        }}
      />
      {/* 左端のティールのレール */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 14,
          height: "100%",
          background: `linear-gradient(180deg, ${C.teal} 0%, ${C.tealHover} 100%)`,
        }}
      />

      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "56px 76px 50px 92px",
        }}
      >
        {/* ── ロゴ ──── */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Mark size={54} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "baseline", fontSize: 29, letterSpacing: 1 }}>
              みんなのRCV
            </div>
            <div style={{ fontSize: 13, letterSpacing: 3.2, color: C.tealHover, marginTop: 4 }}>
              RANKED CHOICE VOTING
            </div>
          </div>
        </div>

        {/* ── 本文 ──── */}
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              backgroundColor: C.teal100,
              color: C.tealDeep,
              borderRadius: 9999,
              padding: "9px 24px",
              fontSize: 23,
              letterSpacing: 1.8,
            }}
          >
            {eyebrow}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 22,
              fontSize: titleFontSize(shown.length),
              lineHeight: 1.42,
              letterSpacing: 1,
            }}
          >
            {shown}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 20,
              maxWidth: 880,
              fontSize: 23,
              lineHeight: 1.7,
              color: C.gray600,
            }}
          >
            {lead}
          </div>
        </div>

        {/* ── フッター ──── */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            borderTop: `2px solid ${C.border}`,
            paddingTop: 24,
          }}
        >
          <div style={{ display: "flex", fontSize: 22, color: C.gray500, letterSpacing: 1 }}>
            順位で選ぶ、票割れしない投票。
          </div>
          {/* 順位バーのモチーフ（1位→3位） */}
          <div style={{ display: "flex", flexDirection: "column", gap: 7, paddingBottom: 2 }}>
            <div style={{ width: 118, height: 11, borderRadius: 6, backgroundColor: C.teal }} />
            <div style={{ width: 82, height: 11, borderRadius: 6, backgroundColor: C.tealSoft }} />
            <div style={{ width: 50, height: 11, borderRadius: 6, backgroundColor: C.teal200 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * OG 画像に載せるお題を引く。見つからない / DB が落ちている場合は null。
 *
 * OG 画像で例外を投げると 500 になり、SNS のカードから画像だけが消える（本文は出るので
 * 気づきにくい）。ここでは常に「絵は出す」を優先し、お題なしの汎用カードへ倒す。
 */
export async function ogPollTitle(slug: string): Promise<string | null> {
  try {
    const found = await getPollBySlug(slug);
    return found?.poll.title ?? null;
  } catch {
    return null;
  }
}

/** 各ページの `opengraph-image.tsx` の default export から呼ぶ。 */
export async function renderOgImage(props: OgCardProps): Promise<ImageResponse> {
  const font = await loadFont();
  return new ImageResponse(<OgCard {...props} />, {
    ...OG_SIZE,
    fonts: [{ name: "Noto Sans JP", data: font, style: "normal", weight: 700 }],
    // サブセットフォントに絵文字は入っていないので、Twemoji の画像で差し替える。
    emoji: "twemoji",
  });
}
