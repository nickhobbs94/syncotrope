import type { FFmpeg } from "@ffmpeg/ffmpeg";
import type * as UtilTypes from "@ffmpeg/util";
import { SyncotropeSettings } from "./settings";
declare const FFmpegUtil: { fetchFile: typeof UtilTypes.fetchFile };

export type FileReference = {
  name: string;
};

export class FileSystemHandler {
  private initialized = false;

  constructor(
    private ffmpeg: FFmpeg,
    private settings: SyncotropeSettings,
  ) {}

  // always call this before trying to do any work
  public async init() {
    if (this.initialized) return;
    this.initialized = true;

    if (this.settings.logging.includes("ffmpeg")) {
      this.ffmpeg.on("log", ({ message }) => {
        console.log(message);
      });
    }

    await this.ffmpeg.load({
      coreURL: "../../../core/dist/umd/ffmpeg-core.js",
    });
  }

  public async loadFile(fileInfo: File): Promise<FileReference> {
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
  public async putFile(
    name: string,
    buffer: Uint8Array,
  ): Promise<FileReference> {
    if (this.settings.logging.includes("file-transfer")) {
      console.log(`Put file ${name}`);
    }

    await this.init();

    const ok = await this.ffmpeg.writeFile(name, buffer);
    if (!ok) throw new Error("Could not store file in syncotrope");

    return { name };
  }

  // retrieve a named file buffer from memory that ffmpeg has written to
  public async getFile(name: string): Promise<Uint8Array> {
    if (this.settings.logging.includes("file-transfer")) {
      console.log(`Get file: ${name}`);
    }

    await this.init();

    const file = await this.ffmpeg.readFile(name);
    if (typeof file !== "object")
      throw new Error("Could not get file from syncotrope");
    return file;
  }

  public async copyFile(
    source: FileReference,
    destination: string,
  ): Promise<FileReference> {
    if (this.settings.logging.includes("file-transfer")) {
      console.log(`Copy ${source.name} ${destination}`);
    }

    const data = await this.retrieveFile(source);
    return await this.putFile(destination, data);
  }
}
