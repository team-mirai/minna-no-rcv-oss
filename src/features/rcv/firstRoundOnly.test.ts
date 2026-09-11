import assert from "node:assert/strict";
import { test } from "node:test";
import { firstRoundOnly } from "./firstRoundOnly.ts";
import { tallyRcv } from "./tally.ts";

// 受付中の結果ページへ渡す値から、決選の中身（暫定勝者・除外・票の移動・順位切れの行方）が
// 落ちていることを固定する。画面に出していないだけでは RSC のフライトデータとして HTML に
// 載るため、渡す時点で落とす必要がある。

test("複数ラウンドかかる集計を第1ラウンドだけに落とす", () => {
  // A:4 B:3 C:2 → C 除外 → C の票が B へ動く、という決選が起きる形。
  const ballots = [
    ...Array(4).fill(["a"]),
    ...Array(3).fill(["b"]),
    ...Array(2).fill(["c", "b"]),
  ];
  const full = tallyRcv(ballots, ["a", "b", "c"], { lotSeed: "seed" });
  assert.ok(full.rounds.length > 1, "前提: 決選が起きる");

  const redacted = firstRoundOnly(full);

  assert.equal(redacted.rounds.length, 1);
  assert.deepEqual(redacted.rounds[0].snap, { a: 4, b: 3, c: 2 });
  assert.equal(redacted.rounds[0].winner, null);
  assert.equal(redacted.rounds[0].elim, null);
  assert.deepEqual(redacted.rounds[0].transfers, {});
  assert.equal(redacted.rounds[0].moved, 0);
  // 除外されたラウンド番号が残ると「どれが先に落ちるか」が読めてしまう。
  assert.deepEqual(redacted.elimRound, {});
});

test("第1ラウンドで過半数に届いても勝者は伏せる", () => {
  const ballots = [...Array(3).fill(["a"]), ["b"]];
  const full = tallyRcv(ballots, ["a", "b"], { lotSeed: "seed" });
  assert.equal(full.rounds[0].winner, "a", "前提: 第1ラウンドで決着する");

  const redacted = firstRoundOnly(full);
  assert.equal(redacted.rounds[0].winner, null);
});

test("画面が描画する値（1位票・並び順・総票数）は保つ", () => {
  const ballots = [
    ...Array(4).fill(["a"]),
    ...Array(3).fill(["b"]),
    ...Array(2).fill(["c", "b"]),
  ];
  const full = tallyRcv(ballots, ["a", "b", "c"], { lotSeed: "seed" });
  const redacted = firstRoundOnly(full);

  assert.equal(redacted.total, full.total);
  assert.deepEqual(redacted.order, full.order);
  assert.equal(redacted.maxV, 4);
});

test("有効票ゼロでも落ちない", () => {
  const full = tallyRcv([], ["a", "b"], { lotSeed: "seed" });
  const redacted = firstRoundOnly(full);

  assert.equal(redacted.total, 0);
  assert.equal(redacted.rounds.length, 1);
  assert.equal(redacted.rounds[0].winner, null);
  assert.equal(redacted.maxV, 0);
});
