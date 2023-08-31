import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { SyncotropeSettings, getSettings } from "../core/settings";
import { updateProgressFromFFmpegLog } from "../ui/progress-bar";
import { FileReference, FileSystemHandler } from "./file-system";

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

    return overlaidImage;
  }

  public async combinedZoomAndVideo(
    image: FileReference,
  ): Promise<FileReference> {
    const outFileName = `video-output-${new Date().getTime().toString()}.mp4`;

    const XP = 50; // x position in percent
    const YP = 50; // y position in percent
    const FPS = this.settings.frameRate;
    const W = this.settings.targetWidth;
    const H = this.settings.targetHeight;

    const DURATION = FPS * this.settings.imageDurationSeconds;

    console.log("Begin making video");

    const result = await this.ffmpeg.exec([
      "-i",
      image.name,
      "-vf",
      `zoompan=z='zoom+${
        this.settings.zoomRate - 1
      }':x='iw/2-iw*(1/2-${XP}/100)*on/${DURATION}-iw/zoom/2':y='ih/2-ih*(1/2-${YP}/100)*on/${DURATION}-ih/zoom/2':d=${DURATION}:fps=${FPS}:s=${W}x${H}`,
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

    const scaleParameter = `scale=${horizontalSize}:${verticalSize}`;
    console.log(`Scaling image with setting: ${scaleParameter}`);

    const result = await this.ffmpeg.exec([
      "-i",
      file.name,
      "-vf",
      scaleParameter,
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

    const result = await this.ffmpeg.exec([
      "-i",
      backgroundImage.name,
      "-i",
      foregroundImage.name,
      "-filter_complex",
      `[0:v][1:v]overlay=(${this.settings.targetWidth}/2)-(overlay_w/2):0,crop=${this.settings.targetWidth}:${this.settings.targetHeight}:0:0[outv]`,
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

    const result = await this.ffmpeg.exec([
      "-i",
      file.name,
      "-vf",
      `boxblur=${this.settings.targetBlur}`,
      "-c:a",
      "copy",
      outFileName,
    ]);

    if (result !== 0) {
      throw new Error("Error from blur");
    }
    return { name: outFileName };
  }

  public async zoomImage(file: FileReference): Promise<FileReference> {
    const outFileName = `zoom-output-${new Date().getTime().toString()}.png`;

    const result = await this.ffmpeg.exec([
      "-i",
      file.name,
      "-vf",
      `zoompan=z=${this.settings.zoomRate}`,
      "-c:a",
      "copy",
      outFileName,
    ]);

    if (result !== 0) {
      throw new Error("Error from zoomImage");
    }

    const outfile = { name: outFileName };

    return outfile;
  }
}
