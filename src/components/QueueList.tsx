import { useQueueStore } from '../state/queueStore';
import QueueItemRow from './QueueItem';

export function QueueList() {
  const items = useQueueStore((s) => s.items);

  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Images ({items.length})
      </h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <QueueItemRow key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}
