import type { FFmpeg } from "@ffmpeg/ffmpeg";
import type * as UtilTypes from "@ffmpeg/util";
import { SyncotropeSettings, getSettings } from "../core/settings";
import { setProgress } from "../ui/progress-bar";
import { FileReference, FileSystemHandler } from "./file-system";
declare const FFmpegUtil: { fetchFile: typeof UtilTypes.fetchFile };

export class Syncotrope {
  private settings: SyncotropeSettings;
  public fs: FileSystemHandler;

  constructor(
    private ffmpeg: FFmpeg,
    settings?: Partial<SyncotropeSettings>,
  ) {
    this.settings = getSettings(settings ?? {});
    this.fs = new FileSystemHandler(this.ffmpeg, this.settings);
  }

  public async standardizeImage(file: FileReference): Promise<FileReference> {
    setProgress(0.1);
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

  public async imageToZoomSequence(
    overlaidImage: FileReference,
  ): Promise<FileReference[]> {
    let imageSequence: FileReference[] = [overlaidImage]; // Start with the overlaid image in the sequence

    let lastImage = overlaidImage;
    const totalFrames = this.settings.frameRate * this.settings.imageDurationSeconds;
    for (let i = 0; i < totalFrames; i++) {
      lastImage = await this.zoomImage(lastImage);
      setProgress((i / totalFrames) * 100 + 0.1);
      imageSequence.push(lastImage);
    }

    return imageSequence;
  }

  // Scale an image to the desired resolution
  public async scaleImage(
    file: FileReference,
    horizontalSize: number,
    verticalSize: number,
  ): Promise<FileReference> {
    const outFileName = `output-${new Date().getTime().toString()}.png`;

    const scaleParameter = `scale=${horizontalSize}:${verticalSize}`;
    console.log(`Scaling image with setting: ${scaleParameter}`);

    await this.ffmpeg.exec([
      "-i",
      file.name,
      "-vf",
      scaleParameter,
      "-c:a",
      "copy",
      outFileName,
    ]);

    return { name: outFileName };
  }

  // overlay an image over another
  public async overlayImage(
    backgroundImage: FileReference,
    foregroundImage: FileReference,
  ): Promise<FileReference> {
    const outFileName = `output-${new Date().getTime().toString()}.png`;

    await this.ffmpeg.exec([
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
    return { name: outFileName };
  }

  public async blurImage(file: FileReference): Promise<FileReference> {
    const outFileName = `output-${new Date().getTime().toString()}.png`;

    await this.ffmpeg.exec([
      "-i",
      file.name,
      "-vf",
      `boxblur=${this.settings.targetBlur}`,
      "-c:a",
      "copy",
      outFileName,
    ]);
    return { name: outFileName };
  }

  public async zoomImage(file: FileReference): Promise<FileReference> {
    const outFileName = `output-${new Date().getTime().toString()}.png`;

    await this.ffmpeg.exec([
      "-i",
      file.name,
      "-vf",
      `zoompan=z=${this.settings.zoomRate}`,
      "-c:a",
      "copy",
      outFileName,
    ]);

    const outfile = { name: outFileName };

    return outfile;
  }

  private static leftPad(n: number, len: number): string {
    const s = "000000" + n.toString();
    return s.slice(s.length - len);
  }

  public async sequenceToVideo(
    imageSequence: FileReference[],
  ): Promise<Uint8Array> {
    let i = 1;
    const date = new Date().getTime().toString();
    const prefix = `sequence-${date}`;

    for (const imageFrame of imageSequence) {
      await this.fs.copyFile(
        imageFrame,
        `${prefix}-${Syncotrope.leftPad(i, 4)}.png`,
      );
      i++;
    }

    await this.ffmpeg.exec([
      "-framerate",
      "25",
      "-i",
      `${prefix}-%04d.png`,
      "-c:v",
      `libx264`,
      "-r",
      this.settings.frameRate.toString(),
      "output.mp4",
    ]);

    const videoBuffer = await this.fs.getFile("output.mp4");
    setProgress(100);
    return videoBuffer;
  }
}
