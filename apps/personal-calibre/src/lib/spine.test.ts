import { describe, expect, it } from 'vitest';

import { spineClass } from './spine';

describe('spineClass', () => {
  it('uses chart-(id % 5 + 1) mixed with muted', () => {
    expect(spineClass(5)).toContain('var(--chart-1)');
    expect(spineClass(4)).toContain('var(--chart-5)');
    expect(spineClass(4)).toContain('var(--muted)');
  });
});
