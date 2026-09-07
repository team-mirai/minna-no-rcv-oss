/**
 * 締切（close_at）と結果公開（results_open_at）の入力検証と表示フォーマット。
 *
 * 受理（submit_ballot RPC）と遅延クローズ（ensureClosedIfDue）は最初から close_at を見て
 * いるので、ここで足しているのは「主催者が締切を決められて、参加者が締切を読める」入口だけ。
 *
 * 締切と結果公開は別の時刻として扱う。締切＝受付をやめる時刻、結果公開＝結果を見せる時刻で、
 * 「18時に締め切って20時に発表する」を成立させるために分けてある（results_open_at が null の
 * ときだけ、これまでどおり締切と同時に公開）。
 *
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
 * 結果公開の入力を ISO 8601（UTC）へ正規化する。null / undefined / 空文字は
 * 「締切と同時に公開」（＝これまでの挙動）。
 *
 * 締切より前の結果公開は成立しない（まだ受け付けている票が結果に入る）ので弾く。
 * 上限・下限は締切と同じ扱いにする。
 */
export function normalizeResultsOpenAt(
  raw: unknown,
  closeAt: string | null,
  now: number = Date.now()
): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "string") throw new Error("結果公開の形式が不正です");

  const at = new Date(raw).getTime();
  if (!Number.isFinite(at)) throw new Error("結果公開の形式が不正です");

  if (at < now + MIN_CLOSE_AT_MINUTES * MINUTE_MS) {
    throw new Error(`結果公開は今から${MIN_CLOSE_AT_MINUTES}分以上あとにしてください`);
  }
  if (at > now + MAX_CLOSE_AT_DAYS * DAY_MS) {
    throw new Error(`結果公開は${MAX_CLOSE_AT_DAYS}日以内にしてください`);
  }
  if (closeAt) {
    const close = new Date(closeAt).getTime();
    if (Number.isFinite(close) && at < close) {
      throw new Error("結果公開は締切以降の時刻にしてください");
    }
  }
  return new Date(at).toISOString();
}

/**
 * 結果（確定結果・プレゼンモード）を見せてよいか。
 *
 * 締切済みで、かつ結果公開時刻を過ぎていること。status は呼び出し側で
 * ensureClosedIfDue を通した後の値を渡す（poll 行の status は遅延クローズ前だと古い）。
 */
export function isResultsOpen(
  status: "open" | "closed",
  resultsOpenAt: string | null,
  now: number = Date.now()
): boolean {
  if (status !== "closed") return false;
  if (!resultsOpenAt) return true;
  const at = new Date(resultsOpenAt).getTime();
  // 読めない値で結果を出しっぱなしにしない（隠す側に倒す）。
  if (!Number.isFinite(at)) return false;
  return at <= now;
}

/**
 * プレゼンモードで何を映すか。
 *
 * - final   … 締切後の確定結果（公開済み、または主催者の公開前プレビュー）
 * - live    … 受付中の途中経過（主催者のプレビューのみ・暫定値）
 * - standby … 待機画面（結果を出さない）
 */
export type PresentMode = "final" | "live" | "standby";

/**
 * プレゼンモードの表示内容を決める。
 *
 * 主催者（管理キーを持っている人）は、結果公開の前でもプレゼンモードを開ける。
 * 「18時に締め切って、20時の配信でこちらから発表する」をやるには、発表の瞬間まで
 * 参加者には結果を見せず、かつ主催者は手元で開票を映せる必要があるため
 * （結果を公開してから映す運用だと、配信で読み上げる前に参加者のスマホに結果が出る）。
 *
 * 参加者（isAdmin=false）の見え方はこれまでどおりで、公開時刻までは standby。
 */
export function resolvePresentMode(
  status: "open" | "closed",
  resultsOpenAt: string | null,
  isAdmin: boolean,
  now: number = Date.now()
): PresentMode {
  if (isResultsOpen(status, resultsOpenAt, now)) return "final";
  if (!isAdmin) return "standby";
  // 締切済みなら確定結果、まだ受付中なら暫定の途中経過（画面にその旨のバッジを出す）。
  return status === "closed" ? "final" : "live";
}

/**
 * 締切の表示（例: 8月22日(土) 18:00）。結果公開の時刻も同じ書式で出す。
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
