import { useEffect } from 'react';
import { useQueueStore } from '../state/queueStore';
import { isAcceptedImage } from '../core/format';

/**
 * Paste images anywhere in the app with Cmd/Ctrl+V — covers both a file
 * copied in the OS file manager (e.g. Finder) and an image copied to the
 * clipboard directly (screenshot tools, "Copy Image" from a browser/app).
 * Both arrive the same way: as Files on the paste event's clipboardData.
 */
export function usePasteImages() {
  const addFiles = useQueueStore((s) => s.addFiles);
  const locked = useQueueStore((s) => s.items.length > 0);

  useEffect(() => {
    if (locked) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter(isAcceptedImage);
      if (!files.length) return;
      e.preventDefault();
      addFiles(files);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [addFiles, locked]);
}
