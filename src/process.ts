declare const FFmpegUtil: any;
declare const FFmpegWASM: any;

const { fetchFile } = FFmpegUtil;
const { FFmpeg } = FFmpegWASM;
let ffmpeg: any = null;

const transcode = async (arg: any) => {
  console.log(arg);
  const files = arg.target.files;
  const message: any = document.getElementById("message");
  if (ffmpeg === null) {
    ffmpeg = new FFmpeg();
    ffmpeg.on("log", ({ message }: any) => {
      console.log(message);
    });
    ffmpeg.on("progress", ({ progress, time }: any) => {
      message.innerHTML = `${progress * 100} %, time: ${time / 1000000} s`;
    });
    await ffmpeg.load({
      coreURL: "/assets/core/dist/umd/ffmpeg-core.js",
    });
  }
  const { name } = files[0];

  console.log(name);

  const file = await fetchFile(files[0]);

  // stores the file as its name
  // await ffmpeg.writeFile(name, file);
  // await ffmpeg.exec(["-i", name, "-vf", "scale=1920:-1", "-c:a", "copy", "outputBlur.png"]);
  // const data = await ffmpeg.readFile("outputBlur.png");
  // console.log(data);

  downloadBuffer(await scaleImage(ffmpeg, file), "output.png", "image/png");
};

async function scaleImage(ffmpeg: any, file: any) {
  await ffmpeg.writeFile("inputfile", file);
  await ffmpeg.exec(["-i", "inputfile", "-vf", "scale=1920:-1", "-c:a", "copy", "output.png"]);
  return await ffmpeg.readFile("output.png");
}

function downloadBuffer(buffer: any, filename: any, mimeType: any) {
  // 1. Convert the buffer to a Blob
  const blob = new Blob([buffer], { type: mimeType });

  // 2. Create an Object URL
  const url = URL.createObjectURL(blob);

  // 3. Create a "download" anchor link
  const a = document.createElement('a');
  a.style.display = 'none';
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

export function setup() {
  const elm: any = document.getElementById("uploader");
  elm.addEventListener("change", transcode);
}
