import { describe, expect, it } from 'vitest';

import { formatBytes, seriesLine, yearOf } from './format';

describe('format', () => {
  it('formats sizes', () => {
    expect(formatBytes(0)).toBe('');
    expect(formatBytes(900)).toBe('900 B');
    expect(formatBytes(4096)).toBe('4 KB');
    expect(formatBytes(3_500_000)).toBe('3.3 MB');
  });

  it('writes the series line', () => {
    expect(seriesLine('Tidewater Cycle', 2)).toBe('Tidewater Cycle · Book 2');
    expect(seriesLine('Tidewater Cycle', 2.5)).toBe(
      'Tidewater Cycle · Book 2.5',
    );
    expect(seriesLine('Tidewater Cycle', null)).toBe('Tidewater Cycle');
  });

  it('reads a year and drops Calibre’s undefined date', () => {
    expect(yearOf('2001-04-15T00:00:00+00:00')).toBe('2001');
    expect(yearOf('0101-01-01T00:00:00+00:00')).toBeNull();
    expect(yearOf(null)).toBeNull();
  });
});
