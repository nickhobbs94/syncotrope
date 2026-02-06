import { describe, it } from "node:test";
import * as assert from "node:assert";
import { parseFrameFromLog, calculateProgress } from "./progress-bar.js";

describe("parseFrameFromLog", () => {
  it("parses frame number from typical FFmpeg output", () => {
    assert.strictEqual(parseFrameFromLog("frame=   42 fps=25"), 42);
  });

  it("parses frame number without leading spaces", () => {
    assert.strictEqual(parseFrameFromLog("frame=100 fps=30"), 100);
  });

  it("parses frame number with many leading spaces", () => {
    assert.strictEqual(parseFrameFromLog("frame=    5 fps=25"), 5);
  });

  it("returns null for non-frame log messages", () => {
    assert.strictEqual(parseFrameFromLog("Input #0, png_pipe"), null);
  });

  it("returns null for empty string", () => {
    assert.strictEqual(parseFrameFromLog(""), null);
  });

  it("returns null when frame appears mid-line", () => {
    assert.strictEqual(parseFrameFromLog("  frame=42 fps=25"), null);
  });
});

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

describe("parseFrameFromLog error paths", () => {
  it("returns null for string with only 'frame=' and no number", () => {
    assert.strictEqual(parseFrameFromLog("frame= fps=25"), null);
  });

  it("returns null for 'frame' without equals sign", () => {
    assert.strictEqual(parseFrameFromLog("frame 42 fps=25"), null);
  });

  it("parses frame=0 correctly", () => {
    assert.strictEqual(parseFrameFromLog("frame=0 fps=25"), 0);
  });

  it("parses very large frame numbers", () => {
    assert.strictEqual(parseFrameFromLog("frame=999999 fps=25"), 999999);
  });

  it("returns null for frame= followed by non-numeric text", () => {
    assert.strictEqual(parseFrameFromLog("frame=abc fps=25"), null);
  });

  it("returns null for just the word 'frame' alone", () => {
    assert.strictEqual(parseFrameFromLog("frame"), null);
  });

  it("returns null for frame= with negative number", () => {
    // Regex expects [0-9]*, negative sign won't match
    assert.strictEqual(parseFrameFromLog("frame=-1 fps=25"), null);
  });
});

describe("calculateProgress error paths", () => {
  it("returns Infinity when frameRate is 0 (division by zero)", () => {
    const settings = { frameRate: 0, imageDurationSeconds: 4 };
    const progress = calculateProgress(50, settings);
    assert.ok(!Number.isFinite(progress), `Expected non-finite, got ${progress}`);
  });

  it("returns Infinity when imageDurationSeconds is 0 (division by zero)", () => {
    const settings = { frameRate: 25, imageDurationSeconds: 0 };
    const progress = calculateProgress(50, settings);
    assert.ok(!Number.isFinite(progress), `Expected non-finite, got ${progress}`);
  });

  it("returns NaN when both frameRate and imageDurationSeconds are 0", () => {
    const settings = { frameRate: 0, imageDurationSeconds: 0 };
    const progress = calculateProgress(0, settings);
    // 0 / 0 = NaN
    assert.ok(Number.isNaN(progress), `Expected NaN, got ${progress}`);
  });

  it("returns negative progress for negative frame", () => {
    const settings = { frameRate: 25, imageDurationSeconds: 4 };
    const progress = calculateProgress(-10, settings);
    assert.ok(progress < 0, `Expected negative progress, got ${progress}`);
  });

  it("returns over 100% when frame exceeds total frames", () => {
    const settings = { frameRate: 25, imageDurationSeconds: 4 };
    // Total frames = 100, frame 150 = 150%
    const progress = calculateProgress(150, settings);
    assert.ok(progress > 100, `Expected >100%, got ${progress}`);
  });

  it("returns exactly 0 for frame 0 regardless of settings", () => {
    assert.strictEqual(calculateProgress(0, { frameRate: 1, imageDurationSeconds: 1 }), 0);
    assert.strictEqual(calculateProgress(0, { frameRate: 60, imageDurationSeconds: 10 }), 0);
    assert.strictEqual(calculateProgress(0, { frameRate: 25, imageDurationSeconds: 3 }), 0);
  });
});
