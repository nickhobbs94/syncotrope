/**
 * Draws zoom frames.
 *
 * Each frame is resampled once, straight from the source image, with a
 * Lanczos-3 filter on the GPU (WebGL2). The zoom is a pure scale about the
 * frame centre in float precision, so it cannot step or drift, and fine detail
 * such as film grain stays steady. (Scaling an intermediate copy, or using the
 * browser's own canvas scaling, makes grain soften and shimmer in moving
 * bands.) Behind the image, a blurred cover-fit copy fills the space the image
 * doesn't, zooming with it.
 *
 * Without WebGL2 it falls back to canvas drawImage: same geometry, but the
 * browser's own scaling filter.
 */

import { gaussianBlur } from "./blur";

export type Canvas = OffscreenCanvas | HTMLCanvasElement;
type Context2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

// Pre-shrink sources with more than this many pixels per output pixel
const MAX_SOURCE_RATIO = 2;

export interface FrameRenderer {
  readonly canvas: Canvas;
  readonly kind: string;
  // Largest image dimension the renderer accepts
  readonly maxSize: number;
  load(
    source: CanvasImageSource & { width: number; height: number },
    background: Canvas,
  ): void;
  draw(zoom: number): void;
  dispose(): void;
}

export function makeCanvas(width: number, height: number): Canvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context2d(canvas: Canvas, alpha = false): Context2D {
  const ctx = canvas.getContext("2d", { alpha }) as Context2D | null;
  if (!ctx) throw new Error("This browser can't draw images (no 2D canvas)");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return ctx;
}

/**
 * Scale (width, height) to fit inside (cover = false) or cover (cover = true)
 * the box, keeping the aspect ratio.
 */
export function fitSize(
  width: number,
  height: number,
  boxWidth: number,
  boxHeight: number,
  cover: boolean,
): [number, number] {
  const scale = (cover ? Math.max : Math.min)(
    boxWidth / width,
    boxHeight / height,
  );
  return [width * scale, height * scale];
}

/**
 * Blurred cover-fit background for the frame at zoom 1. It is made at reduced
 * size (the blur hides that), with sigma in output pixels.
 */
export function makeBackground(
  image: ImageBitmap,
  width: number,
  height: number,
  sigma: number,
): Canvas {
  const down = Math.max(1, Math.min(8, Math.floor(sigma / 3)));
  const w = Math.max(2, Math.round(width / down));
  const h = Math.max(2, Math.round(height / down));
  const canvas = makeCanvas(w, h);
  const ctx = context2d(canvas);
  const [cw, ch] = fitSize(image.width, image.height, w, h, true);
  ctx.drawImage(image, (w - cw) / 2, (h - ch) / 2, cw, ch);
  if (sigma / down > 0.3) {
    const pixels = ctx.getImageData(0, 0, w, h);
    gaussianBlur(pixels.data, w, h, sigma / down);
    ctx.putImageData(pixels, 0, 0);
  }
  return canvas;
}

/**
 * Shrink very large images once, so each frame resamples by at most
 * MAX_SOURCE_RATIO and the image fits the GPU's texture limit. Normal and
 * small images are used as they are.
 */
export function prepareSource(
  image: ImageBitmap,
  width: number,
  height: number,
  finalZoom: number,
  maxSize: number,
): ImageBitmap | Canvas {
  // output pixels per source pixel on the last frame
  const k = Math.min(width / image.width, height / image.height) * finalZoom;
  const scale = Math.min(
    1,
    MAX_SOURCE_RATIO * k,
    maxSize / image.width,
    maxSize / image.height,
  );
  if (scale >= 1) return image;
  const w = Math.max(1, Math.round(image.width * scale));
  const h = Math.max(1, Math.round(image.height * scale));
  const canvas = makeCanvas(w, h);
  context2d(canvas, true).drawImage(image, 0, 0, w, h);
  return canvas;
}

const VERTEX_SHADER = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const LANCZOS3 = `
float lanczos3(float t) {
  t = abs(t);
  if (t < 1e-5) return 1.0;
  if (t >= 3.0) return 0.0;
  float a = 3.14159265358979 * t;
  return 3.0 * sin(a) * sin(a / 3.0) / (a * a);
}`;

