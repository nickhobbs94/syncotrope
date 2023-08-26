import { downloadBuffer } from "./util/buffer-download";
import { Syncotrope } from "./syncotrope";

declare const FFmpegWASM: any;

const { FFmpeg } = FFmpegWASM;
const syncotrope = new Syncotrope(new FFmpeg());

const processFiles = async (event: any) => {
  const files = event.target.files;

  const file = await syncotrope.loadFile(files[0]);
  const scaledImage = await syncotrope.standardizeImage(file);

  const result = await syncotrope.retrieveFile(scaledImage);
  downloadBuffer(result, "output.png", "image/png");
};

export function setup() {
  const elm = document.getElementById("uploader");
  if (!elm) throw new Error("No uploader button");
  elm.addEventListener("change", processFiles);
}
