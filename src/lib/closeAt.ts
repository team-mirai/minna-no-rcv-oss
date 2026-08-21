/**
 * 締切（close_at）の入力検証と表示フォーマット。
 *
 * 受理（submit_ballot RPC）と遅延クローズ（ensureClosedIfDue）は最初から close_at を見て
 * いるので、ここで足しているのは「主催者が締切を決められて、参加者が締切を読める」入口だけ。
 * サーバ・クライアントの両方から呼ぶので、副作用を持たない純粋関数にしておく。
 */

/** 締切として受け付ける最も先の時刻（桁の打ち間違いを弾く）。 */
export const MAX_CLOSE_AT_DAYS = 365;

/** 締切として受け付ける最も手前の時刻（作った瞬間に締切済みになる指定を防ぐ）。 */
export const MIN_CLOSE_AT_MINUTES = 5;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/**
 * 締切の入力を ISO 8601（UTC）へ正規化する。null / undefined / 空文字は「締切なし」。
 *
 * 不正な値は、利用者が自分で直せる日本語メッセージで throw する（createPoll の他の
 * 入力検証と同じ扱いで、そのままフォームに表示される）。
 */
export function normalizeCloseAt(raw: unknown, now: number = Date.now()): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "string") throw new Error("締切の形式が不正です");

  const at = new Date(raw).getTime();
  if (!Number.isFinite(at)) throw new Error("締切の形式が不正です");

  if (at < now + MIN_CLOSE_AT_MINUTES * MINUTE_MS) {
    throw new Error(`締切は今から${MIN_CLOSE_AT_MINUTES}分以上あとにしてください`);
  }
  if (at > now + MAX_CLOSE_AT_DAYS * DAY_MS) {
    throw new Error(`締切は${MAX_CLOSE_AT_DAYS}日以内にしてください`);
  }
  return new Date(at).toISOString();
}

/**
 * 締切の表示（例: 8月22日(土) 18:00）。
 *
 * タイムゾーンは日本時間で固定する。閲覧者のタイムゾーンに合わせると、サーバ描画と
 * クライアント描画で文字列がずれる（hydration）うえ、主催者と参加者で見える締切が
 * 食い違って「いつまでなのか」が伝わらなくなるため。
 */
export function formatCloseAt(iso: string): string {
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at)) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(at);
}
