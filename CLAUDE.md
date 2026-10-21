# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Syncotrope is a browser-based application that converts images to videos with zoom effects. All processing happens in the browser: frames are drawn with WebGL2 and encoded with the browser's own video encoder (WebCodecs), then muxed into MP4 or WebM (`mp4-muxer`, `webm-muxer`).

## Commands

- `bun run build` - Build with webpack
- `bun run start` - Start dev server with hot reload
- `bun test` - Run tests
- `bun run lint` - Run ESLint
- `bun run format` - Format code with Prettier
- `bun run code-check` - Run both ESLint and Prettier check

## Architecture

### Core Processing Pipeline (`src/core/`)

The main processing flow in `Syncotrope` class (`syncotrope.ts`):
1. `processImages(Uint8Array[], onProgress)` - Main public API: takes raw image data for each image and returns one video, one clip per image in order
2. For each image (`loadImage()`):
   - Decode it (`createImageBitmap`, which applies EXIF rotation)
   - Make the background: a cover-fit copy blurred with a Gaussian (`blur.ts`)
   - Upload the image and background to the renderer
3. For each frame: draw it at `zoomAtFrame()` (`renderer.ts`) and encode it (`encoder.ts`)

Key modules:
- `Syncotrope` - Main orchestrator, implements `ISyncotrope` interface
- `renderer.ts` - WebGL2 Lanczos-3 frame renderer, with a canvas `drawImage` fallback
- `encoder.ts` - Picks a supported WebCodecs encoder configuration; `VideoWriter` encodes frames and muxes the file
- `zoom.ts` / `blur.ts` - Pure zoom and blur maths
- `SyncotropeSettings` (`settings.ts`) - User-configurable video parameters

### Settings

User-configurable options (in `settings.ts`):
- Resolution (width/height)
- Zoom speed (percent the image grows by per second)
- Blur amount (FFmpeg boxblur style "radius:power", converted to the equivalent Gaussian)
- Frame rate
- Image duration
- Output format (MP4 with H.264, or WebM with VP9)
- Video quality (CRF-style value, lower = better quality; used as the encoder's constant quantizer where supported)

### UI Layer (`src/ui/`)

- `settings-sidebar.ts` - Toggle sidebar with video settings
- `progress-bar.ts` - Shows processing progress

### Entry Point

`src/index.ts` sets up the file upload handler that:
1. Processes the uploaded images, in the chosen order, into one video
2. Triggers download of the resulting video in the selected format

## Testing

Tests use Bun's test runner with Node.js test compatibility (`node:test`). Test files are named `*.test.ts` and located alongside source files. Run a single test file with:
```
bun test src/core/settings.test.ts
```

Key test files:
- `zoom.test.ts` - Tests for zoom calculations
- `blur.test.ts` - Tests for blur parsing and the Gaussian blur
- `encoder.test.ts` - Tests for H.264 level selection and quality mapping
- `settings.test.ts` - Tests for settings defaults and overrides
- `progress-bar.test.ts` - Tests for progress calculation

## Zoom Implementation

Each frame is resampled once, straight from the original image, by a two-pass (horizontal, then vertical) Lanczos-3 shader in `renderer.ts`. The zoom is a pure float scale about the frame centre, so it never steps by whole pixels and never drifts. The zoom is exponential (`(1 + zoomSpeed / 100) ^ seconds`), so it looks equally fast throughout and doesn't depend on the frame rate.

Don't go back to scaling an intermediate image or to canvas `drawImage` scaling: both soften fine detail such as film grain unevenly from frame to frame, which looks like shimmering or warping. Don't use FFmpeg's `zoompan` either: it only crops whole pixels, so slow zooms judder.

Encoding uses constant-quantizer mode where the browser supports it, otherwise a generous bitrate (`BITS_PER_PIXEL`); too few bits make grain "pump" between keyframes.
