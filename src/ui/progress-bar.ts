export function setProgress(percentage: number) {
  console.log("PROGRESS " + percentage);
  if (percentage <= 0) {
    hide();
    return;
  }
  show();
  const progressBar = getProgressBar();
  progressBar.value = percentage;
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
