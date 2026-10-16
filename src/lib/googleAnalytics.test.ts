import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GA_MEASUREMENT_ID,
  gaMeasurementId,
  isAdminPath,
  shouldLoadGoogleAnalytics,
} from "./googleAnalytics.ts";

test("測定 ID が空なら既定値に戻る", () => {
  assert.equal(gaMeasurementId(undefined), DEFAULT_GA_MEASUREMENT_ID);
  assert.equal(gaMeasurementId(""), DEFAULT_GA_MEASUREMENT_ID);
  assert.equal(gaMeasurementId("   "), DEFAULT_GA_MEASUREMENT_ID);
  assert.equal(DEFAULT_GA_MEASUREMENT_ID, "G-7WCR569WS3");
});

test("測定 ID が設定されていればそれを使う", () => {
  assert.equal(gaMeasurementId("G-TEST1234"), "G-TEST1234");
  assert.equal(gaMeasurementId("  G-TEST1234  "), "G-TEST1234");
});

test("本番の公開ページだけ計測する", () => {
  for (const pathname of ["/", "/new", "/terms", "/p/abc", "/p/abc/manage", "/demo"]) {
    assert.equal(shouldLoadGoogleAnalytics("production", pathname), true, pathname);
  }
});

test("プレビュー・開発・未設定では計測しない", () => {
  for (const env of [undefined, "", "preview", "development", "Production"]) {
    assert.equal(shouldLoadGoogleAnalytics(env, "/"), false, String(env));
  }
});

test("/admin とその配下では計測しない", () => {
  assert.equal(isAdminPath("/admin"), true);
  assert.equal(isAdminPath("/admin/"), true);
  assert.equal(isAdminPath("/admin/users"), true);
  assert.equal(isAdminPath("/administrator"), false);
  assert.equal(isAdminPath("/p/admin"), false);

  assert.equal(shouldLoadGoogleAnalytics("production", "/admin"), false);
  assert.equal(shouldLoadGoogleAnalytics("production", "/admin/"), false);
  assert.equal(shouldLoadGoogleAnalytics("production", "/admin/users"), false);
  assert.equal(shouldLoadGoogleAnalytics("preview", "/admin"), false);
});
