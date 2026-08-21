/**
 * 投票受付完了の投票箱アイソメアート（移植元アプリから移植）。
 * 受付完了ポップアップで使う。マウントのたびに約2.2秒のアニメが1回再生される
 * （state なし）。keyframes tm-iso-* は globals.css 定義済み。
 *
 * tm-ballot-done クラスは、globals.css のグローバルな prefers-reduced-motion 無効化
 * からこの完了演出だけを除外するためのフック（投票が記録されたことを伝える確認
 * フィードバックであり、単なる装飾ではないため）。
 */
export function BallotDoneArt() {
  return (
    <svg className="tm-ballot-done" width="214" height="200" viewBox="0 0 320 300" fill="none" aria-hidden="true">
      <defs>
        <clipPath id="tm-iso-above-slot">
          <polygon points="120,140 204,98 204,-160 120,-118" />
        </clipPath>
      </defs>
      <ellipse
        cx="160"
        cy="252"
        rx="96"
        ry="22"
        fill="var(--tm-teal-100)"
        style={{ animation: "tm-iso-shadow 2.2s ease both", transformBox: "fill-box", transformOrigin: "center" }}
      />
      <g style={{ animation: "tm-iso-box 2.2s ease both", transformBox: "view-box", transformOrigin: "160px 255px" }}>
        <polygon points="160,85 230,120 160,155 90,120" fill="#FFFFFF" stroke="var(--tm-teal)" strokeWidth="5" strokeLinejoin="round" />
        <polygon points="128,132 184,104 192,108 136,136" fill="var(--tm-teal-deep)" />
        <g clipPath="url(#tm-iso-above-slot)">
          <g style={{ animation: "tm-iso-paper 2.2s cubic-bezier(.5,0,.6,1) .2s both" }}>
            <polygon points="134,64 190,36 190,96 134,124" fill="#FFFFFF" stroke="var(--tm-teal)" strokeWidth="5" strokeLinejoin="round" />
            <path d="M144 76 l34 -17 M144 90 l34 -17 M144 104 l20 -10" stroke="var(--tm-teal-soft)" strokeWidth="4" strokeLinecap="round" />
          </g>
        </g>
        <polygon points="90,120 160,155 160,255 90,220" fill="var(--tm-teal-100)" stroke="var(--tm-teal)" strokeWidth="5" strokeLinejoin="round" />
        <polygon points="160,155 230,120 230,220 160,255" fill="#FFFFFF" stroke="var(--tm-teal)" strokeWidth="5" strokeLinejoin="round" />
      </g>
      <g style={{ animation: "tm-iso-spark 2.2s ease both", transformBox: "fill-box", transformOrigin: "center" }}>
        <path d="M84 78 l8 8 M236 78 l-8 8 M160 46 v10" stroke="var(--tm-teal-soft)" strokeWidth="5" strokeLinecap="round" />
        <circle cx="72" cy="58" r="4" fill="var(--tm-teal-soft)" />
        <circle cx="248" cy="58" r="4" fill="var(--tm-teal-soft)" />
      </g>
      <g style={{ animation: "tm-iso-badge 2.2s ease both", transformBox: "fill-box", transformOrigin: "center" }}>
        <g transform="matrix(0.894,-0.447,0,1,195,190)">
          <circle cx="0" cy="0" r="17" fill="var(--tm-teal)" />
          <path d="M-8 0 l6 6 10 -12" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      </g>
    </svg>
  );
}
