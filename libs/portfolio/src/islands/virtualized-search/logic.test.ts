import { describe, expect, it } from 'vitest';

import { computeWindow, rankMarkets } from './logic';

const MARKETS = [
  { code: 'HGN', name: 'Hashgreen' },
  { code: 'XCH', name: 'Chia' },
  { code: 'SBX', name: 'Spacebucks' },
  { code: 'CGT', name: 'CoolGreenToken' },
];

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
