import { describe, it } from "node:test";
import * as assert from "node:assert";
import { avcCodecStrings, quantizerForQuality } from "./encoder.js";

describe("avcCodecStrings", () => {
  it("uses level 4.0 for 1080p at 25fps", () => {
    assert.deepStrictEqual(avcCodecStrings(1920, 1080, 25), [
      "avc1.640028",
      "avc1.4D4028",
      "avc1.42E028",
    ]);
  });

  it("uses level 4.2 for 1080p at 60fps", () => {
    assert.strictEqual(avcCodecStrings(1920, 1080, 60)[0], "avc1.64002A");
  });

  it("uses level 5.1 for 4K at 30fps", () => {
    assert.strictEqual(avcCodecStrings(3840, 2160, 30)[0], "avc1.640033");
  });

  it("uses a low level for small video", () => {
    assert.strictEqual(avcCodecStrings(640, 360, 25)[0], "avc1.64001F");
  });

  it("handles tall video", () => {
    assert.strictEqual(avcCodecStrings(1080, 1920, 25)[0], "avc1.640028");
  });

  it("returns nothing beyond H.264's limits", () => {
    assert.deepStrictEqual(avcCodecStrings(16384, 16384, 25), []);
  });
});

describe("quantizerForQuality", () => {
  it("uses the CRF value directly for H.264", () => {
    assert.strictEqual(quantizerForQuality("mp4", 23), 23);
  });

  it("clamps to H.264's range", () => {
    assert.strictEqual(quantizerForQuality("mp4", 70), 51);
    assert.strictEqual(quantizerForQuality("mp4", -3), 0);
  });

  it("allows VP9's wider range", () => {
    assert.strictEqual(quantizerForQuality("webm", 60), 60);
    assert.strictEqual(quantizerForQuality("webm", 70), 63);
  });

  it("rounds fractional values", () => {
    assert.strictEqual(quantizerForQuality("mp4", 22.6), 23);
  });
});
