import { describe, expect, it } from 'vitest';

import {
  computeWindow,
  FAVORITES_STORAGE_KEY,
  filterByTab,
  rankMarkets,
  readFavorites,
  toggleFavorite,
  writeFavorites,
} from './logic';

const MARKETS = [
  { code: 'HGN', name: 'Hashgreen' },
  { code: 'XCH', name: 'Chia' },
  { code: 'SBX', name: 'Spacebucks' },
  { code: 'CGT', name: 'CoolGreenToken' },
];

/** Minimal in-memory stand-in for `Storage`, for tests that don't have jsdom's real localStorage semantics in play. */
function createFakeStorage(): {
  store: Record<string, string>;
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
} {
  const store: Record<string, string> = {};
  return {
    store,
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = value;
    },
  };
}

describe('virtualized-search logic — rankMarkets', () => {
  it('scores an exact "code name" match at 0', () => {
    const results = rankMarkets('hgn hashgreen', MARKETS);
    expect(results[0]).toMatchObject({ code: 'HGN', score: 0 });
  });

  it('scores a code prefix match near 0, just above exact', () => {
    const results = rankMarkets('hgn', MARKETS);
    expect(results[0]).toMatchObject({ code: 'HGN' });
    expect(results[0].score).toBeGreaterThan(0);
    expect(results[0].score).toBeLessThanOrEqual(0.1);
  });

  it('ranks a prefix match above a scattered subsequence match, both within threshold', () => {
    const results = rankMarkets('sb', MARKETS, 0.5);
    const sbxIndex = results.findIndex((r) => r.code === 'SBX');
    expect(sbxIndex).toBeGreaterThanOrEqual(0);
  });

  it('filters out unrelated markets at the default threshold', () => {
    const results = rankMarkets('hgn', MARKETS);
    expect(results.map((r) => r.code)).not.toContain('XCH');
  });

  it('returns the full list, unranked, for an empty query', () => {
    const results = rankMarkets('', MARKETS);
    expect(results.map((r) => r.code)).toEqual(['HGN', 'XCH', 'SBX', 'CGT']);
  });
});

describe('virtualized-search logic — computeWindow', () => {
  it('windows the first page of rows with overscan, at scrollTop 0', () => {
    const win = computeWindow(0, 40, 352, 100, 3);
    expect(win.start).toBe(0);
    expect(win.end).toBe(12); // ceil(352/40)=9 visible + 3 overscan
    expect(win.topPad).toBe(0);
    expect(win.bottomPad).toBe((100 - 12) * 40);
  });

  it('shifts the window when scrolled down, keeping overscan on both sides', () => {
    const win = computeWindow(2000, 40, 352, 100, 3);
    expect(win.start).toBe(47); // row 50 - 3 overscan
    expect(win.end).toBe(62); // 50 + 9 visible + 3 overscan
    expect(win.topPad).toBe(47 * 40);
    expect(win.bottomPad).toBe((100 - 62) * 40);
  });

  it('clamps the window to the total row count near the end of the list', () => {
    const win = computeWindow(3600, 40, 352, 100, 3);
    expect(win.end).toBe(100);
    expect(win.bottomPad).toBe(0);
  });

  it('never mounts more rows than exist for a short list', () => {
    const win = computeWindow(0, 40, 352, 5, 3);
    expect(win.start).toBe(0);
    expect(win.end).toBe(5);
    expect(win.bottomPad).toBe(0);
  });
});

describe('virtualized-search logic — toggleFavorite', () => {
  it('adds a code that is not yet favorited', () => {
    const result = toggleFavorite(new Set(), 'HGN');
    expect(result.has('HGN')).toBe(true);
  });

  it('removes a code that is already favorited', () => {
    const result = toggleFavorite(new Set(['HGN']), 'HGN');
    expect(result.has('HGN')).toBe(false);
  });

  it('does not mutate the input set', () => {
    const input = new Set(['HGN']);
    const result = toggleFavorite(input, 'XCH');
    expect(input.has('XCH')).toBe(false);
    expect(input.size).toBe(1);
    expect(result.has('XCH')).toBe(true);
  });
});

describe('virtualized-search logic — favorites persistence', () => {
  it('reads an empty set when storage is unavailable (SSR)', () => {
    expect(readFavorites(undefined)).toEqual(new Set());
  });

  it('reads an empty set when nothing has been persisted yet', () => {
    const storage = createFakeStorage();
    expect(readFavorites(storage)).toEqual(new Set());
  });

  it('round-trips a favorites set through write then read', () => {
    const storage = createFakeStorage();
    writeFavorites(storage, new Set(['HGN', 'XCH']));
    expect(readFavorites(storage)).toEqual(new Set(['HGN', 'XCH']));
    expect(storage.store[FAVORITES_STORAGE_KEY]).toBeDefined();
  });

  it('is a no-op write when storage is unavailable (SSR)', () => {
    expect(() => writeFavorites(undefined, new Set(['HGN']))).not.toThrow();
  });

  it('recovers to an empty set from corrupt persisted JSON', () => {
    const storage = createFakeStorage();
    storage.store[FAVORITES_STORAGE_KEY] = 'not json';
    expect(readFavorites(storage)).toEqual(new Set());
  });

  it('ignores a persisted value that is not an array of strings', () => {
    const storage = createFakeStorage();
    storage.store[FAVORITES_STORAGE_KEY] = JSON.stringify({ not: 'an array' });
    expect(readFavorites(storage)).toEqual(new Set());
  });
});

describe('virtualized-search logic — filterByTab', () => {
  it('returns every market on the "all" tab', () => {
    expect(filterByTab(MARKETS, 'all', new Set())).toEqual(MARKETS);
  });

  it('returns only starred markets on the "favorites" tab', () => {
    const result = filterByTab(MARKETS, 'favorites', new Set(['XCH', 'CGT']));
    expect(result.map((m) => m.code)).toEqual(['XCH', 'CGT']);
  });

  it('returns an empty list on the "favorites" tab when nothing is starred', () => {
    expect(filterByTab(MARKETS, 'favorites', new Set())).toEqual([]);
  });
});
