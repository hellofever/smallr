// ── The compression / conversion pipeline ──────────────────────────────────
// Runs inside a Web Worker. Source images are decoded natively via
// createImageBitmap + OffscreenCanvas (no WASM decode needed); only the
// *encoders* are WASM/JS and are lazy-loaded per format to keep the bundle
// small. Nothing here touches the network — all processing is local.

import type { EncodeResult, EncodeSettings, OutputFormat, PngPreset } from './types';
import { FORMAT_META } from './format';

/**
 * PNG preset config — two independent levers:
 *   • `cnum`   UPNG palette colour count. 0 = truecolour (lossless); >0 = lossy
 *              quantisation to that many colours. This is the *quality* lever.
 *   • `oxipng` oxipng effort level (0–6), or `false` to skip. Lossless size/speed
 *              lever only — never changes pixels. Higher = smaller but slower.
 */
const PNG_PRESETS: Record<PngPreset, { cnum: number; oxipng: number | false }> = {
  lossless: { cnum: 0, oxipng: 0 }, // truecolour, minimal lossless squeeze
  high: { cnum: 0, oxipng: 1 }, // truecolour, light lossless squeeze
  medium: { cnum: 256, oxipng: 3 }, // near-lossless palette
  low: { cnum: 64, oxipng: 3 }, // smallest, may band
};

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
  const { cnum, oxipng } = PNG_PRESETS[settings.pngPreset];

  // UPNG encodes the pixels: cnum=0 → truecolour lossless, cnum>0 → the palette
  // quantisation (the lossy step). This runs on every path.
  const UPNG = (await import('upng-js')).default;
  onProgress(0.55);
  const rgba = new Uint8Array(image.data.buffer.slice(0)).buffer;
  const png = UPNG.encode([rgba], image.width, image.height, cnum);

  // oxipng then losslessly squeezes the container (smaller, same pixels). Skip
  // it when the preset opts out (oxipng === false).
  if (oxipng === false) return new Uint8Array(png);
  onProgress(0.75);
  const { optimise } = await import('@jsquash/oxipng');
  const optimised = await optimise(png, { level: oxipng });
  return new Uint8Array(optimised);
}

async function encodeWebp(
  image: ImageData,
  settings: EncodeSettings,
  onProgress: ProgressFn,
): Promise<Uint8Array> {
  const { encode } = await import('@jsquash/webp');
  // The import above is nearly instant once the module is cached, but on a
  // cold worker it still has to load the wasm codec — tick progress here so
  // the bar visibly moves through that gap instead of looking frozen.
  onProgress(0.6);
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
      bytes = await encodeWebp(image, settings, onProgress);
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

function dummyPixel(): ImageData {
  return new ImageData(new Uint8ClampedArray([0, 0, 0, 255]), 1, 1);
}

/**
 * Lazy-load and initialise a format's WASM codec on a 1x1 throwaway image,
 * without doing a real encode. Call this as soon as a format becomes active
 * so the cold-start cost (dynamic import + wasm fetch/compile/instantiate —
 * worst for WebP, which also runs an async SIMD feature-detect) is paid
 * ahead of time instead of during the user's first real conversion.
 */
export async function warmEncoder(format: OutputFormat): Promise<void> {
  switch (format) {
    case 'webp': {
      const { encode } = await import('@jsquash/webp');
      await encode(dummyPixel(), { quality: 1 });
      return;
    }
    case 'jpeg': {
      const { encode } = await import('@jsquash/jpeg');
      await encode(dummyPixel(), { quality: 1 });
      return;
    }
    case 'png': {
      const UPNG = (await import('upng-js')).default;
      const rgba = new Uint8Array(dummyPixel().data.buffer.slice(0)).buffer;
      const png = UPNG.encode([rgba], 1, 1, 0);
      const { optimise } = await import('@jsquash/oxipng');
      await optimise(png, { level: 1 });
      return;
    }
  }
}
