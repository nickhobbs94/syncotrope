import { describe, it } from "node:test";
import * as assert from "node:assert";
import {
  zoomAtFrame,
  finalZoomLevel,
  upscaledDimensions,
  centerOffsetX,
  centerOffsetY,
  flooredOffsetX,
  flooredOffsetY,
  linearOffsetX,
  constantJumpSize,
  adjustedFinalZoom,
  adjustedZoomRate,
  finalOffset,
  isNearInteger,
  analyzeZoomForJitter,
  zoomForCenteredOffset,
  hyperbolicZoomAtFrame,
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

describe("flooredOffsetX and flooredOffsetY", () => {
  it("returns integer values", () => {
    // At zoom 1.005, the ideal offset would be fractional
    const zoom = 1.005;
    const offsetX = flooredOffsetX(2640, zoom);
    const offsetY = flooredOffsetY(1485, zoom);
    assert.strictEqual(offsetX, Math.floor(offsetX));
    assert.strictEqual(offsetY, Math.floor(offsetY));
  });

  it("floors fractional offsets", () => {
    // 1920 / 6 = 320, which is already an integer
    assert.strictEqual(flooredOffsetX(1920, 1.5), 320);
    // For a fractional result, floor should round down
    // centerOffsetX(1000, 1.5) = 1000/2 - 1000/1.5/2 = 500 - 333.33... = 166.66...
    assert.strictEqual(flooredOffsetX(1000, 1.5), 166);
  });

  it("produces smooth progression across frames", () => {
    // Verify offsets increase smoothly with consistent jumps
    const width = 2640;
    let prevOffset = flooredOffsetX(width, 1);
    let prevJump = 0;
    for (let frame = 1; frame <= 75; frame++) {
      const zoom = 1 + 0.005 * frame;
      const offset = flooredOffsetX(width, zoom);
      const jump = offset - prevOffset;
      // Offset should always increase
      assert.ok(jump >= 0, `Frame ${frame}: offset should not decrease`);
      // Jump should be consistent (vary by at most 1 due to floor rounding)
      if (frame > 1) {
        const variation = Math.abs(jump - prevJump);
        assert.ok(variation <= 1, `Frame ${frame}: jump varied by ${variation} (was ${prevJump}, now ${jump})`);
      }
      prevOffset = offset;
      prevJump = jump;
    }
  });
});

describe("adjustedFinalZoom and adjustedZoomRate", () => {
  it("produces finalZoom where offset equals jumpSize * totalFrames", () => {
    const inputSize = 2640;
    const jumpSize = 5;
    const totalFrames = 75;

    const adjustedZoom = adjustedFinalZoom(inputSize, jumpSize, totalFrames);
    const actualOffset = finalOffset(inputSize, adjustedZoom);
    const expectedOffset = jumpSize * totalFrames; // 375

    assert.ok(
      Math.abs(actualOffset - expectedOffset) < 0.001,
      `Expected offset ${expectedOffset}, got ${actualOffset}`,
    );
  });

  it("adjustedZoomRate produces correct finalZoom after totalFrames", () => {
    const inputSize = 2640;
    const jumpSize = 5;
    const totalFrames = 75;

    const zoomRate = adjustedZoomRate(inputSize, jumpSize, totalFrames);
    const computedFinalZoom = 1 + (zoomRate - 1) * totalFrames;
    const expectedFinalZoom = adjustedFinalZoom(inputSize, jumpSize, totalFrames);

    assert.ok(
      Math.abs(computedFinalZoom - expectedFinalZoom) < 0.0001,
      `Expected finalZoom ${expectedFinalZoom}, got ${computedFinalZoom}`,
    );
  });

  it("synchronizes zoom and position at final frame", () => {
    const inputSize = 2640;
    const totalFrames = 75;
    const userFinalZoom = 1.375; // Original user setting
    const jumpSize = constantJumpSize(inputSize, totalFrames, userFinalZoom);
    const zoomRate = adjustedZoomRate(inputSize, jumpSize, totalFrames);

    // At frame 0, both should be 0
    const zoomAtStart = 1 + (zoomRate - 1) * 0;
    assert.strictEqual(centerOffsetX(inputSize, zoomAtStart), 0);
    assert.strictEqual(jumpSize * 0, 0);

    // At final frame, zoom-based offset should match linear offset
    const finalZoom = 1 + (zoomRate - 1) * totalFrames;
    const zoomBasedOffset = centerOffsetX(inputSize, finalZoom);
    const linearOffset = jumpSize * totalFrames;

    assert.ok(
      Math.abs(zoomBasedOffset - linearOffset) < 1,
      `Final frame: zoom offset ${zoomBasedOffset.toFixed(2)} vs linear ${linearOffset}`,
    );
  });
});

describe("focus drift with linear zoom", () => {
  it("detects drift at middle frames when using linear zoom", () => {
    const inputSize = 2640;
    const totalFrames = 75;
    const userFinalZoom = 1.375;
    const jumpSize = constantJumpSize(inputSize, totalFrames, userFinalZoom);
    const zoomRate = adjustedZoomRate(inputSize, jumpSize, totalFrames);

    // Track maximum drift across all frames
    let maxDrift = 0;
    let maxDriftFrame = 0;

    for (let frame = 0; frame <= totalFrames; frame++) {
      // Linear zoom progression
      const linearZoom = 1 + (zoomRate - 1) * frame;
      const zoomBasedOffset = centerOffsetX(inputSize, linearZoom);

      // Linear position progression
      const linearOffset = jumpSize * frame;

      const drift = Math.abs(zoomBasedOffset - linearOffset);
      if (drift > maxDrift) {
        maxDrift = drift;
        maxDriftFrame = frame;
      }
    }

    // With linear zoom, drift peaks around the middle frames
    // This test documents the current behavior - drift should be > 0 at middle
    assert.ok(
      maxDrift > 1,
      `Expected drift > 1 pixel at middle frames, but max drift was ${maxDrift.toFixed(2)} at frame ${maxDriftFrame}`,
    );
    assert.ok(
      maxDriftFrame > 10 && maxDriftFrame < totalFrames - 10,
      `Expected max drift near middle, but was at frame ${maxDriftFrame}`,
    );
  });
});

describe("zoomForCenteredOffset", () => {
  it("returns 1.0 when target offset is 0", () => {
    assert.strictEqual(zoomForCenteredOffset(2640, 0), 1);
  });

  it("is the inverse of centerOffsetX", () => {
    const inputSize = 2640;
    const testZooms = [1.1, 1.25, 1.375, 1.5, 2.0];

    for (const zoom of testZooms) {
      const offset = centerOffsetX(inputSize, zoom);
      const recoveredZoom = zoomForCenteredOffset(inputSize, offset);
      assert.ok(
        Math.abs(recoveredZoom - zoom) < 0.0001,
        `zoom ${zoom} -> offset ${offset} -> zoom ${recoveredZoom}`,
      );
    }
  });
});

describe("hyperbolicZoomAtFrame", () => {
  it("returns 1.0 at frame 0", () => {
    assert.strictEqual(hyperbolicZoomAtFrame(2640, 5, 0), 1);
  });

  it("produces correct final zoom", () => {
    const inputSize = 2640;
    const jumpSize = 5;
    const totalFrames = 75;

    const finalZoom = hyperbolicZoomAtFrame(inputSize, jumpSize, totalFrames);
    const expectedFinalZoom = adjustedFinalZoom(inputSize, jumpSize, totalFrames);

    assert.ok(
      Math.abs(finalZoom - expectedFinalZoom) < 0.0001,
      `Expected ${expectedFinalZoom}, got ${finalZoom}`,
    );
  });

  it("eliminates focus drift at every frame", () => {
    const inputSize = 2640;
    const totalFrames = 75;
    const userFinalZoom = 1.375;
    const jumpSize = constantJumpSize(inputSize, totalFrames, userFinalZoom);

    let maxDrift = 0;

    for (let frame = 0; frame <= totalFrames; frame++) {
      // Hyperbolic zoom that follows the position
      const zoom = hyperbolicZoomAtFrame(inputSize, jumpSize, frame);
      const zoomBasedOffset = centerOffsetX(inputSize, zoom);

      // Linear position
      const linearOffset = jumpSize * frame;

      const drift = Math.abs(zoomBasedOffset - linearOffset);
      if (drift > maxDrift) {
        maxDrift = drift;
      }
    }

    // With hyperbolic zoom, drift should be essentially zero
    assert.ok(
      maxDrift < 0.0001,
      `Expected no drift, but max drift was ${maxDrift.toFixed(6)}`,
    );
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

  // Linear interpolation produces monotonic jumps (no back-and-forth)
  it("produces monotonic jumps without back-and-forth variation", () => {
    const settings: ZoomSettings = {
      zoomRate: 1.005,
      frameRate: 25,
      imageDurationSeconds: 3,
      targetWidth: 1920,
      targetHeight: 1080,
    };
    const { width: upscaledWidth } = upscaledDimensions(settings);
    const totalFrames = settings.frameRate * settings.imageDurationSeconds;
    const finalZoom = finalZoomLevel(settings);

    // Collect all jumps using linear interpolation
    const jumps: number[] = [];
    let prevOffset = linearOffsetX(upscaledWidth, 0, totalFrames, finalZoom);
    for (let frame = 1; frame <= totalFrames; frame++) {
      const offset = linearOffsetX(upscaledWidth, frame, totalFrames, finalZoom);
      jumps.push(offset - prevOffset);
      prevOffset = offset;
    }

    // Check for back-and-forth pattern (e.g., 6,7,6,7 is bad, 6,6,7,7 is ok)
    let directionChanges = 0;
    for (let i = 2; i < jumps.length; i++) {
      const prevDiff = jumps[i - 1] - jumps[i - 2];
      const currDiff = jumps[i] - jumps[i - 1];
      // If we went up then down, or down then up, that's a direction change
      if ((prevDiff > 0 && currDiff < 0) || (prevDiff < 0 && currDiff > 0)) {
        directionChanges++;
      }
    }

    // Linear interpolation with floor() produces monotonic jumps
    assert.strictEqual(
      directionChanges,
      0,
      `Expected monotonic jumps but got ${directionChanges} direction changes. Jumps: ${jumps.slice(0, 20).join(",")}...`,
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

