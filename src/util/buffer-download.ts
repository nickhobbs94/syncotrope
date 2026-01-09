// Handy function to download a buffer
export function downloadBuffer(
  buffer: Uint8Array,
  filename: string,
  mimeType: string,
) {
  // 1. Convert the buffer to a Blob
  // @ts-ignore
  const blob = new Blob([buffer], { type: mimeType });

  // 2. Create an Object URL
  const url = URL.createObjectURL(blob);

  // 3. Create a "download" anchor link
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();

  // 4. Revoke the Object URL after the download starts
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
