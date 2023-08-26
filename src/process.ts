import { downloadBuffer } from "./util/buffer-download";
import { Syncotrope } from "./syncotrope";

declare const FFmpegWASM: any;

const { FFmpeg } = FFmpegWASM;
const syncotrope = new Syncotrope(new FFmpeg());

const processFiles = async (event: any) => {
  const files = event.target.files;

  const file = await syncotrope.loadFile(files[0]);
  const imageSequence = await syncotrope.standardizeImage(file);
  const retrievedSequence = await syncotrope.retrieveSequence(imageSequence);
  const videoFileData = await syncotrope.sequenceToVideo(retrievedSequence);
  downloadBuffer(videoFileData, "output.mp4", "video/mp4");

};

export function setup() {
  const elm = document.getElementById("uploader");
  if (!elm) throw new Error("No uploader button");
  elm.addEventListener("change", processFiles);
}
