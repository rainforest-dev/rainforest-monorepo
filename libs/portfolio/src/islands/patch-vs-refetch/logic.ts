export interface Order {
  id: string;
  market: string;
  status: string;
  side: 'buy' | 'sell';
  price: number;
  amount: number;
  age: string;
}

export interface OrderFilters {
  market: string; // 'all' or a market code
  status: string; // 'all' or a status
}

/**
 * The real question when a live fill event lands: does it still belong on
 * the page the user is looking at? `needRefetch()` is the negation of
 * "matches every active filter" — checkMarket && checkStatus. When it's
 * false, `checkUserOrderCached()` can swap just that row in place instead
 * of refetching the whole page.
 */
export function needsRefetch(order: Order, filters: OrderFilters): boolean {
  const checkMarket = filters.market === 'all' || order.market === filters.market;
  const checkStatus = filters.status === 'all' || order.status === filters.status;
  return !(checkMarket && checkStatus);
}

/**
 * Patch a single order's fields in place without touching the rest of the
 * page — the branch taken when `needsRefetch` is false. A no-op if the id
 * isn't present on the current page.
 */
export function patchOrder<T extends { id: string }>(
  rows: T[],
  updated: T,
): T[] {
  return rows.map((row) => (row.id === updated.id ? updated : row));
}
