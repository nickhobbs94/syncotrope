export function testFunction(s: string): number {
  return s.length;
}

// function that takes an image and fixes the aspect ratio
// export function aspectFixer(image, desiredHeight: number, desiredWidth: number) {
//   return imageFixedAspect
// }


// function that takes an image and scales over time, outputting frames as a list
// function that takes a series of frames and sequences them into one file
// make it downloadable

type Settings = {
  targetHeight: number,
  targetWidth: number,
  targetBlur: number,
  zoomRate: number,
  frameRate: number,
  imageDurationSeconds: number,
}

const defaults: Settings = {
  targetHeight: 1080,
  targetWidth: 1920,
  targetBlur: 195,
  zoomRate: 40,
  frameRate: 25,
  imageDurationSeconds: 10,
}


export function getSettings(given: Partial<Settings>): Settings {
  return {
    ...defaults,...given
  }
}