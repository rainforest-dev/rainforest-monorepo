import {
  clipSnippet,
  LIBRARY_SEARCH_MAX_QUERY,
  librarySearchHitSchema,
  librarySearchQuery,
  librarySearchScope,
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

describe('librarySearchScope', () => {
  it('reads the known collections and drops the rest', () => {
    expect(
      librarySearchScope(new URLSearchParams('in=notebooks,nope,books')),
    ).toEqual(['books', 'notebooks']);
  });

  it('means every collection when absent or unknown', () => {
    expect(librarySearchScope(new URLSearchParams())).toBeUndefined();
    expect(librarySearchScope(new URLSearchParams('in=nope'))).toBeUndefined();
  });
});

describe('clipSnippet', () => {
  it('flattens whitespace and cuts on a character', () => {
    expect(clipSnippet('a\n\n b')).toBe('a b');
    expect(clipSnippet('胃食道逆流', 3)).toBe('胃食…');
  });
});
