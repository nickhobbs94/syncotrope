type Settings = {
  targetHeight: number;
  targetWidth: number;
  targetBlur: number;
  zoomRate: number;
  frameRate: number;
  imageDurationSeconds: number;
};

const defaults: Settings = {
  targetHeight: 1080,
  targetWidth: 1920,
  targetBlur: 195,
  zoomRate: 40,
  frameRate: 25,
  imageDurationSeconds: 10,
};

export function getSettings(given: Partial<Settings>): Settings {
  return {
    ...defaults,
    ...given,
  };
}
