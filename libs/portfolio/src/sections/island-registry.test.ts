import { describe, expect, it } from 'vitest';

import { islandFor } from './island-registry';

describe('island registry', () => {
  it('returns a component for each Hoogii interaction kind', () => {
    for (const kind of [
      'phrase-grid',
      'fuzzy-search',
      'live-ledger',
      'idle-lock',
      'relay-gate',
    ] as const) {
      expect(islandFor(kind)).toBeTypeOf('function');
    }
  });
  it('returns undefined for an unmapped kind', () => {
    // @ts-expect-error deliberately unknown
    expect(islandFor('nope')).toBeUndefined();
  });
});
