import { describe, expect, it } from 'vitest';

import { isIndexHeader, vectorBytes } from './index-header';

describe('isIndexHeader', () => {
  it('accepts the docs.json shape', () => {
    expect(
      isIndexHeader({
        model: 'm',
        dims: 2,
        docs: [{ id: 'a', contentHash: '1', retry: true }],
      }),
    ).toBe(true);
  });

  it('rejects zero dims, a missing hash or a non-object', () => {
    expect(isIndexHeader({ model: 'm', dims: 0, docs: [] })).toBe(false);
    expect(isIndexHeader({ model: 'm', dims: 2, docs: [{ id: 'a' }] })).toBe(
      false,
    );
    expect(isIndexHeader(null)).toBe(false);
  });
});

describe('vectorBytes', () => {
  it('is docs × dims × 4', () => {
    expect(
      vectorBytes({
        model: 'm',
        dims: 3,
        docs: [
          { id: 'a', contentHash: '1' },
          { id: 'b', contentHash: '2' },
        ],
      }),
    ).toBe(24);
  });
});
