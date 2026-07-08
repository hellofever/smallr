import { create } from 'zustand';
import type { EncodeSettings, OutputFormat, PngPreset } from '../core/types';
import { DEFAULT_SETTINGS } from '../core/types';
import { mimeToFormat, renameWithExt } from '../core/format';

export type ItemStatus = 'queued' | 'processing' | 'done' | 'error';

export interface QueueItem {
  id: string;
  file: File;
  name: string;
  originalSize: number;
  status: ItemStatus;
  progress: number; // 0..1 while processing
  previewUrl: string; // object URL of the source, for the thumbnail
  /** Per-item format override (set when the user accepts a recommendation). */
  overrideFormat?: OutputFormat;
  // populated on completion:
  outputName?: string;
  outputSize?: number;
  outputUrl?: string; // object URL of the result, for download
  /** A smaller-tending format to suggest — set only when output grew. */
  recommendation?: OutputFormat;
  error?: string;
}

interface QueueState {
  items: QueueItem[];
  settings: EncodeSettings;
  /** Set once the user explicitly picks a format, so a later drop never clobbers it. */
  formatTouched: boolean;
  /** When on, each finished output is auto-saved to the browser's downloads. */
  autoDownload: boolean;
  setAutoDownload: (value: boolean) => void;

  addFiles: (files: File[]) => void;
  removeItem: (id: string) => void;
  clearAll: () => void;
  clearFinished: () => void;

  setFormat: (format: OutputFormat) => void;
  setQuality: (quality: number) => void;
  setPngPreset: (preset: PngPreset) => void;

  /** Re-run a single item as a different format (accepting a recommendation). */
  requeueAs: (id: string, format: OutputFormat) => void;
  /** Re-queue a single errored item with the current settings. */
  retry: (id: string) => void;
  /** Re-queue every errored item. */
  retryAllFailed: () => void;

  // used by the queue runner
  markProcessing: (id: string) => void;
  setProgress: (id: string, value: number) => void;
  markDone: (
    id: string,
    result: { size: number; url: string; ext: string; recommendation?: OutputFormat },
  ) => void;
  markError: (id: string, message: string) => void;
}

let counter = 0;
const uid = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

const AUTO_DOWNLOAD_KEY = 'smallr:autoDownload';
function loadAutoDownload(): boolean {
  try {
    return localStorage.getItem(AUTO_DOWNLOAD_KEY) === '1';
  } catch {
    return false;
  }
}

