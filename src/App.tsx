import { useQueueRunner } from './hooks/useQueueRunner';
import { useQueueStore } from './state/queueStore';
import { Composer } from './components/Composer';
import { ProgressBar } from './components/ProgressBar';
import { QueueList } from './components/QueueList';
import { ThemeToggle } from './components/ThemeToggle';
import { CheckIcon } from './components/icons';

/** Open-source image libraries powering the pipeline — shown in the info blade. */
const LIBRARIES: { name: string; text: string }[] = [
  {
    name: '@jsquash/webp',
    text: 'A WebAssembly build of Google’s libwebp. Encodes your images to WebP at the quality you choose.',
  },
  {
    name: '@jsquash/jpeg',
    text: 'WebAssembly MozJPEG. Produces smaller JPEGs with tunable quality (transparency is flattened onto white first).',
  },
  {
    name: '@jsquash/oxipng',
    text: 'WebAssembly Oxipng. Losslessly re-optimises every PNG after encoding to shave off extra bytes.',
  },
  {
    name: 'UPNG.js',
    text: 'A pure-JavaScript PNG codec. Powers lossy and lossless PNG output via a colour-count preset.',
  },
  {
    name: 'fflate',
    text: 'A tiny, fast zip library. Bundles a finished batch into a single ZIP — still entirely in your browser.',
  },
];

export default function App() {
  useQueueRunner(); // owns the worker + drains the queue
  // Marketing blades show only on the initial screen (no images queued yet).
  const idle = useQueueStore((s) => s.items.length === 0);

  return (
    <div className="flex min-h-full flex-col">
      {/* The tool — centered column */}
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-8">
        <header className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">smallr</h1>
            <span className="text-sm text-[var(--muted)]">local image compressor</span>
          </div>
          <ThemeToggle />
        </header>

        {/* Composer: dropzone + settings + auto-download, hidden once uploading */}
        <Composer />

        <ProgressBar />

        <QueueList />
      </div>

      {/* Full-width blades — only on the initial (idle) screen */}
      {idle && (
        <>
          <section className="w-full border-t border-[var(--border)] bg-[var(--surface-2)]">
            <div className="mx-auto max-w-3xl px-5 py-16 text-center sm:py-20">
              <h2 className="text-3xl font-bold leading-tight tracking-tight text-[var(--text)] sm:text-5xl">
                Make things <span className="text-[var(--accent)]">smallr</span>.
                <br />
                All <span className="text-[var(--accent)]">locally</span>, all for{' '}
                <span className="text-[var(--accent)]">free</span>.
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
                <span className="text-[var(--accent)]">smallr</span> is a fast, minimal image
                compressor and converter that runs entirely in your browser. Nothing is ever
                uploaded — your files never leave your device — so it stays completely private,
                works offline, and is <span className="text-[var(--accent)]">free</span>.
              </p>
            </div>
          </section>

          <section className="w-full border-t border-[var(--border)] bg-[var(--bg)]">
            <div className="mx-auto grid max-w-3xl grid-cols-1 gap-10 px-5 py-16 sm:grid-cols-2 sm:gap-12 sm:py-20">
              {/* LHS — heading */}
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
                  Image compression with open source platforms
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
                  Every codec is a permissively-licensed, open-source project — running as
                  WebAssembly or plain JavaScript, right on your device.
                </p>
              </div>

              {/* RHS — library checklist */}
              <ul className="space-y-5">
                {LIBRARIES.map((lib) => (
                  <li key={lib.name} className="flex gap-3">
                    <span className="mt-0.5 shrink-0 text-[var(--accent)]">
                      <CheckIcon size={18} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">{lib.name}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-[var(--muted)]">
                        {lib.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </>
      )}

      <footer className="mt-auto w-full border-t border-[var(--border)]">
        <div className="mx-auto max-w-3xl px-5 py-6 text-center text-xs text-[var(--muted)]">
          <p>Everything runs in your browser — no uploads, no servers.</p>
          <p className="mt-1 opacity-70">smallr · {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
