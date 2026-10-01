import { describe, expect, it } from 'vitest';

import { localISODate, parseDateQuery } from './natural-date.ts';

const TODAY = '2026-10-01';
const day = (date: string) => ({ start: date, end: date });
const parse = (q: string) => parseDateQuery(q, TODAY);

describe('parseDateQuery', () => {
  it('reads relative days', () => {
    expect(parse('今天')).toEqual(day('2026-10-01'));
    expect(parse('昨天')).toEqual(day('2026-09-30'));
    expect(parse('前天')).toEqual(day('2026-09-29'));
  });

  it('takes a bare weekday as the latest one up to today', () => {
    expect(parse('週六')).toEqual(day('2026-09-26'));
    expect(parse('星期六')).toEqual(day('2026-09-26'));
    expect(parse('禮拜日')).toEqual(day('2026-09-27'));
    expect(parse('週四')).toEqual(day('2026-10-01'));
  });

  it('counts weeks from Monday', () => {
    expect(parse('上週日')).toEqual(day('2026-09-27'));
    expect(parse('上周六')).toEqual(day('2026-09-26'));
    expect(parse('這週六')).toEqual(day('2026-10-03'));
    expect(parse('上上週一')).toEqual(day('2026-09-14'));
    expect(parse('上週')).toEqual({ start: '2026-09-21', end: '2026-09-27' });
    expect(parse('這週')).toEqual({ start: '2026-09-28', end: '2026-10-04' });
  });

  it('reads relative months and years', () => {
    expect(parse('這個月')).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(parse('上個月')).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(parse('去年')).toEqual({ start: '2025-01-01', end: '2025-12-31' });
  });

  it('takes a month without a year as the latest one up to today', () => {
    expect(parse('11月')).toEqual({ start: '2025-11-01', end: '2025-11-30' });
    expect(parse('10 月')).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(parse('去年 11 月')).toEqual({
      start: '2025-11-01',
      end: '2025-11-30',
    });
    expect(parse('2024年2月')).toEqual({
      start: '2024-02-01',
      end: '2024-02-29',
    });
  });

  it('takes a month and day without a year as the latest one up to today', () => {
    expect(parse('11/8')).toEqual(day('2025-11-08'));
    expect(parse('9月26日')).toEqual(day('2026-09-26'));
    expect(parse('10月2號')).toEqual(day('2025-10-02'));
    expect(parse('2/29')).toEqual(day('2024-02-29'));
    expect(parse('前年 3 月 1 日')).toEqual(day('2024-03-01'));
  });

  it('finds solar and lunar festivals', () => {
    expect(parse('聖誕節')).toEqual(day('2025-12-25'));
    expect(parse('元旦')).toEqual(day('2026-01-01'));
    expect(parse('中秋')).toEqual(day('2026-09-25'));
    expect(parse('中秋節')).toEqual(day('2026-09-25'));
    expect(parse('去年中秋')).toEqual(day('2025-10-06'));
    expect(parse('2025 中秋')).toEqual(day('2025-10-06'));
    expect(parse('過年')).toEqual(day('2026-02-17'));
    expect(parse('除夕')).toEqual(day('2026-02-16'));
  });

  it('leaves numeric dates and nonsense alone', () => {
    for (const q of ['', 'abc', '2025-11-08', '1999', '13月', '2/30', '吃麵'])
      expect(parse(q)).toBeUndefined();
  });
});

describe('localISODate', () => {
  it('uses the local calendar day', () => {
    expect(localISODate(new Date(2026, 9, 1, 23, 59))).toBe('2026-10-01');
  });
});
