import { describe, expect, it } from 'vitest';

import { rank } from './logic';

const ITEMS = ['Spacebucks', 'xSpacebucks wrapped', 'Marmot', 'Chia Wolf'];

describe('fuzzy-search logic', () => {
  it('ranks a near-match (prefix) above a weaker match (substring elsewhere), both within threshold', () => {
    const results = rank('spacebuck', ITEMS);
    expect(results.indexOf('Spacebucks')).toBeLessThan(
      results.indexOf('xSpacebucks wrapped'),
    );
    expect(results).toContain('Spacebucks');
    expect(results).toContain('xSpacebucks wrapped');
  });

  it('filters out a clearly-unrelated item at the default threshold', () => {
    const results = rank('spacebuck', ITEMS);
    expect(results).not.toContain('Marmot');
    expect(results).not.toContain('Chia Wolf');
  });

  it('returns the full list, unfiltered, for an empty query', () => {
    expect(rank('', ITEMS)).toEqual(ITEMS);
    expect(rank('   ', ITEMS)).toEqual(ITEMS);
  });

  it('respects a looser threshold to admit weaker (gappy subsequence) matches', () => {
    const strict = rank('abc', ['aXbXcXXXXX'], 0.05);
    const loose = rank('abc', ['aXbXcXXXXX'], 0.5);
    expect(strict).toEqual([]);
    expect(loose).toEqual(['aXbXcXXXXX']);
  });
});
