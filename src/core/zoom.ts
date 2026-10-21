/**
 * Pure functions for zoom calculations.
 *
 * The zoom speed is the percentage the image grows by each second. The zoom
 * is exponential, so it looks equally fast from start to end (a linear zoom
 * appears to slow down), and it doesn't depend on the frame rate. Each frame
 * is drawn straight from the source image at this float zoom, so there is no
 * whole-pixel stepping and no drift to correct for.
 */

export type ZoomSettings = {
  zoomSpeed: number; // percent per second
  frameRate: number;
  imageDurationSeconds: number;
  targetWidth: number;
  targetHeight: number;
};

/**
 * Calculate the zoom level at a specific frame.
 * Frame 0 starts at zoom level 1.0.
 */
export function zoomAtFrame(
  frame: number,
  zoomSpeed: number,
  frameRate: number,
): number {
  return Math.pow(1 + zoomSpeed / 100, frame / frameRate);
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
  return zoomAtFrame(
    framesPerImage(settings) - 1,
    settings.zoomSpeed,
    settings.frameRate,
  );
}
