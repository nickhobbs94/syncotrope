import { describe, it } from "node:test";
import * as assert from "node:assert";
import {
  calculateZoompanParams,
  buildZoompanFilter,
  zoompanFilterFromSettings,
  buildScaleFilter,
  buildBlurFilter,
  buildOverlayFilter,
  ZoompanParams,
} from "./ffmpeg-filters";
import { ZoomSettings } from "./zoom";

const defaultSettings: ZoomSettings = {
  zoomRate: 1.005,
  frameRate: 25,
  imageDurationSeconds: 3,
  targetWidth: 1920,
  targetHeight: 1080,
};

describe("calculateZoompanParams", () => {
  it("calculates duration from frameRate and imageDurationSeconds", () => {
    const params = calculateZoompanParams(defaultSettings);
    assert.strictEqual(params.duration, 75); // 25 fps * 3 seconds
  });

  it("preserves fps from settings", () => {
    const params = calculateZoompanParams(defaultSettings);
    assert.strictEqual(params.fps, 25);
  });

  it("preserves output dimensions from settings", () => {
    const params = calculateZoompanParams(defaultSettings);
    assert.strictEqual(params.width, 1920);
    assert.strictEqual(params.height, 1080);
  });

  it("calculates positive jump values for zoom in effect", () => {
    const params = calculateZoompanParams(defaultSettings);
    assert.ok(
      params.jumpX > 0,
      `jumpX should be positive, got ${params.jumpX}`,
    );
    assert.ok(
      params.jumpY > 0,
      `jumpY should be positive, got ${params.jumpY}`,
    );
  });

  it("calculates positive zoom increment", () => {
    const params = calculateZoompanParams(defaultSettings);
    assert.ok(
      params.zoomIncrement > 0,
      `zoomIncrement should be positive, got ${params.zoomIncrement}`,
    );
  });

  it("jump values are integers (required for smooth motion)", () => {
    const params = calculateZoompanParams(defaultSettings);
    assert.strictEqual(params.jumpX, Math.round(params.jumpX));
    assert.strictEqual(params.jumpY, Math.round(params.jumpY));
  });

  it("scales jumps proportionally with resolution", () => {
    const hdParams = calculateZoompanParams(defaultSettings);
    const sdSettings: ZoomSettings = {
      ...defaultSettings,
      targetWidth: 1280,
      targetHeight: 720,
    };
    const sdParams = calculateZoompanParams(sdSettings);

    // SD should have smaller jumps than HD (roughly 2/3 ratio)
    assert.ok(sdParams.jumpX < hdParams.jumpX);
    assert.ok(sdParams.jumpY < hdParams.jumpY);
  });
});

describe("buildZoompanFilter", () => {
  it("produces valid FFmpeg zoompan filter syntax", () => {
    const params: ZoompanParams = {
      zoomIncrement: 0.005, // Not used in hyperbolic formula, but kept for compatibility
      jumpX: 10,
      jumpY: 6,
      duration: 75,
      fps: 25,
      width: 1920,
      height: 1080,
    };
    const filter = buildZoompanFilter(params);

    assert.ok(filter.startsWith("zoompan="));
    // Uses hyperbolic zoom formula: z = iw/(iw-2*jumpX*on)
    assert.ok(filter.includes("z='iw/(iw-2*10*on)'"));
    assert.ok(filter.includes("x='10*on'"));
    assert.ok(filter.includes("y='6*on'"));
    assert.ok(filter.includes("d=75"));
    assert.ok(filter.includes("fps=25"));
    assert.ok(filter.includes("s=1920x1080"));
  });

  it("uses hyperbolic zoom formula to eliminate drift", () => {
    const params: ZoompanParams = {
      zoomIncrement: 0.01,
      jumpX: 5,
      jumpY: 3,
      duration: 50,
      fps: 30,
      width: 1280,
      height: 720,
    };
    const filter = buildZoompanFilter(params);

    // Hyperbolic zoom: z = iw/(iw-2*jumpX*on)
    assert.ok(
      filter.includes("z='iw/(iw-2*5*on)'"),
      `Expected hyperbolic zoom formula, got: ${filter}`,
    );
    // Position still uses linear formula
    assert.ok(filter.includes("x='5*on'"));
    assert.ok(filter.includes("y='3*on'"));
  });
});

describe("zoompanFilterFromSettings", () => {
  it("generates complete filter from settings", () => {
    const filter = zoompanFilterFromSettings(defaultSettings);

    assert.ok(filter.startsWith("zoompan="));
    assert.ok(filter.includes("d=75")); // 25 fps * 3 seconds
    assert.ok(filter.includes("fps=25"));
    assert.ok(filter.includes("s=1920x1080"));
  });

  it("generates different filters for different settings", () => {
    const filter1 = zoompanFilterFromSettings(defaultSettings);
    const filter2 = zoompanFilterFromSettings({
      ...defaultSettings,
      zoomRate: 1.01,
    });

    assert.notStrictEqual(filter1, filter2);
  });
});

