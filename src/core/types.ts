// ── Framework-agnostic core types ──────────────────────────────────────────
// Shared by the UI, the state store, and the compression worker. Keeping the
// worker message contract here (no React, no DOM-store deps) is what lets a
// future app (e.g. a Tauri clipboard tool) reuse the same pipeline.

export type OutputFormat = 'png' | 'webp' | 'jpeg';

/**
 * PNG quality presets. `lossless` keeps full colour (no loss); the others
 * quantise the palette to progressively fewer colours for smaller files.
 */
export type PngPreset = 'lossless' | 'high' | 'medium' | 'low';

/** User-controlled encode settings, shared across the whole queue. */
export interface EncodeSettings {
  format: OutputFormat;
  /**
   * 1–100 quality, kept per-format so each remembers its own recommended
   * default (used by WebP and JPEG). Resolve with
   * `settings.quality[settings.format]`. (PNG uses `pngPreset` instead.)
   */
  quality: Record<OutputFormat, number>;
  /** PNG only: quality preset (colour-count / lossless). */
  pngPreset: PngPreset;
}

/**
 * Recommended defaults — retain quality while cutting file size:
 * - PNG: `high` (full 256-colour palette) — avoids the large lossless size with
 *   near-invisible loss. `lossless` remains available for zero-loss output.
 * - WebP / JPEG: 80 — the near-transparent sweet spot for both codecs.
 */
export const DEFAULT_SETTINGS: EncodeSettings = {
  format: 'png',
  quality: { png: 90, webp: 80, jpeg: 80 },
  pngPreset: 'high',
};

/** Result of encoding one image. */
export interface EncodeResult {
  bytes: Uint8Array;
  size: number;
  mime: string;
  /** File extension without the dot, e.g. "webp". */
  ext: string;
  /**
   * A different format likely to produce a smaller file. Only set when this
   * result came out **larger than the source** (i.e. the conversion backfired).
   */
  recommendation?: OutputFormat;
}

// ── Worker message protocol (typed both directions) ─────────────────────────

export interface EncodeRequest {
  id: string;
  /** Raw source file bytes. Transferred, not copied. */
  buffer: ArrayBuffer;
  sourceType: string;
  settings: EncodeSettings;
}

export type WorkerResponse =
  | { id: string; type: 'progress'; value: number }
  | {
      id: string;
      type: 'done';
      buffer: ArrayBuffer;
      size: number;
      mime: string;
      ext: string;
      recommendation?: OutputFormat;
    }
  | { id: string; type: 'error'; message: string };
