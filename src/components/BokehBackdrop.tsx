/**
 * トップページ FV の背景「ボケ玉」。
 *
 * デザイン案「みんなのRCVトップ v3 背景つき」は WebGL のフラグメントシェーダーで
 * 16個のボケ玉を描いていたが、ここでは同じ配色・同じ密度を CSS の radial-gradient で
 * 再現している。canvas / WebGL / requestAnimationFrame に依存しないので Server
 * Component のまま動き、WebGL 非対応環境やレンダラを持たない端末でもフォールバックが
 * 要らない。玉は 60 秒かけてわずかに流れるだけで、prefers-reduced-motion 時は
 * globals.css の一括停止ルールで静止する。
 *
 * 配色はシェーダーの定数と同値：
 *   ベース #FFFCF5 / ティール #73DBBA / イエロー #FFD96B / コーラル #FFB39E
 */

/** 玉ひとつ。x/y は % 位置、r は直径 %、c は色、a は不透明度。 */
type Bokeh = { x: number; y: number; r: number; c: string; a: number };

const TEAL = "115, 219, 186";
const YELLOW = "255, 217, 107";
const CORAL = "255, 179, 158";

const BOKEHS: Bokeh[] = [
  { x: 14, y: 6, r: 34, c: TEAL, a: 0.2 },
  { x: 84, y: 3, r: 26, c: YELLOW, a: 0.22 },
  { x: 56, y: 15, r: 20, c: CORAL, a: 0.16 },
  { x: -4, y: 27, r: 30, c: YELLOW, a: 0.16 },
  { x: 97, y: 31, r: 32, c: TEAL, a: 0.15 },
  { x: 33, y: 39, r: 17, c: CORAL, a: 0.14 },
  { x: 72, y: 49, r: 30, c: YELLOW, a: 0.18 },
  { x: 6, y: 57, r: 23, c: CORAL, a: 0.18 },
  { x: 47, y: 67, r: 36, c: TEAL, a: 0.13 },
  { x: 92, y: 73, r: 22, c: CORAL, a: 0.2 },
  { x: 19, y: 85, r: 28, c: YELLOW, a: 0.16 },
  { x: 68, y: 93, r: 25, c: TEAL, a: 0.16 },
];

/** 玉ひとつを radial-gradient 1枚に落とす。中心 55% までベタ、そこから外へフェード。 */
function layer({ x, y, r, c, a }: Bokeh): string {
  return (
    `radial-gradient(${r}% ${r}% at ${x}% ${y}%, ` +
    `rgba(${c}, ${a}) 0%, rgba(${c}, ${a * 0.72}) 42%, rgba(${c}, 0) 72%)`
  );
}

export function BokehBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[#FFFCF5]"
    >
      {/* 流れる分だけ内側を広くとり、端で背景が切れないようにする */}
      <div
        className="absolute -inset-[12%]"
        style={{
          backgroundImage: BOKEHS.map(layer).join(", "),
          animation: "tp-bokeh-drift 60s ease-in-out infinite alternate",
        }}
      />
    </div>
  );
}
