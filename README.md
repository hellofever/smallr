# smallr

Fast, minimal, **100% local** image compressor & converter. Drop images, tune quality, download —
nothing ever leaves your browser.

- **PNG** — lossy (palette quantisation) & lossless, with an optimise-effort control
- **WebP** & **JPEG** — quality-controlled conversion
- Drag-and-drop queue, processed **one at a time** off the main thread (Web Worker → responsive UI)
- Per-item file size + **% saved**, plus an overall progress bar
- **Light / dark** mode, minimal blue mono palette
- No uploads, no servers, no tracking — all processing is local via WebAssembly

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # typecheck + production build → dist/
npm run preview  # serve the build
```

> **Node:** uses Vite 6 to support Node 20.14+. (Node ≥ 20.19 allows bumping to Vite 7/8.)

## How it works

Source images are decoded natively (`createImageBitmap` + `OffscreenCanvas`); encoders are lazy-
loaded WASM/JS so each codec downloads only when first used:

| Target | Library | License |
|--------|---------|---------|
| PNG (lossy/lossless) | [upng-js](https://github.com/photopea/UPNG.js) + [@jsquash/oxipng](https://github.com/jamsinclair/jSquash) | MIT / Apache-2.0 |
| WebP | [@jsquash/webp](https://github.com/jamsinclair/jSquash) | Apache-2.0 |
| JPEG | [@jsquash/jpeg](https://github.com/jamsinclair/jSquash) (MozJPEG) | Apache-2.0 |

**PNG** — `upng-js` encodes the raw pixels first: the `lossless` and `high` presets keep every pixel
(full truecolour, no palette), while `medium`/`low` quantise the image down to a 256- or 64-colour
palette — the actual lossy step. Either way, `oxipng` then re-compresses the resulting PNG
losslessly (a higher effort level for the quantised presets), shrinking the file without touching a
single pixel.

**WebP** — the decoded pixels go straight into `@jsquash/webp`'s encoder at the quality (1–100) you
choose — a single lossy encode pass, no extra steps.

**JPEG** — JPEG has no alpha channel, so any transparent pixels are first flattened onto a white
background; the result is then encoded by `@jsquash/jpeg` (MozJPEG) at the chosen quality.

The compression logic lives in `src/core/` with no framework dependencies, so it can be reused by a
future desktop/clipboard app. See [`CLAUDE.md`](./CLAUDE.md) for architecture details.

## Tech

React 19 · TypeScript · Vite 6 · Tailwind CSS v4 · Zustand · Web Workers · WebAssembly codecs
