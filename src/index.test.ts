import { describe, it } from "node:test";
import * as assert from "node:assert";
import { testFunction } from "./index.js";

describe("A thing", () => {
  it("should work", () => {
    assert.strictEqual(testFunction("abc"), 4);
  });

  it("should be ok", () => {
    assert.strictEqual(2, 2);
  });
});
