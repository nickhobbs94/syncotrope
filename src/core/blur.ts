/**
 * Background blur.
 *
 * The blur setting keeps the FFmpeg boxblur format "radius:power" (power
 * defaults to 2), measured in output pixels. A box blur repeated `power` times
 * is close to a Gaussian, so it is converted to the Gaussian with the same
 * spread and applied in JavaScript.
 */

export type BoxBlur = { radius: number; power: number };

/**
 * Parse "radius:power" (or just "radius"). Throws on anything else.
 */
export function parseBoxBlur(blur: string): BoxBlur {
  const match = blur.trim().match(/^(\d+(?:\.\d+)?)(?::(\d+))?$/);
  if (!match) {
    throw new Error(
      `Blur must look like "radius:power", for example "50:10" (got "${blur}")`,
    );
  }
  return {
    radius: Number(match[1]),
    power: match[2] === undefined ? 2 : Number(match[2]),
  };
}

/**
 * Standard deviation (in pixels) of the Gaussian matching a box blur of the
 * given radius applied `power` times. One box of width 2r+1 has variance
 * ((2r+1)^2 - 1) / 12, and variances add up over repeated passes.
 */
export function boxBlurSigma({ radius, power }: BoxBlur): number {
  const width = 2 * radius + 1;
  return Math.sqrt((power * (width * width - 1)) / 12);
}

/**
 * Separable Gaussian blur of RGBA pixels, in place. Edges are clamped, so the
 * borders don't darken. Alpha is set to opaque.
 */
export function gaussianBlur(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  sigma: number,
): void {
  if (sigma <= 0) return;
  const r = Math.max(1, Math.ceil(sigma * 3));
  const kernel = new Float32Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    kernel[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma));
    sum += kernel[i + r];
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;

  const tmp = new Float32Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let a = 0,
        b = 0,
        c = 0;
      for (let k = -r; k <= r; k++) {
        const xx = Math.min(width - 1, Math.max(0, x + k));
        const p = (y * width + xx) * 4;
        const w = kernel[k + r];
        a += data[p] * w;
        b += data[p + 1] * w;
        c += data[p + 2] * w;
      }
      const q = (y * width + x) * 3;
      tmp[q] = a;
      tmp[q + 1] = b;
      tmp[q + 2] = c;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let a = 0,
        b = 0,
        c = 0;
      for (let k = -r; k <= r; k++) {
        const yy = Math.min(height - 1, Math.max(0, y + k));
        const q = (yy * width + x) * 3;
        const w = kernel[k + r];
        a += tmp[q] * w;
        b += tmp[q + 1] * w;
        c += tmp[q + 2] * w;
      }
      const p = (y * width + x) * 4;
      data[p] = a;
      data[p + 1] = b;
      data[p + 2] = c;
      data[p + 3] = 255;
    }
  }
}
