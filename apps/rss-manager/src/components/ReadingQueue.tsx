import { Badge, Button } from '@rainforest-dev/rainforest-react';
import { useEffect, useMemo, useState } from 'react';

import {
  type QueueItem,
  type ReadingQueue as ReadingQueueData,
  SORT_MODES,
  type SortMode,
  sortQueue,
  type StaleItem,
} from '../lib/readingQueue.js';

const TIER_LABELS: Record<number, string> = {
  1: 'Finish what you started',
  2: 'Blind spot in your stack',
  3: 'Wiki leverage',
  4: 'Covered interest',
};

/**
 * Keyed by StaleReason so the compiler rejects a new reason until it has both a
 * label and a position — a reason missing from the render order would still be
 * counted in the panel heading but never shown. `order` runs from "safe to
 * sweep" to "needs a human decision".
 */
const STALE_REASONS: Record<
  StaleItem['reason'],
  { label: string; order: number }
> = {
  'done-unfiled': { label: 'Read but never archived', order: 0 },
  expired: { label: 'Time-sensitive and past its window', order: 1 },
  'off-stack': { label: 'Evergreen, but off your current stack', order: 2 },
  'deferred-dead': { label: 'Deferred to Later and never opened', order: 3 },
  abandoned: { label: 'Abandoned part-way', order: 4 },
  duplicate: { label: 'Duplicate of another saved item', order: 5 },
  malformed: { label: 'Malformed title', order: 6 },
};

const DECAY_LABEL: Record<QueueItem['decay'], string | null> = {
  'time-sensitive': 'time-sensitive',
  evergreen: 'evergreen',
  unknown: null,
};

const STALE_REASON_ORDER = (
  Object.keys(STALE_REASONS) as StaleItem['reason'][]
).sort((a, b) => STALE_REASONS[a].order - STALE_REASONS[b].order);

type Payload = ReadingQueueData | { generated: null };

function QueueRow({
  item,
  showTier = false,
}: {
  item: QueueItem;
  showTier?: boolean;
}) {
  return (
    <li className="border-border border-b py-3 last:border-b-0">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-2">
          {showTier && (
            <Badge variant="muted">
              {TIER_LABELS[item.tier] ?? `Tier ${item.tier}`}
            </Badge>
          )}
          <a
            href={item.readerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-medium hover:underline"
          >
            {item.title}
          </a>
        </div>
        <span className="text-muted-foreground shrink-0 text-xs">
          {item.siteName} · {item.sort.readingMinutes} min
        </span>
      </div>
      <p className="text-muted-foreground mt-1 text-sm">{item.why}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {item.tags.map((tag) => (
          <span key={tag} className="text-muted-foreground text-xs">
            #{tag}
          </span>
        ))}
        {DECAY_LABEL[item.decay] && (
          <span className="text-muted-foreground text-xs">
            {DECAY_LABEL[item.decay]}
          </span>
        )}
        {item.sort.progress > 0 && (
          <span className="text-muted-foreground text-xs">
            {Math.round(item.sort.progress * 100)}% read
          </span>
        )}
      </div>
    </li>
  );
}

export default function ReadingQueue() {
  const [data, setData] = useState<Payload | null>(null);
  const [mode, setMode] = useState<SortMode>('default');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/reading-queue')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((payload: Payload) => setData(payload))
      .catch(() => setError('Failed to load the reading queue.'));
  }, []);

  const queue = data && data.generated !== null ? data.queue : [];
  const sorted = useMemo(() => sortQueue(queue, mode), [queue, mode]);

  if (error)
    return <p className="text-destructive py-8 text-center">{error}</p>;
  if (!data)
    return (
      <p className="text-muted-foreground py-8 text-center">Loading queue…</p>
    );

  if (data.generated === null)
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">
          No reading queue has been generated yet.
        </p>
        <p className="text-muted-foreground mt-2 text-sm">
          Run the <code className="text-primary">reading-queue</code> skill to
          build one.
        </p>
      </div>
    );

  const tiers = [...new Set(sorted.map((i) => i.tier))].sort((a, b) => a - b);
  const showTier = mode !== 'default';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {data.counts.queued} queued · {data.counts.backlog} in backlog ·{' '}
          {data.counts.stale} stale · {data.counts.scanned} scanned · generated{' '}
          {data.generated}
        </p>
        <div className="flex flex-wrap gap-1">
          {SORT_MODES.map(({ mode: m, label }) => (
            <Button
              key={m}
              size="xs"
              variant={mode === m ? 'default' : 'secondary'}
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {mode === 'default' ? (
        tiers.map((tier) => (
          <section key={tier}>
            <h3 className="text-muted-foreground mb-2 text-sm font-semibold uppercase tracking-wider">
              {TIER_LABELS[tier] ?? `Tier ${tier}`}
            </h3>
            <ul>
              {sorted
                .filter((i) => i.tier === tier)
                .map((item) => (
                  <QueueRow key={item.id} item={item} />
                ))}
            </ul>
          </section>
        ))
      ) : (
        <ul>
          {sorted.map((item) => (
            <QueueRow key={item.id} item={item} showTier={showTier} />
          ))}
        </ul>
      )}

      {data.stale.length > 0 && (
        <section>
          <h3 className="text-muted-foreground mb-2 text-sm font-semibold uppercase tracking-wider">
            Stale ({data.stale.length})
          </h3>
          <p className="text-muted-foreground mb-3 text-xs">
            Read-only. Archive these in Readwise yourself — this app never
            writes to Reader.
          </p>
          <div className="space-y-4">
            {STALE_REASON_ORDER.map((reason) => {
              const items = data.stale.filter((item) => item.reason === reason);
              if (items.length === 0) return null;
              return (
                <div key={reason}>
                  {/* Sticky so the group you are reading stays named while you
                      scroll a list this long. */}
                  <h4 className="border-border bg-background text-primary sticky top-0 z-10 -mx-2 mb-2 border-b px-2 py-2 text-xs font-semibold uppercase tracking-wider">
                    {STALE_REASONS[reason].label}{' '}
                    <span className="text-muted-foreground">
                      ({items.length})
                    </span>
                  </h4>
                  <ul className="space-y-2">
                    {items.map((item) => (
                      <li key={item.id} className="text-sm">
                        <div className="flex items-baseline gap-3">
                          <a
                            href={item.readerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground hover:text-primary hover:underline"
                          >
                            {item.title}
                          </a>
                          {DECAY_LABEL[item.decay] && (
                            <Badge variant="muted">
                              {DECAY_LABEL[item.decay]}
                            </Badge>
                          )}
                          <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                            {item.savedAt}
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {item.why}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
