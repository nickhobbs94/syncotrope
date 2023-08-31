export function setProgress(percentage: number) {
  if (percentage <= 0) {
    hide();
    return;
  }
  show();
  const progressBar = getProgressBar();
  progressBar.value = percentage;
}

export function updateProgressFromFFmpegLog(
  message: string,
  settings: { frameRate: number; imageDurationSeconds: number },
) {
  const frame = message.match(/^frame=\s*(?<frame>[0-9]*)/)?.groups?.frame;
  if (frame) {
    const duration = settings.frameRate * settings.imageDurationSeconds;
    setProgress((parseFloat(frame) / duration) * 100);
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
