import { describe, expect, it } from 'vitest';

import {
  formatSwapSummary,
  SWAP_LOCALES,
  type SwapSummaryValues,
} from './logic';

const VALUES: SwapSummaryValues = {
  pay: 1000,
  payAsset: 'XCH',
  receive: 364.29,
  receiveAsset: 'hUSDC',
  minReceive: 362.47,
  priceImpactPct: 4.13,
  fee: 30,
  feeAsset: 'XCH',
  estUsd: 364.29,
};

describe('i18n-card logic — formatSwapSummary', () => {
  it('supports exactly EN / Simplified / Traditional Chinese', () => {
    expect(SWAP_LOCALES).toEqual(['en', 'zh-CN', 'zh-TW']);
  });

  it('titles and labels switch per locale', () => {
    const en = formatSwapSummary('en', VALUES);
    const zhCN = formatSwapSummary('zh-CN', VALUES);
    const zhTW = formatSwapSummary('zh-TW', VALUES);
    expect(en.title).toBe('Swap summary');
    expect(zhCN.title).toBe('交易摘要');
    expect(zhTW.title).toBe('交易摘要');
    // Simplified and traditional share the title glyphs here but diverge on
    // at least one label (获得 vs 獲得).
    expect(zhCN.rows[1].label).not.toBe(zhTW.rows[1].label);
  });

  it('produces five rows in a stable order: pay, receive, min, impact, fee', () => {
    const { rows } = formatSwapSummary('en', VALUES);
    expect(rows.map((r) => r.label)).toEqual([
      'You pay',
      'You receive',
      'Minimum received',
      'Price impact',
      'Liquidity fee',
    ]);
  });

  it('formats large numbers with locale-aware grouping', () => {
    const { rows } = formatSwapSummary('en', { ...VALUES, pay: 12345.6 });
    expect(rows[0].value).toContain('12,345.60');
  });

  it('formats the estimated value as locale-aware currency', () => {
    const en = formatSwapSummary('en', VALUES);
    const zhCN = formatSwapSummary('zh-CN', VALUES);
    expect(en.estValue).toContain('364.29');
    expect(zhCN.estValue).toContain('364.29');
    // Currency symbol placement/format differs by locale (CLDR), so the two
    // rendered strings should not be byte-identical.
    expect(en.estValue).not.toBe(zhCN.estValue);
  });

  it('falls back to English for an unrecognized locale key', () => {
    // @ts-expect-error deliberately unknown locale
    const fallback = formatSwapSummary('fr', VALUES);
    expect(fallback.title).toBe('Swap summary');
  });
});
