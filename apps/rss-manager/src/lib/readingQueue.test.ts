import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseReadingQueue } from './readingQueue.js';

const FIXTURE = readFileSync(
  new URL('./fixtures/reading-queue.sample.json', import.meta.url),
  'utf-8',
);

describe('parseReadingQueue', () => {
  it('parses the sample fixture', () => {
    const result = parseReadingQueue(FIXTURE);
    expect(result.generated).toBe('2026-01-15');
    expect(result.cutoffMonths).toBe(12);
    expect(result.counts).toEqual({ scanned: 9, queued: 4, stale: 3 });
    expect(result.queue).toHaveLength(4);
    expect(result.stale).toHaveLength(3);
  });

  it('preserves queue item fields', () => {
    const [first] = parseReadingQueue(FIXTURE).queue;
    expect(first.id).toBe('fixture-0001');
    expect(first.tier).toBe(1);
    expect(first.readerUrl).toBe('https://read.readwise.io/read/fixture-0001');
    expect(first.tags).toEqual(['tech/widget']);
    expect(first.sort.readingMinutes).toBe(20);
    expect(first.sort.progress).toBeCloseTo(0.35);
  });

  it('preserves stale item reasons', () => {
    const reasons = parseReadingQueue(FIXTURE).stale.map((s) => s.reason);
    expect(reasons).toEqual([
      'done-unfiled',
      'never-opened-stale',
      'deferred-dead',
    ]);
  });
});

function baseQueueItem(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    rank: 1,
    tier: 1,
    id: 'q-1',
    title: 'Valid Queue Item Title',
    readerUrl: 'https://read.readwise.io/read/q-1',
    sourceUrl: 'https://example.com/q-1',
    siteName: 'example.com',
    tags: ['tech/widget'],
    why: 'because',
    sort: {
      profileRank: 0,
      wikiSources: 1,
      readingMinutes: 1,
      savedDaysAgo: 1,
      progress: 0,
    },
    ...overrides,
  };
}

function baseStaleItem(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 's-1',
    title: 'Valid Stale Item Title',
    reason: 'done-unfiled',
    savedAt: '2025-01-01',
    readerUrl: 'https://read.readwise.io/read/s-1',
    ...overrides,
  };
}

function baseDocument(
  overrides: {
    counts?: Record<string, unknown>;
    queue?: Record<string, unknown>[];
    stale?: Record<string, unknown>[];
  } = {},
): string {
  return JSON.stringify({
    generated: '2026-01-01',
    cutoffMonths: 12,
    counts: overrides.counts ?? { scanned: 1, queued: 1, stale: 1 },
    queue: overrides.queue ?? [baseQueueItem()],
    stale: overrides.stale ?? [baseStaleItem()],
  });
}

describe('parseReadingQueue — malformed input', () => {
  it('throws on invalid JSON, naming the file and the underlying parse detail', () => {
    const input = '{ not json';
    let underlying = '';
    try {
      JSON.parse(input);
    } catch (err) {
      underlying = (err as Error).message;
    }
    expect(underlying).not.toBe('');

    expect(() => parseReadingQueue(input)).toThrowError(
      new RegExp(
        `reading-queue\\.json.*${underlying.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
        's',
      ),
    );
  });

  it('names the offending path for a wrong-type field', () => {
    const doc = baseDocument({ queue: [baseQueueItem({ rank: 'first' })] });
    expect(() => parseReadingQueue(doc)).toThrow(/queue\[0\]\.rank/);
  });

  it('names the offending path for an unknown stale reason', () => {
    const doc = baseDocument({
      stale: [baseStaleItem({ reason: 'not-a-real-reason' })],
    });
    expect(() => parseReadingQueue(doc)).toThrow(/stale\[0\]\.reason/);
  });

  it('rejects a negative tier', () => {
    const doc = baseDocument({ queue: [baseQueueItem({ tier: -1 })] });
    expect(() => parseReadingQueue(doc)).toThrow(/queue\[0\]\.tier/);
  });

  it('rejects a non-integer rank', () => {
    const doc = baseDocument({ queue: [baseQueueItem({ rank: 1.5 })] });
    expect(() => parseReadingQueue(doc)).toThrow(/queue\[0\]\.rank/);
  });

  it('rejects a fractional count', () => {
    const doc = baseDocument({
      counts: { scanned: 9, queued: 4.5, stale: 3 },
    });
    expect(() => parseReadingQueue(doc)).toThrow(/counts\.queued/);
  });

  it('rejects a progress value above 1', () => {
    const doc = baseDocument({
      queue: [
        baseQueueItem({
          sort: {
            profileRank: 0,
            wikiSources: 1,
            readingMinutes: 1,
            savedDaysAgo: 1,
            progress: 1.4,
          },
        }),
      ],
    });
    expect(() => parseReadingQueue(doc)).toThrow(/queue\[0\]\.sort\.progress/);
  });

  it('rejects a duplicate id shared between a queue item and a stale item', () => {
    const doc = baseDocument({
      queue: [baseQueueItem({ id: 'shared-id' })],
      stale: [baseStaleItem({ id: 'shared-id' })],
    });
    expect(() => parseReadingQueue(doc)).toThrow(/shared-id/);
  });

  it('rejects an empty title', () => {
    const doc = baseDocument({ queue: [baseQueueItem({ title: '   ' })] });
    expect(() => parseReadingQueue(doc)).toThrow(/queue\[0\]\.title/);
  });

  it('includes the received value in the error message', () => {
    const doc = baseDocument({ queue: [baseQueueItem({ rank: 'first' })] });
    expect(() => parseReadingQueue(doc)).toThrow(/got string "first"/);
  });
});
