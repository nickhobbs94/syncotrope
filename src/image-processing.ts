// // function that takes an image and fixes the aspect ratio
// export function aspectFixer(image, desiredHeight: number, desiredWidth: number) {
//     widthOffset = (desiredWidth / 2) - (initialWidth / 2) // 150 for totoro
  
//     // ffmpeg -i input.png -vf "boxblur=50:10" -c:a copy outputBlur.png
//     // ffmpeg -i outputBlur.png -vf scale=1920:-1 outputWideScale.png
//     // ffmpeg -i input.png -vf scale=-1:1080 outputNarrowScale.png
//     // ffmpeg -i outputWideScale.png -i outputNarrowScale.png -filter_complex "[0:v][1:v]overlay=150:0,crop=1920:1080:0:0[outv]" -map "[outv]" -pix_fmt yuv420p -c:a copy outputOverlay.png
    
//     return imageFixedAspect
//    }
  
  
//   // function that takes an image and scales over time, outputting frames as a list
//   export function aspectFixer(image, desiredHeight: number, desiredWidth: number) {
//     // totalFrames = duration * frameRate
//     // finalFrames = []
//     // for i in totalFrames:
//     //   scaledImage // ffmpeg -i outputOverlay.png -filter_complex "zoompan=z='zoom+0.1':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=100, scale=1920:1080" -pix_fmt yuv420p -c:a copy outputZoomed.png
//     //   finalFrames.append(scaledImage)
//     // return imageSequence
//    }
  
//   // function that takes a series of frames and sequences them into one file
//   // $ ffmpeg -framerate 1 -i happy%d.jpg -c:v libx264 -r 30 output.mp4
  

// const transcode = async () => {
//     const ffmpeg = ffmpegRef.current;
//     await ffmpeg.writeFile('input.webm', await fetchFile('https://raw.githubusercontent.com/ffmpegwasm/testdata/master/Big_Buck_Bunny_180_10s.webm'));
//     await ffmpeg.exec(["-i", "input.png", "-vf", "boxblur=50:10", "-c:a", "copy", "outputBlur.png"]);
//     const data = await ffmpeg.readFile('output.mp4');
//     videoRef.current.src =
//         URL.createObjectURL(new Blob([data.buffer], {type: 'video/mp4'}));
// }


export async function processImage(ffmpeg: any, file: any) {
    // for narrow aspect images
    const fillHorizontalImage = await horScaleImage(ffmpeg, file)
    const fillVertImage = await vertScaleImage(ffmpeg, file)
    // const blurredImg = await blurImage(ffmpeg, file)
    const overlaidImage = await overlayImage(ffmpeg, fillHorizontalImage, fillVertImage)
    return overlaidImage;
}

async function horScaleImage(ffmpeg: any, file: any) {
    await ffmpeg.writeFile("inputfile", file);
    await ffmpeg.exec(["-i", "inputfile", "-vf", "scale=1920:-1", "-c:a", "copy", "output.png"]);
    return await ffmpeg.readFile("output.png");
}

async function vertScaleImage(ffmpeg: any, file: any) {
    await ffmpeg.writeFile("inputfile", file);
    await ffmpeg.exec(["-i", "inputfile", "-vf", "scale=-1:1080", "-c:a", "copy", "output.png"]);
    return await ffmpeg.readFile("output.png");
}

// async function blurImage(ffmpeg: any, file: any) {
//     await ffmpeg.writeFile("inputfile", file);
//     await ffmpeg.exec(["-i", "inputfile", "-vf", "boxblur=50:10", "-c:a", "copy", "output.png"]);
//     return await ffmpeg.readFile("output.png");
// }

async function overlayImage(ffmpeg: any, backgroundImage: any, foregroundImage: any) {
    await ffmpeg.writeFile("backgroundImage", backgroundImage);
    await ffmpeg.writeFile("foregroundImage", foregroundImage);
    await ffmpeg.exec([
        "-i", "backgroundImage", "-i", "foregroundImage",
        "-filter_complex", "[0:v][1:v]overlay=150:0,crop=1920:1080:0:0[outv]",
        "-map", "[outv]", "-pix_fmt", "yuv420p", "-c:a", "copy", "output.png"
      ]);
    return await ffmpeg.readFile("output.png");
}