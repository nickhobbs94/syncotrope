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

  it("default zoom speed is 1% per second", () => {
    assert.strictEqual(populateDefaults({}).zoomSpeed, 1);
  });

  it("default frame rate is 25", () => {
    assert.strictEqual(populateDefaults({}).frameRate, 25);
  });

  it("default image duration is 10 seconds", () => {
    assert.strictEqual(populateDefaults({}).imageDurationSeconds, 10);
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
    assert.strictEqual(settings.zoomSpeed, 1);
    assert.strictEqual(settings.imageDurationSeconds, 10);
  });

  it("can enable logging flags", () => {
    const settings = populateDefaults({
      logging: ["ffmpeg", "debug"],
    });
    assert.deepStrictEqual(settings.logging, ["ffmpeg", "debug"]);
  });
});
