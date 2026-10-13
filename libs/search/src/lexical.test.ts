import { describe, expect, it } from 'vitest';

import { type LexicalConfig, lexicalRank } from './lexical';

type Doc = {
  id: string;
  day: string;
  text: string;
  people: string[];
  places: string[];
};

const doc = (
  id: string,
  day: string,
  text: string,
  extra: Partial<Doc> = {},
): Doc => ({
  id,
  day,
  text,
  people: [],
  places: [],
  ...extra,
});

const CONFIG: LexicalConfig<Doc> = {
  id: (d) => d.id,
  text: (d) => d.text,
  facets: [
    { values: (d) => d.people, match: 'exact' },
    { values: (d) => d.places, match: 'substring' },
  ],
  tieBreak: (a, b) => b.day.localeCompare(a.day) || a.id.localeCompare(b.id),
};

const docs = [
  doc('a', '2025-11-01', '09:00 Bob：台南的牛肉麵'),
  doc('b', '2025-11-02', '10:00 Alice：麵 麵 麵'),
  doc('c', '2025-11-03', '11:00 Bob：台北'),
  doc('d', '2025-11-04', 'labels: Ramen', { places: ['台南'] }),
  doc('e', '2025-11-05', 'hello', { people: ['bob'] }),
];

describe('lexicalRank', () => {
  it('requires every term', () => {
    expect(lexicalRank(docs, ['台南', '麵'], CONFIG)).toEqual(['a']);
  });

  it('ranks facet hits first, then text hits, then the tie-break', () => {
    expect(lexicalRank(docs, ['台南'], CONFIG)).toEqual(['d', 'a']);
    expect(lexicalRank(docs, ['麵'], CONFIG)).toEqual(['b', 'a']);
  });

  it('matches an exact facet but not a partial one', () => {
    expect(lexicalRank(docs, ['bob'], CONFIG)).toEqual(['e', 'c', 'a']);
    expect(lexicalRank(docs, ['bo'], CONFIG)).toEqual(['c', 'a']);
  });

  it('returns nothing for no usable terms', () => {
    expect(lexicalRank(docs, ['', ''], CONFIG)).toEqual([]);
  });

  it('keeps input order without a tie-break', () => {
    const plain = { id: CONFIG.id, text: CONFIG.text };
    expect(
      lexicalRank([doc('x', '1', 'a'), doc('y', '2', 'a')], ['a'], plain),
    ).toEqual(['x', 'y']);
  });
});

describe('lexicalRank with the memories corpus', () => {
  const memories = docs.slice(0, 4);

  it('requires every term', () => {
    expect(lexicalRank(memories, ['台南', '麵'], CONFIG)).toEqual(['a']);
  });

  it('matches facets as well as text, and ranks facet hits first', () => {
    expect(lexicalRank(memories, ['台南'], CONFIG)).toEqual(['d', 'a']);
  });

  it('orders by occurrences, then newest day', () => {
    expect(lexicalRank(memories, ['麵'], CONFIG)).toEqual(['b', 'a']);
  });

  it('is case and width insensitive', () => {
    expect(lexicalRank(memories, ['ramen'], CONFIG)).toEqual(['d']);
  });

  it('ignores empty terms instead of looping on them', () => {
    expect(lexicalRank(memories, [''], CONFIG)).toEqual([]);
    expect(lexicalRank(memories, ['', '台北'], CONFIG)).toEqual(['c']);
  });

  it('matches person facets only exactly, not as substrings', () => {
    const withPerson = [
      doc('p', '2025-11-05', 'hello', { people: ['bob'] }),
      doc('q', '2025-11-06', 'a bobba fett figure'),
    ];
    expect(lexicalRank(withPerson, ['bo'], CONFIG)).toEqual(['q']);
    expect(lexicalRank(withPerson, ['bob'], CONFIG)).toEqual(['p', 'q']);
  });

  it('returns nothing without terms', () => {
    expect(lexicalRank(memories, [], CONFIG)).toEqual([]);
  });
});
