import { describe, expect, it } from 'vitest';

import { morphAttrs, morphKey, refererPath } from './zoom.ts';

const YEAR = { level: 'year' } as const;
const NOV = { level: 'month', month: '2025-11' } as const;
const DAY = { level: 'day', date: '2025-11-03' } as const;

describe('morphKey', () => {
  it('ties a day to its heat cell and to its month cell, both ways', () => {
    expect(morphKey(YEAR, DAY)).toBe('day-2025-11-03');
    expect(morphKey(DAY, YEAR)).toBe('day-2025-11-03');
    expect(morphKey(NOV, DAY)).toBe('day-2025-11-03');
    expect(morphKey(DAY, NOV)).toBe('day-2025-11-03');
  });

  it('ties a month to its heatmap row', () => {
    expect(morphKey(YEAR, NOV)).toBe('month-2025-11');
    expect(morphKey(NOV, YEAR)).toBe('month-2025-11');
  });

  it('names nothing for sideways moves, other months or unknown pages', () => {
    expect(morphKey(DAY, { level: 'month', month: '2025-12' })).toBeUndefined();
    expect(morphKey(NOV, { level: 'month', month: '2025-12' })).toBeUndefined();
    expect(morphKey(DAY, { level: 'day', date: '2025-11-04' })).toBeUndefined();
    expect(morphKey(undefined, DAY)).toBeUndefined();
  });
});

describe('refererPath', () => {
  it('accepts only a same-host referer', () => {
    expect(
      refererPath('http://127.0.0.1:3024/month/2025-11', '127.0.0.1:3024'),
    ).toBe('/month/2025-11');
    expect(
      refererPath('https://elsewhere.example/', '127.0.0.1:3024'),
    ).toBeUndefined();
    expect(refererPath('not a url', '127.0.0.1:3024')).toBeUndefined();
    expect(refererPath(null, '127.0.0.1:3024')).toBeUndefined();
  });
});

describe('morphAttrs', () => {
  it('names only the element that matches', () => {
    expect(morphAttrs('day-2025-11-03', 'day-2025-11-03')).toEqual({
      style: 'view-transition-name: day-2025-11-03',
      'data-morph-target': '',
    });
    expect(morphAttrs('day-2025-11-03', undefined)).toEqual({});
  });
});
