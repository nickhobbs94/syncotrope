/**
 * File list UI component for managing and reordering selected files.
 */

let selectedFiles: File[] = [];
let onFilesChangedCallback: ((files: File[]) => void) | null = null;

export function getSelectedFiles(): File[] {
  return [...selectedFiles];
}

export function clearSelectedFiles() {
  selectedFiles = [];
  render();
}

export function onFilesChanged(callback: (files: File[]) => void) {
  onFilesChangedCallback = callback;
}

function render() {
  const fileList = document.getElementById("file-list");
  const container = document.getElementById("file-list-container");
  if (!fileList || !container) return;

  if (selectedFiles.length === 0) {
    container.style.display = "none";
    return;
  }

  container.style.display = "block";
  fileList.innerHTML = "";

  selectedFiles.forEach((file, index) => {
    const li = document.createElement("li");
    li.draggable = true;
    li.dataset.index = String(index);

    li.innerHTML = `
      <span class="file-order">${index + 1}.</span>
      <span class="file-name">${file.name}</span>
      <div class="file-controls">
        <button class="move-up" ${index === 0 ? "disabled" : ""}>↑</button>
        <button class="move-down" ${index === selectedFiles.length - 1 ? "disabled" : ""}>↓</button>
        <button class="remove">×</button>
      </div>
    `;

    // Move up button
    li.querySelector(".move-up")?.addEventListener("click", () => {
      if (index > 0) {
        [selectedFiles[index - 1], selectedFiles[index]] = [
          selectedFiles[index],
          selectedFiles[index - 1],
        ];
        render();
        onFilesChangedCallback?.(selectedFiles);
      }
    });

    // Move down button
    li.querySelector(".move-down")?.addEventListener("click", () => {
      if (index < selectedFiles.length - 1) {
        [selectedFiles[index], selectedFiles[index + 1]] = [
          selectedFiles[index + 1],
          selectedFiles[index],
        ];
        render();
        onFilesChangedCallback?.(selectedFiles);
      }
    });

    // Remove button
    li.querySelector(".remove")?.addEventListener("click", () => {
      selectedFiles.splice(index, 1);
      render();
      onFilesChangedCallback?.(selectedFiles);
    });

    // Drag and drop
    li.addEventListener("dragstart", (e) => {
      li.classList.add("dragging");
      e.dataTransfer?.setData("text/plain", String(index));
    });

    li.addEventListener("dragend", () => {
      li.classList.remove("dragging");
    });

    li.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    li.addEventListener("drop", (e) => {
      e.preventDefault();
      const fromIndex = parseInt(e.dataTransfer?.getData("text/plain") || "0");
      const toIndex = index;
      if (fromIndex !== toIndex) {
        const [movedFile] = selectedFiles.splice(fromIndex, 1);
        selectedFiles.splice(toIndex, 0, movedFile);
        render();
        onFilesChangedCallback?.(selectedFiles);
      }
    });

    fileList.appendChild(li);
  });
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = input.files;

  if (!files?.length) return;

  // Add new files to the list
  selectedFiles = [...selectedFiles, ...Array.from(files)];
  render();
  onFilesChangedCallback?.(selectedFiles);

  // Clear the input so the same files can be selected again if needed
  input.value = "";
}

export function setupFileList() {
  const uploader = document.getElementById("uploader");
  if (!uploader) throw new Error("No uploader element found");
  uploader.addEventListener("change", handleFileSelect);
}
