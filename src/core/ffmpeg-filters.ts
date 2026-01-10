/**
 * Pure functions for building FFmpeg filter strings.
 * Extracted for testability.
 */

import { ZoomSettings, finalZoomLevel, upscaledDimensions } from "./zoom";

export type ZoompanParams = {
  zoomIncrement: number;
  jumpX: number;
  jumpY: number;
  duration: number;
  fps: number;
  width: number;
  height: number;
};

/**
 * Calculate all zoompan parameters from settings.
 * This centralizes the complex calculations.
 */
export function calculateZoompanParams(settings: ZoomSettings): ZoompanParams {
  const totalFrames = settings.frameRate * settings.imageDurationSeconds;
  const userFinalZoom = finalZoomLevel(settings);

  // Get upscaled dimensions
  const { width: upscaledW, height: upscaledH } = upscaledDimensions(settings);

  // Calculate ideal final offset and round to get constant jump
  const idealOffsetX = (upscaledW * (userFinalZoom - 1)) / (2 * userFinalZoom);
  const idealOffsetY = (upscaledH * (userFinalZoom - 1)) / (2 * userFinalZoom);
  const jumpX = Math.round(idealOffsetX / totalFrames);
  const jumpY = Math.round(idealOffsetY / totalFrames);

  // Calculate adjusted zoom increment (kept for compatibility, not used in hyperbolic formula)
  const zoomIncrement = (userFinalZoom - 1) / totalFrames;

  return {
    zoomIncrement,
    jumpX,
    jumpY,
    duration: totalFrames,
    fps: settings.frameRate,
    width: settings.targetWidth,
    height: settings.targetHeight,
  };
}

/**
 * Build zoompan filter string from parameters.
 * Uses hyperbolic zoom formula to keep focus centered (eliminates drift).
 *
 * The zoom formula z = iw/(iw-2*jumpX*on) is derived from:
 * - We want position to move linearly: x = jumpX * on
 * - For the zoom to stay centered, zoom must satisfy: centerOffset(zoom) = jumpX * on
 * - Solving for zoom: zoom = inputSize / (inputSize - 2 * targetOffset)
 * - Since FFmpeg's 'iw' gives us inputSize and 'on' gives us frame number:
 *   z = iw / (iw - 2 * jumpX * on)
 */
export function buildZoompanFilter(params: ZoompanParams): string {
  // Use hyperbolic zoom to eliminate focus drift
  // z = iw / (iw - 2 * jumpX * on) keeps zoom and position perfectly synchronized
  return `zoompan=z='iw/(iw-2*${params.jumpX}*on)':x='${params.jumpX}*on':y='${params.jumpY}*on':d=${params.duration}:fps=${params.fps}:s=${params.width}x${params.height}`;
}

/**
 * Build zoompan filter directly from settings.
 */
export function zoompanFilterFromSettings(settings: ZoomSettings): string {
  const params = calculateZoompanParams(settings);
  return buildZoompanFilter(params);
}

/**
 * Build scale filter string.
 * Use -1 for width or height to maintain aspect ratio.
 */
export function buildScaleFilter(width: number, height: number): string {
  return `scale=${width}:${height}`;
}

/**
 * Build boxblur filter string.
 * @param blur - Blur parameter in format "radius:power" (e.g., "50:10")
 */
export function buildBlurFilter(blur: string): string {
  return `boxblur=${blur}`;
}

/**
 * Build overlay filter string for centering foreground on background.
 * @param targetWidth - Output width
 * @param targetHeight - Output height
 */
export function buildOverlayFilter(
  targetWidth: number,
  targetHeight: number,
): string {
  return `[0:v][1:v]overlay=(${targetWidth}/2)-(overlay_w/2):0,crop=${targetWidth}:${targetHeight}:0:0[outv]`;
}

/**
 * Build concat list file content for FFmpeg's concat demuxer.
 * @param filenames - Array of video filenames to concatenate
 */
export function buildConcatList(filenames: string[]): string {
  return filenames.map((f) => `file '${f}'`).join("\n");
}
