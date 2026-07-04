// Browser-side helpers for exporting results: copy-to-clipboard and ZIP.
// These are DOM/browser utilities (not part of the framework-agnostic core).
import { zip } from 'fflate';

/** Copy an image (by object URL) to the clipboard. */
export async function copyImageToClipboard(url: string): Promise<void> {
  const blob = await (await fetch(url)).blob();

  // Try writing the blob directly first (works for PNG everywhere).
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return;
  } catch {
    // Fall through: browsers often only accept image/png on the clipboard.
  }

  // Fallback: re-encode to PNG so any output format can be copied.
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!png) throw new Error('Could not encode image');
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}

/** Programmatically save an object URL to the browser's downloads. */
export function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.click();
}

export interface ZipEntry {
  name: string;
  url: string; // object URL of the output blob
}

/** Bundle finished outputs into a ZIP and trigger a download. */
export async function downloadZip(entries: ZipEntry[], filename = 'smallr.zip'): Promise<void> {
  const used = new Map<string, number>();
  const files: Record<string, [Uint8Array, { level: 0 }]> = {};

  for (const entry of entries) {
    const buf = new Uint8Array(await (await fetch(entry.url)).arrayBuffer());
    // Avoid collisions when several outputs share a name.
    let name = entry.name;
    const seen = used.get(name);
    if (seen != null) {
      const dot = name.lastIndexOf('.');
      const base = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : '';
      name = `${base}-${seen + 1}${ext}`;
      used.set(entry.name, seen + 1);
    } else {
      used.set(entry.name, 0);
    }
    // Store (level 0) — images are already compressed, so don't re-deflate.
    files[name] = [buf, { level: 0 }];
  }

  const zipped = await new Promise<Uint8Array>((resolve, reject) => {
    zip(files, (err, data) => (err ? reject(err) : resolve(data)));
  });

  const url = URL.createObjectURL(new Blob([zipped as BlobPart], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
