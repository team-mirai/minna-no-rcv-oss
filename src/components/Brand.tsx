/**
 * みんなのRCV のブランドマーク（順位付きバーのアイコン）。
 * 画像アセットに依存しない inline SVG。ヘッダー・プレゼン・OG などで共用する。
 */
export function BrandMark({
  size = 34,
  style,
}: {
  /** px サイズ。cqw 等で可変にしたい場合は style で width/height を上書きする。 */
  size?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      style={{ display: "block", ...style }}
    >
      <rect width="48" height="48" rx="12" fill="var(--tm-teal)" />
      {/* 1位（長いバー）→ 3位（短いバー）の順位バー */}
      <rect x="10" y="11" width="28" height="6" rx="3" fill="#FFFFFF" />
      <rect x="10" y="21" width="20" height="6" rx="3" fill="#FFFFFF" opacity="0.85" />
      <rect x="10" y="31" width="12" height="6" rx="3" fill="#FFFFFF" opacity="0.7" />
      {/* 票が次の順位へ流れるドット */}
      <circle cx="36" cy="34" r="4" fill="var(--tm-yellow)" stroke="#000" strokeWidth="1.5" />
    </svg>
  );
}

export function BrandLockup({ markSize = 30 }: { markSize?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark size={markSize} />
      <b
        className="font-[family-name:var(--tm-font-jp-display)] text-[16px] leading-none tracking-[0.04em]"
        style={{ fontWeight: 900 }}
      >
        みんなのRCV
      </b>
    </span>
  );
}
