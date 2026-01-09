import { describe, it } from "node:test";
import * as assert from "node:assert";
import {
  zoomAtFrame,
  finalZoomLevel,
  upscaledDimensions,
  centerOffsetX,
  centerOffsetY,
  isNearInteger,
  analyzeZoomForJitter,
  ZoomSettings,
} from "./zoom.js";

describe("zoomAtFrame", () => {
  it("returns 1.0 at frame 0", () => {
    assert.strictEqual(zoomAtFrame(0, 1.005), 1.0);
  });

  it("increases by (zoomRate - 1) each frame", () => {
    const zoomRate = 1.005;
    assert.ok(Math.abs(zoomAtFrame(1, zoomRate) - 1.005) < 0.0001);
    assert.ok(Math.abs(zoomAtFrame(2, zoomRate) - 1.01) < 0.0001);
    assert.ok(Math.abs(zoomAtFrame(10, zoomRate) - 1.05) < 0.0001);
  });

  it("calculates correct zoom at frame 100 with zoomRate 1.005", () => {
    // 1 + 0.005 * 100 = 1.5
    assert.ok(Math.abs(zoomAtFrame(100, 1.005) - 1.5) < 0.0001);
  });
});

describe("finalZoomLevel", () => {
  it("calculates final zoom for default settings", () => {
    const settings: ZoomSettings = {
      zoomRate: 1.005,
      frameRate: 25,
      imageDurationSeconds: 3,
      targetWidth: 1920,
      targetHeight: 1080,
    };
    // totalFrames = 25 * 3 = 75
    // finalZoom = 1 + 0.005 * 75 = 1.375
    assert.ok(Math.abs(finalZoomLevel(settings) - 1.375) < 0.0001);
  });
});

describe("upscaledDimensions", () => {
  it("calculates upscaled dimensions", () => {
    const settings: ZoomSettings = {
      zoomRate: 1.005,
      frameRate: 25,
      imageDurationSeconds: 3,
      targetWidth: 1920,
      targetHeight: 1080,
    };
    const dims = upscaledDimensions(settings);
    // finalZoom = 1.375
    assert.ok(Math.abs(dims.width - 1920 * 1.375) < 0.01);
    assert.ok(Math.abs(dims.height - 1080 * 1.375) < 0.01);
  });

  it("produces integer dimensions with default settings", () => {
    const settings: ZoomSettings = {
      zoomRate: 1.005,
      frameRate: 25,
      imageDurationSeconds: 3,
      targetWidth: 1920,
      targetHeight: 1080,
    };
    const dims = upscaledDimensions(settings);
    // 1920 * 1.375 = 2640 (integer)
    // 1080 * 1.375 = 1485 (integer)
    assert.ok(
      isNearInteger(dims.width),
      `Width ${dims.width} should be an integer`,
    );
    assert.ok(
      isNearInteger(dims.height),
      `Height ${dims.height} should be an integer`,
    );
  });
});

describe("centerOffsetX and centerOffsetY", () => {
  it("returns 0 offset at zoom level 1", () => {
    assert.strictEqual(centerOffsetX(1920, 1), 0);
    assert.strictEqual(centerOffsetY(1080, 1), 0);
  });

  it("calculates correct offset at zoom level 2", () => {
    // At zoom 2, we show half the image, centered
    // offset = iw/2 - iw/zoom/2 = iw/2 - iw/4 = iw/4
    assert.strictEqual(centerOffsetX(1920, 2), 480);
    assert.strictEqual(centerOffsetY(1080, 2), 270);
  });

  it("calculates correct offset at zoom level 1.5", () => {
    // offset = iw/2 - iw/1.5/2 = iw/2 - iw/3 = iw/6
    const expectedX = 1920 / 6;
    const expectedY = 1080 / 6;
    assert.strictEqual(centerOffsetX(1920, 1.5), expectedX);
    assert.strictEqual(centerOffsetY(1080, 1.5), expectedY);
  });
});

describe("isNearInteger", () => {
  it("returns true for integers", () => {
    assert.ok(isNearInteger(5));
    assert.ok(isNearInteger(0));
    assert.ok(isNearInteger(-3));
  });

  it("returns true for values very close to integers", () => {
    assert.ok(isNearInteger(5.0001, 0.001));
    assert.ok(isNearInteger(4.9999, 0.001));
  });

  it("returns false for non-integers", () => {
    assert.ok(!isNearInteger(5.5));
    assert.ok(!isNearInteger(5.01, 0.001));
  });
});

describe("analyzeZoomForJitter", () => {
  // TDD TARGET: This test FAILS now, should PASS after fixing jitter
  it("produces no jitter with default settings", () => {
    const settings: ZoomSettings = {
      zoomRate: 1.005,
      frameRate: 25,
      imageDurationSeconds: 3,
      targetWidth: 1920,
      targetHeight: 1080,
    };
    const warnings = analyzeZoomForJitter(settings);
    assert.strictEqual(
      warnings.length,
      0,
      `Expected no jitter but got ${warnings.length} warnings:\n${warnings.slice(0, 10).join("\n")}`,
    );
  });

  it("detects non-integer upscaled dimensions", () => {
    const settings: ZoomSettings = {
      zoomRate: 1.003, // Will likely produce non-integer dimensions
      frameRate: 30,
      imageDurationSeconds: 3,
      targetWidth: 1920,
      targetHeight: 1080,
    };
    const warnings = analyzeZoomForJitter(settings);
    const dimensionWarnings = warnings.filter((w) => w.includes("Upscaled"));
    assert.ok(
      dimensionWarnings.length > 0,
      "Should detect non-integer upscaled dimensions",
    );
  });
});

