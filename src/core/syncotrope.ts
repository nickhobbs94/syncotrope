import { SyncotropeSettings, getSettings } from "./settings";
import { finalZoomLevel, framesPerImage, zoomAtFrame } from "./zoom";
import { boxBlurSigma, parseBoxBlur } from "./blur";
import {
  createRenderer,
  makeBackground,
  prepareSource,
  type FrameRenderer,
} from "./renderer";
import { pickEncoder, VideoWriter } from "./encoder";

export type FrameProgress = (
  imageIndex: number,
  framesDone: number,
  framesTotal: number,
) => void;

export interface ISyncotrope {
  loadSettings(): void;

  processImages(
    files: Uint8Array[],
    onProgress?: FrameProgress,
  ): Promise<Uint8Array>;
}

export class Syncotrope implements ISyncotrope {
  private settings: SyncotropeSettings;

  constructor() {
    this.settings = getSettings();
  }

  public loadSettings() {
    this.settings = getSettings();
  }

  /**
   * Process images into a single video, one zoom clip per image in order.
   * Takes raw image data and returns the video file data.
   */
  public async processImages(
    files: Uint8Array[],
    onProgress?: FrameProgress,
  ): Promise<Uint8Array> {
    if (files.length === 0) {
      throw new Error("No files provided");
    }

    const {
      targetWidth: width,
      targetHeight: height,
      frameRate,
      outputFormat,
      videoQuality,
    } = this.settings;
    if (width % 2 || height % 2) {
      throw new Error("Width and height must be even numbers");
    }
    if (!(this.settings.zoomSpeed >= 0)) {
      throw new Error("Zoom speed must be 0 or more percent per second");
    }
    const sigma = boxBlurSigma(parseBoxBlur(this.settings.targetBlur));

    const plan = await pickEncoder(
      outputFormat,
      width,
      height,
      frameRate,
      videoQuality,
    );
    if (!plan) {
      throw new Error(
        `This browser can't encode ${outputFormat.toUpperCase()} video at ${width}x${height}, ${frameRate} fps. Try a smaller resolution, the other format, or a recent Chrome, Edge, Firefox or Safari.`,
      );
    }

    const frames = framesPerImage(this.settings);
    const finalZoom = finalZoomLevel(this.settings);
    const total = frames * files.length;
    const writer = new VideoWriter(outputFormat, plan, frameRate);
    const renderer = createRenderer(width, height);
    console.log(
      `Rendering with ${renderer.kind}, encoding ${plan.config.codec}` +
        (plan.quantizer !== null ? ` at quantizer ${plan.quantizer}` : ""),
    );

    try {
      for (let i = 0; i < files.length; i++) {
        await this.loadImage(renderer, files[i], i, sigma, finalZoom);
        for (let frame = 0; frame < frames; frame++) {
          renderer.draw(zoomAtFrame(frame, this.settings.zoomSpeed, frameRate));
          // A keyframe at the start of each image keeps the cuts crisp
          await writer.addFrame(renderer.canvas, frame === 0);
          onProgress?.(i, i * frames + frame + 1, total);
        }
      }
      return await writer.finish();
    } finally {
      writer.close();
      renderer.dispose();
    }
  }

  private async loadImage(
    renderer: FrameRenderer,
    data: Uint8Array,
    index: number,
    sigma: number,
    finalZoom: number,
  ) {
    let image: ImageBitmap;
    try {
      image = await createImageBitmap(new Blob([data as BlobPart]), {
        imageOrientation: "from-image",
        premultiplyAlpha: "none",
      });
    } catch {
      throw new Error(
        `Couldn't read image ${index + 1}. It may be damaged or in a format this browser can't open.`,
      );
    }
    const { targetWidth: width, targetHeight: height } = this.settings;
    const background = makeBackground(image, width, height, sigma);
    const source = prepareSource(
      image,
      width,
      height,
      finalZoom,
      renderer.maxSize,
    );
    renderer.load(source, background);
    image.close();
  }
}
