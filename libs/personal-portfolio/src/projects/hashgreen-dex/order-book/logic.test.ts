import { describe, expect, it } from 'vitest';

import { levelKey, reconcileSelection } from './logic';

const MARKET = 'HGN-USDC';
const LEVEL_A = { price: 1.24, amount: 120, total: 148.8 };
const LEVEL_B = { price: 1.25, amount: 80, total: 100 };

describe('order-book logic — levelKey', () => {
  it('builds a deterministic key from market, price, amount, and total', () => {
    expect(levelKey(MARKET, LEVEL_A)).toBe('HGN-USDC:1.24:120:148.8');
  });

  it('produces different keys for different levels', () => {
    expect(levelKey(MARKET, LEVEL_A)).not.toBe(levelKey(MARKET, LEVEL_B));
  });
});

describe('order-book logic — reconcileSelection', () => {
  it('passes through a null selection unchanged', () => {
    expect(reconcileSelection(null, MARKET, [LEVEL_A, LEVEL_B])).toBeNull();
  });

  it('keeps the selection when its key still exists among the current levels', () => {
    const key = levelKey(MARKET, LEVEL_A);
    expect(reconcileSelection(key, MARKET, [LEVEL_A, LEVEL_B])).toBe(key);
  });

  it('clears the selection when its key no longer matches any current level (a ghost)', () => {
    const key = levelKey(MARKET, LEVEL_A);
    expect(reconcileSelection(key, MARKET, [LEVEL_B])).toBeNull();
  });

  it('clears the selection when the book is emptied entirely', () => {
    const key = levelKey(MARKET, LEVEL_A);
    expect(reconcileSelection(key, MARKET, [])).toBeNull();
  });
});
