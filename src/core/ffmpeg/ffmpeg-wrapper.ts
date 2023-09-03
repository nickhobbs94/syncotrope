export interface IFFmpegWrapper {
  scaleImage(
    file: Uint8Array,
    horizontalSize: number,
    verticalSize: number,
  ): Promise<Uint8Array>;

  overlayImage(
    backgroundImage: Uint8Array,
    foregroundImage: Uint8Array,
  ): Promise<Uint8Array>;

  blurImage(file: Uint8Array): Promise<Uint8Array>;

  zoomImageAsVideo(image: Uint8Array): Promise<Uint8Array>;

  concatenateVideos(
    firstVideo: Uint8Array,
    secondVideo: Uint8Array,
  ): Promise<Uint8Array>;
}
