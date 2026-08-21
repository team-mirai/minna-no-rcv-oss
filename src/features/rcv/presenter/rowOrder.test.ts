import { test } from "node:test";
import assert from "node:assert/strict";
// .ts 拡張子明示は node --test（型ストリップ実行）が拡張子を補完しないため必要。
import { orderRcvRows } from "./rowOrder.ts";

test("候補行: 表示票数の降順で並べる", () => {
  assert.deepEqual(
    orderRcvRows(["a", "b", "c"], { a: 3, b: 7, c: 5 }, {}),
    ["b", "c", "a"]
  );
});

test("候補行: 同票なら長く生存する候補を上、先に除外される候補を下に置く", () => {
  assert.deepEqual(
    orderRcvRows(
      ["a", "b", "c", "d"],
      { a: 10, b: 10, c: 10, d: 10 },
      { a: 2, b: 5, c: 3 }
    ),
    ["d", "b", "c", "a"]
  );
});

test("候補行: 生存順も同じならR1基本順を維持する", () => {
  assert.deepEqual(
    orderRcvRows(["b", "a", "c"], { a: 4, b: 4, c: 4 }, { a: 2, b: 2 }),
    ["c", "b", "a"]
  );
});

test("候補行: 同じ入力なら並びは決定的（開票前後で票数が同じなら順序も同じ）", () => {
  const votes = { a: 8, b: 8, c: 8, d: 5 };
  const elim = { a: 3, d: 1 };
  assert.deepEqual(
    orderRcvRows(["a", "b", "c", "d"], votes, elim),
    orderRcvRows(["a", "b", "c", "d"], { ...votes }, { ...elim })
  );
  assert.deepEqual(orderRcvRows(["a", "b", "c", "d"], votes, elim), ["b", "c", "a", "d"]);
});
