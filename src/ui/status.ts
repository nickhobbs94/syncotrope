/**
 * UI status management for displaying progress, messages, and download button.
 */

export type StatusType = "info" | "success" | "error" | "processing";

let pendingDownload: {
  data: Uint8Array;
  filename: string;
  mimeType: string;
} | null = null;

export function setStatus(message: string, type: StatusType = "info") {
  const statusElement = document.getElementById("status-message");
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = `status-${type}`;
  }
}

export function clearStatus() {
  const statusElement = document.getElementById("status-message");
  if (statusElement) {
    statusElement.textContent = "";
    statusElement.className = "";
  }
}

export function showDownloadButton(
  data: Uint8Array,
  filename: string,
  mimeType: string,
) {
  pendingDownload = { data, filename, mimeType };

  const downloadButton = document.getElementById(
    "download-button",
  ) as HTMLButtonElement;
  if (downloadButton) {
    downloadButton.style.display = "inline-block";
    downloadButton.textContent = `Download ${filename}`;
  }
}

export function hideDownloadButton() {
  pendingDownload = null;

  const downloadButton = document.getElementById(
    "download-button",
  ) as HTMLButtonElement;
  if (downloadButton) {
    downloadButton.style.display = "none";
  }
}

export function getPendingDownload() {
  return pendingDownload;
}

export function setupDownloadButton(
  downloadFn: (data: Uint8Array, filename: string, mimeType: string) => void,
) {
  const downloadButton = document.getElementById("download-button");
  if (downloadButton) {
    downloadButton.addEventListener("click", () => {
      if (pendingDownload) {
        downloadFn(
          pendingDownload.data,
          pendingDownload.filename,
          pendingDownload.mimeType,
        );
        hideDownloadButton();
        setStatus("Download started!", "success");
        // Clear success message after a delay
        setTimeout(() => {
          clearStatus();
        }, 3000);
      }
    });
  }
}
