import { describe, expect, it } from 'vitest';

import { topK } from './vector.ts';

const rows = new Float32Array([1, 0, 0, 1, 1, 1, 0, 0]);

describe('topK', () => {
  it('ranks by cosine, highest first, ties by row', () => {
    expect(
      topK(rows, 2, new Float32Array([1, 0]), 2).map((r) => r.row),
    ).toEqual([0, 2]);
    expect(topK(rows, 2, new Float32Array([1, 1]), 1)[0]?.row).toBe(2);
  });

  it('skips rows the filter rejects and zero rows', () => {
    expect(
      topK(rows, 2, new Float32Array([1, 0]), 4, (r) => r !== 0).map(
        (r) => r.row,
      ),
    ).toEqual([2, 1]);
  });

  it('returns nothing for a zero query', () => {
    expect(topK(rows, 2, new Float32Array([0, 0]), 4)).toEqual([]);
  });
});
