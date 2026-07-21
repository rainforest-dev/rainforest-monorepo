import { describe, expect, it } from 'vitest';

import { needsRefetch, type Order, type OrderFilters, patchOrder } from './logic';

const ORDER: Order = {
  id: 'ORD-1',
  market: 'HGN-USDC',
  status: 'Active',
  side: 'buy',
  price: 1.24,
  amount: 100,
  age: '2m',
};

const NO_FILTER: OrderFilters = { market: 'all', status: 'all' };

describe('patch-vs-refetch logic — needsRefetch', () => {
  it('does not need a refetch when the updated order still matches every active filter', () => {
    expect(needsRefetch(ORDER, NO_FILTER)).toBe(false);
    expect(
      needsRefetch(ORDER, { market: 'HGN-USDC', status: 'Active' }),
    ).toBe(false);
  });

  it('needs a refetch when the market filter would now exclude the order', () => {
    expect(needsRefetch(ORDER, { market: 'XCH-USDC', status: 'all' })).toBe(
      true,
    );
  });

  it('needs a refetch when the status filter would now exclude the order (e.g. it just filled)', () => {
    const filled: Order = { ...ORDER, status: 'Filled' };
    expect(needsRefetch(filled, { market: 'all', status: 'Active' })).toBe(
      true,
    );
  });

  it('does not need a refetch for a status that still matches an explicit filter', () => {
    const filled: Order = { ...ORDER, status: 'Filled' };
    expect(needsRefetch(filled, { market: 'all', status: 'Filled' })).toBe(
      false,
    );
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
