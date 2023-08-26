declare const FFmpegUtil: any;
declare const FFmpegWASM: any;

const { fetchFile } = FFmpegUtil;
const { FFmpeg } = FFmpegWASM;
let ffmpeg: any = null;

const transcode = async ({ target: { files } }: any) => {
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
  await ffmpeg.writeFile(name, await fetchFile(files[0]));
  message.innerHTML = "Start transcoding";
  console.time("exec");
  await ffmpeg.exec(["-i", name, "output.mp4"]);
  console.timeEnd("exec");
  message.innerHTML = "Complete transcoding";
  const data = await ffmpeg.readFile("output.mp4");

  const video: any = document.getElementById("output-video");
  video.src = URL.createObjectURL(
    new Blob([data.buffer], { type: "video/mp4" }),
  );
};

export function setup() {
  const elm: any = document.getElementById("uploader");
  elm.addEventListener("change", transcode);
}
