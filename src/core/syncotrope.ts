import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { SyncotropeSettings, getSettings } from "./settings";
import { updateProgressFromFFmpegLog } from "../ui/progress-bar";
import { FileReference, FileSystemHandler } from "./file-system";
import { finalZoomLevel } from "./zoom";
import {
  zoompanFilterFromSettings,
  buildScaleFilter,
  buildBlurFilter,
  buildOverlayFilter,
} from "./ffmpeg-filters";

/*
We want to refactor the Syncotrope class to be like the interface.
*/

export interface ISyncotrope {
  loadSettings(): void;

  processImages(files: Uint8Array[]): Promise<Uint8Array>;
}

export class Syncotrope {
  private settings: SyncotropeSettings;
  public fs: FileSystemHandler;

  constructor(private ffmpeg: FFmpeg) {
    this.settings = getSettings();
    this.fs = new FileSystemHandler(this.ffmpeg, this.settings, (m) =>
      updateProgressFromFFmpegLog(m, this.settings),
    );
  }

  public loadSettings() {
    this.settings = getSettings();
  }

  public async standardizeImage(file: FileReference): Promise<FileReference> {
    const fillHorizontalImage = await this.scaleImage(
      file,
      this.settings.targetWidth,
      -1,
    );

    const fillVertImage = await this.scaleImage(
      file,
      -1,
      this.settings.targetHeight,
    );

    const blurredImg = await this.blurImage(fillHorizontalImage);
    const overlaidImage = await this.overlayImage(blurredImg, fillVertImage);

    // upscale the final image to avoid jitter
    const finalZoom = finalZoomLevel(this.settings);
    return await this.scaleImage(
      overlaidImage,
      this.settings.targetWidth * finalZoom,
      this.settings.targetHeight * finalZoom,
    );
  }

  public async combinedZoomAndVideo(
    image: FileReference,
  ): Promise<FileReference> {
    const outFileName = `video-output-${new Date().getTime().toString()}.mp4`;

    console.log("Begin making video");

    const zoompanFilter = zoompanFilterFromSettings(this.settings);
    const result = await this.ffmpeg.exec([
      "-i",
      image.name,
      "-vf",
      zoompanFilter,
      "-c:v",
      "libx264",
      outFileName,
    ]);

    if (result !== 0) {
      throw new Error("Error from video making");
    }

    console.log(`Video made, saved under ${outFileName}`);

    return { name: outFileName };
  }

  // Scale an image to the desired resolution
  public async scaleImage(
    file: FileReference,
    horizontalSize: number,
    verticalSize: number,
  ): Promise<FileReference> {
    const outFileName = `scale-output-${new Date().getTime().toString()}.png`;

    const scaleFilter = buildScaleFilter(horizontalSize, verticalSize);
    console.log(`Scaling image with setting: ${scaleFilter}`);

    const result = await this.ffmpeg.exec([
      "-i",
      file.name,
      "-vf",
      scaleFilter,
      "-c:a",
      "copy",
      outFileName,
    ]);

    if (result !== 0) {
      throw new Error("Error from scaleImage");
    }

    return { name: outFileName };
  }

  // overlay an image over another
  public async overlayImage(
    backgroundImage: FileReference,
    foregroundImage: FileReference,
  ): Promise<FileReference> {
    const outFileName = `overlay-output-${new Date().getTime().toString()}.png`;

    const overlayFilter = buildOverlayFilter(
      this.settings.targetWidth,
      this.settings.targetHeight,
    );
    const result = await this.ffmpeg.exec([
      "-i",
      backgroundImage.name,
      "-i",
      foregroundImage.name,
      "-filter_complex",
      overlayFilter,
      "-map",
      "[outv]",
      "-c:a",
      "copy",
      outFileName,
    ]);

    if (result !== 0) {
      throw new Error("Error from overlay");
    }

    return { name: outFileName };
  }

  public async blurImage(file: FileReference): Promise<FileReference> {
    const outFileName = `blur-output-${new Date().getTime().toString()}.png`;

    const blurFilter = buildBlurFilter(this.settings.targetBlur);
    const result = await this.ffmpeg.exec([
      "-i",
      file.name,
      "-vf",
      blurFilter,
      "-c:a",
      "copy",
      outFileName,
    ]);

    if (result !== 0) {
      throw new Error("Error from blur");
    }
    return { name: outFileName };
  }
}
