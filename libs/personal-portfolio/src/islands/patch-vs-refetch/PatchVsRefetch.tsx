import { type JSX, useState } from 'react';

import { button } from '../_shared/ui';
import {
  matchesDateRange,
  matchesFilters,
  matchesMarket,
  matchesStatus,
  needsRefetch,
  type Order,
  type OrderFilters,
  patchOrder,
} from './logic';

const MARKET_OPTS = ['all', 'HGN-USDC', 'XCH-USDC', 'SBX-USDC'];
const STATUS_OPTS = ['all', 'Active', 'Filled', 'Cancelled'];
const RANGE_OPTS: { value: string; label: string }[] = [
  { value: 'all', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
];
const PAGE_SIZE = 5;

/**
 * Fabricated order history — cosmetic only, never a real position.
 * `ageMinutes` is spread across today / this-week / older-than-a-week so
 * the date-range filter (and the "simulate a fill" branch readout) has
 * something real to demonstrate, not just market/status.
 */
const INITIAL_ORDERS: Order[] = [
  { id: 'ORD-101', market: 'HGN-USDC', status: 'Active', side: 'buy', price: 1.2401, amount: 120, age: '2m', ageMinutes: 2 },
  { id: 'ORD-102', market: 'HGN-USDC', status: 'Active', side: 'sell', price: 1.2489, amount: 60, age: '4h', ageMinutes: 240 },
  { id: 'ORD-103', market: 'XCH-USDC', status: 'Filled', side: 'buy', price: 18.2, amount: 5, age: '9m', ageMinutes: 9 },
  { id: 'ORD-104', market: 'SBX-USDC', status: 'Active', side: 'buy', price: 0.041, amount: 4000, age: '5d', ageMinutes: 8000 },
  { id: 'ORD-105', market: 'HGN-USDC', status: 'Cancelled', side: 'sell', price: 1.26, amount: 30, age: '14m', ageMinutes: 14 },
  { id: 'ORD-106', market: 'XCH-USDC', status: 'Active', side: 'sell', price: 18.55, amount: 8, age: '16m', ageMinutes: 16 },
  { id: 'ORD-107', market: 'SBX-USDC', status: 'Filled', side: 'sell', price: 0.039, amount: 2200, age: '19m', ageMinutes: 19 },
  { id: 'ORD-108', market: 'HGN-USDC', status: 'Active', side: 'buy', price: 1.235, amount: 200, age: '22m', ageMinutes: 22 },
  { id: 'ORD-109', market: 'XCH-USDC', status: 'Cancelled', side: 'buy', price: 17.9, amount: 3, age: '27m', ageMinutes: 27 },
  { id: 'ORD-110', market: 'SBX-USDC', status: 'Active', side: 'sell', price: 0.043, amount: 1500, age: '14d', ageMinutes: 20000 },
];

interface Readout {
  orderId: string;
  market: string;
  matchMarket: boolean;
  matchStatus: boolean;
  matchDateRange: boolean;
  branch: 'PATCH-IN-PLACE' | 'PAGE-REFETCH';
  note: string;
}

export function PatchVsRefetch(): JSX.Element {
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [filters, setFilters] = useState<OrderFilters>({
    market: 'all',
    status: 'all',
    range: 'all',
  });
  const [page, setPage] = useState(0);
  const [readout, setReadout] = useState<Readout | null>(null);

  const filtered = orders.filter((order) => matchesFilters(order, filters));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages - 1);
  const rows = filtered.slice(
    clampedPage * PAGE_SIZE,
    clampedPage * PAGE_SIZE + PAGE_SIZE,
  );

  const handleFilterChange = (next: Partial<OrderFilters>) => {
    setFilters((prev) => ({ ...prev, ...next }));
    setPage(0);
  };

  const handleSimulateFill = () => {
    const activeOrders = orders.filter((order) => order.status === 'Active');
    if (activeOrders.length === 0) return;
    const target = activeOrders[Math.floor(Math.random() * activeOrders.length)];
    // Only status flips on a fill — ageMinutes is the order's placement
    // time, which a fill doesn't change, so the date-range check stays
    // meaningful (an old order can still fill; it just won't show up under
    // a narrow "today" filter).
    const updated: Order = { ...target, status: 'Filled' };

    const refetch = needsRefetch(updated, filters);
    setOrders((prev) => patchOrder(prev, updated));
    setReadout({
      orderId: updated.id,
      market: updated.market,
      matchMarket: matchesMarket(updated, filters),
      matchStatus: matchesStatus(updated, filters),
      matchDateRange: matchesDateRange(updated, filters),
      branch: refetch ? 'PAGE-REFETCH' : 'PATCH-IN-PLACE',
      note: refetch
        ? 'This event no longer matches the active filters, so the page refetches instead of trusting a stale row.'
        : 'This event still matches every active filter, so only this row updates in place.',
    });
    if (refetch) setPage(0);
  };

  return (
    <div className="border-border bg-card text-card-foreground rounded-xl border p-6">
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          market
          <select
            value={filters.market}
            onChange={(event) => handleFilterChange({ market: event.target.value })}
            className="border-border bg-muted/40 text-foreground h-8 min-w-32 rounded-md border pl-2 pr-8 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {MARKET_OPTS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'all' ? 'All markets' : opt}
              </option>
            ))}
          </select>
        </label>
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          status
          <select
            value={filters.status}
            onChange={(event) => handleFilterChange({ status: event.target.value })}
            className="border-border bg-muted/40 text-foreground h-8 min-w-32 rounded-md border pl-2 pr-8 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {STATUS_OPTS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'all' ? 'All statuses' : opt}
              </option>
            ))}
          </select>
        </label>
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          placed
          <select
            value={filters.range}
            onChange={(event) => handleFilterChange({ range: event.target.value })}
            className="border-border bg-muted/40 text-foreground h-8 min-w-32 rounded-md border pl-2 pr-8 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {RANGE_OPTS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="text-muted-foreground mb-1 grid grid-cols-6 gap-2 px-2 font-mono text-[11px] uppercase">
        <span>order</span>
        <span>market</span>
        <span className="text-right">price</span>
        <span className="text-right">amount</span>
        <span>status</span>
        <span className="text-right">age</span>
      </div>

      <div role="table" aria-label="Order history" className="flex min-h-[10rem] flex-col gap-1">
        {rows.map((order) => (
          <div
            key={order.id}
            role="row"
            className="border-border/60 grid grid-cols-6 items-center gap-2 rounded-md border-b px-2 py-1.5 font-mono text-xs"
          >
            <span className="text-muted-foreground">{order.id}</span>
            <span className="text-foreground">{order.market}</span>
            <span
              className={`text-right ${order.side === 'buy' ? 'text-primary' : 'text-destructive'}`}
            >
              {order.side} {order.price}
            </span>
            <span className="text-foreground text-right">{order.amount}</span>
            <span className="text-muted-foreground">{order.status}</span>
            <span className="text-muted-foreground text-right">{order.age}</span>
          </div>
        ))}
        {rows.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No orders match these filters.
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setPage((prev) => Math.max(0, prev - 1))}
          disabled={clampedPage === 0}
          aria-label="Previous page"
          className={button({ variant: 'outline', size: 'icon' })}
        >
          ←
        </button>
        <span className="text-muted-foreground font-mono text-xs">
          page {clampedPage + 1} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
          disabled={clampedPage >= totalPages - 1}
          aria-label="Next page"
          className={button({ variant: 'outline', size: 'icon' })}
        >
          →
        </button>
      </div>

      <div className="border-border mt-5 flex flex-wrap items-center gap-3 border-t pt-4">
        <button
          type="button"
          onClick={handleSimulateFill}
          className={button()}
        >
          simulate a fill
        </button>
        <span className="text-muted-foreground text-sm">
          Fills a random Active order, then decides the branch against your
          filters.
        </span>
      </div>

      {readout ? (
        <div
          role="status"
          className="border-border bg-muted/30 mt-4 rounded-lg border p-4"
        >
          <p className="text-foreground mb-3 text-sm">
            Fill event · order <span className="font-mono">{readout.orderId}</span>{' '}
            on <span className="font-mono">{readout.market}</span> →{' '}
            <span className="text-primary font-mono">Filled</span>
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            <span
              className={`rounded-md border px-2 py-1 font-mono text-xs ${
                readout.matchMarket
                  ? 'border-primary/40 text-primary'
                  : 'border-destructive/40 text-destructive'
              }`}
            >
              checkMarket: {readout.matchMarket ? '✓' : '✗'}
            </span>
            <span
              className={`rounded-md border px-2 py-1 font-mono text-xs ${
                readout.matchStatus
                  ? 'border-primary/40 text-primary'
                  : 'border-destructive/40 text-destructive'
              }`}
            >
              checkStatus: {readout.matchStatus ? '✓' : '✗'}
            </span>
            <span
              className={`rounded-md border px-2 py-1 font-mono text-xs ${
                readout.matchDateRange
                  ? 'border-primary/40 text-primary'
                  : 'border-destructive/40 text-destructive'
              }`}
            >
              checkDateRange: {readout.matchDateRange ? '✓' : '✗'}
            </span>
          </div>
          <p className="text-foreground font-mono text-lg font-bold">
            {readout.branch}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">{readout.note}</p>
        </div>
      ) : null}
    </div>
  );
}

export default PatchVsRefetch;
