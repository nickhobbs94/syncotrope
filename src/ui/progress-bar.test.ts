import { describe, it } from "node:test";
import * as assert from "node:assert";
import { calculateProgress } from "./progress-bar.js";

describe("calculateProgress", () => {
  it("calculates 0% at frame 0", () => {
    const settings = { frameRate: 25, imageDurationSeconds: 4 };
    assert.strictEqual(calculateProgress(0, settings), 0);
  });

  it("calculates 50% at halfway point", () => {
    const settings = { frameRate: 25, imageDurationSeconds: 4 };
    // Total frames = 25 * 4 = 100, so frame 50 = 50%
    assert.strictEqual(calculateProgress(50, settings), 50);
  });

  it("calculates 100% at final frame", () => {
    const settings = { frameRate: 25, imageDurationSeconds: 4 };
    // Total frames = 25 * 4 = 100
    assert.strictEqual(calculateProgress(100, settings), 100);
  });

  it("handles different frame rates", () => {
    const settings = { frameRate: 30, imageDurationSeconds: 3 };
    // Total frames = 30 * 3 = 90, so frame 45 = 50%
    assert.strictEqual(calculateProgress(45, settings), 50);
  });

  it("handles fractional progress", () => {
    const settings = { frameRate: 25, imageDurationSeconds: 3 };
    // Total frames = 75, frame 25 = 33.33...%
    const progress = calculateProgress(25, settings);
    assert.ok(Math.abs(progress - 33.333) < 0.01);
  });
});
