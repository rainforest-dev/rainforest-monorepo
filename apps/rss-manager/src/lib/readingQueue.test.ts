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