// Pass 1: resample columns, for every source row. Output x maps to source
// u = u0 + x * du (pixel centres). Taps outside the image count as
// transparent, so its edges come out antialiased.
const HORIZONTAL_SHADER = `#version 300 es
precision highp float;
uniform sampler2D src;
uniform float u0, du, fs;
uniform int srcW;
out vec4 o;
${LANCZOS3}
void main() {
  int row = int(gl_FragCoord.y);
  float u = u0 + gl_FragCoord.x * du;
  float support = 3.0 / fs;
  int j0 = int(floor(u - support)), j1 = int(ceil(u + support));
  vec4 acc = vec4(0.0);
  float ws = 0.0;
  for (int j = j0; j <= j1; j++) {
    float w = lanczos3((float(j) + 0.5 - u) * fs);
    ws += w;
    if (j >= 0 && j < srcW) acc += w * texelFetch(src, ivec2(j, row), 0);
  }
  o = acc / ws;
}`;

// Pass 2: resample rows, then composite (premultiplied) over the zoomed
// background.
const VERTICAL_SHADER = `#version 300 es
precision highp float;
uniform sampler2D mid, bg;
uniform float v0, dv, fs, zoom;
uniform int midH;
uniform vec2 outSize;
out vec4 o;
${LANCZOS3}
void main() {
  float yTop = outSize.y - gl_FragCoord.y;
  float v = v0 + yTop * dv;
  float support = 3.0 / fs;
  int j0 = int(floor(v - support)), j1 = int(ceil(v + support));
  int col = int(gl_FragCoord.x);
  vec4 acc = vec4(0.0);
  float ws = 0.0;
  for (int j = j0; j <= j1; j++) {
    float w = lanczos3((float(j) + 0.5 - v) * fs);
    ws += w;
    if (j >= 0 && j < midH) acc += w * texelFetch(mid, ivec2(col, j), 0);
  }
  vec4 fg = acc / ws;
  vec2 xy = vec2(gl_FragCoord.x, yTop);
  vec2 uv = ((xy - 0.5 * outSize) / zoom + 0.5 * outSize) / outSize;
  vec3 b = texture(bg, uv).rgb;
  o = vec4(clamp(fg.rgb + b * (1.0 - clamp(fg.a, 0.0, 1.0)), 0.0, 1.0), 1.0);
}`;

type Program = {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
};

