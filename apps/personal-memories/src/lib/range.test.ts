import { describe, expect, it } from 'vitest';

import { parseRange } from './range.ts';

describe('parseRange', () => {
  it('returns undefined for no range header', () => {
    expect(parseRange(undefined, 100)).toBeUndefined();
    expect(parseRange(null, 100)).toBeUndefined();
    expect(parseRange('', 100)).toBeUndefined();
  });

  it('parses a start-end range', () => {
    expect(parseRange('bytes=0-9', 100)).toEqual({ start: 0, end: 9 });
    expect(parseRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 });
  });

  it('parses an open-ended range to the end of the resource', () => {
    expect(parseRange('bytes=90-', 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange('bytes=0-', 100)).toEqual({ start: 0, end: 99 });
  });

  it('parses a suffix range for the last N bytes', () => {
    expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange('bytes=-500', 100)).toEqual({ start: 0, end: 99 });
  });

  it('clamps an end past the resource size', () => {
    expect(parseRange('bytes=50-999', 100)).toEqual({ start: 50, end: 99 });
  });

  it('rejects a range starting at or past the resource size', () => {
    expect(parseRange('bytes=100-199', 100)).toBe('unsatisfiable');
    expect(parseRange('bytes=150-', 100)).toBe('unsatisfiable');
  });

  it('rejects an inverted range', () => {
    expect(parseRange('bytes=50-10', 100)).toBe('unsatisfiable');
  });

  it('rejects a zero-length suffix and an empty resource', () => {
    expect(parseRange('bytes=-0', 100)).toBe('unsatisfiable');
    expect(parseRange('bytes=0-9', 0)).toBe('unsatisfiable');
  });

  it('ignores a header it does not recognize', () => {
    expect(parseRange('items=0-9', 100)).toBeUndefined();
    expect(parseRange('bytes=0-9,20-29', 100)).toBeUndefined();
    expect(parseRange('bytes=-', 100)).toBeUndefined();
  });
});
