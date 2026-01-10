/**
 * Pipeline processor for converting images to video.
 * Orchestrates the processing flow and reports progress.
 */

import { Syncotrope } from "./syncotrope";
import { getSettings, OutputFormat } from "./settings";
import { fetchFile } from "@ffmpeg/util";

export type ProgressCallback = (progress: number, message: string) => void;

export type ProcessingResult = {
  data: Uint8Array;
  filename: string;
  mimeType: string;
};

function getMimeType(format: OutputFormat): string {
  return format === "webm" ? "video/webm" : "video/mp4";
}

/**
 * Process a list of image files into a single video.
 *
 * @param syncotrope - The Syncotrope instance to use for processing
 * @param files - Array of File objects to process
 * @param onProgress - Optional callback for progress updates
 * @returns The processed video data with filename and MIME type
 */
export async function processImages(
  syncotrope: Syncotrope,
  files: File[],
  onProgress?: ProgressCallback,
): Promise<ProcessingResult> {
  if (files.length === 0) {
    throw new Error("No files provided");
  }

  syncotrope.loadSettings();
  const settings = getSettings();
  const mimeType = getMimeType(settings.outputFormat);
  const filename = `output.${settings.outputFormat}`;

  const videoDataList: Uint8Array[] = [];
  const totalFiles = files.length;

  // Process each image into a video clip
  for (let i = 0; i < totalFiles; i++) {
    const file = files[i];
    const progressBase = (i / totalFiles) * 90; // Reserve 10% for concatenation
    onProgress?.(
      progressBase + 1,
      `Processing image ${i + 1} of ${totalFiles}`,
    );

    const imageData = await fetchFile(file);
    const videoData = await syncotrope.processImage(imageData);
    videoDataList.push(videoData);
  }

  // Concatenate all videos
  onProgress?.(
    92,
    totalFiles > 1 ? "Concatenating videos..." : "Finalizing...",
  );
  const finalVideo = await syncotrope.concatenateVideos(videoDataList);

  onProgress?.(100, "Complete");

  return {
    data: finalVideo,
    filename,
    mimeType,
  };
}
