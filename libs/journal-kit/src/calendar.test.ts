import { describe, expect, it } from 'vitest';

import { calendarWeeks, MONTH_RE, monthLabel, shiftMonth } from './calendar';

describe('calendar', () => {
  it('validates YYYY-MM', () => {
    expect(MONTH_RE.test('2025-11')).toBe(true);
    expect(MONTH_RE.test('2025-13')).toBe(false);
    expect(MONTH_RE.test('2025-1')).toBe(false);
  });

  it('shifts across year boundaries and labels in zh-TW', () => {
    expect(shiftMonth('2025-12', 1)).toBe('2026-01');
    expect(shiftMonth('2025-01', -1)).toBe('2024-12');
    expect(shiftMonth('2025-11', 0)).toBe('2025-11');
    expect(monthLabel('2025-01')).toBe('2025 年 1 月');
  });

  it('lays out Sunday-first weeks padded with null', () => {
    const weeks = calendarWeeks('2025-11');
    expect(weeks).toHaveLength(6);
    expect(weeks[0]).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      '2025-11-01',
    ]);
    expect(weeks[5]).toEqual([
      '2025-11-30',
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(calendarWeeks('2024-02')[4][4]).toBe('2024-02-29');
  });
});
