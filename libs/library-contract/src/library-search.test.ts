import {
  clipSnippet,
  LIBRARY_SEARCH_MAX_QUERY,
  librarySearchHitSchema,
  librarySearchQuery,
} from './library-search';

describe('librarySearchHitSchema', () => {
  const hit = {
    kind: 'notebook',
    id: '12',
    title: '2026-A5 · p. 40',
    snippet: 'met the coach',
    href: '/notebooks/3?page=12',
  };

  it('accepts a hit', () => {
    expect(librarySearchHitSchema.parse(hit)).toEqual(hit);
  });

  it.each(['https://evil.example/x', '//evil.example', 'notebooks/3'])(
    'rejects the off-origin href %s',
    (href) => {
      expect(librarySearchHitSchema.safeParse({ ...hit, href }).success).toBe(
        false,
      );
    },
  );
});

describe('librarySearchQuery', () => {
  it('trims and cuts the query', () => {
    expect(librarySearchQuery(new URLSearchParams('q=%20dune%20'))).toBe(
      'dune',
    );
    expect(
      librarySearchQuery(new URLSearchParams({ q: 'x'.repeat(500) })),
    ).toHaveLength(LIBRARY_SEARCH_MAX_QUERY);
    expect(librarySearchQuery(new URLSearchParams())).toBe('');
  });
});

describe('clipSnippet', () => {
  it('flattens whitespace and cuts on a character', () => {
    expect(clipSnippet('a\n\n b')).toBe('a b');
    expect(clipSnippet('胃食道逆流', 3)).toBe('胃食…');
  });
});
