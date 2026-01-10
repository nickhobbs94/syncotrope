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
 * Calculate the ideal x offset to keep the image centered at a given zoom level.
 * iw = input width (upscaled image width)
 */
export function centerOffsetX(inputWidth: number, zoom: number): number {
  // Formula: (iw/2 - iw/zoom/2) = iw * (1/2 - 1/(2*zoom)) = iw * (zoom - 1) / (2 * zoom)
  return (inputWidth / 2) - (inputWidth / zoom / 2);
}

/**
 * Calculate the ideal y offset to keep the image centered at a given zoom level.
 * ih = input height (upscaled image height)
 */
export function centerOffsetY(inputHeight: number, zoom: number): number {
  return (inputHeight / 2) - (inputHeight / zoom / 2);
}

/**
 * Calculate the floored x offset (what FFmpeg actually uses with floor()).
 */
export function flooredOffsetX(inputWidth: number, zoom: number): number {
  return Math.floor(centerOffsetX(inputWidth, zoom));
}

/**
 * Calculate the floored y offset (what FFmpeg actually uses with floor()).
 */
export function flooredOffsetY(inputHeight: number, zoom: number): number {
  return Math.floor(centerOffsetY(inputHeight, zoom));
}

/**
 * Check if a value is close to an integer (within tolerance).
 */
export function isNearInteger(value: number, tolerance: number = 0.001): boolean {
  return Math.abs(value - Math.round(value)) < tolerance;
}

/**
 * Analyze zoom parameters for potential jitter issues.
 * With floor() applied, checks for inconsistent jumps between frames.
 * Jitter occurs when the jump size varies too much between frames.
 * Returns an array of warnings about issues that could cause visible jitter.
 */
export function analyzeZoomForJitter(settings: ZoomSettings): string[] {
  const warnings: string[] = [];
  const totalFrames = settings.frameRate * settings.imageDurationSeconds;
  const { width: upscaledWidth, height: upscaledHeight } = upscaledDimensions(settings);

  // Check if upscaled dimensions are integers (non-integer dimensions can cause issues)
  if (!isNearInteger(upscaledWidth)) {
    warnings.push(`Upscaled width ${upscaledWidth} is not an integer`);
  }
  if (!isNearInteger(upscaledHeight)) {
    warnings.push(`Upscaled height ${upscaledHeight} is not an integer`);
  }

  // Track offsets and jumps to detect inconsistent motion
  let prevOffsetX = flooredOffsetX(upscaledWidth, 1); // frame 0, zoom = 1
  let prevOffsetY = flooredOffsetY(upscaledHeight, 1);
  let prevJumpX = 0;
  let prevJumpY = 0;

  // Jitter occurs when jump sizes vary too much between consecutive frames
  // Due to floor(), jumps can vary by 1 (e.g., 6,7,6,7) which is smooth
  // But larger variations indicate jitter
  const maxJumpVariation = 1;

  for (let frame = 1; frame <= totalFrames; frame++) {
    const zoom = zoomAtFrame(frame, settings.zoomRate);
    const offsetX = flooredOffsetX(upscaledWidth, zoom);
    const offsetY = flooredOffsetY(upscaledHeight, zoom);

    const jumpX = offsetX - prevOffsetX;
    const jumpY = offsetY - prevOffsetY;

    // Check for inconsistent jumps (skip first frame comparison)
    if (frame > 1) {
      const variationX = Math.abs(jumpX - prevJumpX);
      const variationY = Math.abs(jumpY - prevJumpY);

      if (variationX > maxJumpVariation) {
        warnings.push(`Frame ${frame}: X jump varied by ${variationX} (was ${prevJumpX}, now ${jumpX})`);
      }
      if (variationY > maxJumpVariation) {
        warnings.push(`Frame ${frame}: Y jump varied by ${variationY} (was ${prevJumpY}, now ${jumpY})`);
      }
    }

    prevOffsetX = offsetX;
    prevOffsetY = offsetY;
    prevJumpX = jumpX;
    prevJumpY = jumpY;
  }

  return warnings;
}
