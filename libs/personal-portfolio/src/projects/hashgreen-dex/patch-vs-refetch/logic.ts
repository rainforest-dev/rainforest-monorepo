export interface Order {
  id: string;
  market: string;
  status: string;
  side: 'buy' | 'sell';
  price: number;
  amount: number;
  age: string; // display string, e.g. "2m", "5d" — derived from ageMinutes
  ageMinutes: number; // minutes since the order was placed — drives the date-range filter
}

export interface OrderFilters {
  market: string; // 'all' or a market code
  status: string; // 'all' or a status
  range: string; // 'all' | 'today' | 'week'
}

const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

/** checkMarket: the market filter is either "all" or names this order's market. */
export function matchesMarket(order: Order, filters: OrderFilters): boolean {
  return filters.market === 'all' || order.market === filters.market;
}

/** checkStatus: the status filter is either "all" or names this order's status. */
export function matchesStatus(order: Order, filters: OrderFilters): boolean {
  return filters.status === 'all' || order.status === filters.status;
}

/** checkDateRange: whether the order's age falls within the selected window. */
export function matchesDateRange(order: Order, filters: OrderFilters): boolean {
  if (filters.range === 'today') return order.ageMinutes <= MINUTES_PER_DAY;
  if (filters.range === 'week') return order.ageMinutes <= MINUTES_PER_WEEK;
  return true; // 'all'
}

/**
 * Whether an order matches every active filter — the real
 * `checkMarket && checkStatus && checkDateRange` conjunction.
 */
export function matchesFilters(order: Order, filters: OrderFilters): boolean {
  return (
    matchesMarket(order, filters) &&
    matchesStatus(order, filters) &&
    matchesDateRange(order, filters)
  );
}

/**
 * The real question when a live fill event lands: does it still belong on
 * the page the user is looking at? `needRefetch()` is the negation of
 * `matchesFilters` — checkMarket && checkStatus && checkDateRange. When
 * it's false, `checkUserOrderCached()` can swap just that row in place
 * instead of refetching the whole page.
 */
export function needsRefetch(order: Order, filters: OrderFilters): boolean {
  return !matchesFilters(order, filters);
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
