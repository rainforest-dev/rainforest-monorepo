export interface Pool {
  reserveA: number;
  reserveB: number;
  lpSupply: number;
}

export type AssetSide = 'a' | 'b';

export interface PairedAmounts {
  amountA: number;
  amountB: number;
}

/**
 * Balanced mode: `useAssetInputPair` pins the side you didn't type into to
 * the current reserve ratio, so the deposit always stays balanced.
 */
export function pairedAmount(
  pool: Pool,
  amount: number,
  side: AssetSide,
): PairedAmounts {
  const ratio = pool.reserveB / pool.reserveA;
  if (side === 'a') return { amountA: amount, amountB: amount * ratio };
  return { amountA: ratio > 0 ? amount / ratio : 0, amountB: amount };
}

/** Zap converts part of one asset before minting — modeled as an even split. */
export const ZAP_SPLIT_RATIO = 0.5;

export interface ZapSplit {
  held: number; // kept as asset A
  swapped: number; // converted to asset B before minting
}

export function splitZap(amount: number): ZapSplit {
  return {
    held: amount * ZAP_SPLIT_RATIO,
    swapped: amount * (1 - ZAP_SPLIT_RATIO),
  };
}

export interface PoolShareResult {
  lpMinted: number;
  poolSharePct: number; // 0-100
}

/**
 * `add_liquidity` / `add_liquidity_zap` pool-share math: LP minted is
 * proportional to the effective A-side contribution against the existing
 * reserve; pool share is the minted LP against the post-mint total supply.
 */
export function poolShareMath(
  pool: Pool,
  effectiveAmountA: number,
): PoolShareResult {
  if (!(effectiveAmountA > 0) || pool.reserveA <= 0) {
    return { lpMinted: 0, poolSharePct: 0 };
  }
  const lpMinted = pool.lpSupply * (effectiveAmountA / pool.reserveA);
  const poolSharePct = (lpMinted / (pool.lpSupply + lpMinted)) * 100;
  return { lpMinted, poolSharePct };
}
