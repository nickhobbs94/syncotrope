import { describe, it } from "node:test";
import * as assert from "node:assert";
import { populateDefaults } from "./settings.js";

describe("Default settings", () => {
  it("default height is 1080", () => {
    assert.strictEqual(populateDefaults({}).targetHeight, 1080);
  });

  it("default width is 1920", () => {
    assert.strictEqual(populateDefaults({}).targetWidth, 1920);
  });

  it("default blur is 50:10", () => {
    assert.strictEqual(populateDefaults({}).targetBlur, "50:10");
  });

  it("default zoom rate is 1.005", () => {
    assert.strictEqual(populateDefaults({}).zoomRate, 1.005);
  });

  it("default frame rate is 25", () => {
    assert.strictEqual(populateDefaults({}).frameRate, 25);
  });

  it("default image duration is 3 seconds", () => {
    assert.strictEqual(populateDefaults({}).imageDurationSeconds, 3);
  });

  it("default logging is empty", () => {
    assert.deepStrictEqual(populateDefaults({}).logging, []);
  });

  it("can override the height", () => {
    assert.strictEqual(
      populateDefaults({
        targetHeight: 77,
      }).targetHeight,
      77,
    );
  });

  it("can override multiple settings at once", () => {
    const settings = populateDefaults({
      targetWidth: 1280,
      targetHeight: 720,
      frameRate: 30,
    });
    assert.strictEqual(settings.targetWidth, 1280);
    assert.strictEqual(settings.targetHeight, 720);
    assert.strictEqual(settings.frameRate, 30);
    // Non-overridden values should remain defaults
    assert.strictEqual(settings.zoomRate, 1.005);
    assert.strictEqual(settings.imageDurationSeconds, 3);
  });

  it("can enable logging flags", () => {
    const settings = populateDefaults({
      logging: ["ffmpeg", "debug"],
    });
    assert.deepStrictEqual(settings.logging, ["ffmpeg", "debug"]);
  });
});

describe("Settings error paths and boundary conditions", () => {
  it("populateDefaults with all fields overridden uses no defaults", () => {
    const full = {
      targetHeight: 720,
      targetWidth: 1280,
      targetBlur: "20:5",
      zoomRate: 1.01,
      frameRate: 30,
      imageDurationSeconds: 5,
      outputFormat: "webm" as const,
      videoQuality: 18,
      logging: [] as ("ffmpeg" | "file-transfer" | "debug")[],
    };
    const settings = populateDefaults(full);
    assert.strictEqual(settings.targetHeight, 720);
    assert.strictEqual(settings.targetWidth, 1280);
    assert.strictEqual(settings.targetBlur, "20:5");
    assert.strictEqual(settings.zoomRate, 1.01);
    assert.strictEqual(settings.frameRate, 30);
    assert.strictEqual(settings.imageDurationSeconds, 5);
    assert.strictEqual(settings.outputFormat, "webm");
    assert.strictEqual(settings.videoQuality, 18);
  });

  it("populateDefaults with 0 dimensions preserves them", () => {
    const settings = populateDefaults({ targetWidth: 0, targetHeight: 0 });
    assert.strictEqual(settings.targetWidth, 0);
    assert.strictEqual(settings.targetHeight, 0);
  });

  it("populateDefaults with negative values preserves them", () => {
    const settings = populateDefaults({
      targetWidth: -1,
      frameRate: -10,
      imageDurationSeconds: -5,
    });
    assert.strictEqual(settings.targetWidth, -1);
    assert.strictEqual(settings.frameRate, -10);
    assert.strictEqual(settings.imageDurationSeconds, -5);
  });

  it("populateDefaults with NaN values preserves them", () => {
    const settings = populateDefaults({ zoomRate: NaN });
    assert.ok(Number.isNaN(settings.zoomRate));
  });

  it("populateDefaults with 0 zoomRate preserves it", () => {
    const settings = populateDefaults({ zoomRate: 0 });
    assert.strictEqual(settings.zoomRate, 0);
  });

  it("populateDefaults with videoQuality 0 (best) preserves it", () => {
    const settings = populateDefaults({ videoQuality: 0 });
    assert.strictEqual(settings.videoQuality, 0);
  });

  it("populateDefaults with videoQuality 51 (worst) preserves it", () => {
    const settings = populateDefaults({ videoQuality: 51 });
    assert.strictEqual(settings.videoQuality, 51);
  });

  it("default outputFormat is mp4", () => {
    assert.strictEqual(populateDefaults({}).outputFormat, "mp4");
  });

  it("default videoQuality is 23", () => {
    assert.strictEqual(populateDefaults({}).videoQuality, 23);
  });

  it("later overrides win when spreading", () => {
    // Verify the spread-based merge semantics work correctly
    const settings = populateDefaults({ targetWidth: 1280 });
    assert.strictEqual(settings.targetWidth, 1280);
    // Other fields still have defaults
    assert.strictEqual(settings.targetHeight, 1080);
  });
});
