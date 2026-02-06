# Test Coverage Analysis

## Current State

**86 tests across 4 test files, all passing.**

Coverage follows a clear pattern: pure functions are well-tested, everything else
is not.

### Well-Covered (4 of 13 source files)

| File | Tests | Notes |
|------|-------|-------|
| `src/core/zoom.ts` | 67 | All 14 exported functions, edge cases, drift verification |
| `src/core/ffmpeg-filters.ts` | 37 | All 8 filter builders |
| `src/core/settings.ts` | 11 | Only `populateDefaults`; DOM functions untested |
| `src/ui/progress-bar.ts` | 11 | `parseFrameFromLog` and `calculateProgress`; DOM functions untested |

### Not Covered (9 of 13 source files)

- `src/core/syncotrope.ts` — main orchestrator class
- `src/core/processor.ts` — high-level pipeline wrapper
- `src/core/file-system.ts` — FFmpeg virtual filesystem manager
- `src/ui/file-list.ts` — file list UI with drag-and-drop reordering
- `src/ui/settings-sidebar.ts` — sidebar toggle
- `src/ui/status.ts` — status message and download button management
- `src/util/buffer-download.ts` — browser download utility
- `src/index.ts` — application entry point
- `src/core/ffmpeg/ffmpeg-wrapper.ts` — interface only, no implementation

## Recommended Improvements (Ranked by Impact)

### 1. Syncotrope class — mock-based unit tests

**File:** `src/core/syncotrope.ts`

This is the most impactful gap. The Syncotrope class is the core of the
application. None of its methods are tested: `processImage`, `standardizeImage`,
`combinedZoomAndVideo`, `concatenateVideos`, `getCodecArgs`.

**What to test:**

- `getCodecArgs()` — pure logic choosing between H.264/VP9 codec args based on
  format setting. No mocking needed.
- `standardizeImage()` — verify it calls the right sequence of scale, blur, and
  overlay operations via a mock `IFFmpegWrapper`.
- `combinedZoomAndVideo()` — verify correct zoompan filter and encoding args.
- `concatenateVideos()` — verify the concat demuxer flow with multiple inputs.
- `processImage()` / `processImages()` — end-to-end pipeline order verification
  with a mocked FFmpeg wrapper.

**Why it matters:** The `IFFmpegWrapper` interface already exists as a seam for
dependency injection. Tests can provide a mock implementation that records calls,
making it straightforward to verify orchestration logic without actual
FFmpeg/WASM.

### 2. FileSystemHandler — virtual filesystem logic

**File:** `src/core/file-system.ts`

**What to test:**

- `putFile` / `getFile` / `copyFile` — file naming and data flow
- `getRecentLogs()` — log accumulation and retrieval
- Log callback registration during `init()`

Mock the FFmpeg instance and verify correct `writeFile`/`readFile`/`rename`
calls. Test that the log buffer accumulates correctly and `clearLogs()` resets
it.

### 3. Processor pipeline

**File:** `src/core/processor.ts`

**What to test:**

- Progress callback invocation during multi-file processing
- MIME type calculation based on format setting
- Error propagation from the underlying Syncotrope

### 4. Settings DOM integration

**File:** `src/core/settings.ts`

`populateDefaults` is tested, but `getSettings()`, `setDefaultSettingsInUI()`,
`getElementValueById()`, and `setElementValueById()` are not.

**Approach:** Extract the DOM-reading logic so settings can be built from a plain
object (testable without DOM mocking), or use a minimal DOM mock (`happy-dom`).

### 5. Error and edge-case scenarios

No tests currently exercise failure paths:

- FFmpeg returning an error or empty output
- Invalid/corrupt image data passed to `processImage`
- `concatenateVideos` with empty array or single video
- Settings with extreme values (0 fps, 0 duration, negative zoom)

### 6. UI components

**Files:** `src/ui/file-list.ts`, `src/ui/status.ts`, `src/ui/settings-sidebar.ts`

Lower priority. The non-trivial logic is in `file-list.ts` (file reordering).
Extract array manipulation into pure functions and test without DOM.

### 7. Buffer download utility

**File:** `src/util/buffer-download.ts`

Low priority — small browser-API wrapper.

## Structural Recommendations

1. **Introduce mock-based testing for Syncotrope via `IFFmpegWrapper`.** The
   interface already exists as a dependency injection seam — this is the
   highest-value change.

2. **Extract pure logic from DOM-coupled modules.** Functions like file
   reordering in `file-list.ts` and settings reading in `settings.ts` mix pure
   logic with DOM access. Separating these would make the logic testable.

3. **Add at least one integration test** that exercises the full pipeline
   (`processImage` → standardize → zoom → encode) with a mocked FFmpeg.

4. **Add error-path tests** to existing well-tested files. Current tests only
   cover happy paths — adding boundary values (zero, negative, extremely large)
   would increase robustness.
