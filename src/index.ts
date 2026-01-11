/**
 * Application entry point.
 * Wires together UI components and processing pipeline.
 */

import "../public/static/style.css";
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
import {
  setupFileList,
  getSelectedFiles,
  clearSelectedFiles,
} from "./ui/file-list";

declare const FFmpegWASM: { FFmpeg: typeof FFmpegClass };
declare const __GIT_HASH__: string;
const { FFmpeg } = FFmpegWASM;

const syncotrope = new Syncotrope(new FFmpeg());

async function handleStartProcessing() {
  const files = getSelectedFiles();
  if (files.length === 0) {
    return;
  }

  // Clear any previous status
  clearStatus();
  hideDownloadButton();

  const startButton = document.getElementById(
    "start-processing",
  ) as HTMLButtonElement;
  if (startButton) {
    startButton.disabled = true;
    startButton.textContent = "Processing...";
  }

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

    // Clear the file list after successful processing
    clearSelectedFiles();
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    setStatus(`Error: ${errorMessage}`, "error");
    setProgress(0);
    console.error("Processing failed:", error);
  } finally {
    if (startButton) {
      startButton.disabled = false;
      startButton.textContent = "Start Processing";
    }
  }
}

export function setup() {
  setupFileList();

  const startButton = document.getElementById("start-processing");
  if (startButton) {
    startButton.addEventListener("click", handleStartProcessing);
  }

  setupDownloadButton(downloadBuffer);
  setupSettingsSidebar();

  const versionElement = document.getElementById("version");
  if (versionElement) {
    versionElement.textContent = __GIT_HASH__;
  }
}

setup();
