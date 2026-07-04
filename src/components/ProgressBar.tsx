import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useQueueStore, selectFlow } from '../state/queueStore';
import { formatBytes, percentSaved, FORMAT_META } from '../core/format';
import { downloadZip, type ZipEntry } from '../lib/exports';
import type { OutputFormat } from '../core/types';
import { CheckIcon, PackageIcon, AlertTriangleIcon, RotateCwIcon } from './icons';

export function ProgressBar() {
  const flow = useQueueStore(useShallow(selectFlow));
  const items = useQueueStore((s) => s.items);
  const autoDownload = useQueueStore((s) => s.autoDownload);
  const settings = useQueueStore((s) => s.settings);
  const retryAllFailed = useQueueStore((s) => s.retryAllFailed);
  const clearAll = useQueueStore((s) => s.clearAll);
  const [busy, setBusy] = useState(false);

  const entries = useMemo<ZipEntry[]>(
    () =>
      items
        .filter((i) => i.status === 'done' && i.outputUrl)
        .map((i) => ({ name: i.outputName ?? i.name, url: i.outputUrl! })),
    [items],
  );

  if (flow.phase === 'idle') return null;

  // Shared shell: same border/padding/min-height across states so switching
  // phases doesn't resize the box or shift the list below.
  const shell = (tone: 'neutral' | 'success' | 'danger') =>
    `flex min-h-[76px] items-center rounded-[var(--radius-card)] border p-4 transition-colors ${
      tone === 'success'
        ? 'border-[color-mix(in_srgb,var(--success)_35%,var(--border))] bg-[color-mix(in_srgb,var(--success)_8%,var(--surface))]'
        : tone === 'danger'
          ? 'border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_8%,var(--surface))]'
          : 'border-[var(--border)] bg-[var(--surface)]'
    }`;

  // Reset action, shown under the terminal (done/failed) message.
  const clearAction = (
    <div className="mt-2 text-center">
      <button
        type="button"
        onClick={clearAll}
        className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
      >
        <RotateCwIcon size={15} />
        Convert more images
      </button>
    </div>
  );

  // ── Running ────────────────────────────────────────────────────────────
  if (flow.phase === 'running') {
    const pct = Math.round(flow.fraction * 100);
    const current = Math.min(flow.finished + 1, flow.total);
    const label = flow.processing > 0 ? `Compressing ${current} of ${flow.total}` : 'Preparing…';

    return (
      <div className={shell('neutral')}>
        <div className="w-full">
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="font-medium text-[var(--text)]">{label}</span>
            <span className="tabular-nums text-[var(--muted)]">{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--track)]">
            <div
              className="h-full rounded-full bg-[var(--fill)] transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Failed (nothing succeeded) ─────────────────────────────────────────
  if (flow.phase === 'failed') {
    return (
      <div>
      <div className={shell('danger')}>
        <div className="flex w-full items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] text-[var(--danger)]">
              <AlertTriangleIcon size={20} />
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">
                Couldn’t convert {flow.total === 1 ? 'the image' : 'any images'}
              </p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {flow.errors} {flow.errors === 1 ? 'image' : 'images'} failed.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={retryAllFailed}
            className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Retry all
          </button>
        </div>
      </div>
      {clearAction}
      </div>
    );
  }

  // ── Done (at least one succeeded) ──────────────────────────────────────
  const saved = Math.round(percentSaved(flow.originalTotal, flow.outputTotal));
  const larger = saved < 0;

  const onDownload = async () => {
    setBusy(true);
    try {
      await downloadZip(entries);
    } finally {
      setBusy(false);
    }
  };

  const counts =
    flow.errors > 0
      ? `${flow.done} of ${flow.total} · ${formatBytes(flow.originalTotal)} → ${formatBytes(flow.outputTotal)}`
      : `${flow.done} ${flow.done === 1 ? 'image' : 'images'}${autoDownload ? ' saved' : ''} · ${formatBytes(flow.originalTotal)} → ${formatBytes(flow.outputTotal)}`;

  // Describe the settings actually applied to the outputs. Format can vary per
  // item (accepted recommendations override it); quality/preset is the global
  // setting for whichever format an item ended up as.
  const formatCounts = new Map<OutputFormat, number>();
  for (const i of items) {
    if (i.status !== 'done') continue;
    const f = i.overrideFormat ?? settings.format;
    formatCounts.set(f, (formatCounts.get(f) ?? 0) + 1);
  }
  const formatDetail = (f: OutputFormat) =>
    f === 'png'
      ? settings.pngPreset[0].toUpperCase() + settings.pngPreset.slice(1)
      : `Quality ${settings.quality[f]}`;
  const settingsLabel =
    formatCounts.size === 1
      ? (() => {
          const [f] = [...formatCounts.keys()];
          return `${FORMAT_META[f].label} · ${formatDetail(f)}`;
        })()
      : [...formatCounts.entries()]
          .map(([f, n]) => `${FORMAT_META[f].label} ×${n}`)
          .join(' · ');

  return (
    <div>
    <div className={shell('success')}>
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-[var(--success)]">
            <CheckIcon size={20} />
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">
              Done — {larger ? 'grew ' : 'saved '}
              <span className={larger ? 'text-[var(--danger)]' : 'text-[var(--success)]'}>
                {larger ? '+' : '−'}
                {Math.abs(saved)}%
              </span>
            </p>
            <p className="mt-0.5 text-xs tabular-nums text-[var(--muted)]">{counts}</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">{settingsLabel}</p>
            {flow.errors > 0 && (
              <button
                type="button"
                onClick={retryAllFailed}
                className="mt-1 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[var(--warning)] transition-opacity hover:opacity-80"
              >
                <AlertTriangleIcon size={13} />
                {flow.errors} failed — retry
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onDownload}
          disabled={busy}
          className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-contrast)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PackageIcon size={16} />
          {busy ? 'Zipping…' : `Download ZIP · ${formatBytes(flow.outputTotal)}`}
        </button>
      </div>
    </div>
      {clearAction}
    </div>
  );
}
