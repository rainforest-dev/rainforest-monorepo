import { describe, expect, it } from 'vitest';

import { makeEvent } from './timeline.ts';
import {
  countBySource,
  dayHeading,
  diaryDate,
  groupByWeek,
  isoWeek,
  taipeiTime,
  weekSpan,
} from './weeks.ts';

const at = (iso: string, source: 'line' | 'slack' | 'photo' = 'line') =>
  makeEvent({ source, at: iso, author: 'A', text: iso });

describe('isoWeek', () => {
  it('uses the Taipei date, not UTC', () => {
    // Sunday 23:30 UTC is Monday 07:30 in Taipei.
    expect(isoWeek('2026-09-13T23:30:00Z')).toBe('2026-W38');
    expect(isoWeek('2026-09-13T23:30:00+08:00')).toBe('2026-W37');
  });

  it('assigns year-boundary days to the ISO year of their Thursday', () => {
    expect(isoWeek('2025-12-29T09:00:00+08:00')).toBe('2026-W01');
    expect(isoWeek('2027-01-01T09:00:00+08:00')).toBe('2026-W53');
    expect(isoWeek('2027-01-04T09:00:00+08:00')).toBe('2027-W01');
  });
});

describe('weekSpan', () => {
  it('returns Monday through Sunday', () => {
    expect(weekSpan('2026-W01')).toEqual(['2025-12-29', '2026-01-04']);
    expect(weekSpan('2026-W38')).toEqual(['2026-09-14', '2026-09-20']);
  });

  it('rejects malformed weeks', () => {
    expect(weekSpan('2026-38')).toBeUndefined();
  });
});

describe('groupByWeek', () => {
  const events = [
    at('2026-01-04T22:00:00+08:00', 'photo'), // Sunday, 2026-W01
    at('2025-12-28T23:59:00+08:00'), // Sunday, 2025-W52
    at('2026-01-05T00:01:00+08:00', 'slack'), // Monday, 2026-W02
    at('2025-12-31T16:30:00Z'), // 2026-01-01 00:30 Taipei, 2026-W01
    at('2025-12-29T08:00:00+08:00'), // Monday, 2026-W01
  ];
  const weeks = groupByWeek(events);
  const week = (key: string) => weeks.get(key) ?? new Map();

  it('splits across the year boundary and the Sunday→Monday boundary', () => {
    expect([...weeks.keys()]).toEqual(['2025-W52', '2026-W01', '2026-W02']);
    expect([...week('2026-W01').keys()]).toEqual([
      '2025-12-29',
      '2026-01-01',
      '2026-01-04',
    ]);
    expect([...week('2026-W02').keys()]).toEqual(['2026-01-05']);
  });

  it('keeps events ascending within a day', () => {
    const later = at('2026-01-01T12:00:00+08:00');
    const day = groupByWeek([later, ...events])
      .get('2026-W01')
      ?.get('2026-01-01');
    expect(day?.map((e) => e.at)).toEqual([
      '2025-12-31T16:30:00Z',
      '2026-01-01T12:00:00+08:00',
    ]);
  });

  it('counts events per source', () => {
    expect(countBySource(week('2026-W01'))).toEqual({
      line: 2,
      slack: 0,
      photo: 1,
    });
  });
});

describe('labels', () => {
  it('formats zh-TW day headings and Taipei times', () => {
    expect(dayHeading('2026-01-04')).toBe('2026-01-04（週日）');
    expect(dayHeading('2025-12-29')).toBe('2025-12-29（週一）');
    expect(taipeiTime('2025-12-31T16:30:00Z')).toBe('00:30');
  });

  it('splits a diary date into the big day and its weekday and year', () => {
    expect(diaryDate('2025-11-08')).toEqual({
      day: '11 月 8 日',
      meta: '週六 · 2025',
    });
    expect(diaryDate('2026-01-04')).toEqual({
      day: '1 月 4 日',
      meta: '週日 · 2026',
    });
  });
});
