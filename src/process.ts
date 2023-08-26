import type * as UtilTypes from '@ffmpeg/util';
import { downloadBuffer } from './util/buffer-download';
import { Syncotrope } from './syncotrope';

declare const FFmpegUtil: {fetchFile: typeof UtilTypes.fetchFile};
declare const FFmpegWASM: any;

const { fetchFile } = FFmpegUtil;
const { FFmpeg } = FFmpegWASM;
const syncotrope = new Syncotrope(new FFmpeg());

const processFiles = async (event: any) => {
  const files = event.target.files;
  const file = await fetchFile(files[0]);

  downloadBuffer(await syncotrope.scaleImage(file), "output.png", "image/png");
};

export function setup() {
  const elm = document.getElementById("uploader");
  if (!elm) throw new Error('No uploader button');
  elm.addEventListener("change", processFiles);
}
