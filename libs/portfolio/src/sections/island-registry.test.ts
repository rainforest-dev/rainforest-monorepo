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
  it('returns a component for each Hashgreen DEX interaction kind', () => {
    for (const kind of [
      'virtualized-search',
      'order-book',
      'fetch-then-stream',
      'wallet-state-machine',
      'patch-vs-refetch',
    ] as const) {
      expect(islandFor(kind)).toBeTypeOf('function');
    }
  });
  it('returns a component for each HashgreenSwap interaction kind', () => {
    for (const kind of [
      'amm-quote',
      'offer-state',
      'zap-liquidity',
      'env-deploy',
      'i18n-card',
    ] as const) {
      expect(islandFor(kind)).toBeTypeOf('function');
    }
  });
  it('returns a component for each OpenCGT interaction kind', () => {
    for (const kind of [
      'jwt-decode',
      'role-shell',
      'casbin-playground',
      'phi-encrypt',
      'affected-pipeline',
    ] as const) {
      expect(islandFor(kind)).toBeTypeOf('function');
    }
  });
  it('returns undefined for an unmapped kind', () => {
    // @ts-expect-error deliberately unknown
    expect(islandFor('nope')).toBeUndefined();
  });
});
