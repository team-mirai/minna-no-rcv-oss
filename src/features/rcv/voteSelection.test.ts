import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getPostSelectionFocusTarget,
  getRankChangeAnnouncement,
  getSelectionAnnouncement,
  moveRankedOption,
} from "./voteSelection.ts";

describe("getPostSelectionFocusTarget", () => {
  it("moves focus to the next remaining candidate", () => {
    assert.deepEqual(getPostSelectionFocusTarget(["a", "b", "c"], "b"), {
      kind: "candidate",
      id: "c",
    });
  });

  it("moves focus to the previous candidate when the last visible candidate is selected", () => {
    assert.deepEqual(getPostSelectionFocusTarget(["a", "b", "c"], "c"), {
      kind: "candidate",
      id: "b",
    });
  });

  it("moves focus to the submit control when no candidates remain", () => {
    assert.deepEqual(getPostSelectionFocusTarget(["a"], "a"), { kind: "submit" });
  });
});

describe("getSelectionAnnouncement", () => {
  it("announces the selected candidate and resulting rank", () => {
    assert.equal(getSelectionAnnouncement("温泉", 2), "温泉を2位に追加しました");
  });
});

describe("moveRankedOption", () => {
  it("moves the selected option up and returns its resulting rank", () => {
    assert.deepEqual(moveRankedOption(["a", "b", "c"], "b", -1), {
      order: ["b", "a", "c"],
      rank: 1,
    });
  });

  it("moves the selected option down and returns its resulting rank", () => {
    assert.deepEqual(moveRankedOption(["a", "b", "c"], "b", 1), {
      order: ["a", "c", "b"],
      rank: 3,
    });
  });

  it("does not move an option beyond either end of the ranking", () => {
    assert.equal(moveRankedOption(["a", "b", "c"], "a", -1), null);
    assert.equal(moveRankedOption(["a", "b", "c"], "c", 1), null);
  });
});

describe("getRankChangeAnnouncement", () => {
  it("announces the candidate and its resulting rank", () => {
    assert.equal(getRankChangeAnnouncement("温泉", 2), "温泉を2位に移動しました");
  });
});
