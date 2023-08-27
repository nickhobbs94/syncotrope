import type { FFmpeg } from "@ffmpeg/ffmpeg";
import type * as UtilTypes from "@ffmpeg/util";
import { SyncotropeSettings, getSettings } from "./settings";
import { setProgress } from "./ui/progress-bar";
declare const FFmpegUtil: { fetchFile: typeof UtilTypes.fetchFile };

export type FileReference = {
  name: string;
};

export class Syncotrope {
  private initialized = false;
  private settings: SyncotropeSettings;

  constructor(
    private ffmpeg: FFmpeg,
    settings?: Partial<SyncotropeSettings>,
  ) {
    this.settings = getSettings(settings ?? {});
  }

  // always call this before trying to do any work
  public async init() {
    if (this.initialized) return;
    this.initialized = true;
    this.ffmpeg.on("log", ({ message }: any) => {
      //console.log(message);
    });
    await this.ffmpeg.load({
      coreURL: "../../../core/dist/umd/ffmpeg-core.js",
    });
  }

  /* --------------- Useful methods that acutally do stuff --------------- */

  public async standardizeImage(file: FileReference) {
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

    let imageSequence: FileReference[] = [overlaidImage]; // Start with the overlaid image in the sequence

    let lastImage = overlaidImage;
    for (let i = 0; i < 25; i++) {
      lastImage = await this.zoomImage(lastImage);
      console.log(i);
      setProgress((i / 25) * 100 + 0.1);
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
      `zoompan=z='min(zoom+0.015,1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=100,scale=1920:1080`,
      "-c:a",
      "copy",
      outFileName,
    ]);

    // await this.copyFile(file, outFileName);

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
    console.log(imageSequence);
    let i = 1;
    const date = new Date().getTime().toString();
    const prefix = `sequence-${date}`;

    console.log("Before move");
    for (const imageFrame of imageSequence) {
      await this.copyFile(
        imageFrame,
        `${prefix}-${Syncotrope.leftPad(i, 4)}.png`,
      );
      i++;
    }

    console.log("After move");

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

    console.log("After merge");

    const videoBuffer = await this.getFile("output.mp4");
    setProgress(100);
    return videoBuffer;
  }

  /* --------------- Helper methods --------------- */

  public async loadFile(fileInfo: any): Promise<FileReference> {
    const { fetchFile } = FFmpegUtil;
    const fileBuffer: Uint8Array = await fetchFile(fileInfo);
    const name: string = fileInfo.name;
    await this.putFile(name, fileBuffer);
    return { name };
  }

  public async retrieveFile(file: FileReference): Promise<Uint8Array> {
    return this.getFile(file.name);
  }

  public async retrieveSequence(imageSequence: any): Promise<any> {
    let sequenceData = [];
    for (const image of imageSequence) {
      const imageData = await this.retrieveFile(image);
      sequenceData.push(imageData);
    }
    return sequenceData;
  }

  // store a file buffer in memory under a given name so ffmpeg can read from it
  private async putFile(
    name: string,
    buffer: Uint8Array,
  ): Promise<FileReference> {
    await this.init();
    console.log(`PUTTING ${name}`);
    const ok = await this.ffmpeg.writeFile(name, buffer);
    if (!ok) throw new Error("Could not store file in syncotrope");
    return { name };
  }

  // retrieve a named file buffer from memory that ffmpeg has written to
  private async getFile(name: string): Promise<Uint8Array> {
    await this.init();
    const file = await this.ffmpeg.readFile(name);
    if (typeof file !== "object")
      throw new Error("Could not get file from syncotrope");
    return file;
  }

  private async copyFile(
    source: FileReference,
    destination: string,
  ): Promise<FileReference> {
    const data = await this.retrieveFile(source);
    return await this.putFile(destination, data);
  }
}
