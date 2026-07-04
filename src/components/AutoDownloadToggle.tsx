import { useQueueStore } from '../state/queueStore';
import { useComposerLocked } from '../hooks/useComposerLocked';

/**
 * Switch to auto-save each output the moment it finishes converting. Downloads
 * land wherever the browser/OS is configured to put them (the Downloads folder,
 * or iOS's Files/Photos prompt). Stays interactive during a batch so it can be
 * flipped for the items still in the queue.
 */
export function AutoDownloadToggle() {
  const autoDownload = useQueueStore((s) => s.autoDownload);
  const setAutoDownload = useQueueStore((s) => s.setAutoDownload);
  const locked = useComposerLocked();

  return (
    <div
      className={`flex items-center justify-between gap-4 border-t border-[var(--border)] px-1 pt-4 ${
        locked ? 'opacity-50' : ''
      }`}
    >
      <div>
        <label
          htmlFor="auto-download"
          className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
        >
          Automatic downloads
        </label>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Save each image as soon as it’s converted, based on your browser/device settings.
        </p>
      </div>
      <button
        id="auto-download"
        type="button"
        role="switch"
        aria-checked={autoDownload}
        aria-label="Allow automatic downloads"
        disabled={locked}
        onClick={() => setAutoDownload(!autoDownload)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed ${
          locked ? 'cursor-not-allowed' : 'cursor-pointer'
        } ${autoDownload ? 'bg-[var(--accent)]' : 'bg-[var(--track)]'}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            autoDownload ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
