import { describe, expect, it } from 'vitest';

import {
  dayForWeek,
  heatLevels,
  indexDays,
  monthRows,
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

  it('lays out one row per month across a year boundary', () => {
    const rows = monthRows(
      '2025-12-20',
      '2026-01-10',
      new Map([['2025-12-25', 2]]),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ year: 2025, month: 12 });
    expect(rows[0].cells[18]).toBeNull(); // Dec 19, before the range
    expect(rows[0].cells[19]).toEqual({ date: '2025-12-20', total: 0 });
    expect(rows[0].cells[24]).toEqual({ date: '2025-12-25', total: 2 });
    expect(rows[0].cells[30]).toEqual({ date: '2025-12-31', total: 0 });
    expect(rows[1]).toMatchObject({ year: 2026, month: 1 });
    expect(rows[1].cells[9]).toEqual({ date: '2026-01-10', total: 0 });
    expect(rows[1].cells[10]).toBeNull(); // Jan 11, after the range
  });

  it('keeps all 29 February slots in a leap year and nulls the rest', () => {
    const rows = monthRows('2024-02-01', '2024-02-29', new Map());
    expect(rows).toHaveLength(1);
    expect(rows[0].cells[27]).toEqual({ date: '2024-02-28', total: 0 });
    expect(rows[0].cells[28]).toEqual({ date: '2024-02-29', total: 0 });
    expect(rows[0].cells[29]).toBeNull(); // the month has no day 30
    expect(rows[0].cells[30]).toBeNull(); // nor day 31
  });

  it('nulls the days before a mid-month start', () => {
    const rows = monthRows('2025-11-15', '2025-11-20', new Map());
    expect(rows).toHaveLength(1);
    expect(rows[0].cells.slice(0, 14)).toEqual(Array(14).fill(null));
    expect(rows[0].cells[14]).toEqual({ date: '2025-11-15', total: 0 });
    expect(rows[0].cells[19]).toEqual({ date: '2025-11-20', total: 0 });
    expect(rows[0].cells.slice(20)).toEqual(Array(11).fill(null));
  });
});
