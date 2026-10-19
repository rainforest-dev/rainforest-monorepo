import { describe, expect, it } from 'vitest';

import { hexToRgb, spineColor } from './spine';

describe('spine colours', () => {
  it('reads six-digit, shorthand and alpha hex', () => {
    expect(hexToRgb('#3e7d7d')).toEqual([62, 125, 125]);
    expect(hexToRgb('#fff')).toEqual([255, 255, 255]);
    expect(hexToRgb('#00000080')).toEqual([0, 0, 0]);
  });

  it('mixes toward the muted token', () => {
    expect(spineColor('#123456')).toBe(
      'color-mix(in oklch, #123456 55%, var(--muted))',
    );
  });
});
