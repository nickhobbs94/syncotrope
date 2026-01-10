# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Syncotrope is a browser-based application that converts images to videos with zoom effects. It uses FFmpeg compiled to WebAssembly (@ffmpeg/ffmpeg) to perform all video processing directly in the browser.

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
1. `processImage(Uint8Array)` - Main public API that takes raw image data and returns video data
2. `standardizeImage()` - Scale and prepare the image:
   - Scale horizontally to fill target width
   - Scale vertically to fit target height
   - Blur the horizontal version as background
   - Overlay the sharp vertical version centered on blurred background
   - Upscale final image to account for zoom
3. `combinedZoomAndVideo()` - Apply zoompan filter and encode to video (MP4 or WebM)
4. `concatenateVideos()` - Join multiple video clips into one using FFmpeg concat demuxer

Key classes:
- `Syncotrope` - Main orchestrator that chains FFmpeg operations, implements `ISyncotrope` interface
- `FileSystemHandler` (`file-system.ts`) - Manages FFmpeg's in-memory virtual filesystem
- `SyncotropeSettings` (`settings.ts`) - User-configurable video parameters

### Settings

User-configurable options (in `settings.ts`):
- Resolution (width/height)
- Zoom rate
- Blur amount
- Frame rate
- Image duration
- Output format (MP4 with H.264, or WebM with VP9)
- Video quality (CRF value, lower = better quality)

### UI Layer (`src/ui/`)

- `settings-sidebar.ts` - Toggle sidebar with video settings
- `progress-bar.ts` - Updates progress by parsing FFmpeg log output (frame count)

### Entry Point

`src/index.ts` sets up the file upload handler that:
1. Processes each uploaded image through the Syncotrope pipeline
2. Concatenates multiple videos if multiple images are uploaded
3. Triggers download of the resulting video in the selected format

## Testing

Tests use Bun's test runner with Node.js test compatibility (`node:test`). Test files are named `*.test.ts` and located alongside source files. Run a single test file with:
```
bun test src/core/settings.test.ts
```

Key test files:
- `zoom.test.ts` - Tests for zoom calculations and jitter prevention
- `ffmpeg-filters.test.ts` - Tests for FFmpeg filter string generation
- `settings.test.ts` - Tests for settings defaults and overrides
- `progress-bar.test.ts` - Tests for progress parsing

## FFmpeg Usage

FFmpeg runs as WebAssembly in the browser. Files are passed to FFmpeg through a virtual filesystem managed by `FileSystemHandler`. The `@ffmpeg/core` WASM files are copied to `dist/webpack/assets` during build.

### Zoom Implementation

The zoom effect uses a hyperbolic zoom formula (`z = iw/(iw-2*jumpX*on)`) to keep the focus point centered and eliminate drift. This is implemented in `ffmpeg-filters.ts`.
