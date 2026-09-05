import { test } from "node:test";
import assert from "node:assert/strict";
// .ts 拡張子明示は node --test（型ストリップ実行）が拡張子を補完しないため必要。
import { tallyRcv, type RcvBallot } from "./tally.ts";

// 受け入れケース（過半数即決 / 複数ラウンド / 順位切れ発生 / 全員1位のみ記入）＋
// タイブレーク規則＋票の保存則を検証する。移植元アプリから移植。

const A = "a";
const B = "b";
const C = "c";
const D = "d";

/** [票の中身, 枚数] の組から票束を作る補助。 */
function ballots(...specs: Array<[RcvBallot, number]>): RcvBallot[] {
  const out: RcvBallot[] = [];
  for (const [b, n] of specs) for (let i = 0; i < n; i++) out.push([...b]);
  return out;
}

/** tiedWith は生存候補の内部順に依存するので、比較は並べ替えてから行う。 */
function sorted(ids: string[]): string[] {
  return [...ids].sort();
}

/** 各ラウンドで「除外票 = 移動先合計 + 順位切れ増分」が成立すること（受け入れ条件2）。 */
function assertConservation(t: ReturnType<typeof tallyRcv>) {
  for (let i = 1; i < t.rounds.length; i++) {
    const r = t.rounds[i];
    const transferred = Object.values(r.transfers).reduce((s, v) => s + v, 0);
    assert.equal(r.moved, transferred + r.toEx, `round ${i + 1}: 票の保存則`);
  }
}

test("過半数即決: 第1ラウンドで過半数に達したら1ラウンドで決定する", () => {
  const t = tallyRcv(
    ballots([[A, B, C], 6], [[B, A, C], 3], [[C, B, A], 1]),
    [A, B, C]
  );
  assert.equal(t.total, 10);
  assert.equal(t.rounds.length, 1);
  assert.equal(t.rounds[0].majority, 6); // floor(10/2)+1
  assert.equal(t.rounds[0].winner, A);
  assert.equal(t.rounds[0].exhausted, 0);
  assertConservation(t);
});

test("複数ラウンド: 最下位除外→次順位へ票が移り、過半数で決定する", () => {
  // R1: A=4, B=3, C=2 (計9・過半数5)。C除外→2票ともBへ→ B=5 で決定。
  const t = tallyRcv(
    ballots([[A, B, C], 4], [[B, A, C], 3], [[C, B, A], 2]),
    [A, B, C]
  );
  assert.equal(t.rounds.length, 2);
  assert.equal(t.rounds[1].elim, C);
  assert.equal(t.rounds[1].moved, 2);
  assert.deepEqual(t.rounds[1].transfers, { [B]: 2 });
  assert.equal(t.rounds[1].toEx, 0);
  assert.equal(t.rounds[1].snap[B], 5);
  assert.equal(t.rounds[1].winner, B);
  assert.equal(t.elimRound[C], 1);
  // 同数ではない除外なので、タイブレーク記録は空のまま（表示側は何も出さない）。
  assert.equal(t.rounds[1].tiebreak, null);
  assert.deepEqual(t.rounds[1].tiedWith, []);
  // 表示側が並べ替える際の基本順は R1 の得票降順
  assert.deepEqual(t.order, [A, B, C]);
  assertConservation(t);
});

test("順位切れ発生: 後続順位が無い票は exhausted に積まれ、過半数ラインが縮む", () => {
  // R1: A=4, B=3, C=2 (計9・過半数5)。C除外→1票([C,B])はBへ、1票([C])は順位切れ。
  // R2: 有効票8・過半数5。A=4, B=4 → 同数だが誰も過半数未達。
  // 最下位同数(A,B)は backward で R1 比較 → B(3) < A(4) → B除外。
  // B の4票: [B,A]×2 は A へ、[B]×1 と [C,B]×1 は後続なしで順位切れ（累計3）。
  // R3: 有効票6・過半数4。A=6 で決定。
  const t = tallyRcv(
    ballots([[A], 4], [[B, A], 2], [[B], 1], [[C, B], 1], [[C], 1]),
    [A, B, C]
  );
  assert.equal(t.rounds[0].majority, 5);
  assert.equal(t.rounds[1].elim, C);
  assert.equal(t.rounds[1].toEx, 1);
  assert.equal(t.rounds[1].exhausted, 1);
  assert.equal(t.rounds[1].majority, 5); // floor(8/2)+1
  assert.equal(t.rounds[2].elim, B);
  assert.equal(t.rounds[2].tiebreak, "backward");
  assert.deepEqual(sorted(t.rounds[2].tiedWith), [A, B]);
  assert.equal(t.rounds[2].exhausted, 3);
  assert.equal(t.rounds[2].majority, 4); // floor(6/2)+1
  assert.equal(t.rounds[2].winner, A);
  assertConservation(t);
});

