/**
 * `<input type="datetime-local">` の値（ブラウザのローカル時刻）と ISO 8601（UTC）の変換。
 *
 * 作成フォームと管理ページの予約変更フォームが同じ変換を使う。片方だけ直して
 * 「作成時と変更時で 9 時間ずれる」を起こさないよう、実装はここに 1 つだけ置く。
 */

/** 時刻 → datetime-local の値（YYYY-MM-DDTHH:mm・ブラウザのローカル時刻）。 */
export function toLocalInputValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/** datetime-local の値（ローカル時刻）→ ISO 8601（UTC）。読めなければ null。 */
export function toIso(localValue: string): string | null {
  const t = new Date(localValue).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}
