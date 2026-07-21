import { describe, expect, it } from 'vitest';

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

const ORDER: Order = {
  id: 'ORD-1',
  market: 'HGN-USDC',
  status: 'Active',
  side: 'buy',
  price: 1.24,
  amount: 100,
  age: '2m',
  ageMinutes: 2,
};

const NO_FILTER: OrderFilters = { market: 'all', status: 'all', range: 'all' };

describe('patch-vs-refetch logic — matchesMarket / matchesStatus', () => {
  it('matches any market/status when the filter is "all"', () => {
    expect(matchesMarket(ORDER, NO_FILTER)).toBe(true);
    expect(matchesStatus(ORDER, NO_FILTER)).toBe(true);
  });

  it('matchesMarket is false when the filter names a different market', () => {
    expect(matchesMarket(ORDER, { ...NO_FILTER, market: 'XCH-USDC' })).toBe(
      false,
    );
  });

  it('matchesStatus is false when the filter names a different status', () => {
    expect(matchesStatus(ORDER, { ...NO_FILTER, status: 'Filled' })).toBe(
      false,
    );
  });
});

describe('patch-vs-refetch logic — matchesDateRange (checkDateRange)', () => {
  it('matches any age when the range filter is "all"', () => {
    expect(matchesDateRange({ ...ORDER, ageMinutes: 999999 }, NO_FILTER)).toBe(
      true,
    );
  });

  it('"today" matches an order placed within the last 24h', () => {
    expect(
      matchesDateRange({ ...ORDER, ageMinutes: 500 }, { ...NO_FILTER, range: 'today' }),
    ).toBe(true);
  });

  it('"today" excludes an order older than 24h', () => {
    expect(
      matchesDateRange(
        { ...ORDER, ageMinutes: 1500 },
        { ...NO_FILTER, range: 'today' },
      ),
    ).toBe(false);
  });

  it('"week" matches an order placed within the last 7 days but excluded from "today"', () => {
    const midWeek: Order = { ...ORDER, ageMinutes: 8000 }; // ~5.5 days
    expect(matchesDateRange(midWeek, { ...NO_FILTER, range: 'today' })).toBe(
      false,
    );
    expect(matchesDateRange(midWeek, { ...NO_FILTER, range: 'week' })).toBe(
      true,
    );
  });

  it('"week" excludes an order older than 7 days', () => {
    expect(
      matchesDateRange(
        { ...ORDER, ageMinutes: 20000 },
        { ...NO_FILTER, range: 'week' },
      ),
    ).toBe(false);
  });
});

describe('patch-vs-refetch logic — matchesFilters / needsRefetch', () => {
  it('does not need a refetch when the updated order still matches every active filter', () => {
    expect(needsRefetch(ORDER, NO_FILTER)).toBe(false);
    expect(
      needsRefetch(ORDER, { market: 'HGN-USDC', status: 'Active', range: 'all' }),
    ).toBe(false);
  });

  it('needs a refetch when the market filter would now exclude the order', () => {
    expect(
      needsRefetch(ORDER, { market: 'XCH-USDC', status: 'all', range: 'all' }),
    ).toBe(true);
  });

  it('needs a refetch when the status filter would now exclude the order (e.g. it just filled)', () => {
    const filled: Order = { ...ORDER, status: 'Filled' };
    expect(
      needsRefetch(filled, { market: 'all', status: 'Active', range: 'all' }),
    ).toBe(true);
  });

  it('does not need a refetch for a status that still matches an explicit filter', () => {
    const filled: Order = { ...ORDER, status: 'Filled' };
    expect(
      needsRefetch(filled, { market: 'all', status: 'Filled', range: 'all' }),
    ).toBe(false);
  });

  it('needs a refetch when the date-range filter would now exclude the order (the third check)', () => {
    const old: Order = { ...ORDER, ageMinutes: 20000 }; // ~14 days
    expect(
      needsRefetch(old, { market: 'all', status: 'all', range: 'today' }),
    ).toBe(true);
    expect(
      needsRefetch(old, { market: 'all', status: 'all', range: 'week' }),
    ).toBe(true);
  });

  it('does not need a refetch when the order still falls within the selected date range', () => {
    const recent: Order = { ...ORDER, ageMinutes: 500 };
    expect(
      needsRefetch(recent, { market: 'all', status: 'all', range: 'today' }),
    ).toBe(false);
  });

  it('requires all three checks to pass at once — market and status matching is not enough', () => {
    const stale: Order = { ...ORDER, ageMinutes: 20000 };
    expect(
      needsRefetch(stale, {
        market: 'HGN-USDC',
        status: 'Active',
        range: 'today',
      }),
    ).toBe(true);
  });

  it('matchesFilters is the exact negation of needsRefetch', () => {
    const filters: OrderFilters = { market: 'all', status: 'all', range: 'week' };
    for (const ageMinutes of [10, 8000, 20000]) {
      const order: Order = { ...ORDER, ageMinutes };
      expect(matchesFilters(order, filters)).toBe(!needsRefetch(order, filters));
    }
  });
});

describe('patch-vs-refetch logic — patchOrder', () => {
  it('swaps the matching row in place, leaving the rest untouched', () => {
    const rows = [ORDER, { ...ORDER, id: 'ORD-2' }];
    const updated = { ...ORDER, status: 'Filled' };
    const result = patchOrder(rows, updated);
    expect(result[0]).toEqual(updated);
    expect(result[1]).toEqual(rows[1]);
  });

  it('does not mutate the input array', () => {
    const rows = [ORDER];
    const original = [...rows];
    patchOrder(rows, { ...ORDER, status: 'Filled' });
    expect(rows).toEqual(original);
  });

  it('leaves rows unchanged if the id is not found on the current page', () => {
    const rows = [ORDER];
    const result = patchOrder(rows, { ...ORDER, id: 'ORD-404' });
    expect(result).toEqual(rows);
  });
});
