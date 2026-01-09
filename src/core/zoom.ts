/**
 * Pure functions for zoom calculations.
 * Extracted for testability and to fix jitter issues.
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
 * Frame 0 starts at zoom level 1.0.
 */
export function zoomAtFrame(frame: number, zoomRate: number): number {
  // Each frame multiplies by zoomRate, so after n frames: zoomRate^n
  // But FFmpeg zoompan uses additive: zoom starts at 1, adds (zoomRate-1) each frame
  // So: 1 + (zoomRate - 1) * frame
  return 1 + (zoomRate - 1) * frame;
}

/**
 * Calculate the final zoom level after all frames.
 */
export function finalZoomLevel(settings: ZoomSettings): number {
  const totalFrames = settings.frameRate * settings.imageDurationSeconds;
  return zoomAtFrame(totalFrames, settings.zoomRate);
}

/**
 * Calculate the upscaled image dimensions needed to avoid
 * running out of pixels during zoom.
 */
export function upscaledDimensions(settings: ZoomSettings): {
  width: number;
  height: number;
} {
  const zoom = finalZoomLevel(settings);
  return {
    width: settings.targetWidth * zoom,
    height: settings.targetHeight * zoom,
  };
}

/**
 * Calculate the x offset to keep the image centered at a given zoom level.
 * iw = input width (upscaled image width)
 */
export function centerOffsetX(inputWidth: number, zoom: number): number {
  // Formula: (iw/2 - iw/zoom/2) = iw * (1/2 - 1/(2*zoom)) = iw * (zoom - 1) / (2 * zoom)
  return (inputWidth / 2) - (inputWidth / zoom / 2);
}

/**
 * Calculate the y offset to keep the image centered at a given zoom level.
 * ih = input height (upscaled image height)
 */
export function centerOffsetY(inputHeight: number, zoom: number): number {
  return (inputHeight / 2) - (inputHeight / zoom / 2);
}

/**
 * Check if a value is close to an integer (within tolerance).
 */
export function isNearInteger(value: number, tolerance: number = 0.001): boolean {
  return Math.abs(value - Math.round(value)) < tolerance;
}

/**
 * Analyze zoom parameters for potential jitter issues.
 * Returns an array of warnings about non-integer pixel values.
 */
export function analyzeZoomForJitter(settings: ZoomSettings): string[] {
  const warnings: string[] = [];
  const totalFrames = settings.frameRate * settings.imageDurationSeconds;
  const { width: upscaledWidth, height: upscaledHeight } = upscaledDimensions(settings);

  // Check if upscaled dimensions are integers
  if (!isNearInteger(upscaledWidth)) {
    warnings.push(`Upscaled width ${upscaledWidth} is not an integer`);
  }
  if (!isNearInteger(upscaledHeight)) {
    warnings.push(`Upscaled height ${upscaledHeight} is not an integer`);
  }

  // Check center offsets at each frame for non-integer values
  for (let frame = 0; frame <= totalFrames; frame++) {
    const zoom = zoomAtFrame(frame, settings.zoomRate);
    const offsetX = centerOffsetX(upscaledWidth, zoom);
    const offsetY = centerOffsetY(upscaledHeight, zoom);

    if (!isNearInteger(offsetX)) {
      warnings.push(`Frame ${frame}: X offset ${offsetX.toFixed(4)} is not an integer`);
    }
    if (!isNearInteger(offsetY)) {
      warnings.push(`Frame ${frame}: Y offset ${offsetY.toFixed(4)} is not an integer`);
    }
  }

  return warnings;
}
