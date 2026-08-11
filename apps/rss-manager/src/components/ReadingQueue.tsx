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

const STALE_LABELS: Record<StaleItem['reason'], string> = {
  'done-unfiled': 'Read but never archived',
  'never-opened-stale': 'Never opened, over 12 months old',
  'deferred-dead': 'Deferred to Later and never opened',
  abandoned: 'Abandoned part-way',
  duplicate: 'Duplicate of another saved item',
  malformed: 'Malformed title',
};

/** Runs from "safe to sweep" to "needs a human decision" — the order the stale panel groups in. */
const STALE_REASON_ORDER: StaleItem['reason'][] = [
  'done-unfiled',
  'never-opened-stale',
  'deferred-dead',
  'abandoned',
  'duplicate',
  'malformed',
];

type Payload = ReadingQueueData | { generated: null };

function QueueRow({
  item,
  showTier = false,
}: {
  item: QueueItem;
  showTier?: boolean;
}) {
  return (
    <li className="border-b border-gray-800 py-3 last:border-b-0">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-2">
          {showTier && (
            <span className="shrink-0 rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
              {TIER_LABELS[item.tier] ?? `Tier ${item.tier}`}
            </span>
          )}
          <a
            href={item.readerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-violet-400 hover:underline"
          >
            {item.title}
          </a>
        </div>
        <span className="shrink-0 text-xs text-gray-500">
          {item.siteName} · {item.sort.readingMinutes} min
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-400">{item.why}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {item.tags.map((tag) => (
          <span key={tag} className="text-xs text-gray-500">
            #{tag}
          </span>
        ))}
        {item.sort.progress > 0 && (
          <span className="text-xs text-gray-500">
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

  if (error) return <p className="py-8 text-center text-red-400">{error}</p>;
  if (!data)
    return <p className="py-8 text-center text-gray-400">Loading queue…</p>;

  if (data.generated === null)
    return (
      <div className="py-12 text-center">
        <p className="text-gray-400">No reading queue has been generated yet.</p>
        <p className="mt-2 text-sm text-gray-500">
          Run the <code className="text-violet-400">reading-queue</code> skill to
          build one.
        </p>
      </div>
    );

  const tiers = [...new Set(sorted.map((i) => i.tier))].sort((a, b) => a - b);
  const showTier = mode !== 'default';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {data.counts.queued} queued · {data.counts.stale} stale ·{' '}
          {data.counts.scanned} scanned · generated {data.generated}
        </p>
        <div className="flex flex-wrap gap-1">
          {SORT_MODES.map(({ mode: m, label }) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                mode === m
                  ? 'bg-violet-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'default' ? (
        tiers.map((tier) => (
          <section key={tier}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
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
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Stale ({data.stale.length})
          </h3>
          <p className="mb-3 text-xs text-gray-500">
            Read-only. Archive these in Readwise yourself — this app never writes
            to Reader.
          </p>
          <div className="space-y-4">
            {STALE_REASON_ORDER.map((reason) => {
              const items = data.stale.filter((item) => item.reason === reason);
              if (items.length === 0) return null;
              return (
                <div key={reason}>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {STALE_LABELS[reason]} ({items.length})
                  </h4>
                  <ul className="space-y-1">
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-baseline gap-3 text-sm"
                      >
                        <a
                          href={item.readerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-300 hover:text-violet-400 hover:underline"
                        >
                          {item.title}
                        </a>
                        <span className="ml-auto shrink-0 text-xs text-gray-500">
                          {item.savedAt}
                        </span>
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
