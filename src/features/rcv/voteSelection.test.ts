import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getPostSelectionFocusTarget,
  getSelectionAnnouncement,
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
