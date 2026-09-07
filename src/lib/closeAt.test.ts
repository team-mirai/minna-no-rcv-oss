import { test } from "node:test";
import assert from "node:assert/strict";
// .ts 拡張子明示は node --test（型ストリップ実行）が拡張子を補完しないため必要。
import {
  formatCloseAt,
  isResultsOpen,
  normalizeCloseAt,
  normalizeResultsOpenAt,
  resolvePresentMode,
  MAX_CLOSE_AT_DAYS,
  MIN_CLOSE_AT_MINUTES,
} from "./closeAt.ts";

const NOW = Date.parse("2026-08-15T09:00:00+09:00");
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

test("空の入力は「締切なし」として通す", () => {
  assert.equal(normalizeCloseAt(null, NOW), null);
  assert.equal(normalizeCloseAt(undefined, NOW), null);
  assert.equal(normalizeCloseAt("", NOW), null);
});

test("有効な日時は ISO 8601（UTC）へ正規化する", () => {
  assert.equal(
    normalizeCloseAt("2026-08-22T18:00:00+09:00", NOW),
    "2026-08-22T09:00:00.000Z"
  );
});

test("過去・直近すぎる締切は弾く（作った瞬間に締切済みにしない）", () => {
  assert.throws(() => normalizeCloseAt(new Date(NOW - MINUTE).toISOString(), NOW), /締切/);
  const tooSoon = new Date(NOW + (MIN_CLOSE_AT_MINUTES - 1) * MINUTE).toISOString();
  assert.throws(() => normalizeCloseAt(tooSoon, NOW), /締切/);
  // 下限ちょうどは通す
  const justOk = new Date(NOW + MIN_CLOSE_AT_MINUTES * MINUTE).toISOString();
  assert.equal(normalizeCloseAt(justOk, NOW), justOk);
});

test("遠すぎる締切は弾く（桁の打ち間違い）", () => {
  const tooFar = new Date(NOW + (MAX_CLOSE_AT_DAYS + 1) * DAY).toISOString();
  assert.throws(() => normalizeCloseAt(tooFar, NOW), /締切/);
});

test("日時として読めない値は弾く", () => {
  assert.throws(() => normalizeCloseAt("あした", NOW), /形式/);
  assert.throws(() => normalizeCloseAt(1786699625608, NOW), /形式/);
});

test("表示は日本時間で固定する（実行環境のタイムゾーンに依存しない）", () => {
  const s = formatCloseAt("2026-08-22T09:00:00.000Z");
  assert.ok(s.includes("8月22日"), s);
  assert.ok(s.includes("18:00"), s);
  assert.equal(formatCloseAt("not-a-date"), "");
});

test("結果公開の空入力は「締切と同時に公開」として通す", () => {
  const closeAt = new Date(NOW + DAY).toISOString();
  assert.equal(normalizeResultsOpenAt(null, closeAt, NOW), null);
  assert.equal(normalizeResultsOpenAt(undefined, closeAt, NOW), null);
  assert.equal(normalizeResultsOpenAt("", closeAt, NOW), null);
});

test("結果公開は締切より前にできない（締切と同時は通す）", () => {
  const closeAt = new Date(NOW + DAY).toISOString();
  const before = new Date(NOW + DAY - MINUTE).toISOString();
  assert.throws(() => normalizeResultsOpenAt(before, closeAt, NOW), /締切以降/);
  assert.equal(normalizeResultsOpenAt(closeAt, closeAt, NOW), closeAt);
  const after = new Date(NOW + DAY + 2 * 60 * MINUTE).toISOString();
  assert.equal(normalizeResultsOpenAt(after, closeAt, NOW), after);
});

test("結果公開も直近すぎる・遠すぎる指定は弾く", () => {
  const tooSoon = new Date(NOW + (MIN_CLOSE_AT_MINUTES - 1) * MINUTE).toISOString();
  assert.throws(() => normalizeResultsOpenAt(tooSoon, null, NOW), /結果公開/);
  const tooFar = new Date(NOW + (MAX_CLOSE_AT_DAYS + 1) * DAY).toISOString();
  assert.throws(() => normalizeResultsOpenAt(tooFar, null, NOW), /結果公開/);
  assert.throws(() => normalizeResultsOpenAt("あした", null, NOW), /形式/);
});

test("結果は「締切済み かつ 公開時刻を過ぎている」ときだけ見せる", () => {
  const soon = new Date(NOW + 2 * 60 * MINUTE).toISOString();
  const past = new Date(NOW - MINUTE).toISOString();
  // 受付中は、公開時刻の指定があってもなくても見せない
  assert.equal(isResultsOpen("open", null, NOW), false);
  assert.equal(isResultsOpen("open", past, NOW), false);
  // 締切済み＋指定なし＝これまでどおり締切と同時に公開
  assert.equal(isResultsOpen("closed", null, NOW), true);
  // 締切済みでも、公開時刻の前は見せない
  assert.equal(isResultsOpen("closed", soon, NOW), false);
  assert.equal(isResultsOpen("closed", past, NOW), true);
  // 読めない値は隠す側に倒す
  assert.equal(isResultsOpen("closed", "not-a-date", NOW), false);
});

test("参加者のプレゼンモードは公開時刻まで待機のまま", () => {
  const soon = new Date(NOW + 2 * 60 * MINUTE).toISOString();
  const past = new Date(NOW - MINUTE).toISOString();
  assert.equal(resolvePresentMode("open", null, false, NOW), "standby");
  assert.equal(resolvePresentMode("open", soon, false, NOW), "standby");
  assert.equal(resolvePresentMode("closed", soon, false, NOW), "standby");
  // 公開済みなら確定結果（これまでどおり）
  assert.equal(resolvePresentMode("closed", null, false, NOW), "final");
  assert.equal(resolvePresentMode("closed", past, false, NOW), "final");
});

test("主催者のプレゼンモードは公開前でも出せる（受付中は暫定）", () => {
  const soon = new Date(NOW + 2 * 60 * MINUTE).toISOString();
  // 締切済み・公開待ち＝確定結果を主催者だけ先に映せる
  assert.equal(resolvePresentMode("closed", soon, true, NOW), "final");
  // 受付中＝途中経過（暫定）。確定結果はまだ存在しない
  assert.equal(resolvePresentMode("open", soon, true, NOW), "live");
  assert.equal(resolvePresentMode("open", null, true, NOW), "live");
  // 公開済みなら参加者と同じ確定結果
  assert.equal(resolvePresentMode("closed", null, true, NOW), "final");
});
