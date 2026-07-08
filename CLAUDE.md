# CLAUDE.md — smallr

Guidance for working in this repo. Read before making changes.

## Overview

**smallr** is a fast, minimal, **100% local** image compressor & converter (web app).
Drop images → they queue → each is compressed/converted **one at a time** → download the result.

- **Formats (v1):** PNG (lossy + lossless), WebP, JPEG — each with quality controls.
- **Hard constraint — privacy:** everything runs in the browser. **No network calls, ever.**
  Never add uploads, telemetry, analytics, or CDN codec loading. This is a core promise.
- Intended as a **foundation**: the image logic lives in `src/core/` (framework-agnostic) so a
  future app (e.g. a Tauri clipboard tool) can reuse the exact same pipeline.

## Commands

- `npm run dev` — dev server (http://localhost:5173)
- `npm run build` — typecheck (`tsc -b`) + production build
- `npm run preview` — serve the production build
- `npm run typecheck` — types only

## Environment note

Node **20.14** is below Vite 7/8's requirement (20.19+), so this repo pins **Vite 6** +
`@vitejs/plugin-react@4`. If Node is upgraded to ≥20.19, Vite/plugin-react can be bumped.

## Architecture

```
src/
  core/        ← framework-agnostic. NO React, NO DOM-store imports. Reusable by other apps.
    types.ts     worker message contract + EncodeSettings/EncodeResult
    format.ts    formatBytes, percentSaved, FORMAT_META, renameWithExt
    encode.ts    THE pipeline (decode → encode); runs inside the worker
  workers/
    compress.worker.ts   thin adapter: message ⇄ core/encode, streams progress
  state/
    queueStore.ts        Zustand store: items[], settings, selectors, object-URL lifecycle
  hooks/
    useQueueRunner.ts    owns the Worker, drains the queue sequentially
    useTheme.ts          data-theme attribute + localStorage
  components/            presentational React (Dropzone, SettingsPanel, ProgressBar, QueueList/Item, ThemeToggle)
  App.tsx  main.tsx  index.css
```

### Rules that matter
- **All encode/decode work goes through the worker.** Never import `core/encode` (or jSquash/UPNG)
  on the main thread — it will freeze the UI. The main thread only makes thumbnails and DOM.
- **Keep `core/` framework-agnostic.** No React, no `queueStore`, no `window`-only assumptions
  beyond the Worker/OffscreenCanvas APIs. That is what makes it portable to a desktop app.
- **Typed worker boundary.** Messages use `EncodeRequest` / `WorkerResponse` from `core/types.ts`.
  No `any` across the boundary. ArrayBuffers are **transferred** (not copied) both ways.
- **Object URLs:** always created in `queueStore` and revoked on remove / clear (see `revokeItem`).

## Pipeline (`core/encode.ts`)

1. **Decode** source natively: `createImageBitmap` → `OffscreenCanvas` → `getImageData`.
   (Browser decodes PNG/JPEG/WebP/GIF — no WASM decoder needed for input.)
   - **Metadata is stripped for free:** every output is re-encoded from raw pixels, so EXIF /
     GPS / ICC / XMP / PNG text chunks never carry over. `createImageBitmap` is called with
     `imageOrientation: 'from-image'` so EXIF rotation is baked into the pixels *before* the
     metadata is dropped (otherwise rotated photos would export sideways).
2. **Encode** to target (encoders are lazy-`import()`ed so each WASM chunk loads only when used):
   - **PNG:** `upng-js` `encode([rgba], w, h, cnum)` where `cnum` comes from the `pngPreset`
     (`PNG_PRESET_COLORS`: lossless=0 truecolour, high=256, medium=128, low=64). Then
     `@jsquash/oxipng` `optimise(png, { level: 3 })` (fixed effort). No PNG quality slider —
     the preset is the only PNG control.
   - **WebP:** `@jsquash/webp` `encode(imageData, { quality })`.
   - **JPEG:** flatten alpha onto white (JPEG has no alpha) → `@jsquash/jpeg` `encode(..., { quality })`.

## Codec / build notes

- **jSquash** (`@jsquash/webp`, `@jsquash/jpeg`, `@jsquash/oxipng`) — Apache-2.0, WASM, ESM.
  Must stay in `vite.config.ts` → `optimizeDeps.exclude` (their `.wasm` won't resolve otherwise).
- **upng-js** — MIT, pure JS. Chosen over libimagequant for lossy PNG specifically to keep the
  whole foundation **permissively licensed** (libimagequant is GPL v3). Do not swap it back to a
  copyleft lib without a deliberate license decision. Types are hand-declared in `src/vite-env.d.ts`.
- Codecs are **lazy-loaded** via dynamic `import()`; keep it that way so the initial bundle stays small.

## Design system

- Palette + light/dark tokens live in `src/index.css`. The supplied blue ramp is exposed as Tailwind
  `--color-brand-*`; **semantic** tokens (`--bg`, `--surface`, `--text`, `--accent`, `--fill`, …) are
  plain CSS vars, overridden under `[data-theme='dark']`. Components use `bg-[var(--surface)]` etc.
- Theme is set on `<html data-theme>` (initial value applied inline in `index.html` to avoid FOUC).
- Keep it minimal: one accent, subtle borders, generous whitespace, no heavy shadows.

## Roadmap / good next steps

- AVIF / JPEG XL (`@jsquash/avif`, `@jsquash/jxl`) — same pattern in `core/encode.ts`.
- "Download all" as a zip.
- Worker **pool** for parallelism: run N `useQueueRunner` drain loops instead of one.
- Resize option (`@jsquash/resize`).
- Desktop clipboard app reusing `src/core/` unchanged.
- Offline mode (PWA) — tried via `vite-plugin-pwa` and reverted (2026-07-08): the app is always
  cross-origin isolated for oxipng's multithreaded WASM build, which spawns a *nested* Worker
  (a Worker created from inside `compress.worker`) to run its thread pool. Nested-worker fetches
  are an inconsistent service-worker interception case across browsers, and this broke offline
  use in both Firefox (`AbortError` / CSP inline-script violations) and Safari (broken outright,
  online or offline) even after disabling cross-origin isolation to force oxipng single-threaded.
  Root cause wasn't fully pinned down before parking it. If revisited: verify the exact failing
  request per-browser (URL + whether the service worker's fetch handler even saw it) before
  trying a fix again, and consider prefetching codec WASM from the main thread (always a
  service-worker-controlled client) and handing the compiled module to the worker via
  `postMessage`, instead of letting workers fetch their own WASM.
