import { describe, it } from "node:test";
import * as assert from "node:assert";
import { testFunction, getSettings } from "./index.js";

describe("A thing", () => {
  it("should work", () => {
    assert.strictEqual(testFunction("abc"), 3);
  });

  it("should be ok", () => {
    assert.strictEqual(2, 2);
  });
  it("default Height is 1080", () => {
    assert.strictEqual(getSettings({}).targetHeight, 1080);
  });
});