test("全員1位のみ記入: 除外票は全て順位切れになり、縮む過半数で決着する", () => {
  // A=3, B=2, C=1 (計6・過半数4)。C除外→順位切れ1 → 有効5・過半数3。A=3 で決定。
  const t = tallyRcv(ballots([[A], 3], [[B], 2], [[C], 1]), [A, B, C]);
  assert.equal(t.rounds[0].majority, 4);
  assert.equal(t.rounds[1].toEx, 1);
  assert.equal(t.rounds[1].majority, 3);
  assert.equal(t.rounds[1].winner, A);
  assertConservation(t);
});

test("タイブレーク(backward): 直前ラウンドの票数で決まる", () => {
  // R1: A=4, B=3, C=2, D=1 → D除外(1票はCへ) →
  // R2: A=4, B=3, C=3 → 最下位 B,C 同数 → R1 では B=3 > C=2 → C を除外。
  const t = tallyRcv(
    ballots([[A, B, C, D], 4], [[B, A, C, D], 3], [[C, A, B, D], 2], [[D, C, A, B], 1]),
    [A, B, C, D]
  );
  assert.equal(t.rounds[1].elim, D);
  assert.equal(t.rounds[1].snap[C], 3);
  // D は単独最下位。同数ではないラウンドに同数の記録を残さない。
  assert.equal(t.rounds[1].tiebreak, null);
  assert.deepEqual(t.rounds[1].tiedWith, []);
  assert.equal(t.rounds[2].elim, C, "同数最下位(B,C)は前ラウンドの票数が少ないCを除外");
  // 同数だった事実と解消方法を残す（表示側がこれを開示する）。
  assert.equal(t.rounds[2].tiebreak, "backward");
  assert.deepEqual(sorted(t.rounds[2].tiedWith), [B, C]);
  assertConservation(t);
});

test("タイブレーク(by lot): 全ラウンド同数なら lotSeed から決定的に決まる", () => {
  // A=B=C=2 (計6・過半数4)。R1から全員同数 → くじ。
  const votes = ballots([[A, B, C], 2], [[B, C, A], 2], [[C, A, B], 2]);
  const t1 = tallyRcv(votes, [A, B, C], { lotSeed: "seed-1" });
  const t2 = tallyRcv(votes, [A, B, C], { lotSeed: "seed-1" });
  // 決定的: 同じシードなら常に同じ経過・同じ勝者
  assert.deepEqual(t1.rounds, t2.rounds);
  assert.ok(t1.rounds[t1.rounds.length - 1].winner);
  // 第1ラウンドまで遡っても同数なので「くじ」と記録される。
  assert.equal(t1.rounds[1].tiebreak, "lot");
  assert.deepEqual(sorted(t1.rounds[1].tiedWith), [A, B, C]);
  assert.ok(t1.rounds[1].tiedWith.includes(t1.rounds[1].elim!));
  assertConservation(t1);
});

test("未知の候補id・空票は無視し、有効票だけを数える", () => {
  const t = tallyRcv(
    ballots([[A, "unknown"], 2], [["unknown"], 1], [[], 1], [[B], 1]),
    [A, B]
  );
  assert.equal(t.total, 3); // [A,unknown]×2 と [B]×1
  assert.equal(t.rounds[0].snap[A], 2);
  assert.equal(t.rounds[0].winner, A); // 過半数 floor(3/2)+1 = 2
});

test("有効票ゼロ・候補ゼロでも壊れない（未決着の単一ラウンド）", () => {
  const empty = tallyRcv([], [A, B]);
  assert.equal(empty.total, 0);
  assert.equal(empty.rounds.length, 1);
  assert.equal(empty.rounds[0].winner, null);
  assert.equal(empty.rounds[0].tiebreak, null);
  assert.deepEqual(empty.rounds[0].tiedWith, []);
  const noOptions = tallyRcv(ballots([[A], 1]), []);
  assert.equal(noOptions.total, 0);
  assert.equal(noOptions.rounds[0].winner, null);
});

test("完全順位の票束: 順位切れは発生せず過半数ラインは不動", () => {
  const t = tallyRcv(
    ballots([[A, B, C, D], 5], [[B, C, D, A], 4], [[C, D, B, A], 3], [[D, C, B, A], 2]),
    [A, B, C, D]
  );
  for (const r of t.rounds) {
    assert.equal(r.exhausted, 0);
    assert.equal(r.majority, Math.floor(14 / 2) + 1);
  }
  const last = t.rounds[t.rounds.length - 1];
  assert.ok(last.winner);
  assert.ok(last.snap[last.winner!] >= last.majority);
  assertConservation(t);
});
