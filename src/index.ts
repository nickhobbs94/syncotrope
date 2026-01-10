/**
 * Application entry point.
 * Wires together UI components and processing pipeline.
 */

import { downloadBuffer } from "./util/buffer-download";
import { Syncotrope } from "./core/syncotrope";
import type { FFmpeg as FFmpegClass } from "@ffmpeg/ffmpeg";
import { setupSettingsSidebar } from "./ui/settings-sidebar";
import { setProgress } from "./ui/progress-bar";
import { processImages } from "./core/processor";

declare const FFmpegWASM: { FFmpeg: typeof FFmpegClass };
const { FFmpeg } = FFmpegWASM;

const syncotrope = new Syncotrope(new FFmpeg());

async function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = input.files;

  if (!files?.length) {
    return;
  }

  const result = await processImages(
    syncotrope,
    Array.from(files),
    (progress) => {
      setProgress(progress);
    },
  );

  downloadBuffer(result.data, result.filename, result.mimeType);
}

export function setup() {
  const uploader = document.getElementById("uploader");
  if (!uploader) throw new Error("No uploader element found");
  uploader.addEventListener("change", handleFileUpload);

  setupSettingsSidebar();
}

setup();
