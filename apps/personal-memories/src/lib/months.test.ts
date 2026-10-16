import { describe, expect, it } from 'vitest';

import { nearestDate, scrubberMonths } from './months.ts';

describe('months', () => {
  it('finds the nearest date, earlier on a tie, even for impossible targets', () => {
    const dates = ['2025-11-01', '2025-11-03', '2025-11-10'];
    expect(nearestDate(dates, '2025-11-02')).toBe('2025-11-01');
    expect(nearestDate(dates, '2025-11-08')).toBe('2025-11-10');
    expect(nearestDate(dates, '1999-01-01')).toBe('2025-11-01');
    expect(nearestDate(dates, '2030-01-01')).toBe('2025-11-10');
    expect(nearestDate(dates, '2025-11-31')).toBe('2025-11-10');
    expect(nearestDate([], '2025-11-01')).toBeUndefined();
  });

  it('sums days into scrubber months across a year change', () => {
    expect(
      scrubberMonths([
        { date: '2024-12-30', total: 2 },
        { date: '2024-12-31', total: 3 },
        { date: '2025-01-02', total: 4 },
      ]),
    ).toEqual([
      { month: '2024-12', first: '2024-12-30', total: 5 },
      { month: '2025-01', first: '2025-01-02', total: 4 },
    ]);
  });
});
