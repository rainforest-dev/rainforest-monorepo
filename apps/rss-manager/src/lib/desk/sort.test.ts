import { describe, expect, it } from 'vitest';

import type { Source, StaleType } from '@/lib/registry.types';

import { compareSources } from './sort.js';

const source = (
  name: string,
  status: Source['status'],
  staleType?: StaleType,
): Source => ({
  name,
  url: '',
  siteUrl: '',
  tags: [],
  status,
  category: '',
  ...(staleType ? { stale: { type: staleType, note: '' } } : {}),
});

const order = (list: Source[]) =>
  [...list].sort(compareSources).map((s) => s.name);

describe('compareSources', () => {
  it('orders by status: proposed, active, no-rss, retired', () => {
    expect(
      order([
        source('A', 'retired'),
        source('B', 'no-rss'),
        source('C', 'active'),
        source('D', 'proposed'),
      ]),
    ).toEqual(['D', 'C', 'B', 'A']);
  });

  it('puts stale sources first within a status, then sorts by name', () => {
    expect(
      order([
        source('Alpha', 'active'),
        source('Zulu', 'active', 'low-value'),
        source('Bravo', 'active'),
        source('Mike', 'active', 'feed-dead'),
        source('Kilo', 'proposed'),
      ]),
    ).toEqual(['Kilo', 'Mike', 'Zulu', 'Alpha', 'Bravo']);
  });

  it('does not lift a retired source for its stale comment', () => {
    expect(
      order([
        source('Bell', 'retired'),
        source('Echo', 'retired', 'feed-dead'),
        source('Amber', 'retired'),
      ]),
    ).toEqual(['Amber', 'Bell', 'Echo']);
  });

  it('compares names with locale rules, so case and & do not reorder', () => {
    expect(
      order([
        source('rust & Rain', 'active'),
        source('Rack and Ruin', 'active'),
        source('Échelle', 'active'),
        source('Ember', 'active'),
      ]),
    ).toEqual(['Échelle', 'Ember', 'Rack and Ruin', 'rust & Rain']);
  });

  it('is stable for equal sources', () => {
    expect(compareSources(source('A', 'active'), source('A', 'active'))).toBe(
      0,
    );
  });
});
