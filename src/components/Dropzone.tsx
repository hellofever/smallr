import { useCallback, useRef, useState } from 'react';
import { useQueueStore } from '../state/queueStore';
import { useComposerLocked } from '../hooks/useComposerLocked';
import { isAcceptedImage } from '../core/format';
import { UploadCloudIcon } from './icons';

export function Dropzone() {
  const addFiles = useQueueStore((s) => s.addFiles);
  const locked = useComposerLocked();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const accept = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      const files = Array.from(list).filter(isAcceptedImage);
      if (files.length) addFiles(files);
    },
    [addFiles],
  );

  return (
    <div
      role="button"
      aria-disabled={locked}
      tabIndex={locked ? -1 : 0}
      onClick={() => !locked && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!locked && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        if (locked) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (locked) return;
        e.preventDefault();
        setDragging(false);
        accept(e.dataTransfer.files);
      }}
      className={`flex flex-col items-center justify-center gap-3 rounded-[calc(var(--radius-card)-4px)] border-2 border-dashed px-6 py-10 text-center transition-colors ${
        locked
          ? 'cursor-not-allowed border-[var(--border)] bg-[var(--surface-2)]/40 opacity-50'
          : dragging
            ? 'cursor-pointer border-[var(--accent)] bg-[var(--surface-2)]'
            : 'cursor-pointer border-[var(--border)] bg-[var(--surface-2)]/40 hover:border-[var(--accent)]'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        disabled={locked}
        onChange={(e) => {
          accept(e.target.files);
          e.target.value = '';
        }}
      />
      <div className="grid h-12 w-12 place-items-center rounded-full bg-[var(--surface)] text-[var(--accent)]">
        <UploadCloudIcon size={22} />
      </div>
      <div>
        <p className="font-medium text-[var(--text)]">
          Drop images here, <span className="text-[var(--accent)]">browse</span>, or paste
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">PNG · JPEG · WebP · GIF</p>
      </div>
    </div>
  );
}
