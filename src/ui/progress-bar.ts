export function setProgress(percentage: number) {
  if (percentage <= 0) {
    hide();
    return;
  }
  show();
  const progressBar = getProgressBar();
  progressBar.value = percentage;
}

export function parseFrameFromLog(message: string): number | null {
  const frame = message.match(/^frame=\s*(?<frame>[0-9]*)/)?.groups?.frame;
  return frame ? parseFloat(frame) : null;
}

export function calculateProgress(
  frame: number,
  settings: { frameRate: number; imageDurationSeconds: number },
): number {
  const totalFrames = settings.frameRate * settings.imageDurationSeconds;
  return (frame / totalFrames) * 100;
}

export function updateProgressFromFFmpegLog(
  message: string,
  settings: { frameRate: number; imageDurationSeconds: number },
) {
  const frame = parseFrameFromLog(message);
  if (frame !== null) {
    setProgress(calculateProgress(frame, settings));
  }
}

function show() {
  const progressBar = getProgressBar();
  progressBar.style.display = "block";
}

function hide() {
  const progressBar = getProgressBar();
  progressBar.style.display = "none";
}

function getProgressBar(): HTMLProgressElement {
  const progressBar: HTMLProgressElement | null = document.getElementById(
    "progressBar",
  ) as HTMLProgressElement;
  if (!progressBar) {
    throw new Error("Cannot find progress bar");
  }
  return progressBar;
}