export const useQueueStore = create<QueueState>((set) => ({
  items: [],
  settings: DEFAULT_SETTINGS,
  formatTouched: false,
  autoDownload: loadAutoDownload(),

  setAutoDownload: (value) =>
    set(() => {
      try {
        localStorage.setItem(AUTO_DOWNLOAD_KEY, value ? '1' : '0');
      } catch {
        /* storage may be unavailable (private mode); keep it in-memory */
      }
      return { autoDownload: value };
    }),

  addFiles: (files) =>
    set((state) => {
      // Auto-select the output format to match the (first) dropped/pasted image,
      // so the default action is "optimise in place". Unknown types keep current.
      // Only for the first batch, and only if the user hasn't explicitly chosen a
      // format themselves — once they have, respect it instead of overriding it.
      const matched =
        state.items.length === 0 && !state.formatTouched && files[0]
          ? mimeToFormat(files[0].type)
          : null;
      return {
        settings: matched ? { ...state.settings, format: matched } : state.settings,
        items: [
          ...state.items,
          ...files.map<QueueItem>((file) => ({
            id: uid(),
            file,
            name: file.name,
            originalSize: file.size,
            status: 'queued',
            progress: 0,
            previewUrl: URL.createObjectURL(file),
          })),
        ],
      };
    }),

  removeItem: (id) =>
    set((state) => {
      const item = state.items.find((i) => i.id === id);
      if (item) revokeItem(item);
      return { items: state.items.filter((i) => i.id !== id) };
    }),

  clearAll: () =>
    set((state) => {
      state.items.forEach(revokeItem);
      return { items: [] };
    }),

  clearFinished: () =>
    set((state) => {
      const keep: QueueItem[] = [];
      for (const item of state.items) {
        if (item.status === 'done' || item.status === 'error') revokeItem(item);
        else keep.push(item);
      }
      return { items: keep };
    }),

  setFormat: (format) =>
    set((state) => ({ settings: { ...state.settings, format }, formatTouched: true })),
  setQuality: (quality) =>
    set((state) => ({
      settings: {
        ...state.settings,
        quality: { ...state.settings.quality, [state.settings.format]: quality },
      },
    })),
  setPngPreset: (pngPreset) => set((state) => ({ settings: { ...state.settings, pngPreset } })),

  requeueAs: (id, format) =>
    set((state) => ({
      items: state.items.map((i) => {
        if (i.id !== id) return i;
        if (i.outputUrl) URL.revokeObjectURL(i.outputUrl);
        return {
          ...i,
          overrideFormat: format,
          status: 'queued',
          progress: 0,
          outputSize: undefined,
          outputUrl: undefined,
          outputName: undefined,
          recommendation: undefined,
          error: undefined,
        };
      }),
    })),

  retry: (id) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id && i.status === 'error'
          ? { ...i, status: 'queued', progress: 0, error: undefined }
          : i,
      ),
    })),

  retryAllFailed: () =>
    set((state) => ({
      items: state.items.map((i) =>
        i.status === 'error' ? { ...i, status: 'queued', progress: 0, error: undefined } : i,
      ),
    })),

  markProcessing: (id) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id ? { ...i, status: 'processing', progress: 0, error: undefined } : i,
      ),
    })),

  setProgress: (id, value) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, progress: value } : i)),
    })),

  markDone: (id, result) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id
          ? {
              ...i,
              status: 'done',
              progress: 1,
              outputSize: result.size,
              outputUrl: result.url,
              outputName: renameWithExt(i.name, result.ext),
              recommendation: result.recommendation,
            }
          : i,
      ),
    })),

  markError: (id, message) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id ? { ...i, status: 'error', error: message } : i,
      ),
    })),
}));

function revokeItem(item: QueueItem) {
  URL.revokeObjectURL(item.previewUrl);
  if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
}

// Selectors ------------------------------------------------------------------

/** The single source of truth for the conversion flow's state. */
export type Phase = 'idle' | 'running' | 'done' | 'failed';

export interface Flow {
  phase: Phase;
  total: number;
  done: number; // finished successfully (has an output)
  errors: number; // finished with an error
  finished: number; // done + errors
  processing: number; // currently encoding
  fraction: number; // 0..1 across the whole queue (partial credit while processing)
  originalTotal: number; // summed source bytes of done items
  outputTotal: number; // summed result bytes of done items
}

export function selectFlow(state: QueueState): Flow {
  const { items } = state;
  const total = items.length;
  let sum = 0;
  let done = 0;
  let errors = 0;
  let processing = 0;
  let originalTotal = 0;
  let outputTotal = 0;
  for (const i of items) {
    if (i.status === 'done') {
      sum += 1;
      done += 1;
      if (i.outputSize != null) {
        originalTotal += i.originalSize;
        outputTotal += i.outputSize;
      }
    } else if (i.status === 'error') {
      sum += 1;
      errors += 1;
    } else if (i.status === 'processing') {
      sum += i.progress;
      processing += 1;
    }
  }
  const finished = done + errors;
  const phase: Phase =
    total === 0 ? 'idle' : finished < total ? 'running' : done > 0 ? 'done' : 'failed';
  return {
    phase,
    total,
    done,
    errors,
    finished,
    processing,
    fraction: total === 0 ? 0 : sum / total,
    originalTotal,
    outputTotal,
  };
}
