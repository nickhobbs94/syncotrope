import { describe, it } from "node:test";
import * as assert from "node:assert";
import {
  zoomAtFrame,
  framesPerImage,
  finalZoomLevel,
  ZoomSettings,
} from "./zoom.js";

const settings: ZoomSettings = {
  zoomRate: 1.005,
  frameRate: 25,
  imageDurationSeconds: 3,
  targetWidth: 1920,
  targetHeight: 1080,
};

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

  it("never zooms out", () => {
    for (let frame = 1; frame < 1000; frame++) {
      assert.ok(zoomAtFrame(frame, 1.001) > zoomAtFrame(frame - 1, 1.001));
    }
  });

  it("stays at 1.0 with zoomRate 1", () => {
    assert.strictEqual(zoomAtFrame(250, 1), 1);
  });
});

describe("framesPerImage", () => {
  it("is frame rate times duration", () => {
    assert.strictEqual(framesPerImage(settings), 75);
  });

  it("rounds fractional frame counts", () => {
    assert.strictEqual(
      framesPerImage({ ...settings, frameRate: 30, imageDurationSeconds: 2.5 }),
      75,
    );
    assert.strictEqual(
      framesPerImage({ ...settings, frameRate: 24, imageDurationSeconds: 0.1 }),
      2,
    );
  });

  it("is at least one frame", () => {
    assert.strictEqual(
      framesPerImage({ ...settings, imageDurationSeconds: 0 }),
      1,
    );
  });
});

describe("finalZoomLevel", () => {
  it("is the zoom of the last frame", () => {
    // 75 frames: the last is frame 74
    assert.ok(Math.abs(finalZoomLevel(settings) - (1 + 0.005 * 74)) < 1e-12);
  });

  it("is 1 for a single-frame clip", () => {
    assert.strictEqual(
      finalZoomLevel({ ...settings, imageDurationSeconds: 0.04 }),
      1,
    );
  });
});
