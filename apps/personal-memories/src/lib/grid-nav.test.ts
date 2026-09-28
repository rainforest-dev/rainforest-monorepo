import { describe, expect, it } from 'vitest';

import { gridTarget, isGridKey, isGridLayout } from './grid-nav.ts';

const FIXTURE = ['2025-10-31', '2025-11-01', '2025-11-02', '2025-11-03'];

describe('gridTarget', () => {
  it('steps to the previous and next day with data, and stops at the ends', () => {
    expect(gridTarget(FIXTURE, '2025-11-01', 'ArrowLeft', 'year')).toBe(
      '2025-10-31',
    );
    expect(gridTarget(FIXTURE, '2025-11-01', 'ArrowRight', 'year')).toBe(
      '2025-11-02',
    );
    expect(
      gridTarget(FIXTURE, '2025-10-31', 'ArrowLeft', 'year'),
    ).toBeUndefined();
    expect(
      gridTarget(FIXTURE, '2025-11-03', 'ArrowRight', 'week'),
    ).toBeUndefined();
  });

  it('jumps to the first and last day with data on Home and End', () => {
    expect(gridTarget(FIXTURE, '2025-11-02', 'Home', 'year')).toBe(
      '2025-10-31',
    );
    expect(gridTarget(FIXTURE, '2025-11-02', 'End', 'list')).toBe('2025-11-03');
  });

  it('on the year, takes the same day in the next month row, else the nearest day with data', () => {
    const dates = ['2025-09-10', '2025-10-03', '2025-10-20', '2025-11-03'];
    expect(gridTarget(dates, '2025-10-03', 'ArrowDown', 'year')).toBe(
      '2025-11-03',
    );
    expect(gridTarget(dates, '2025-10-20', 'ArrowUp', 'year')).toBe(
      '2025-09-10',
    );
    expect(gridTarget(dates, '2025-11-03', 'ArrowUp', 'year')).toBe(
      '2025-10-03',
    );
    expect(gridTarget(FIXTURE, '2025-11-03', 'ArrowUp', 'year')).toBe(
      '2025-10-31',
    );
    expect(gridTarget(FIXTURE, '2025-10-31', 'ArrowDown', 'year')).toBe(
      '2025-11-03',
    );
  });

  it('breaks a tie between two equally near days toward the earlier one', () => {
    const dates = ['2025-10-08', '2025-10-12', '2025-11-10'];
    expect(gridTarget(dates, '2025-11-10', 'ArrowUp', 'year')).toBe(
      '2025-10-08',
    );
  });

  it('keeps going past a month row with no data, and stops past the last row', () => {
    const dates = ['2025-08-05', '2025-11-05'];
    expect(gridTarget(dates, '2025-11-05', 'ArrowUp', 'year')).toBe(
      '2025-08-05',
    );
    expect(gridTarget(dates, '2025-08-05', 'ArrowUp', 'year')).toBeUndefined();
    expect(
      gridTarget(dates, '2025-11-05', 'ArrowDown', 'year'),
    ).toBeUndefined();
  });

  it('on the month calendar (November 2025 starts on a Saturday), moves a week, else the nearest day in that week', () => {
    const dates = ['2025-11-01', '2025-11-02', '2025-11-03', '2025-11-10'];
    expect(gridTarget(dates, '2025-11-03', 'ArrowDown', 'week')).toBe(
      '2025-11-10',
    );
    expect(gridTarget(dates, '2025-11-10', 'ArrowUp', 'week')).toBe(
      '2025-11-03',
    );
    expect(gridTarget(dates, '2025-11-03', 'ArrowUp', 'week')).toBe(
      '2025-11-01',
    );
    expect(gridTarget(dates, '2025-11-01', 'ArrowDown', 'week')).toBe(
      '2025-11-03',
    );
  });

  it('on the phone list, moves one item at a time', () => {
    expect(gridTarget(FIXTURE, '2025-11-01', 'ArrowDown', 'list')).toBe(
      '2025-11-02',
    );
    expect(gridTarget(FIXTURE, '2025-11-01', 'ArrowUp', 'list')).toBe(
      '2025-10-31',
    );
  });

  it('ignores a date that is not in the grid, and copes with unsorted or repeated input', () => {
    expect(
      gridTarget(FIXTURE, '2025-12-01', 'ArrowDown', 'year'),
    ).toBeUndefined();
    expect(
      gridTarget(
        ['2025-11-03', '2025-11-01', '2025-11-01'],
        '2025-11-01',
        'ArrowRight',
        'list',
      ),
    ).toBe('2025-11-03');
  });
});

describe('isGridKey and isGridLayout', () => {
  it('accept only the grid keys and the three layouts', () => {
    for (const key of [
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ])
      expect(isGridKey(key)).toBe(true);
    expect(isGridKey('PageDown')).toBe(false);
    expect(isGridLayout('week')).toBe(true);
    expect(isGridLayout('grid')).toBe(false);
    expect(isGridLayout(undefined)).toBe(false);
  });
});
