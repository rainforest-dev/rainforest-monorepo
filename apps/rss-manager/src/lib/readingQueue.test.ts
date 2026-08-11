import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { parseReadingQueue, sortQueue } from './readingQueue.js';
import { readReadingQueue } from './readingQueueFile.js';

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

  // Reader returns reading_time: null for videos and podcasts, so null — not a wrong
  // type, not a missing key — is the shape real upstream data actually produces. The
  // skill is responsible for coalescing it; this asserts the app refuses to render a
  // queue where it slipped through, and says which item to look at.
  it('rejects a null where a number is required', () => {
    const doc = baseDocument({
      queue: [
        baseQueueItem({
          sort: {
            profileRank: 0,
            wikiSources: 1,
            readingMinutes: null,
            savedDaysAgo: 1,
            progress: 0,
          },
        }),
      ],
    });
    expect(() => parseReadingQueue(doc)).toThrow(
      /queue\[0\]\.sort\.readingMinutes.*got null/s,
    );
  });

  it('rejects a duplicate id shared between a queue item and a stale item', () => {
    const doc = baseDocument({
      queue: [baseQueueItem({ id: 'shared-id' })],
      stale: [baseStaleItem({ id: 'shared-id' })],
    });
    expect(() => parseReadingQueue(doc)).toThrow(
      /shared-id.*queue\[0\].*stale\[0\]/s,
    );
  });

  it('rejects an empty title', () => {
    const doc = baseDocument({ queue: [baseQueueItem({ title: '   ' })] });
    expect(() => parseReadingQueue(doc)).toThrow(/queue\[0\]\.title/);
  });

  it('includes the received value in the error message', () => {
    const doc = baseDocument({ queue: [baseQueueItem({ rank: 'first' })] });
    expect(() => parseReadingQueue(doc)).toThrow(/got string "first"/);
  });

  it('rejects a negative wikiSources value, naming the offending path', () => {
    const doc = baseDocument({
      queue: [
        baseQueueItem({
          sort: {
            profileRank: 0,
            wikiSources: -1,
            readingMinutes: 1,
            savedDaysAgo: 1,
            progress: 0,
          },
        }),
      ],
    });
    expect(() => parseReadingQueue(doc)).toThrow(
      /queue\[0\]\.sort\.wikiSources/,
    );
  });

  it('rejects a negative progress value', () => {
    const doc = baseDocument({
      queue: [
        baseQueueItem({
          sort: {
            profileRank: 0,
            wikiSources: 1,
            readingMinutes: 1,
            savedDaysAgo: 1,
            progress: -0.1,
          },
        }),
      ],
    });
    expect(() => parseReadingQueue(doc)).toThrow(/queue\[0\]\.sort\.progress/);
  });

  it('rejects Infinity in a numeric field', () => {
    const doc = baseDocument({
      queue: [
        baseQueueItem({
          sort: {
            profileRank: 0,
            wikiSources: 1,
            readingMinutes: Infinity,
            savedDaysAgo: 1,
            progress: 0,
          },
        }),
      ],
    });
    expect(() => parseReadingQueue(doc)).toThrow(
      /queue\[0\]\.sort\.readingMinutes/,
    );
  });
});

describe('readReadingQueue', () => {
  const originalVaultPath = process.env.VAULT_PATH;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'reading-queue-test-'));
  });

  afterEach(() => {
    if (originalVaultPath === undefined) delete process.env.VAULT_PATH;
    else process.env.VAULT_PATH = originalVaultPath;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null when the file is absent', () => {
    process.env.VAULT_PATH = join(tmpDir, 'does-not-exist');
    expect(readReadingQueue()).toBeNull();
  });

  it('reads and parses a real file', () => {
    process.env.VAULT_PATH = tmpDir;
    writeFileSync(join(tmpDir, 'reading-queue.json'), FIXTURE, 'utf-8');

    const result = readReadingQueue();
    expect(result?.generated).toBe('2026-01-15');
    expect(result?.queue).toHaveLength(4);
  });

  it('propagates a non-ENOENT error (EISDIR) instead of returning null', () => {
    process.env.VAULT_PATH = tmpDir;
    mkdirSync(join(tmpDir, 'reading-queue.json'));

    expect(() => readReadingQueue()).toThrow(
      expect.objectContaining({ code: 'EISDIR' }),
    );
  });
});

describe('sortQueue', () => {
  const queue = parseReadingQueue(FIXTURE).queue;
  const ids = (mode: Parameters<typeof sortQueue>[1]) =>
    sortQueue(queue, mode).map((i) => i.id);

  it('defaults to the rank the skill assigned', () => {
    expect(ids('default')).toEqual([
      'fixture-0001',
      'fixture-0002',
      'fixture-0003',
      'fixture-0004',
    ]);
  });

  it('sorts shortest first by reading minutes', () => {
    expect(ids('shortest')).toEqual([
      'fixture-0003',
      'fixture-0002',
      'fixture-0001',
      'fixture-0004',
    ]);
  });

  it('sorts newest first by days since saved', () => {
    expect(ids('newest')).toEqual([
      'fixture-0004',
      'fixture-0001',
      'fixture-0002',
      'fixture-0003',
    ]);
  });

  it('sorts thinnest wiki page first', () => {
    expect(ids('thinnest')).toEqual([
      'fixture-0003',
      'fixture-0001',
      'fixture-0002',
      'fixture-0004',
    ]);
  });

  it('does not mutate the input array', () => {
    const before = queue.map((i) => i.id);
    sortQueue(queue, 'shortest');
    expect(queue.map((i) => i.id)).toEqual(before);
  });

  it('breaks ties by rank so ordering is deterministic', () => {
    const tied = [
      { ...queue[1], id: 'b', rank: 9 },
      { ...queue[1], id: 'a', rank: 2 },
    ];
    expect(sortQueue(tied, 'shortest').map((i) => i.id)).toEqual(['a', 'b']);
  });
});
