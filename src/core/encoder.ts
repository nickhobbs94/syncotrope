/**
 * Video encoding with the browser's own encoder (WebCodecs) and muxing into
 * MP4 or WebM in memory.
 */

import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4Target } from "mp4-muxer";
import {
  Muxer as WebMMuxer,
  ArrayBufferTarget as WebMTarget,
} from "webm-muxer";
import type { OutputFormat } from "./settings";

// A keyframe every few seconds (and at the start of every image).
export const KEYFRAME_SECONDS = 4;

// Fallback when the encoder has no constant-quantizer mode: generous enough
// that film grain doesn't "pump" between keyframes.
export const BITS_PER_PIXEL = 0.25;

// H.264 levels: [hex, max macroblocks per frame, max macroblocks per second]
const AVC_LEVELS: [string, number, number][] = [
  ["1F", 3600, 108000],
  ["20", 5120, 216000],
  ["28", 8192, 245760],
  ["2A", 8704, 522240],
  ["32", 22080, 589824],
  ["33", 36864, 983040],
  ["34", 36864, 2073600],
  ["3C", 139264, 4177920],
  ["3D", 139264, 8355840],
  ["3E", 139264, 16711680],
];

/**
 * H.264 codec strings for this size and rate: High, then Main, then
 * Constrained Baseline profile, each at the lowest level that fits.
 */
export function avcCodecStrings(
  width: number,
  height: number,
  fps: number,
): string[] {
  const mbs = Math.ceil(width / 16) * Math.ceil(height / 16);
  const level = AVC_LEVELS.find(
    ([, maxFs, maxMbps]) =>
      mbs <= maxFs &&
      mbs * fps <= maxMbps &&
      Math.max(width, height) / 16 <= Math.sqrt(8 * maxFs),
  );
  if (!level) return [];
  return ["6400", "4D40", "42E0"].map(
    (profile) => `avc1.${profile}${level[0]}`,
  );
}

/**
 * The user's quality value is an x264-style CRF (0-51, lower = better). It is
 * used as the encoder's constant quantizer, clamped to the codec's range.
 */
export function quantizerForQuality(
  format: OutputFormat,
  quality: number,
): number {
  const max = format === "webm" ? 63 : 51;
  return Math.min(Math.max(Math.round(quality), 0), max);
}

export type EncoderPlan = {
  config: VideoEncoderConfig;
  // Per-frame quantizer, or null when encoding to a target bitrate.
  quantizer: number | null;
};

function codecCandidates(
  format: OutputFormat,
  width: number,
  height: number,
  fps: number,
): VideoEncoderConfig[] {
  const base = {
    width,
    height,
    framerate: fps,
    latencyMode: "quality" as const,
  };
  if (format === "webm") {
    return ["vp09.00.50.08", "vp09.00.41.08", "vp8"].map((codec) => ({
      ...base,
      codec,
    }));
  }
  return avcCodecStrings(width, height, fps).map((codec) => ({
    ...base,
    codec,
    avc: { format: "avc" as const },
  }));
}

async function isSupported(config: VideoEncoderConfig): Promise<boolean> {
  try {
    return (await VideoEncoder.isConfigSupported(config)).supported === true;
  } catch {
    return false;
  }
}

/**
 * Pick the first encoder configuration this browser supports, preferring a
 * constant quantizer (so the quality setting means what it says).
 */
export async function pickEncoder(
  format: OutputFormat,
  width: number,
  height: number,
  fps: number,
  quality: number,
): Promise<EncoderPlan | null> {
  if (typeof VideoEncoder === "undefined") return null;
  for (const base of codecCandidates(format, width, height, fps)) {
    // VP8 has no per-frame quantizer in WebCodecs
    if (!base.codec.startsWith("vp8")) {
      const config = { ...base, bitrateMode: "quantizer" as const };
      if (await isSupported(config)) {
        return { config, quantizer: quantizerForQuality(format, quality) };
      }
    }
    const config = {
      ...base,
      bitrate: Math.max(2e6, Math.round(width * height * fps * BITS_PER_PIXEL)),
    };
    if (await isSupported(config)) return { config, quantizer: null };
  }
  return null;
}

/**
 * Encodes frames into one MP4 or WebM file held in memory.
 */
export class VideoWriter {
  private encoder: VideoEncoder;
  private muxer: Mp4Muxer<Mp4Target> | WebMMuxer<WebMTarget>;
  private error: unknown = null;
  private frames = 0;

  constructor(
    private format: OutputFormat,
    private plan: EncoderPlan,
    private fps: number,
  ) {
    const { width, height, codec } = plan.config;
    if (format === "webm") {
      this.muxer = new WebMMuxer({
        target: new WebMTarget(),
        video: {
          codec: codec.startsWith("vp8") ? "V_VP8" : "V_VP9",
          width,
          height,
          frameRate: fps,
        },
      });
    } else {
      this.muxer = new Mp4Muxer({
        target: new Mp4Target(),
        video: { codec: "avc", width, height, frameRate: fps },
        fastStart: "in-memory",
      });
    }
    this.encoder = new VideoEncoder({
      output: (chunk, meta) => this.muxer.addVideoChunk(chunk, meta),
      error: (e) => {
        this.error = e;
      },
    });
    this.encoder.configure(plan.config);
  }

  /**
   * Encode the current contents of a canvas as the next frame.
   */
  public async addFrame(
    canvas: OffscreenCanvas | HTMLCanvasElement,
    keyFrame: boolean,
  ): Promise<void> {
    if (this.error) throw this.error;
    const frame = new VideoFrame(canvas, {
      timestamp: Math.round((this.frames * 1e6) / this.fps),
      duration: Math.round(1e6 / this.fps),
    });
    const keyEvery = Math.max(1, Math.round(this.fps * KEYFRAME_SECONDS));
    const options: VideoEncoderEncodeOptions & {
      avc?: { quantizer: number };
      vp9?: { quantizer: number };
    } = { keyFrame: keyFrame || this.frames % keyEvery === 0 };
    if (this.plan.quantizer !== null) {
      const q = { quantizer: this.plan.quantizer };
      if (this.format === "webm") options.vp9 = q;
      else options.avc = q;
    }
    this.encoder.encode(frame, options);
    frame.close();
    this.frames++;
    await this.waitForQueue(6);
  }

  /**
   * Flush the encoder and return the finished file.
   */
  public async finish(): Promise<Uint8Array> {
    await this.encoder.flush();
    if (this.error) throw this.error;
    this.muxer.finalize();
    this.encoder.close();
    return new Uint8Array(this.muxer.target.buffer);
  }

  public close(): void {
    if (this.encoder.state !== "closed") this.encoder.close();
  }

  // Don't let frames pile up faster than the encoder takes them.
  private waitForQueue(max: number): Promise<void> {
    if (this.encoder.encodeQueueSize <= max) return Promise.resolve();
    return new Promise((resolve) => {
      const check = () => {
        if (this.encoder.encodeQueueSize <= max) {
          clearInterval(timer);
          this.encoder.removeEventListener("dequeue", check);
          resolve();
        }
      };
      this.encoder.addEventListener("dequeue", check);
      const timer = setInterval(check, 5); // in case 'dequeue' isn't supported
    });
  }
}
