import { useEffect } from 'react';
import { useQueueStore } from '../state/queueStore';
import { triggerDownload } from '../lib/exports';
import type { EncodeRequest, WorkerResponse } from '../core/types';

/**
 * How many images encode at once. UPNG (the lossy PNG step) is single-threaded
 * pure JS, so parallelism across items is the only way to use more than one
 * core — but each in-flight item holds a full decoded ImageData, so we leave
 * one core free for the UI thread and cap the rest rather than grabbing every
 * core (which would also cap peak memory use on many-core machines).
 */
const POOL_SIZE = Math.max(1, Math.min((navigator.hardwareConcurrency || 1) - 1, 4));

interface Slot {
  worker: Worker;
  busy: boolean;
  currentId: string | null;
}

/**
 * Owns a small pool of compression workers and drains the queue across them.
 * Mount once, near the app root. Each slot pulls the next `queued` item and
 * claims it synchronously (via `markProcessing`) so two slots never grab the
 * same one. Results may complete out of order — every update keys off item id.
 */
export function useQueueRunner() {
  useEffect(() => {
    const store = useQueueStore;
    const slots: Slot[] = [];

    const dispatch = (slot: Slot, id: string) => {
      const item = store.getState().items.find((i) => i.id === id);
      if (!item) {
        slot.busy = false;
        slot.currentId = null;
        return;
      }
      item.file
        .arrayBuffer()
        .then((buffer) => {
          const base = store.getState().settings;
          // An accepted recommendation overrides the global format for this item.
          const settings = item.overrideFormat
            ? { ...base, format: item.overrideFormat }
            : base;
          const req: EncodeRequest = {
            id,
            buffer,
            sourceType: item.file.type || 'image/png',
            settings,
          };
          slot.worker.postMessage(req, [buffer]);
        })
        .catch((err: unknown) => {
          store.getState().markError(id, String(err));
          slot.busy = false;
          slot.currentId = null;
          pump();
        });
    };

    const pump = () => {
      for (const slot of slots) {
        if (slot.busy) continue;
        // getState() is re-read each iteration so the item just claimed by the
        // previous slot is already 'processing' and won't be picked again.
        const next = store.getState().items.find((i) => i.status === 'queued');
        if (!next) return;
        slot.busy = true;
        slot.currentId = next.id;
        store.getState().markProcessing(next.id);
        dispatch(slot, next.id);
      }
    };

    for (let i = 0; i < POOL_SIZE; i++) {
      const worker = new Worker(new URL('../workers/compress.worker.ts', import.meta.url), {
        type: 'module',
      });
      const slot: Slot = { worker, busy: false, currentId: null };

      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data;
        const state = store.getState();
        switch (msg.type) {
          case 'progress':
            state.setProgress(msg.id, msg.value);
            break;
          case 'done': {
            const blob = new Blob([msg.buffer], { type: msg.mime });
            const url = URL.createObjectURL(blob);
            state.markDone(msg.id, {
              size: msg.size,
              url,
              ext: msg.ext,
              recommendation: msg.recommendation,
            });
            // Auto-save this output if the user enabled it. Re-read state so we
            // pick up the freshly-computed output filename from markDone.
            if (store.getState().autoDownload) {
              const done = store.getState().items.find((i) => i.id === msg.id);
              if (done?.outputName) triggerDownload(url, done.outputName);
            }
            slot.busy = false;
            slot.currentId = null;
            pump();
            break;
          }
          case 'error':
            state.markError(msg.id, msg.message);
            slot.busy = false;
            slot.currentId = null;
            pump();
            break;
        }
      };

      worker.onerror = (e) => {
        // Fail this slot's in-flight item so the queue doesn't stall.
        if (slot.currentId) store.getState().markError(slot.currentId, e.message || 'Worker error');
        slot.busy = false;
        slot.currentId = null;
        pump();
      };

      slots.push(slot);
    }

    // React to newly added items while any slot is idle.
    const unsubscribe = store.subscribe(() => pump());
    pump();

    return () => {
      unsubscribe();
      slots.forEach((s) => s.worker.terminate());
    };
  }, []);
}
