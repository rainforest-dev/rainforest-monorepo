import { describe, expect, it } from 'vitest';

import { MAX_QUERY, searchUrl, shouldSearch } from './content-search.ts';

describe('shouldSearch', () => {
  it('starts after one CJK character or two Latin letters', () => {
    expect(shouldSearch({ text: '麵' }, false)).toBe(true);
    expect(shouldSearch({ text: 'a' }, false)).toBe(false);
    expect(shouldSearch({ text: 'ab' }, false)).toBe(true);
    expect(shouldSearch({ text: '  ' }, false)).toBe(false);
  });

  it('searches a person on their own, but not a bare date range', () => {
    expect(shouldSearch({ text: '', people: ['bob'] }, false)).toBe(true);
    expect(
      shouldSearch({ text: '', range: { start: 'x', end: 'y' } }, false),
    ).toBe(false);
  });

  it('waits while an IME is composing', () => {
    expect(shouldSearch({ text: '拉麵' }, true)).toBe(false);
    expect(shouldSearch({ text: '', people: ['bob'] }, true)).toBe(false);
  });
});

describe('searchUrl', () => {
  it('encodes the query and leaves out absent parts', () => {
    expect(searchUrl({ text: '拉麵' })).toBe(
      `/search.json?q=${encodeURIComponent('拉麵')}`,
    );
    expect(
      searchUrl({
        text: 'a b',
        range: { start: '2025-11-01', end: '2025-11-30' },
        people: ['bob', 'dana'],
        sources: ['line'],
      }),
    ).toBe(
      '/search.json?q=a+b&from=2025-11-01&to=2025-11-30&people=bob%2Cdana&sources=line',
    );
  });

  it('clamps the text to the server limit', () => {
    const url = new URL(searchUrl({ text: '麵'.repeat(500) }), 'http://x');
    expect(Array.from(url.searchParams.get('q') ?? '')).toHaveLength(MAX_QUERY);
  });
});
