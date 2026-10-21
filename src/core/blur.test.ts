import { describe, it } from "node:test";
import * as assert from "node:assert";
import { parseBoxBlur, boxBlurSigma, gaussianBlur } from "./blur.js";

describe("parseBoxBlur", () => {
  it("parses radius and power", () => {
    assert.deepStrictEqual(parseBoxBlur("50:10"), { radius: 50, power: 10 });
  });

  it("defaults power to 2 like FFmpeg boxblur", () => {
    assert.deepStrictEqual(parseBoxBlur("20"), { radius: 20, power: 2 });
  });

  it("ignores surrounding whitespace", () => {
    assert.deepStrictEqual(parseBoxBlur(" 5:3 "), { radius: 5, power: 3 });
  });

  it("rejects other formats", () => {
    assert.throws(() => parseBoxBlur("strong"));
    assert.throws(() => parseBoxBlur("50:"));
    assert.throws(() => parseBoxBlur("-5:2"));
  });
});

describe("boxBlurSigma", () => {
  it("matches the variance of one box pass", () => {
    // width 3 box: variance (9 - 1) / 12 = 2/3
    assert.ok(
      Math.abs(boxBlurSigma({ radius: 1, power: 1 }) - Math.sqrt(2 / 3)) <
        1e-12,
    );
  });

  it("adds variance over repeated passes", () => {
    const one = boxBlurSigma({ radius: 50, power: 1 });
    const ten = boxBlurSigma({ radius: 50, power: 10 });
    assert.ok(Math.abs(ten - one * Math.sqrt(10)) < 1e-9);
  });

  it("is about 92px for the default 50:10", () => {
    const sigma = boxBlurSigma({ radius: 50, power: 10 });
    assert.ok(sigma > 91 && sigma < 93);
  });

  it("is 0 for radius 0", () => {
    assert.strictEqual(boxBlurSigma({ radius: 0, power: 10 }), 0);
  });
});

describe("gaussianBlur", () => {
  function image(width: number, height: number, fill: number[]) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) data.set(fill, i * 4);
    return data;
  }

  it("leaves a flat colour unchanged, edges included", () => {
    const data = image(9, 7, [40, 120, 200, 255]);
    gaussianBlur(data, 9, 7, 2);
    for (let i = 0; i < data.length; i += 4) {
      assert.deepStrictEqual([...data.subarray(i, i + 4)], [40, 120, 200, 255]);
    }
  });

  it("spreads a single bright pixel symmetrically and keeps its total", () => {
    const w = 21;
    const data = image(w, w, [0, 0, 0, 255]);
    const centre = (10 * w + 10) * 4;
    data[centre] = 255;
    gaussianBlur(data, w, w, 1.5);
    const at = (x: number, y: number) => data[(y * w + x) * 4];
    assert.strictEqual(at(9, 10), at(11, 10));
    assert.strictEqual(at(10, 9), at(10, 11));
    assert.ok(at(10, 10) < 255 && at(10, 10) > at(11, 10));
    let total = 0;
    for (let i = 0; i < data.length; i += 4) total += data[i];
    assert.ok(Math.abs(total - 255) < 15); // rounding to 8 bits per pixel
  });

  it("does nothing with sigma 0", () => {
    const data = image(3, 3, [1, 2, 3, 4]);
    gaussianBlur(data, 3, 3, 0);
    assert.deepStrictEqual([...data.subarray(0, 4)], [1, 2, 3, 4]);
  });
});
