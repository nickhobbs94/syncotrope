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
import {
  setStatus,
  clearStatus,
  showDownloadButton,
  hideDownloadButton,
  setupDownloadButton,
} from "./ui/status";

declare const FFmpegWASM: { FFmpeg: typeof FFmpegClass };
const { FFmpeg } = FFmpegWASM;

const syncotrope = new Syncotrope(new FFmpeg());

async function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = input.files;

  if (!files?.length) {
    return;
  }

  // Clear any previous status
  clearStatus();
  hideDownloadButton();

  try {
    const result = await processImages(
      syncotrope,
      Array.from(files),
      (progress, message) => {
        setProgress(progress);
        setStatus(message, "processing");
      },
    );

    setStatus("Video ready! Click the button below to download.", "success");

    // Show download button instead of auto-downloading
    showDownloadButton(result.data, result.filename, result.mimeType);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    setStatus(`Error: ${errorMessage}`, "error");
    setProgress(0);
    console.error("Processing failed:", error);
  }
}

export function setup() {
  const uploader = document.getElementById("uploader");
  if (!uploader) throw new Error("No uploader element found");
  uploader.addEventListener("change", handleFileUpload);

  setupDownloadButton(downloadBuffer);
  setupSettingsSidebar();
}

setup();
