import { describe, expect, it } from 'vitest';

import { applyTransaction } from './logic';

describe('live-ledger logic', () => {
  it('prepends the new transaction as the newest entry', () => {
    const feed = ['b', 'a'];
    expect(applyTransaction(feed, 'c', 10)).toEqual(['c', 'b', 'a']);
  });

  it('caps the feed length, dropping the oldest entries', () => {
    const feed = ['c', 'b', 'a'];
    expect(applyTransaction(feed, 'd', 3)).toEqual(['d', 'c', 'b']);
  });

  it('does not mutate the input feed', () => {
    const feed = ['b', 'a'];
    const original = [...feed];
    applyTransaction(feed, 'c', 10);
    expect(feed).toEqual(original);
  });

  it('works with object entries, not just primitives', () => {
    const feed = [{ id: 2 }, { id: 1 }];
    const result = applyTransaction(feed, { id: 3 }, 2);
    expect(result).toEqual([{ id: 3 }, { id: 2 }]);
  });
});
