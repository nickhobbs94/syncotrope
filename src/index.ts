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

  const videoDataList: Uint8Array[] = [];
  const totalFiles = files.length;

  // Process each image into a video clip
  for (let i = 0; i < totalFiles; i++) {
    const file = files[i];
    const progressBase = (i / totalFiles) * 90; // Reserve 10% for concatenation
    setProgress(progressBase + 1);

    // Convert File to Uint8Array and process with the simplified API
    const imageData = await fetchFile(file);
    const videoData = await syncotrope.processImage(imageData);
    videoDataList.push(videoData);
  }

  // Concatenate all videos if there are multiple
  setProgress(92);
  const finalVideo = await syncotrope.concatenateVideos(videoDataList);

  setProgress(100);

  downloadBuffer(finalVideo, outputFilename, mimeType);
};

export function setup() {
  const elm = document.getElementById("uploader");
  if (!elm) throw new Error("No uploader button");
  elm.addEventListener("change", processFiles);
  setupSettingsSidebar();
}

setup();
