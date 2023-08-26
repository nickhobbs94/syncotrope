import { downloadBuffer } from "./util/buffer-download";
import { Syncotrope } from "./syncotrope";

declare const FFmpegWASM: any;

const { FFmpeg } = FFmpegWASM;
const syncotrope = new Syncotrope(new FFmpeg());

const processFiles = async (event: any) => {
  const files = event.target.files;

  const file = await syncotrope.loadFile(files[0]);

  // for narrow aspect images
  const fillHorizontalImage = await syncotrope.scaleImage(file, 1920, -1);
  const fillVertImage = await syncotrope.scaleImage(file, -1, 1080);
  const blurredImg = await syncotrope.blurImage(file)
  const overlaidImage = await syncotrope.overlayImage(
    blurredImg,
    fillVertImage,
  );

  const result = await syncotrope.retrieveFile(overlaidImage);
  downloadBuffer(result, "output.png", "image/png");
};

export function setup() {
  const elm = document.getElementById("uploader");
  if (!elm) throw new Error("No uploader button");
  elm.addEventListener("change", processFiles);
}
