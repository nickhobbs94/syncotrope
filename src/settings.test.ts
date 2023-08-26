import { describe, it } from "node:test";
import * as assert from "node:assert";
import { getSettings } from "./settings.js";

describe("Default settings", () => {
  it("default height is 1080", () => {
    assert.strictEqual(getSettings({}).targetHeight, 1080);
  });

  it("can override the height", () => {
    assert.strictEqual(getSettings({
      targetHeight: 77,
    }).targetHeight, 77);
  });
});
