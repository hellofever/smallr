import { useQueueStore } from '../state/queueStore';
import { useComposerLocked } from '../hooks/useComposerLocked';
import { FORMAT_META } from '../core/format';
import type { OutputFormat, PngPreset } from '../core/types';

const FORMATS: OutputFormat[] = ['png', 'webp', 'jpeg'];

const PNG_PRESETS: { value: PngPreset; label: string; caption: string }[] = [
  { value: 'lossless', label: 'Lossless', caption: 'No quality loss. Larger files.' },
  { value: 'high', label: 'High', caption: 'Recommended. Near-lossless, much smaller than lossless.' },
  { value: 'medium', label: 'Medium', caption: 'Smaller. Slight colour reduction.' },
  { value: 'low', label: 'Low', caption: 'Smallest. May band on gradients.' },
];

// The quality slider (1–100) is described by whichever range it falls into.
// Ranges are matched top-down by `min`, so list them high → low.
interface QualityRange {
  min: number;
  label: string;
  caption: string;
}
const QUALITY_RANGES: Record<'webp' | 'jpeg', QualityRange[]> = {
  webp: [
    { min: 91, label: 'Maximum', caption: 'Highest quality. Minimal savings.' },
    { min: 66, label: 'High', caption: 'Recommended. Near-lossless, much smaller.' },
    { min: 41, label: 'Medium', caption: 'Smaller. Some detail loss.' },
    { min: 1, label: 'Low', caption: 'Smallest. Visible artefacts.' },
  ],
  jpeg: [
    { min: 91, label: 'Maximum', caption: 'Highest quality. Larger files.' },
    { min: 66, label: 'High', caption: 'Recommended. Visually lossless, much smaller.' },
    { min: 41, label: 'Medium', caption: 'Smaller. Some artefacts on fine detail.' },
    { min: 1, label: 'Low', caption: 'Smallest. Visible blocking/artefacts.' },
  ],
};
function qualityRange(format: 'webp' | 'jpeg', quality: number): QualityRange {
  return QUALITY_RANGES[format].find((r) => quality >= r.min) ?? QUALITY_RANGES[format].at(-1)!;
}

export function SettingsPanel() {
  const settings = useQueueStore((s) => s.settings);
  const setFormat = useQueueStore((s) => s.setFormat);
  const setQuality = useQueueStore((s) => s.setQuality);
  const setPngPreset = useQueueStore((s) => s.setPngPreset);
  const locked = useComposerLocked();

  const isPng = settings.format === 'png';
  const activePreset = PNG_PRESETS.find((p) => p.value === settings.pngPreset);

  return (
    <div className="px-1">
      <fieldset
        disabled={locked}
        className="grid grid-cols-1 items-start gap-x-8 gap-y-4 border-0 p-0 disabled:opacity-50 sm:grid-cols-[1fr_2fr]"
      >
        {/* Output format — left half */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Output format
          </label>
          <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1">
            {FORMATS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={`flex-1 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  settings.format === f
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                {FORMAT_META[f].label}
              </button>
            ))}
          </div>
        </div>

        {/* Quality — right half (PNG presets or WebP/JPEG slider) */}
        {isPng ? (
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              PNG quality
            </label>
            <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1">
              {PNG_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPngPreset(p.value)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                    settings.pngPreset === p.value
                      ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                      : 'text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {activePreset && (
              <p className="mt-1.5 text-xs text-[var(--muted)]">{activePreset.caption}</p>
            )}
          </div>
        ) : (
          <Slider
            label="Quality"
            value={settings.quality[settings.format]}
            range={qualityRange(settings.format as 'webp' | 'jpeg', settings.quality[settings.format])}
            min={1}
            max={100}
            onChange={setQuality}
          />
        )}
      </fieldset>
    </div>
  );
}

function Slider({
  label,
  value,
  range,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  range: QualityRange;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="min-w-[180px]">
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {label}
        </label>
        <span className="text-sm font-medium text-[var(--text)]">
          <span className="tabular-nums">{value}</span>
          <span className="text-[var(--muted)]"> · {range.label}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="smallr-range w-full"
      />
      <p className="mt-1.5 text-xs text-[var(--muted)]">{range.caption}</p>
    </div>
  );
}
