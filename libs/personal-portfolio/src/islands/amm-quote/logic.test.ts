import { describe, expect, it } from 'vitest';

import {
  applySlippage,
  calcUserSwap,
  POOL_FEE,
  SAFETY_MARGIN,
  type SwapPool,
} from './logic';

const POOL: SwapPool = { reserveA: 82000, reserveB: 31160 };

describe('amm-quote logic — calcUserSwap (log-space invariant)', () => {
  it('returns an all-zero quote for a non-positive amount', () => {
    expect(calcUserSwap(POOL, 0, true)).toMatchObject({
      pay: 0,
      receive: 0,
      priceImpact: 0,
      fee: 0,
    });
    expect(calcUserSwap(POOL, -5, true)).toMatchObject({
      pay: 0,
      receive: 0,
    });
  });

  it('quotes exact-in: pays the typed amount, receives less than spot value', () => {
    const quote = calcUserSwap(POOL, 1000, true);
    expect(quote.pay).toBe(1000);
    const spot = POOL.reserveB / POOL.reserveA;
    // Received is strictly less than the naive spot-priced amount — the pool
    // fee and slippage both eat into it.
    expect(quote.receive).toBeLessThan(1000 * spot);
    expect(quote.receive).toBeGreaterThan(0);
  });

  it('charges the 300 bps pool fee on the input side for exact-in', () => {
    const quote = calcUserSwap(POOL, 1000, true);
    expect(quote.fee).toBeCloseTo(1000 * POOL_FEE, 9);
  });

  it('computes price impact as |1 - actual/spot|, growing with trade size', () => {
    const small = calcUserSwap(POOL, 10, true);
    const large = calcUserSwap(POOL, 10000, true);
    expect(small.priceImpact).toBeGreaterThan(0);
    expect(large.priceImpact).toBeGreaterThan(small.priceImpact);
  });

  it('exact-out inverts the same invariant instead of re-approximating', () => {
    const wantOut = 300;
    const quote = calcUserSwap(POOL, wantOut, false);
    expect(quote.receive).toBeCloseTo(wantOut, 6);
    expect(quote.pay).toBeGreaterThan(0);

    // Round-trip: quoting exact-in for the computed `pay` should recover
    // (approximately) the same `receive`, confirming both directions solve
    // the same invariant rather than two independent formulas.
    const roundTrip = calcUserSwap(POOL, quote.pay, true);
    expect(roundTrip.receive).toBeCloseTo(wantOut, 1);
  });

  it('applies the safety margin epsilon to shave the exact-in output', () => {
    const withMargin = calcUserSwap(POOL, 1000, true);
    const inAfterFee = 1000 * (1 - POOL_FEE);
    const withoutMargin =
      (POOL.reserveB * inAfterFee) / (POOL.reserveA + inAfterFee);
    expect(withMargin.receive).toBeCloseTo(
      withoutMargin * (1 - SAFETY_MARGIN),
      9,
    );
    expect(withMargin.receive).toBeLessThan(withoutMargin);
  });

  it('reports the pool spot price as reserveB / reserveA', () => {
    const quote = calcUserSwap(POOL, 1000, true);
    expect(quote.spot).toBeCloseTo(POOL.reserveB / POOL.reserveA, 12);
  });

  it('matches the golden reference case: 1000 XCH exact-in against the default pool', () => {
    // Hardcoded, independently-derived expected values (not recomputed from
    // the formula under test) — catches a formula that's internally
    // consistent but subtly wrong, which the other assertions above
    // (round-trips, relative comparisons) can't.
    const quote = calcUserSwap(POOL, 1000, true);
    expect(quote.receive).toBeCloseTo(364.29, 1);
    expect(quote.priceImpact * 100).toBeCloseTo(4.13, 1);
    expect(quote.fee).toBe(30);
  });
});

describe('amm-quote logic — applySlippage', () => {
  it('derives minimum received below the quote for exact-in tolerance', () => {
    const quote = calcUserSwap(POOL, 1000, true);
    const bounds = applySlippage(quote, 0.5);
    expect(bounds.minimumReceived).toBeCloseTo(quote.receive * 0.995, 9);
    expect(bounds.minimumReceived).toBeLessThan(quote.receive);
  });

  it('derives maximum sold above the quote for exact-out tolerance', () => {
    const quote = calcUserSwap(POOL, 300, false);
    const bounds = applySlippage(quote, 1);
    expect(bounds.maximumSold).toBeCloseTo(quote.pay * 1.01, 9);
    expect(bounds.maximumSold).toBeGreaterThan(quote.pay);
  });

  it('a zero tolerance leaves both bounds equal to the quote', () => {
    const quote = calcUserSwap(POOL, 1000, true);
    const bounds = applySlippage(quote, 0);
    expect(bounds.minimumReceived).toBeCloseTo(quote.receive, 9);
    expect(bounds.maximumSold).toBeCloseTo(quote.pay, 9);
  });
});
