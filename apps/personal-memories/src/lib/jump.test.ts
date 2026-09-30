import { describe, expect, it } from 'vitest';

import { groupByMonth, jumpTarget, matchDates, queryPrefixes } from './jump.ts';

const DATES = [
  '2025-10-31',
  '2025-11-01',
  '2025-11-02',
  '2025-11-10',
  '2026-01-01',
];

describe('queryPrefixes', () => {
  it('normalises separators and pads closed parts', () => {
    expect(queryPrefixes('')).toEqual(['']);
    expect(queryPrefixes('2025')).toEqual(['2025']);
    expect(queryPrefixes('202')).toEqual(['202']);
    expect(queryPrefixes('2025/11/01')).toEqual(['2025-11-01']);
    expect(queryPrefixes('20251101')).toEqual(['2025-11-01']);
    expect(queryPrefixes('2025年11月')).toEqual(['2025-11']);
    expect(queryPrefixes('2025-11-')).toEqual(['2025-11']);
  });

  it('keeps an open single digit as both a padded value and a prefix', () => {
    expect(queryPrefixes('2025-1')).toEqual(['2025-01', '2025-1']);
    expect(queryPrefixes('2025.11.1')).toEqual(['2025-11-01', '2025-11-1']);
  });

  it('rejects what cannot be a date', () => {
    expect(queryPrefixes('abc')).toEqual([]);
    expect(queryPrefixes('2025-111')).toEqual([]);
    expect(queryPrefixes('12-01')).toEqual([]);
  });
});

describe('matchDates and groupByMonth', () => {
  it('matches every prefix and groups by month in order', () => {
    expect(matchDates(DATES, '2025-11-1')).toEqual([
      '2025-11-01',
      '2025-11-10',
    ]);
    expect(matchDates(DATES, '')).toEqual(DATES);
    expect(matchDates(DATES, 'abc')).toEqual([]);
    expect(groupByMonth(['2025-10-31', '2025-11-01', '2025-11-02'])).toEqual([
      { month: '2025-10', dates: ['2025-10-31'] },
      { month: '2025-11', dates: ['2025-11-01', '2025-11-02'] },
    ]);
  });
});

describe('jumpTarget', () => {
  it('goes to the first match', () => {
    expect(jumpTarget(DATES, '2025/11/2')).toEqual({
      date: '2025-11-02',
      exact: true,
    });
  });

  it('goes to the nearest day for a missing, partial or impossible date', () => {
    expect(jumpTarget(DATES, '2025-11-20')).toEqual({
      date: '2025-11-10',
      exact: false,
    });
    expect(jumpTarget(DATES, '1999')).toEqual({
      date: '2025-10-31',
      exact: false,
    });
    expect(jumpTarget(DATES, '2025-13')).toEqual({
      date: '2026-01-01',
      exact: false,
    });
  });

  it('gives up on nonsense or no data', () => {
    expect(jumpTarget(DATES, 'abc')).toBeUndefined();
    expect(jumpTarget([], '2025-11-01')).toBeUndefined();
  });
});
