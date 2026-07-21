import { describe, expect, it } from 'vitest';

import {
  pairedAmount,
  type Pool,
  poolShareMath,
  splitZap,
  ZAP_SPLIT_RATIO,
} from './logic';

const POOL: Pool = { reserveA: 82000, reserveB: 31160, lpSupply: 1250000 };

describe('zap-liquidity logic — pairedAmount (balanced mode)', () => {
  it('pins side B to the reserve ratio when typing into side A', () => {
    const { amountA, amountB } = pairedAmount(POOL, 5000, 'a');
    expect(amountA).toBe(5000);
    expect(amountB).toBeCloseTo(5000 * (POOL.reserveB / POOL.reserveA), 9);
  });

  it('pins side A to the reserve ratio when typing into side B', () => {
    const { amountA, amountB } = pairedAmount(POOL, 1900, 'b');
    expect(amountB).toBe(1900);
    expect(amountA).toBeCloseTo(1900 / (POOL.reserveB / POOL.reserveA), 9);
  });

  it('round-trips: pairing A then re-pairing the derived B recovers A', () => {
    const fromA = pairedAmount(POOL, 3000, 'a');
    const fromB = pairedAmount(POOL, fromA.amountB, 'b');
    expect(fromB.amountA).toBeCloseTo(3000, 6);
  });
});

describe('zap-liquidity logic — splitZap', () => {
  it('splits the input evenly by the zap ratio', () => {
    expect(ZAP_SPLIT_RATIO).toBe(0.5);
    const { held, swapped } = splitZap(1000);
    expect(held).toBe(500);
    expect(swapped).toBe(500);
  });

  it('held + swapped always reconstitutes the original amount', () => {
    const { held, swapped } = splitZap(777);
    expect(held + swapped).toBeCloseTo(777, 9);
  });
});

describe('zap-liquidity logic — poolShareMath', () => {
  it('returns zero LP and zero share for a non-positive contribution', () => {
    expect(poolShareMath(POOL, 0)).toEqual({ lpMinted: 0, poolSharePct: 0 });
    expect(poolShareMath(POOL, -10)).toEqual({
      lpMinted: 0,
      poolSharePct: 0,
    });
  });

  it('mints LP proportional to the effective A-side contribution', () => {
    const { lpMinted } = poolShareMath(POOL, 8200); // 10% of reserveA
    expect(lpMinted).toBeCloseTo(POOL.lpSupply * 0.1, 6);
  });

  it('pool share reflects dilution: minted LP against the post-mint supply', () => {
    const { lpMinted, poolSharePct } = poolShareMath(POOL, 8200);
    const expectedShare = (lpMinted / (POOL.lpSupply + lpMinted)) * 100;
    expect(poolSharePct).toBeCloseTo(expectedShare, 9);
    // A depositor never owns >= 100% of the post-mint pool from one deposit
    // this size relative to existing reserves.
    expect(poolSharePct).toBeLessThan(100);
    expect(poolSharePct).toBeGreaterThan(0);
  });

  it('a larger contribution yields a larger pool share', () => {
    const small = poolShareMath(POOL, 1000);
    const large = poolShareMath(POOL, 20000);
    expect(large.poolSharePct).toBeGreaterThan(small.poolSharePct);
  });

  it('zap halves the effective contribution before minting, halving the LP', () => {
    const amount = 4000;
    const { held } = splitZap(amount);
    const zapResult = poolShareMath(POOL, held);
    const balancedResult = poolShareMath(POOL, amount);
    expect(zapResult.lpMinted).toBeCloseTo(balancedResult.lpMinted / 2, 6);
  });
});
