export interface Level {
  price: number;
  amount: number;
  total: number;
}

/**
 * Deterministic key for a price level — mirrors the real reconciliation
 * `useEffect`'s `key(market, price, amount, total)`.
 */
export function levelKey(market: string, level: Level): string {
  return `${market}:${level.price}:${level.amount}:${level.total}`;
}

/**
 * The reconciliation invariant: a trader must never act on a level that has
 * already moved. If the selected key is no longer present among the current
 * levels — the row it anchored to was replaced or removed — the selection
 * (and its offer tooltip) clears. Otherwise the selection is unaffected.
 */
export function reconcileSelection(
  selectedKey: string | null,
  market: string,
  levels: Level[],
): string | null {
  if (selectedKey === null) return null;
  const stillExists = levels.some(
    (level) => levelKey(market, level) === selectedKey,
  );
  return stillExists ? selectedKey : null;
}
