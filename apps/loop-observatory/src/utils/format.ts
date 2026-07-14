/** Shared display formatters for the usage dashboard. */

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const USD4 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 4,
});

const INT = new Intl.NumberFormat('en-US');

const COMPACT = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatUsd(n: number): string {
  return USD.format(n);
}

/** Small dollar amounts (e.g. per-day cost) keep more precision. */
export function formatUsdPrecise(n: number): string {
  return n !== 0 && Math.abs(n) < 0.01 ? USD4.format(n) : USD.format(n);
}

export function formatInt(n: number): string {
  return INT.format(n);
}

/** Compact token counts: 1_200_000 → "1.2M". */
export function formatTokens(n: number): string {
  return COMPACT.format(n);
}

export function formatPct(n: number): string {
  return `${n.toFixed(1)}%`;
}
