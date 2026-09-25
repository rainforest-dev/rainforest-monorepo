import { describe, expect, it } from 'vitest';

import { levelHrefs, placeOf, zoomOutHref } from './nav.ts';

describe('placeOf', () => {
  it('reads the three zoom levels from a path', () => {
    expect(placeOf('/')).toEqual({ level: 'year' });
    expect(placeOf('/month/2025-11')).toEqual({
      level: 'month',
      month: '2025-11',
    });
    expect(placeOf('/day/2025-11-01')).toEqual({
      level: 'day',
      date: '2025-11-01',
    });
  });

  it('ignores every other path', () => {
    for (const path of [
      '',
      '/month/2025-13',
      '/day/2025-11-01/partial',
      '/week/2025-W44',
      '/media/x',
    ])
      expect(placeOf(path)).toBeUndefined();
  });
});

describe('zoomOutHref', () => {
  it('goes day → month → year and stops there', () => {
    expect(zoomOutHref({ level: 'day', date: '2025-11-03' })).toBe(
      '/month/2025-11',
    );
    expect(zoomOutHref({ level: 'month', month: '2025-11' })).toBe('/');
    expect(zoomOutHref({ level: 'year' })).toBeUndefined();
  });
});

describe('levelHrefs', () => {
  const dates = ['2025-10-31', '2025-11-01', '2025-11-03'];

  it('on a day, points at that day and its month', () => {
    expect(levelHrefs({ level: 'day', date: '2025-11-03' }, [])).toEqual({
      year: '/',
      month: '/month/2025-11',
      day: '/day/2025-11-03',
    });
  });

  it('on a month, opens its first day with events, else the nearest day', () => {
    expect(levelHrefs({ level: 'month', month: '2025-11' }, dates).day).toBe(
      '/day/2025-11-01',
    );
    expect(levelHrefs({ level: 'month', month: '2025-12' }, dates).day).toBe(
      '/day/2025-11-03',
    );
  });

  it('on the year, opens the latest month and day, and points home without data', () => {
    expect(levelHrefs({ level: 'year' }, dates)).toEqual({
      year: '/',
      month: '/month/2025-11',
      day: '/day/2025-11-03',
    });
    expect(levelHrefs({ level: 'year' }, [])).toEqual({
      year: '/',
      month: '/',
      day: '/',
    });
  });
});
