import { test } from "node:test";
import assert from "node:assert/strict";
// .ts 拡張子明示は node --test（型ストリップ実行）が拡張子を補完しないため必要。
import { toIso, toLocalInputValue } from "./datetimeLocal.ts";

test("datetime-local の値を経由しても同じ時刻に戻る", () => {
  // 分より下は datetime-local が持たないので、分に丸めた時刻で往復させる。
  const ms = Math.floor(Date.parse("2026-09-07T20:00:00+09:00") / 60_000) * 60_000;
  const local = toLocalInputValue(ms);
  assert.match(local, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  assert.equal(Date.parse(toIso(local) as string), ms);
});

test("0 埋めして 1 桁の月日時分を作らない", () => {
  const local = toLocalInputValue(Date.parse("2026-01-02T03:04:00"));
  assert.equal(local, "2026-01-02T03:04");
});

test("読めない値は null（呼び出し側でエラー表示する）", () => {
  assert.equal(toIso(""), null);
  assert.equal(toIso("あした"), null);
});