function createWebGLRenderer(
  width: number,
  height: number,
): FrameRenderer | null {
  if (typeof WebGL2RenderingContext === "undefined") return null;
  const canvas = makeCanvas(width, height);
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
  }) as WebGL2RenderingContext | null;
  if (!gl) return null;

  function compile(fragmentSource: string): Program {
    const program = gl!.createProgram();
    for (const [type, source] of [
      [gl!.VERTEX_SHADER, VERTEX_SHADER],
      [gl!.FRAGMENT_SHADER, fragmentSource],
    ] as const) {
      const shader = gl!.createShader(type)!;
      gl!.shaderSource(shader, source);
      gl!.compileShader(shader);
      if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
        throw new Error(gl!.getShaderInfoLog(shader) ?? "shader error");
      }
      gl!.attachShader(program, shader);
    }
    gl!.bindAttribLocation(program, 0, "p");
    gl!.linkProgram(program);
    if (!gl!.getProgramParameter(program, gl!.LINK_STATUS)) {
      throw new Error(gl!.getProgramInfoLog(program) ?? "link error");
    }
    const uniforms: Program["uniforms"] = {};
    const count = gl!.getProgramParameter(program, gl!.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
      const name = gl!.getActiveUniform(program, i)!.name;
      uniforms[name] = gl!.getUniformLocation(program, name);
    }
    return { program, uniforms };
  }

  let horizontal: Program, vertical: Program;
  try {
    horizontal = compile(HORIZONTAL_SHADER);
    vertical = compile(VERTICAL_SHADER);
  } catch (e) {
    console.warn("WebGL renderer unavailable, using canvas fallback:", e);
    return null;
  }

  // One triangle covering the viewport
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const floatIntermediate = !!gl.getExtension("EXT_color_buffer_float");
  const maxSize: number = gl.getParameter(gl.MAX_TEXTURE_SIZE);

  function texture(filter: number): WebGLTexture {
    const t = gl!.createTexture()!;
    gl!.bindTexture(gl!.TEXTURE_2D, t);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, filter);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, filter);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    return t;
  }

  const sourceTexture = texture(gl.NEAREST);
  const backgroundTexture = texture(gl.LINEAR);
  const intermediateTexture = texture(gl.NEAREST);
  const framebuffer = gl.createFramebuffer();
  let sourceWidth = 0;
  let sourceHeight = 0;
  let scale = 1; // output pixels per source pixel at zoom 1

  return {
    canvas,
    kind: "webgl2-lanczos3",
    maxSize,

    load(source, background) {
      sourceWidth = source.width;
      sourceHeight = source.height;
      scale = Math.min(width / sourceWidth, height / sourceHeight);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source as TexImageSource,
      );
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        background as TexImageSource,
      );
      gl.bindTexture(gl.TEXTURE_2D, intermediateTexture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        floatIntermediate ? gl.RGBA16F : gl.RGBA8,
        width,
        sourceHeight,
        0,
        gl.RGBA,
        floatIntermediate ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
        null,
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        intermediateTexture,
        0,
      );
      if (
        gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE
      ) {
        throw new Error(
          "The graphics card refused the working buffer. Try a smaller resolution.",
        );
      }
    },

    draw(zoom) {
      if (gl.isContextLost()) {
        throw new Error(
          "The graphics card was reset while rendering. Please try again.",
        );
      }
      const step = 1 / (scale * zoom); // source pixels per output pixel
      const filterScale = Math.min(1, 1 / step); // widen the filter when shrinking

      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.viewport(0, 0, width, sourceHeight);
      gl.useProgram(horizontal.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
      const h = horizontal.uniforms;
      gl.uniform1i(h.src, 0);
      gl.uniform1f(h.u0, sourceWidth / 2 - (width / 2) * step);
      gl.uniform1f(h.du, step);
      gl.uniform1f(h.fs, filterScale);
      gl.uniform1i(h.srcW, sourceWidth);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, width, height);
      gl.useProgram(vertical.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, intermediateTexture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
      const v = vertical.uniforms;
      gl.uniform1i(v.mid, 0);
      gl.uniform1i(v.bg, 1);
      gl.uniform1f(v.v0, sourceHeight / 2 - (height / 2) * step);
      gl.uniform1f(v.dv, step);
      gl.uniform1f(v.fs, filterScale);
      gl.uniform1f(v.zoom, zoom);
      gl.uniform1i(v.midH, sourceHeight);
      gl.uniform2f(v.outSize, width, height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },

    dispose() {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}

function createCanvasRenderer(width: number, height: number): FrameRenderer {
  const canvas = makeCanvas(width, height);
  const ctx = context2d(canvas);
  let source: Canvas | null = null;
  let background: Canvas | null = null;

  return {
    canvas,
    kind: "canvas2d",
    maxSize: 16384,

    load(image, bg) {
      // Keep a copy: the caller frees the decoded image after loading
      source = makeCanvas(image.width, image.height);
      context2d(source, true).drawImage(image, 0, 0);
      background = bg;
    },

    draw(zoom) {
      if (!source || !background) throw new Error("No image loaded");
      // Both layers scale by zoom about the frame centre
      ctx.setTransform(
        zoom,
        0,
        0,
        zoom,
        (width / 2) * (1 - zoom),
        (height / 2) * (1 - zoom),
      );
      ctx.drawImage(background, 0, 0, width, height);
      const [w, h] = fitSize(source.width, source.height, width, height, false);
      ctx.drawImage(source, (width - w) / 2, (height - h) / 2, w, h);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    },

    dispose() {},
  };
}

/**
 * The WebGL2 Lanczos renderer, or the canvas fallback where WebGL2 is missing.
 */
export function createRenderer(width: number, height: number): FrameRenderer {
  return (
    createWebGLRenderer(width, height) ?? createCanvasRenderer(width, height)
  );
}
