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
1. `loadFile()` - Load image into FFmpeg's virtual filesystem
2. `standardizeImage()` - Scale and prepare the image:
   - Scale horizontally to fill target width
   - Scale vertically to fit target height
   - Blur the horizontal version as background
   - Overlay the sharp vertical version centered on blurred background
   - Upscale final image to account for zoom
3. `combinedZoomAndVideo()` - Apply zoompan filter and encode to MP4

Key classes:
- `Syncotrope` - Main orchestrator that chains FFmpeg operations
- `FileSystemHandler` (`file-system.ts`) - Manages FFmpeg's in-memory virtual filesystem
- `SyncotropeSettings` (`settings.ts`) - User-configurable video parameters (resolution, zoom rate, blur, framerate, duration)

### UI Layer (`src/ui/`)

- `settings-sidebar.ts` - Toggle sidebar with video settings
- `progress-bar.ts` - Updates progress by parsing FFmpeg log output (frame count)

### Entry Point

`src/index.ts` sets up the file upload handler that processes each uploaded image through the Syncotrope pipeline and triggers download of the resulting MP4.

## Testing

Tests use Bun's test runner with Node.js test compatibility (`node:test`). Test files are named `*.test.ts` and located alongside source files. Run a single test file with:
```
bun test src/core/settings.test.ts
```

## FFmpeg Usage

FFmpeg runs as WebAssembly in the browser. Files are passed to FFmpeg through a virtual filesystem managed by `FileSystemHandler`. The `@ffmpeg/core` WASM files are copied to `dist/webpack/assets` during build.
