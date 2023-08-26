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
  