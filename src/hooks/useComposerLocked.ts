import { useQueueStore } from '../state/queueStore';

/**
 * The composer (dropzone + settings + auto-download) locks the moment there are
 * any images to work on — i.e. once the flow leaves the `idle` phase — and stays
 * locked until the queue is cleared. Single source of truth for that rule.
 */
export const useComposerLocked = () => useQueueStore((s) => s.items.length > 0);