describe("buildScaleFilter", () => {
  it("builds scale filter with both dimensions", () => {
    const filter = buildScaleFilter(1920, 1080);
    assert.strictEqual(filter, "scale=1920:1080");
  });

  it("supports -1 for aspect ratio preservation", () => {
    const filter = buildScaleFilter(1920, -1);
    assert.strictEqual(filter, "scale=1920:-1");
  });

  it("supports -1 for width with fixed height", () => {
    const filter = buildScaleFilter(-1, 1080);
    assert.strictEqual(filter, "scale=-1:1080");
  });
});

describe("buildBlurFilter", () => {
  it("builds boxblur filter with radius and power", () => {
    const filter = buildBlurFilter("50:10");
    assert.strictEqual(filter, "boxblur=50:10");
  });

  it("handles different blur values", () => {
    const filter = buildBlurFilter("20:5");
    assert.strictEqual(filter, "boxblur=20:5");
  });
});

describe("buildOverlayFilter", () => {
  it("builds overlay filter for centering", () => {
    const filter = buildOverlayFilter(1920, 1080);

    // Should center horizontally
    assert.ok(filter.includes("(1920/2)-(overlay_w/2)"));
    // Should crop to target dimensions
    assert.ok(filter.includes("crop=1920:1080:0:0"));
    // Should use correct stream mapping
    assert.ok(filter.includes("[0:v][1:v]overlay"));
    assert.ok(filter.includes("[outv]"));
  });

  it("adapts to different resolutions", () => {
    const filter = buildOverlayFilter(1280, 720);

    assert.ok(filter.includes("(1280/2)-(overlay_w/2)"));
    assert.ok(filter.includes("crop=1280:720:0:0"));
  });

  it("handles 4K resolution", () => {
    const filter = buildOverlayFilter(3840, 2160);

    assert.ok(filter.includes("(3840/2)-(overlay_w/2)"));
    assert.ok(filter.includes("crop=3840:2160:0:0"));
  });

  it("handles square aspect ratio", () => {
    const filter = buildOverlayFilter(1080, 1080);

    assert.ok(filter.includes("(1080/2)-(overlay_w/2)"));
    assert.ok(filter.includes("crop=1080:1080:0:0"));
  });
});

describe("settings to filter integration", () => {
  it("default settings produce valid zoompan with no jitter", () => {
    const params = calculateZoompanParams(defaultSettings);

    // Verify all params are finite numbers
    assert.ok(Number.isFinite(params.zoomIncrement));
    assert.ok(Number.isFinite(params.jumpX));
    assert.ok(Number.isFinite(params.jumpY));
    assert.ok(Number.isFinite(params.duration));

    // Verify jumps are integers (prevents sub-pixel jitter)
    assert.strictEqual(params.jumpX % 1, 0);
    assert.strictEqual(params.jumpY % 1, 0);
  });

  it("higher zoom rate produces larger jumps", () => {
    const normalParams = calculateZoompanParams(defaultSettings);
    const fastZoomParams = calculateZoompanParams({
      ...defaultSettings,
      zoomRate: 1.01,
    });

    assert.ok(fastZoomParams.jumpX > normalParams.jumpX);
    assert.ok(fastZoomParams.jumpY > normalParams.jumpY);
  });

  it("longer duration produces more frames", () => {
    const shortParams = calculateZoompanParams(defaultSettings);
    const longParams = calculateZoompanParams({
      ...defaultSettings,
      imageDurationSeconds: 6,
    });

    assert.strictEqual(longParams.duration, shortParams.duration * 2);
    // Same zoomRate but more frames = higher final zoom = larger total offset
    // Jump size stays similar (slightly larger due to more total zoom)
    assert.ok(longParams.jumpX >= shortParams.jumpX);
  });

  it("handles 60fps video settings", () => {
    const highFpsSettings: ZoomSettings = {
      ...defaultSettings,
      frameRate: 60,
    };
    const params = calculateZoompanParams(highFpsSettings);

    assert.strictEqual(params.fps, 60);
    assert.strictEqual(params.duration, 180); // 60 * 3
    assert.ok(params.jumpX > 0);
    assert.ok(params.jumpY > 0);
  });

  it("handles 4K resolution settings", () => {
    const uhd4kSettings: ZoomSettings = {
      zoomRate: 1.005,
      frameRate: 25,
      imageDurationSeconds: 3,
      targetWidth: 3840,
      targetHeight: 2160,
    };
    const params = calculateZoompanParams(uhd4kSettings);

    assert.strictEqual(params.width, 3840);
    assert.strictEqual(params.height, 2160);
    // 4K should have larger jumps than HD
    const hdParams = calculateZoompanParams(defaultSettings);
    assert.ok(params.jumpX > hdParams.jumpX);
    assert.ok(params.jumpY > hdParams.jumpY);
  });

  it("produces complete end-to-end filter from settings", () => {
    const filter = zoompanFilterFromSettings(defaultSettings);

    // Should be a valid FFmpeg zoompan filter
    assert.ok(filter.startsWith("zoompan="));
    assert.ok(filter.includes("z="));
    assert.ok(filter.includes("x="));
    assert.ok(filter.includes("y="));
    assert.ok(filter.includes("d="));
    assert.ok(filter.includes("fps="));
    assert.ok(filter.includes("s="));
  });
});
