import { test } from "node:test";
import assert from "node:assert/strict";
// .ts 拡張子明示は node --test（型ストリップ実行）が拡張子を補完しないため必要。
import {
  formatCloseAt,
  isResultsOpen,
  normalizeCloseAt,
  normalizeResultsOpenAt,
  resolvePresentMode,
  resolveScheduleEdit,
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

// ── 作成後の予約変更（resolveScheduleEdit）────────────────────────────

/** 受付中・締切あり・結果公開の指定なし、という一番ふつうの状態。 */
const OPEN_POLL = {
  status: "open" as const,
  close_at: new Date(NOW + 3 * 60 * MINUTE).toISOString(),
  results_open_at: null,
};

test("変更しなかった項目は差分に入れない（DB を無駄に触らない）", () => {
  assert.deepEqual(resolveScheduleEdit(OPEN_POLL, {}, NOW), {});
  // 同じ時刻を表記違いで渡しても「変更なし」と見る
  const sameCloseAt = new Date(OPEN_POLL.close_at).toISOString();
  assert.deepEqual(
    resolveScheduleEdit(OPEN_POLL, { closeAt: sameCloseAt, resultsOpenAt: null }, NOW),
    {}
  );
});

test("結果公開だけを変えるとき、締切の下限は再検証しない", () => {
  // 締切 3 分後（＝下限の 5 分を切っている）でも、結果公開だけなら保存できる。
  // 「配信が押したので公開を後ろへずらす」を締切間際にやれないと詰むため。
  const nearClose = { ...OPEN_POLL, close_at: new Date(NOW + 3 * MINUTE).toISOString() };
  const publishAt = new Date(NOW + 60 * MINUTE).toISOString();
  assert.deepEqual(resolveScheduleEdit(nearClose, { resultsOpenAt: publishAt }, NOW), {
    results_open_at: publishAt,
  });
});

test("動かした項目には作成時と同じ範囲の検証をかける", () => {
  assert.throws(() => resolveScheduleEdit(OPEN_POLL, { closeAt: "あした" }, NOW), /形式/);
  assert.throws(
    () => resolveScheduleEdit(OPEN_POLL, { closeAt: new Date(NOW + MINUTE).toISOString() }, NOW),
    new RegExp(`${MIN_CLOSE_AT_MINUTES}分`)
  );
  assert.throws(
    () =>
      resolveScheduleEdit(
        OPEN_POLL,
        { closeAt: new Date(NOW + (MAX_CLOSE_AT_DAYS + 1) * DAY).toISOString() },
        NOW
      ),
    new RegExp(`${MAX_CLOSE_AT_DAYS}日`)
  );
  assert.throws(() => resolveScheduleEdit(OPEN_POLL, { closeAt: 1234 }, NOW), /形式/);
});

test("結果公開が締切より前になる組み合わせは弾く（締切だけ動かした場合も）", () => {
  const withPublish = {
    ...OPEN_POLL,
    results_open_at: new Date(NOW + 30 * MINUTE).toISOString(),
  };
  // 締切を結果公開より後ろへ動かした（結果公開は触っていない）
  assert.throws(
    () =>
      resolveScheduleEdit(
        withPublish,
        { closeAt: new Date(NOW + 60 * MINUTE).toISOString() },
        NOW
      ),
    /締切以降/
  );
});

test("締切を「なし」に戻せる", () => {
  assert.deepEqual(resolveScheduleEdit(OPEN_POLL, { closeAt: null }, NOW), { close_at: null });
  assert.deepEqual(resolveScheduleEdit(OPEN_POLL, { closeAt: "" }, NOW), { close_at: null });
});

test("締切済みの投票では締切の入力を無視する（締切は再開できない）", () => {
  const closed = {
    status: "closed" as const,
    close_at: new Date(NOW - 10 * MINUTE).toISOString(),
    results_open_at: new Date(NOW + 60 * MINUTE).toISOString(),
  };
  const later = new Date(NOW + 120 * MINUTE).toISOString();
  assert.deepEqual(resolveScheduleEdit(closed, { closeAt: later, resultsOpenAt: later }, NOW), {
    results_open_at: later,
  });
});

test("締切済みで結果公開を空にする指定は弾く（意図しない即公開を防ぐ）", () => {
  const closed = {
    status: "closed" as const,
    close_at: new Date(NOW - 10 * MINUTE).toISOString(),
    results_open_at: new Date(NOW + 60 * MINUTE).toISOString(),
  };
  assert.throws(() => resolveScheduleEdit(closed, { resultsOpenAt: null }, NOW), /いま結果を公開/);
});

test("渡していないキーは触らない（片方だけの更新で他方を消さない）", () => {
  const both = {
    ...OPEN_POLL,
    results_open_at: new Date(NOW + 4 * 60 * MINUTE).toISOString(),
  };
  const later = new Date(NOW + 5 * 60 * MINUTE).toISOString();
  // 結果公開だけ渡す → 締切は差分に入らない
  assert.deepEqual(resolveScheduleEdit(both, { resultsOpenAt: later }, NOW), {
    results_open_at: later,
  });
  // 締切だけ渡す → 結果公開は差分に入らない
  const closeLater = new Date(NOW + 4 * 60 * MINUTE).toISOString();
  assert.deepEqual(resolveScheduleEdit(both, { closeAt: closeLater }, NOW), {
    close_at: closeLater,
  });
});
