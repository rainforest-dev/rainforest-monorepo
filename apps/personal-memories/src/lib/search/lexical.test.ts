import { describe, expect, it } from 'vitest';

import type { SearchDoc } from './docs.ts';
import { lexicalRank } from './lexical.ts';

const doc = (
  id: string,
  day: string,
  text: string,
  extra: Partial<SearchDoc> = {},
): SearchDoc => ({
  id,
  day,
  kind: 'chat',
  source: 'line',
  text,
  snippet: text,
  people: [],
  places: [],
  eventIds: [id],
  contentHash: id,
  ...extra,
});

describe('lexicalRank', () => {
  const docs = [
    doc('a', '2025-11-01', '09:00 Bob：台南的牛肉麵'),
    doc('b', '2025-11-02', '10:00 Alice：麵 麵 麵'),
    doc('c', '2025-11-03', '11:00 Bob：台北'),
    doc('d', '2025-11-04', 'labels: Ramen', {
      kind: 'photo',
      source: 'photo',
      places: ['台南'],
    }),
  ];

  it('requires every term', () => {
    expect(lexicalRank(docs, ['台南', '麵'])).toEqual(['a']);
  });

  it('matches facets as well as text, and ranks facet hits first', () => {
    expect(lexicalRank(docs, ['台南'])).toEqual(['d', 'a']);
  });

  it('orders by occurrences, then newest day', () => {
    expect(lexicalRank(docs, ['麵'])).toEqual(['b', 'a']);
  });

  it('is case and width insensitive', () => {
    expect(lexicalRank(docs, ['ramen'])).toEqual(['d']);
  });

  it('ignores empty terms instead of looping on them', () => {
    expect(lexicalRank(docs, [''])).toEqual([]);
    expect(lexicalRank(docs, ['', '台北'])).toEqual(['c']);
  });

  it('returns nothing without terms', () => {
    expect(lexicalRank(docs, [])).toEqual([]);
  });
});
