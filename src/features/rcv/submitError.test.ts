import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSubmitErrorMessage, type SubmitFailure } from "./submitError.ts";

const FAILURES: SubmitFailure[] = [
  "poll_not_found",
  "poll_closed",
  "invalid_rankings",
  "captcha_required",
  "cookie_issued",
  "rate_limited",
  "network_error",
];

describe("getSubmitErrorMessage", () => {
  it("returns a message for every failure result", () => {
    for (const r of FAILURES) {
      assert.ok(getSubmitErrorMessage(r).length > 0, r);
    }
  });

  it("states the reason with a cause clause for every failure result", () => {
    for (const r of FAILURES) {
      assert.match(getSubmitErrorMessage(r), /ため/, r);
    }
  });

  it("tells the next action for every failure result", () => {
    for (const r of FAILURES) {
      assert.match(
        getSubmitErrorMessage(r),
        /お試しください|ご確認ください|お問い合わせください/,
        r
      );
    }
  });

  it("returns distinct messages so each failure is distinguishable", () => {
    const messages = new Set(FAILURES.map(getSubmitErrorMessage));
    assert.equal(messages.size, FAILURES.length);
  });
});
