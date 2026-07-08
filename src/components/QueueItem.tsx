import { memo, useState } from 'react';
import type { QueueItem as Item } from '../state/queueStore';
import { useQueueStore } from '../state/queueStore';
import { formatBytes, percentSaved, extLabel, FORMAT_META } from '../core/format';
import { copyImageToClipboard } from '../lib/exports';
import { CopyIcon, CheckIcon, DownloadIcon, Trash2Icon, AlertTriangleIcon, RotateCwIcon } from './icons';

function QueueItemRow({ item }: { item: Item }) {
  const removeItem = useQueueStore((s) => s.removeItem);
  const requeueAs = useQueueStore((s) => s.requeueAs);
  const retry = useQueueStore((s) => s.retry);
  const [copied, setCopied] = useState(false);
  const saved = item.outputSize != null ? percentSaved(item.originalSize, item.outputSize) : 0;
  const larger = saved < 0;

  // Copy the compressed output once available, otherwise the original source.
  const copyUrl = item.outputUrl ?? item.previewUrl;
  const onCopy = async () => {
    try {
      await copyImageToClipboard(copyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked; ignore */
    }
  };

  return (
    <li className="flex items-center gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-3">
      <img
        src={item.previewUrl}
        alt=""
        className="h-12 w-12 shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface-2)] object-cover"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-[var(--text)]">
            {item.outputName ?? item.name}
          </p>
          {item.status === 'done' && (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                larger
                  ? 'bg-[color-mix(in_srgb,var(--danger)_15%,transparent)] text-[var(--danger)]'
                  : 'bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-[var(--success)]'
              }`}
            >
              {larger ? '+' : '−'}
              {Math.abs(Math.round(saved))}%
            </span>
          )}
        </div>

        <div className="mt-0.5 text-xs text-[var(--muted)]">
          {item.status === 'done' && item.outputSize != null && item.outputName ? (
            <span className="tabular-nums">
              {extLabel(item.name)} → {extLabel(item.outputName)} ·{' '}
              {formatBytes(item.originalSize)} → {formatBytes(item.outputSize)}
            </span>
          ) : item.status === 'error' ? (
            <span className="text-[var(--danger)]">{item.error ?? 'Failed'}</span>
          ) : (
            <span className="tabular-nums">{formatBytes(item.originalSize)}</span>
          )}
        </div>

        {item.status === 'processing' && (
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--track)]">
            <div
              className="h-full rounded-full bg-[var(--fill)] transition-[width] duration-200"
              style={{ width: `${Math.round(item.progress * 100)}%` }}
            />
          </div>
        )}

        {/* Amber suggestion: only set when the result grew vs. the source. */}
        {item.status === 'done' && item.recommendation && (
          <button
            type="button"
            onClick={() => requeueAs(item.id, item.recommendation!)}
            title={`Re-convert this image to ${FORMAT_META[item.recommendation].label}`}
            className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--warning)] transition-opacity hover:opacity-80"
          >
            <AlertTriangleIcon size={13} />
            Larger than original — try {FORMAT_META[item.recommendation].label}
          </button>
        )}
      </div>

      {/* Trailing action / status */}
      <div className="flex shrink-0 items-center gap-2">
        {(item.status === 'queued' || item.status === 'processing') && <Spinner />}
        {item.status !== 'processing' && (
          <button
            type="button"
            onClick={onCopy}
            aria-label={copied ? 'Copied' : 'Copy image'}
            title={copied ? 'Copied' : item.status === 'done' ? 'Copy result' : 'Copy original'}
            className={`grid h-12 w-12 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface)] transition-colors ${
              copied ? 'text-green-500' : 'text-[var(--muted)] hover:text-[var(--accent)]'
            }`}
          >
            {copied ? <CheckIcon size={18} /> : <CopyIcon size={18} />}
          </button>
        )}
        {item.status === 'error' && (
          <button
            type="button"
            onClick={() => retry(item.id)}
            aria-label="Retry"
            title="Retry"
            className="grid h-12 w-12 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--accent)] transition-colors hover:bg-[var(--surface-2)]"
          >
            <RotateCwIcon size={18} />
          </button>
        )}
        {item.status === 'done' && item.outputUrl && (
          <a
            href={item.outputUrl}
            download={item.outputName}
            aria-label="Download"
            title="Download"
            className="grid h-12 w-12 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--accent)] transition-colors hover:bg-[var(--surface-2)]"
          >
            <DownloadIcon size={18} />
          </a>
        )}
        <button
          type="button"
          onClick={() => removeItem(item.id)}
          aria-label="Remove"
          title="Remove"
          className="grid h-12 w-12 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition-colors hover:text-[var(--danger)]"
        >
          <Trash2Icon size={18} />
        </button>
      </div>
    </li>
  );
}

function Spinner() {
  return (
    <span
      className="smallr-spin inline-block h-4 w-4 rounded-full border-2 border-[var(--track)] border-t-[var(--accent)]"
      aria-label="Processing"
    />
  );
}

export default memo(QueueItemRow);
