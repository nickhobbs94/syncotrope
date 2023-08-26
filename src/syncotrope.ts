import type { FFmpeg } from "@ffmpeg/ffmpeg";
import type * as UtilTypes from "@ffmpeg/util";
declare const FFmpegUtil: { fetchFile: typeof UtilTypes.fetchFile };

export type FileReference = {
  name: string;
};

export class Syncotrope {
  private initialized = false;
  constructor(private ffmpeg: FFmpeg) {}

  // always call this before trying to do any work
  public async init() {
    if (this.initialized) return;
    this.initialized = true;
    this.ffmpeg.on("log", ({ message }: any) => {
      console.log(message);
    });
    await this.ffmpeg.load({
      coreURL: "/assets/core/dist/umd/ffmpeg-core.js",
    });
  }

  /* --------------- Useful methods that acutally do stuff --------------- */

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
      "[0:v][1:v]overlay=150:0,crop=1920:1080:0:0[outv]",
      "-map",
      "[outv]",
      "-pix_fmt",
      "yuv420p",
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
      "boxblur=50:10",
      "-c:a",
      "copy",
      outFileName,
    ]);
    return { name: outFileName };
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

  // store a file buffer in memory under a given name so ffmpeg can read from it
  private async putFile(name: string, buffer: Uint8Array) {
    await this.init();
    console.log(`PUTTING ${name}`);
    const ok = await this.ffmpeg.writeFile(name, buffer);
    if (!ok) throw new Error("Could not store file in syncotrope");
  }

  // retrieve a named file buffer from memory that ffmpeg has written to
  private async getFile(name: string): Promise<Uint8Array> {
    await this.init();
    const file = await this.ffmpeg.readFile(name);
    if (typeof file !== "object")
      throw new Error("Could not get file from syncotrope");
    return file;
  }
}
