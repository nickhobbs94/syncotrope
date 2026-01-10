import { downloadBuffer } from "./util/buffer-download";
import { Syncotrope } from "./core/syncotrope";
import type { FFmpeg as FFmpegClass } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { setupSettingsSidebar } from "./ui/settings-sidebar";
import { setProgress } from "./ui/progress-bar";
import { getSettings, OutputFormat } from "./core/settings";

declare const FFmpegWASM: { FFmpeg: typeof FFmpegClass };
const { FFmpeg } = FFmpegWASM;

const syncotrope = new Syncotrope(new FFmpeg());

function getMimeType(format: OutputFormat): string {
  return format === "webm" ? "video/webm" : "video/mp4";
}

const processFiles = async (event: Event) => {
  const files = (event.target as HTMLInputElement)?.files;

  if (!files?.length) {
    throw new Error("Cannot find file uploaded");
  }

  syncotrope.loadSettings();
  const settings = getSettings();
  const mimeType = getMimeType(settings.outputFormat);
  const outputFilename = `output.${settings.outputFormat}`;

  for (const file of files) {
    setProgress(0.1);

    // Convert File to Uint8Array and process with the simplified API
    const imageData = await fetchFile(file);
    const videoData = await syncotrope.processImage(imageData);

    setProgress(100);

    downloadBuffer(videoData, outputFilename, mimeType);
  }
};

export function setup() {
  const elm = document.getElementById("uploader");
  if (!elm) throw new Error("No uploader button");
  elm.addEventListener("change", processFiles);
  setupSettingsSidebar();
}

setup();
