/**
 * Pure functions for zoom calculations.
 *
 * Each frame is drawn straight from the source image at a float zoom level,
 * so there is no whole-pixel stepping and no drift to correct for.
 */

export type ZoomSettings = {
  zoomRate: number;
  frameRate: number;
  imageDurationSeconds: number;
  targetWidth: number;
  targetHeight: number;
};

/**
 * Calculate the zoom level at a specific frame.
 * Frame 0 starts at zoom level 1.0, and each frame adds (zoomRate - 1).
 */
export function zoomAtFrame(frame: number, zoomRate: number): number {
  return 1 + (zoomRate - 1) * frame;
}

/**
 * Number of frames each image is shown for.
 */
export function framesPerImage(settings: ZoomSettings): number {
  return Math.max(
    1,
    Math.round(settings.frameRate * settings.imageDurationSeconds),
  );
}

/**
 * Calculate the zoom level of the last frame.
 */
export function finalZoomLevel(settings: ZoomSettings): number {
  return zoomAtFrame(framesPerImage(settings) - 1, settings.zoomRate);
}
