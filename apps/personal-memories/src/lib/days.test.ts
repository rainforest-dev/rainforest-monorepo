import { describe, expect, it } from 'vitest';

import {
  dayForWeek,
  heatLevels,
  indexDays,
  neighbours,
  summarize,
} from './days.ts';
import type { TimelineEvent } from './timeline.ts';

const ev = (
  id: string,
  at: string,
  source: TimelineEvent['source'] = 'line',
): TimelineEvent => ({
  id,
  source,
  at,
  author: 'A',
});

const EVENTS = [
  ev('c', '2025-11-03T08:00:00+08:00'),
  ev('a', '2025-11-01T00:05:00+08:00'),
  ev('p', '2025-11-01T10:15:00+08:00', 'photo'),
  ev('b', '2025-10-31T17:00:00Z'),
];

describe('days', () => {
  const index = indexDays(EVENTS);

  it('groups by Taipei date in time order', () => {
    expect(index.dates).toEqual(['2025-11-01', '2025-11-03']);
    expect(index.byDate.get('2025-11-01')?.map((e) => e.id)).toEqual([
      'a',
      'b',
      'p',
    ]);
    expect(indexDays(EVENTS)).toBe(index);
  });

  it('summarizes counts', () => {
    expect(summarize(index)[0]).toEqual({
      date: '2025-11-01',
      counts: { line: 2, slack: 0, photo: 1 },
      total: 3,
    });
  });

  it('finds neighbouring days with events', () => {
    expect(neighbours(index, '2025-11-01')).toEqual({ next: '2025-11-03' });
    expect(neighbours(index, '2025-11-03')).toEqual({ prev: '2025-11-01' });
  });

  it('maps an ISO week to its first day with events', () => {
    expect(dayForWeek(index, '2025-W44')).toBe('2025-11-01');
    expect(dayForWeek(index, '2025-W45')).toBe('2025-11-03');
    expect(dayForWeek(index, '1999-W01')).toBeUndefined();
    expect(dayForWeek(index, 'nope')).toBeUndefined();
  });

  it('buckets totals by quartile', () => {
    const level = heatLevels([0, 1, 2, 3, 4, 100]);
    expect([0, 1, 2, 3, 4, 100].map(level)).toEqual([0, 1, 1, 2, 3, 4]);
  });
});
