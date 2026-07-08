// Compression worker: runs the (heavy) encode pipeline off the main thread,
// streaming progress + the result back. Also handles 'warm' requests that
// pre-load a format's WASM codec ahead of the first real encode.
import { encodeImage, warmEncoder } from '../core/encode';
import type { WorkerRequest, WorkerResponse } from '../core/types';

function post(msg: WorkerResponse, transfer?: Transferable[]) {
  (self as unknown as Worker).postMessage(msg, transfer ?? []);
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  if (e.data.type === 'warm') {
    // Fire-and-forget: best-effort cache warm, nothing to report either way.
    warmEncoder(e.data.format).catch(() => {});
    return;
  }

  const { id, buffer, sourceType, settings } = e.data;
  try {
    const result = await encodeImage(buffer, sourceType, settings, (value) => {
      post({ id, type: 'progress', value });
    });
    // Transfer the output buffer to avoid a copy.
    const out = result.bytes.buffer as ArrayBuffer;
    post(
      {
        id,
        type: 'done',
        buffer: out,
        size: result.size,
        mime: result.mime,
        ext: result.ext,
        recommendation: result.recommendation,
      },
      [out],
    );
  } catch (err) {
    post({ id, type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
