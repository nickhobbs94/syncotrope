export type SyncotropeSettings = {
  targetHeight: number;
  targetWidth: number;
  targetBlur: string;
  zoomRate: number;
  frameRate: number;
  imageDurationSeconds: number;
};

const defaults: SyncotropeSettings = {
  targetHeight: 1080,
  targetWidth: 1920,
  targetBlur: "50:10",
  zoomRate: 1.001,
  frameRate: 25,
  imageDurationSeconds: 3,
};

export function getSettings(
  given: Partial<SyncotropeSettings>,
): SyncotropeSettings {
  return {
    ...defaults,
    ...given,
  };
}
