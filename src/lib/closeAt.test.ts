import { test } from "node:test";
import assert from "node:assert/strict";
// .ts 拡張子明示は node --test（型ストリップ実行）が拡張子を補完しないため必要。
import {
  formatCloseAt,
  normalizeCloseAt,
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
