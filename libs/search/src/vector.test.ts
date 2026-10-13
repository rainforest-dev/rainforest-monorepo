import { describe, expect, it } from 'vitest';

import { semanticIds, topK } from './vector';

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

describe('semanticIds', () => {
  it('drops hits under the floor, sorts by score then id, and truncates', () => {
    const hits = [
      { id: 'b', score: 0.9 },
      { id: 'a', score: 0.9 },
      { id: 'c', score: 0.5 },
      { id: 'd', score: 0.8 },
    ];
    expect(semanticIds({ hits, minScore: 0.6, k: 2 })).toEqual(['a', 'b']);
    expect(semanticIds({ hits, minScore: 0.6, k: 10 })).toEqual([
      'a',
      'b',
      'd',
    ]);
  });
});
