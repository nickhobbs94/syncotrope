/**
 * Pipeline processor for converting images to video.
 * Orchestrates the processing flow and reports progress.
 */

import { Syncotrope } from "./syncotrope";
import { getSettings, OutputFormat } from "./settings";

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

  const totalFiles = files.length;
  const imageDataList = await Promise.all(
    files.map(async (file) => new Uint8Array(await file.arrayBuffer())),
  );

  // All images go into one video, one clip after another
  onProgress?.(1, `Processing image 1 of ${totalFiles}`);
  const finalVideo = await syncotrope.processImages(
    imageDataList,
    (imageIndex, framesDone, framesTotal) => {
      onProgress?.(
        Math.max(1, (framesDone / framesTotal) * 99),
        `Processing image ${imageIndex + 1} of ${totalFiles}`,
      );
    },
  );

  onProgress?.(100, "Complete");

  return {
    data: finalVideo,
    filename,
    mimeType,
  };
}
