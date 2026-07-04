// Compression worker: receives an EncodeRequest, runs the (heavy) encode
// pipeline off the main thread, and streams progress + the result back.
import { encodeImage } from '../core/encode';
import type { EncodeRequest, WorkerResponse } from '../core/types';

function post(msg: WorkerResponse, transfer?: Transferable[]) {
  (self as unknown as Worker).postMessage(msg, transfer ?? []);
}

self.onmessage = async (e: MessageEvent<EncodeRequest>) => {
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
