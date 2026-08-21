// タップ送信などの「手元で押せた」感を出すための軽いハプティクス（ポコッ）。
// 移植元アプリの lib/haptics.ts の移植。
//
// 実装は Web の Vibration API（navigator.vibrate）。
//  - Android の Chrome/Edge 等: 実際に振動する
//  - iOS: WebKit が未実装のため no-op / デスクトップ: no-op
// プログレッシブエンハンスメント（対応端末だけ振動）。必ずユーザー操作ハンドラ内から呼ぶ。
export function tapHaptic(durationMs = 10): void {
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean };
  if (typeof nav.vibrate !== "function") return;
  try {
    nav.vibrate(durationMs);
  } catch {
    // 一部環境で例外になりうるので握りつぶす（best-effort）。
  }
}
