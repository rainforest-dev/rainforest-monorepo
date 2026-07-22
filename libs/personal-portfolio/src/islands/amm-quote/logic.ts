export interface SwapPool {
  reserveA: number;
  reserveB: number;
}

export interface SwapQuote {
  pay: number;
  receive: number;
  priceImpact: number; // fraction, e.g. 0.0012 == 0.12%
  fee: number;
  spot: number;
}

/** Pool fee φ — 300 bps. */
export const POOL_FEE = 0.03;

/** Safety margin ε applied against rounding/precision drift. */
export const SAFETY_MARGIN = 1e-5;

/**
 * Pyke is not constant-product (x·y=k) — this solves the log-space invariant
 * with pool fee φ and safety margin ε, mirroring `calcUserSwap` in
 * `utils/swap.ts`. Exact-out inverts the same invariant instead of running a
 * second approximation. Price impact is `|1 − actual/spot|`.
 */
export function calcUserSwap(
  pool: SwapPool,
  amount: number,
  exactIn: boolean,
): SwapQuote {
  const spot = pool.reserveB / pool.reserveA;
  if (!(amount > 0))
    return { pay: 0, receive: 0, priceImpact: 0, fee: 0, spot };

  if (exactIn) {
    const inAfterFee = amount * (1 - POOL_FEE);
    const out =
      ((pool.reserveB * inAfterFee) / (pool.reserveA + inAfterFee)) *
      (1 - SAFETY_MARGIN);
    return {
      pay: amount,
      receive: out,
      priceImpact: Math.abs(1 - out / amount / spot),
      fee: amount * POOL_FEE,
      spot,
    };
  }

  const out = Math.min(amount, pool.reserveB * 0.98);
  const dx =
    (pool.reserveA * out) /
    ((pool.reserveB - out) * (1 - POOL_FEE)) /
    (1 - SAFETY_MARGIN);
  return {
    pay: dx,
    receive: out,
    priceImpact: Math.abs(1 - out / dx / spot),
    fee: dx * POOL_FEE,
    spot,
  };
}

export interface SlippageBounds {
  minimumReceived: number;
  maximumSold: number;
}

/** Applies a slippage tolerance (percent, e.g. 0.5 for 0.5%) to a quote. */
export function applySlippage(
  quote: SwapQuote,
  slippagePct: number,
): SlippageBounds {
  return {
    minimumReceived: quote.receive * (1 - slippagePct / 100),
    maximumSold: quote.pay * (1 + slippagePct / 100),
  };
}
