import { describe, expect, it } from 'vitest';

import { approach, hexToRgb, seedOf } from './colors.ts';

describe('hexToRgb', () => {
  it('reads six- and eight-digit hex and rejects anything else', () => {
    expect(hexToRgb('#ff0080')).toEqual([1, 0, 128 / 255]);
    expect(hexToRgb('FFFFFF80')).toEqual([1, 1, 1]);
    expect(hexToRgb('rgb(1 2 3)')).toBeUndefined();
  });
});

describe('seedOf', () => {
  it('is stable and stays in [0, 1]', () => {
    expect(seedOf('day:2026-11-13')).toBe(seedOf('day:2026-11-13'));
    expect(seedOf('a')).not.toBe(seedOf('b'));
    for (const s of ['', 'x', 'photo:abc']) {
      expect(seedOf(s)).toBeGreaterThanOrEqual(0);
      expect(seedOf(s)).toBeLessThanOrEqual(1);
    }
  });
});

describe('approach', () => {
  it('eases toward the target without overshooting', () => {
    expect(approach(1, 3, 0.1)).toBeCloseTo(1.8);
    expect(approach(1, 3, 10)).toBe(3);
  });
});
