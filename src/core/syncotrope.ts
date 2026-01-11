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
  buildConcatList,
} from "./ffmpeg-filters";

export interface ISyncotrope {
  loadSettings(): void;

  processImages(files: Uint8Array[]): Promise<Uint8Array>;
}

export class Syncotrope implements ISyncotrope {
  private settings: SyncotropeSettings;
  private fs: FileSystemHandler;

  constructor(private ffmpeg: FFmpeg) {
    this.settings = getSettings();
    this.fs = new FileSystemHandler(this.ffmpeg, this.settings, (m) =>
      updateProgressFromFFmpegLog(m, this.settings),
    );
  }

  public loadSettings() {
    this.settings = getSettings();
  }

  /**
   * Process multiple images into a single concatenated video.
   */
  public async processImages(files: Uint8Array[]): Promise<Uint8Array> {
    if (files.length === 0) {
      throw new Error("No files provided");
    }

    const videos: Uint8Array[] = [];
    for (const file of files) {
      const video = await this.processImage(file);
      videos.push(video);
    }

    return this.concatenateVideos(videos);
  }

  /**
   * Process a single image into a video with zoom effect.
   * This is the main public API - takes raw image data and returns video data.
   */
  public async processImage(imageData: Uint8Array): Promise<Uint8Array> {
    const inputName = `input-${Date.now()}.png`;
    const inputRef = await this.fs.putFile(inputName, imageData);

    const standardized = await this.standardizeImage(inputRef);
    const videoRef = await this.combinedZoomAndVideo(standardized);

    return this.fs.getFile(videoRef.name);
  }

  private async standardizeImage(file: FileReference): Promise<FileReference> {
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

  private async combinedZoomAndVideo(
    image: FileReference,
  ): Promise<FileReference> {
    const format = this.settings.outputFormat;
    const outFileName = `video-output-${Date.now()}.${format}`;

    console.log(`Begin making video (format: ${format})`);

    const zoompanFilter = zoompanFilterFromSettings(this.settings);

    // Build codec arguments based on format
    const codecArgs = this.getCodecArgs();

    const result = await this.ffmpeg.exec([
      "-i",
      image.name,
      "-vf",
      zoompanFilter,
      ...codecArgs,
      outFileName,
    ]);

    if (result !== 0) {
      const logs = this.fs.getRecentLogs().join("\n");
      throw new Error(`FFmpeg video creation failed:\n${logs}`);
    }

    console.log(`Video made, saved under ${outFileName}`);

    return { name: outFileName };
  }

  /**
   * Get FFmpeg codec arguments based on output format and quality settings.
   */
  private getCodecArgs(): string[] {
    const { outputFormat, videoQuality } = this.settings;

    switch (outputFormat) {
      case "webm":
        // VP9 codec for WebM, CRF range 0-63 (we'll use the same value)
        return [
          "-c:v",
          "libvpx-vp9",
          "-crf",
          String(videoQuality),
          "-b:v",
          "0",
        ];
      case "mp4":
      default:
        // H.264 codec for MP4
        return ["-c:v", "libx264", "-crf", String(videoQuality)];
    }
  }

  // Scale an image to the desired resolution
  private async scaleImage(
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
      const logs = this.fs.getRecentLogs().join("\n");
      throw new Error(`FFmpeg scale failed:\n${logs}`);
    }

    return { name: outFileName };
  }

  // overlay an image over another
  private async overlayImage(
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
      const logs = this.fs.getRecentLogs().join("\n");
      throw new Error(`FFmpeg overlay failed:\n${logs}`);
    }

    return { name: outFileName };
  }

  private async blurImage(file: FileReference): Promise<FileReference> {
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
      const logs = this.fs.getRecentLogs().join("\n");
      throw new Error(`FFmpeg blur failed:\n${logs}`);
    }
    return { name: outFileName };
  }

  /**
   * Concatenate multiple videos into a single output video.
   * Uses FFmpeg's concat demuxer for seamless joining.
   */
  public async concatenateVideos(videos: Uint8Array[]): Promise<Uint8Array> {
    if (videos.length === 0) {
      throw new Error("No videos to concatenate");
    }

    if (videos.length === 1) {
      return videos[0];
    }

    // Write all video files to the virtual filesystem
    const videoRefs: FileReference[] = [];
    for (let i = 0; i < videos.length; i++) {
      const fileName = `video-${Date.now()}-${i}.mp4`;
      const ref = await this.fs.putFile(fileName, videos[i]);
      videoRefs.push(ref);
    }

    const outFileName = `concat-output-${Date.now()}.mp4`;
    const listFileName = `concat-list-${Date.now()}.txt`;

    // Create concat list file content
    const listContent = buildConcatList(videoRefs.map((v) => v.name));

    // Write the list file to FFmpeg's virtual filesystem
    const encoder = new TextEncoder();
    await this.fs.putFile(listFileName, encoder.encode(listContent));

    console.log(`Concatenating ${videos.length} videos`);

    const result = await this.ffmpeg.exec([
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listFileName,
      "-c",
      "copy",
      outFileName,
    ]);

    if (result !== 0) {
      const logs = this.fs.getRecentLogs().join("\n");
      throw new Error(`FFmpeg concatenation failed:\n${logs}`);
    }

    console.log(`Videos concatenated, saved under ${outFileName}`);

    return this.fs.getFile(outFileName);
  }
}
