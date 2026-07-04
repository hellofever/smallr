import { useQueueStore, selectFlow } from '../state/queueStore';
import { Dropzone } from './Dropzone';
import { SettingsPanel } from './SettingsPanel';
import { AutoDownloadToggle } from './AutoDownloadToggle';

/**
 * The upload/settings surface: dropzone + output settings + auto-download.
 * Stays visible (with its controls disabled) while a batch is converting, and
 * is hidden entirely on the terminal (done/failed) screen.
 */
export function Composer() {
  const phase = useQueueStore((s) => selectFlow(s).phase);

  if (phase === 'done' || phase === 'failed') return null;

  return (
    <section className="space-y-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow)]">
      <Dropzone />
      <SettingsPanel />
      <AutoDownloadToggle />
    </section>
  );
}
