import { downloadBuffer } from "./util/buffer-download";
import { Syncotrope } from "./core/syncotrope";

declare const FFmpegWASM: any;

const { FFmpeg } = FFmpegWASM;
const syncotrope = new Syncotrope(new FFmpeg());

const processFiles = async (event: any) => {
  const files = event.target.files;

  const originalImage = await syncotrope.fs.loadFile(files[0]);
  const overlaidImage = await syncotrope.standardizeImage(originalImage);
  const imageSequence = await syncotrope.imageToZoomSequence(overlaidImage);
  const videoFileData = await syncotrope.sequenceToVideo(imageSequence);

  downloadBuffer(videoFileData, "output.mp4", "video/mp4");
};

export function setup() {
  const elm = document.getElementById("uploader");
  if (!elm) throw new Error("No uploader button");
  elm.addEventListener("change", processFiles);
}

setup();
