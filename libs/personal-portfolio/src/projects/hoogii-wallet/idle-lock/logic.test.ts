import { describe, expect, it } from 'vitest';

import { nextLockState } from './logic';

describe('idle-lock logic', () => {
  it('stays active while idle time is below the threshold', () => {
    expect(nextLockState(0, 5000)).toBe('active');
    expect(nextLockState(4999, 5000)).toBe('active');
  });

  it('locks once idle time reaches the threshold', () => {
    expect(nextLockState(5000, 5000)).toBe('locked');
  });

  it('locks when idle time exceeds the threshold', () => {
    expect(nextLockState(9000, 5000)).toBe('locked');
  });
});
