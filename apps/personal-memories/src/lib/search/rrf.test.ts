import { describe, expect, it } from 'vitest';

import { rrf } from './rrf.ts';

describe('rrf', () => {
  it('rewards a doc that ranks in both lists', () => {
    const s = rrf([
      ['a', 'b'],
      ['b', 'c'],
    ]);
    expect([...s].sort((x, y) => y[1] - x[1])[0]?.[0]).toBe('b');
    expect(s.get('a')).toBeCloseTo(1 / 61);
    expect(s.get('b')).toBeCloseTo(1 / 62 + 1 / 61);
  });

  it('handles one list and empty lists', () => {
    expect([...rrf([['a']]).keys()]).toEqual(['a']);
    expect(rrf([[], []]).size).toBe(0);
  });
});
