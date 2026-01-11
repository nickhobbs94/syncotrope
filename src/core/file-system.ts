import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { SyncotropeSettings } from "./settings";

export type FileReference = {
  name: string;
};

export class FileSystemHandler {
  private initialized = false;
  private recentLogs: string[] = [];
  private readonly maxLogs = 20;

  constructor(
    private ffmpeg: FFmpeg,
    private settings: SyncotropeSettings,
    private progressHook: (s: string) => void,
  ) {}

  public getRecentLogs(): string[] {
    return [...this.recentLogs];
  }

  public clearLogs(): void {
    this.recentLogs = [];
  }

  // always call this before trying to do any work
  public async init() {
    if (this.initialized) return;
    this.initialized = true;

    this.ffmpeg.on("log", ({ message }) => {
      // Store recent logs for error reporting
      this.recentLogs.push(message);
      if (this.recentLogs.length > this.maxLogs) {
        this.recentLogs.shift();
      }

      if (this.settings.logging.includes("ffmpeg")) {
        console.log(message);
      }
      this.progressHook(message);
    });

    await this.ffmpeg.load({
      coreURL: "../../../core/dist/umd/ffmpeg-core.js",
    });
  }

  public async loadFile(fileInfo: File): Promise<FileReference> {
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

    try {
      const file = await this.ffmpeg.readFile(name);
      if (typeof file !== "object")
        throw new Error("Could not get file from syncotrope");
      return file;
    } catch (e) {
      console.log(`Unable to get file: ${name}`);
      console.log(await this.ffmpeg.listDir("."));
      throw e;
    }
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
