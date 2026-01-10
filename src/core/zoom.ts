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
 * Calculate the floored x offset (old approach - has back-and-forth jitter).
 * @deprecated Use linearOffsetX for monotonic motion
 */
export function flooredOffsetX(inputWidth: number, zoom: number): number {
  return Math.floor(centerOffsetX(inputWidth, zoom));
}

/**
 * Calculate the floored y offset (old approach - has back-and-forth jitter).
 * @deprecated Use linearOffsetY for monotonic motion
 */
export function flooredOffsetY(inputHeight: number, zoom: number): number {
  return Math.floor(centerOffsetY(inputHeight, zoom));
}

/**
 * Calculate the final offset at maximum zoom.
 * This is the target offset we'll linearly interpolate towards.
 */
export function finalOffset(inputSize: number, finalZoom: number): number {
  return centerOffsetX(inputSize, finalZoom); // Same formula for X and Y
}

/**
 * Calculate the constant jump size per frame (rounded to ensure smooth motion).
 */
export function constantJumpSize(inputSize: number, totalFrames: number, finalZoom: number): number {
  const endOffset = finalOffset(inputSize, finalZoom);
  return Math.round(endOffset / totalFrames);
}

/**
 * Calculate the adjusted finalZoom that produces exactly jumpSize * totalFrames offset.
 * This ensures the zoom and position stay perfectly synchronized.
 */
export function adjustedFinalZoom(inputSize: number, jumpSize: number, totalFrames: number): number {
  const targetOffset = jumpSize * totalFrames;
  // Solve: inputSize * (zoom - 1) / (2 * zoom) = targetOffset
  // => zoom = inputSize / (inputSize - 2 * targetOffset)
  return inputSize / (inputSize - 2 * targetOffset);
}

/**
 * Calculate the adjusted zoomRate that matches constant jump motion.
 * This keeps zoom and position perfectly synchronized.
 */
export function adjustedZoomRate(inputSize: number, jumpSize: number, totalFrames: number): number {
  const finalZoom = adjustedFinalZoom(inputSize, jumpSize, totalFrames);
  // zoomRate such that: 1 + (zoomRate - 1) * totalFrames = finalZoom
  return 1 + (finalZoom - 1) / totalFrames;
}

/**
 * Calculate offset using constant jump size (perfectly smooth, no variation).
 * Every frame moves by exactly the same number of pixels.
 *
 * @param inputSize - Input dimension (width or height)
 * @param frame - Current frame number (0-indexed)
 * @param totalFrames - Total number of frames
 * @param finalZoom - Zoom level at final frame
 */
export function linearOffsetX(
  inputWidth: number,
  frame: number,
  totalFrames: number,
  finalZoom: number,
): number {
  const jump = constantJumpSize(inputWidth, totalFrames, finalZoom);
  return jump * frame;
}

/**
 * Calculate Y offset using constant jump size (perfectly smooth, no variation).
 */
export function linearOffsetY(
  inputHeight: number,
  frame: number,
  totalFrames: number,
  finalZoom: number,
): number {
  const jump = constantJumpSize(inputHeight, totalFrames, finalZoom);
  return jump * frame;
}

/**
 * Check if a value is close to an integer (within tolerance).
 */
export function isNearInteger(value: number, tolerance: number = 0.001): boolean {
  return Math.abs(value - Math.round(value)) < tolerance;
}

/**
 * Analyze zoom parameters for potential jitter issues.
 * Uses linear interpolation which produces monotonic jumps.
 * Returns an array of warnings about issues that could cause visible jitter.
 */
export function analyzeZoomForJitter(settings: ZoomSettings): string[] {
  const warnings: string[] = [];
  const totalFrames = settings.frameRate * settings.imageDurationSeconds;
  const { width: upscaledWidth, height: upscaledHeight } = upscaledDimensions(settings);
  const finalZoom = finalZoomLevel(settings);

  // Check if upscaled dimensions are integers (non-integer dimensions can cause issues)
  if (!isNearInteger(upscaledWidth)) {
    warnings.push(`Upscaled width ${upscaledWidth} is not an integer`);
  }
  if (!isNearInteger(upscaledHeight)) {
    warnings.push(`Upscaled height ${upscaledHeight} is not an integer`);
  }

  // Collect jumps using linear interpolation
  const jumpsX: number[] = [];
  const jumpsY: number[] = [];
  let prevOffsetX = linearOffsetX(upscaledWidth, 0, totalFrames, finalZoom);
  let prevOffsetY = linearOffsetY(upscaledHeight, 0, totalFrames, finalZoom);

  for (let frame = 1; frame <= totalFrames; frame++) {
    const offsetX = linearOffsetX(upscaledWidth, frame, totalFrames, finalZoom);
    const offsetY = linearOffsetY(upscaledHeight, frame, totalFrames, finalZoom);
    jumpsX.push(offsetX - prevOffsetX);
    jumpsY.push(offsetY - prevOffsetY);
    prevOffsetX = offsetX;
    prevOffsetY = offsetY;
  }

  // Check for back-and-forth direction changes
  for (let i = 2; i < jumpsX.length; i++) {
    const prevDiff = jumpsX[i - 1] - jumpsX[i - 2];
    const currDiff = jumpsX[i] - jumpsX[i - 1];
    if ((prevDiff > 0 && currDiff < 0) || (prevDiff < 0 && currDiff > 0)) {
      warnings.push(`Frame ${i + 1}: X jump direction changed (${jumpsX[i - 2]},${jumpsX[i - 1]},${jumpsX[i]})`);
    }
  }

  for (let i = 2; i < jumpsY.length; i++) {
    const prevDiff = jumpsY[i - 1] - jumpsY[i - 2];
    const currDiff = jumpsY[i] - jumpsY[i - 1];
    if ((prevDiff > 0 && currDiff < 0) || (prevDiff < 0 && currDiff > 0)) {
      warnings.push(`Frame ${i + 1}: Y jump direction changed (${jumpsY[i - 2]},${jumpsY[i - 1]},${jumpsY[i]})`);
    }
  }

  return warnings;
}
