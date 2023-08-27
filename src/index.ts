import { downloadBuffer } from "./util/buffer-download";
import { Syncotrope } from "./core/syncotrope";
import type { FFmpeg as FFmpegClass } from "@ffmpeg/ffmpeg";

declare const FFmpegWASM: { FFmpeg: typeof FFmpegClass };
const { FFmpeg } = FFmpegWASM;

const syncotrope = new Syncotrope(new FFmpeg());

const processFiles = async (event: Event) => {
  const files = (event.target as HTMLInputElement)?.files;

  if (!files?.length) {
    throw new Error("Cannt find file uploaded");
  }

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
