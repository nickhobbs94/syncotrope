import type { FFmpeg } from "@ffmpeg/ffmpeg";

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
  public async scaleImage(file: Uint8Array): Promise<Uint8Array> {
    await this.init();
    const inFileName = "inputfile";
    const outFileName = "output.png";
    await this.putFile(inFileName, file);

    await this.ffmpeg.exec([
      "-i",
      inFileName,
      "-vf",
      "scale=1920:-1",
      "-c:a",
      "copy",
      outFileName,
    ]);

    return await this.getFile(outFileName);
  }

  /* --------------- Helper methods --------------- */

  // store a file buffer in memory under a given name so ffmpeg can read from it
  private async putFile(name: string, buffer: Uint8Array) {
    console.log("PUTTING");
    const ok = await this.ffmpeg.writeFile(name, buffer);
    if (!ok) throw new Error("Could not store file in syncotrope");
  }

  // retrieve a named file buffer from memory that ffmpeg has written to
  private async getFile(name: string): Promise<Uint8Array> {
    const file = await this.ffmpeg.readFile(name);
    if (typeof file !== "object")
      throw new Error("Could not get file from syncotrope");
    return file;
  }
}
