import { describe, expect, it } from 'vitest';

import { planReuse } from './reuse';

describe('planReuse', () => {
  it('reuses rows whose id and hash both match', () => {
    const plan = planReuse(
      [
        { id: 'a', hash: '1' },
        { id: 'b', hash: '2' },
        { id: 'c', hash: '3', retry: true },
      ],
      [
        { id: 'b', hash: '2' },
        { id: 'a', hash: 'changed' },
        { id: 'c', hash: '3' },
        { id: 'd', hash: '4' },
      ],
    );
    expect([...plan.reuse]).toEqual([[0, 1]]);
    expect(plan.missing).toEqual([1, 2, 3]);
  });

  it('plans everything as missing without a previous run', () => {
    expect(planReuse([], [{ id: 'a', hash: '1' }]).missing).toEqual([0]);
  });
});
