import assert from "node:assert/strict";
import { test } from "node:test";
import { cmpVersion, pickAsset } from "../src/web/version.js";

test("версии сравниваются по числам, а не по строкам", () => {
  assert.ok(cmpVersion("0.10.0", "0.9.9") > 0);
  assert.ok(cmpVersion("v1.0.0", "0.99.99") > 0);
  assert.ok(cmpVersion("0.2.0", "0.2.1") < 0);
  assert.equal(cmpVersion("v0.2.0", "0.2.0"), 0);
  assert.equal(cmpVersion("1.2", "1.2.0"), 0);
});

test("для Android берётся apk, для Windows zip", () => {
  const assets = [
    { name: "kodeks-0.2.0.apk", browser_download_url: "a" },
    { name: "kodeks-0.2.0-windows.zip", browser_download_url: "w" },
  ];
  assert.equal(pickAsset(assets, "android")?.browser_download_url, "a");
  assert.equal(pickAsset(assets, "windows")?.browser_download_url, "w");
  assert.equal(pickAsset([], "android"), undefined);
});
