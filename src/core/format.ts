import type { OutputFormat } from './types';

/** Human-readable byte size, e.g. 1536 → "1.5 KB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[i]}`;
}

/**
 * Percentage of size saved (positive = smaller). Can be negative if the output
 * grew (e.g. converting a photo to lossless PNG).
 */
export function percentSaved(original: number, output: number): number {
  if (original <= 0) return 0;
  return ((original - output) / original) * 100;
}

/** Signed, rounded label for the saved percentage, e.g. "−12%" when larger. */
export function savedLabel(original: number, output: number): string {
  const pct = percentSaved(original, output);
  const rounded = Math.round(pct);
  if (rounded < 0) return `+${Math.abs(rounded)}% larger`;
  return `−${rounded}% saved`;
}

export const FORMAT_META: Record<OutputFormat, { label: string; mime: string; ext: string }> = {
  png: { label: 'PNG', mime: 'image/png', ext: 'png' },
  webp: { label: 'WebP', mime: 'image/webp', ext: 'webp' },
  jpeg: { label: 'JPEG', mime: 'image/jpeg', ext: 'jpg' },
};

/** Swap a filename's extension, e.g. ("photo.png", "webp") → "photo.webp". */
export function renameWithExt(name: string, ext: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base}.${ext}`;
}

/** A filename's extension, upper-cased for display, e.g. "photo.jpg" → "JPG". */
export function extLabel(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toUpperCase() : '';
}

/** Map an input MIME type to a matching output format, if we support it. */
export function mimeToFormat(mime: string): OutputFormat | null {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpeg';
    case 'image/webp':
      return 'webp';
    default:
      return null; // e.g. gif/bmp — leave the current output format as-is
  }
}

/** Formats we can accept as input (decoded natively by the browser). */
export const ACCEPTED_INPUT = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp'];

export function isAcceptedImage(file: File): boolean {
  return file.type.startsWith('image/');
}
