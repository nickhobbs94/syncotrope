import { describe, it } from "node:test";
import * as assert from "node:assert";
import { populateDefaults } from "./settings.js";

describe("Default settings", () => {
  it("default height is 1080", () => {
    assert.strictEqual(populateDefaults({}).targetHeight, 1080);
  });

  it("can override the height", () => {
    assert.strictEqual(
      populateDefaults({
        targetHeight: 77,
      }).targetHeight,
      77,
    );
  });
});
