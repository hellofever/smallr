// ── The compression / conversion pipeline ──────────────────────────────────
// Runs inside a Web Worker. Source images are decoded natively via
// createImageBitmap + OffscreenCanvas (no WASM decode needed); only the
// *encoders* are WASM/JS and are lazy-loaded per format to keep the bundle
// small. Nothing here touches the network — all processing is local.

import type { EncodeResult, EncodeSettings, OutputFormat, PngPreset } from './types';
import { FORMAT_META } from './format';

/** PNG preset → palette colour count (UPNG `cnum`). 0 = truecolour lossless. */
const PNG_PRESET_COLORS: Record<PngPreset, number> = {
  lossless: 0,
  high: 256,
  medium: 128,
  low: 64,
};

/**
 * Oxipng optimisation level applied to every PNG. Profiling showed the higher
 * levels cost seconds (their trials aren't cheap even multithreaded) for well
 * under a percent of extra size — level 1 captures the bulk of the win at a
 * fraction of the time, on both the lossless and lossy paths.
 */
const OXIPNG_LEVEL = 1;

type ProgressFn = (value: number) => void;

/** Decode any browser-supported image to ImageData (RGBA). */
async function decodeToImageData(buffer: ArrayBuffer, type: string): Promise<ImageData> {
  const blob = new Blob([buffer], { type });
  // `from-image` bakes EXIF orientation into the pixels — important because we
  // strip all metadata (re-encoding from raw pixels), so orientation must be
  // applied here or rotated phone photos would come out sideways.
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const { width, height } = bitmap;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not create 2D context');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, width, height);
}

/** JPEG has no alpha — composite transparent pixels over white in place. */
function flattenOntoWhite(image: ImageData): ImageData {
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 255) continue;
    const alpha = a / 255;
    data[i] = Math.round(data[i] * alpha + 255 * (1 - alpha));
    data[i + 1] = Math.round(data[i + 1] * alpha + 255 * (1 - alpha));
    data[i + 2] = Math.round(data[i + 2] * alpha + 255 * (1 - alpha));
    data[i + 3] = 255;
  }
  return image;
}

async function encodePng(
  image: ImageData,
  settings: EncodeSettings,
  onProgress: ProgressFn,
): Promise<Uint8Array> {
  // 0 = truecolour (lossless); >0 quantises to that many palette colours.
  const cnum = PNG_PRESET_COLORS[settings.pngPreset];
  const { optimise } = await import('@jsquash/oxipng');

  if (cnum === 0) {
    // Lossless: oxipng encodes + optimises straight from the pixels in a single
    // WASM pass — no separate (pure-JS) UPNG deflate needed.
    onProgress(0.6);
    const optimised = await optimise(image, { level: OXIPNG_LEVEL });
    return new Uint8Array(optimised);
  }

  // Lossy: UPNG quantises the palette (this is the lossy step), then oxipng
  // squeezes the resulting container.
  const UPNG = (await import('upng-js')).default;
  onProgress(0.55);
  const rgba = new Uint8Array(image.data.buffer.slice(0)).buffer;
  const png = UPNG.encode([rgba], image.width, image.height, cnum);
  onProgress(0.75);
  const optimised = await optimise(png, { level: OXIPNG_LEVEL });
  return new Uint8Array(optimised);
}

async function encodeWebp(image: ImageData, settings: EncodeSettings): Promise<Uint8Array> {
  const { encode } = await import('@jsquash/webp');
  const out = await encode(image, { quality: settings.quality.webp });
  return new Uint8Array(out);
}

async function encodeJpeg(image: ImageData, settings: EncodeSettings): Promise<Uint8Array> {
  const { encode } = await import('@jsquash/jpeg');
  const out = await encode(flattenOntoWhite(image), { quality: settings.quality.jpeg });
  return new Uint8Array(out);
}

/**
 * Suggest a different, typically-smaller format than `current`. Only used when a
 * conversion came out larger than the source. Prefers the lossy size-savers and
 * avoids JPEG when the source could carry transparency (JPEG has no alpha).
 */
function recommendSmaller(current: OutputFormat, sourceType: string): OutputFormat | undefined {
  const mightHaveAlpha = sourceType !== 'image/jpeg';
  for (const f of ['webp', 'jpeg'] as const) {
    if (f === current) continue;
    if (f === 'jpeg' && mightHaveAlpha) continue;
    return f;
  }
  return undefined;
}

/** Encode a source image to the target format. `onProgress` is 0..1. */
export async function encodeImage(
  buffer: ArrayBuffer,
  sourceType: string,
  settings: EncodeSettings,
  onProgress: ProgressFn = () => {},
): Promise<EncodeResult> {
  const originalSize = buffer.byteLength;
  onProgress(0.1);
  const image = await decodeToImageData(buffer, sourceType);
  onProgress(0.4);

  let bytes: Uint8Array;
  switch (settings.format) {
    case 'png':
      bytes = await encodePng(image, settings, onProgress);
      break;
    case 'webp':
      bytes = await encodeWebp(image, settings);
      break;
    case 'jpeg':
      bytes = await encodeJpeg(image, settings);
      break;
  }

  onProgress(1);
  const meta = FORMAT_META[settings.format];
  // Only bother recommending when the conversion actually grew the file.
  const recommendation =
    bytes.byteLength >= originalSize ? recommendSmaller(settings.format, sourceType) : undefined;
  return { bytes, size: bytes.byteLength, mime: meta.mime, ext: meta.ext, recommendation };
}
