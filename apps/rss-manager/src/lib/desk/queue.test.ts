import { describe, expect, it } from 'vitest';

import type { QueueItem, StaleItem } from '@/lib/readingQueue';

import {
  filterQueue,
  groupStale,
  queueTiers,
  readLabel,
  savedLabel,
  tierLabel,
} from './queue.js';

const item = (rank: number, tier: number) =>
  ({ rank, tier, id: `q${rank}` }) as QueueItem;

const stale = (id: string, reason: StaleItem['reason']) =>
  ({ id, reason }) as StaleItem;

describe('queueTiers', () => {
  it('lists the tiers present, in order', () => {
    expect(queueTiers([item(1, 3), item(2, 1), item(3, 3)])).toEqual([1, 3]);
    expect(queueTiers([])).toEqual([]);
  });

  it('skips a tier outside 1 to 4', () => {
    expect(queueTiers([item(1, 0), item(2, 5), item(3, 2)])).toEqual([2]);
  });
});

describe('filterQueue', () => {
  const items = [item(1, 1), item(2, 2), item(3, 1)];

  it('keeps every item without a tier', () => {
    expect(filterQueue(items, null)).toEqual(items);
  });

  it('keeps the items of one tier', () => {
    expect(filterQueue(items, 1).map((i) => i.rank)).toEqual([1, 3]);
    expect(filterQueue(items, 4)).toEqual([]);
  });
});

describe('readLabel', () => {
  it.each([
    [0, ''],
    [0.4, '40% read'],
    [0.155, '16% read'],
    [1, '100% read'],
  ])('%d is %j', (progress, label) => {
    expect(readLabel(progress)).toBe(label);
  });
});

describe('savedLabel', () => {
  it('reads days since saved', () => {
    expect(savedLabel(0)).toBe('today');
    expect(savedLabel(12)).toBe('12d ago');
  });
});

describe('tierLabel', () => {
  it('names the four tiers and falls back for others', () => {
    expect(tierLabel(1)).toBe('Finish what you started');
    expect(tierLabel(4)).toBe('Covered interest');
    expect(tierLabel(7)).toBe('Tier 7');
  });
});

describe('groupStale', () => {
  it('groups by reason in panel order and drops empty reasons', () => {
    const groups = groupStale([
      stale('a', 'duplicate'),
      stale('b', 'done-unfiled'),
      stale('c', 'duplicate'),
      stale('d', 'expired'),
    ]);
    expect(groups.map((g) => [g.reason, g.items.map((i) => i.id)])).toEqual([
      ['done-unfiled', ['b']],
      ['expired', ['d']],
      ['duplicate', ['a', 'c']],
    ]);
    expect(groups[0]?.label).toBe('Read but never archived');
  });
});
