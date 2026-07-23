import { describe, expect, it } from 'vitest';

import { prefersReducedMotion } from './useReducedMotion';

describe('prefersReducedMotion', () => {
  it('returns false when matchMedia is unavailable (jsdom/SSR)', () => {
    expect(prefersReducedMotion()).toBe(false);
  });
});
