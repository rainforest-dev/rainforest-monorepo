import { describe, expect, it } from 'vitest';

import { PORTFOLIO_LIB } from './index';

describe('portfolio lib', () => {
  it('exposes a lib marker', () => {
    expect(PORTFOLIO_LIB).toBe('@rainforest-dev/portfolio');
  });
});
