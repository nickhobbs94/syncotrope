import { describe, it } from "node:test";
import * as assert from "node:assert";
import {
  zoomAtFrame,
  framesPerImage,
  finalZoomLevel,
  ZoomSettings,
} from "./zoom.js";

const settings: ZoomSettings = {
  zoomSpeed: 1,
  frameRate: 25,
  imageDurationSeconds: 10,
  targetWidth: 1920,
  targetHeight: 1080,
};

const close = (a: number, b: number) => Math.abs(a - b) < 1e-12;

describe("zoomAtFrame", () => {
  it("returns 1.0 at frame 0", () => {
    assert.strictEqual(zoomAtFrame(0, 1, 25), 1.0);
  });

  it("grows by the zoom speed each second", () => {
    assert.ok(close(zoomAtFrame(25, 1, 25), 1.01));
    assert.ok(close(zoomAtFrame(50, 1, 25), 1.01 * 1.01));
    assert.ok(close(zoomAtFrame(30, 4, 30), 1.04));
  });

  it("doesn't depend on the frame rate", () => {
    // 2 seconds in
    assert.ok(close(zoomAtFrame(50, 1, 25), zoomAtFrame(120, 1, 60)));
  });

  it("has the same ratio between every pair of consecutive frames", () => {
    const step = Math.pow(1.01, 1 / 25);
    for (let frame = 0; frame < 500; frame++) {
      const ratio = zoomAtFrame(frame + 1, 1, 25) / zoomAtFrame(frame, 1, 25);
      assert.ok(Math.abs(ratio - step) < 1e-12);
    }
  });

  it("never zooms out", () => {
    for (let frame = 1; frame < 1000; frame++) {
      assert.ok(
        zoomAtFrame(frame, 0.25, 25) > zoomAtFrame(frame - 1, 0.25, 25),
      );
    }
  });

  it("stays at 1.0 with zoom speed 0", () => {
    assert.strictEqual(zoomAtFrame(250, 0, 25), 1);
  });
});

describe("framesPerImage", () => {
  it("is frame rate times duration", () => {
    assert.strictEqual(framesPerImage(settings), 250);
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
    // 250 frames: the last is frame 249, at 9.96 seconds
    assert.ok(close(finalZoomLevel(settings), Math.pow(1.01, 249 / 25)));
  });

  it("is 1 for a single-frame clip", () => {
    assert.strictEqual(
      finalZoomLevel({ ...settings, imageDurationSeconds: 0.04 }),
      1,
    );
  });
});
