import { describe, expect, it, vi } from 'vitest';

import { loadHallItems, sourceUrl } from './collections';

const item = (kind: string, id: string) => ({
  kind,
  id,
  title: id,
  color: '#3e7d7d',
  groups: [],
  href: `/x/${id}`,
});

const respond = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );

describe('sourceUrl', () => {
  it('joins the configured base and the hall-items path', () => {
    expect(
      sourceUrl('books', {
        LIBRARY_BOOKS_URL: 'http://host.docker.internal:8082/books/',
      }),
    ).toBe('http://host.docker.internal:8082/books/api/hall-items');
  });

  it('skips a collection with no URL', () => {
    expect(sourceUrl('rack', {})).toBeNull();
  });
});

describe('loadHallItems', () => {
  it('merges collections in shelf order and reports each one', async () => {
    const fetcher = vi.fn((url: string | URL | Request) =>
      String(url).includes('8082')
        ? respond({ items: [item('book', '1')] })
        : respond({ items: [item('kb', 'a'), item('kb', 'b')] }),
    ) as unknown as typeof fetch;
    const result = await loadHallItems(
      {
        LIBRARY_KB_URL: 'http://kb:1',
        LIBRARY_BOOKS_URL: 'http://calibre:8082',
      },
      fetcher,
    );
    expect(result.items.map((i) => `${i.kind}:${i.id}`)).toEqual([
      'book:1',
      'kb:a',
      'kb:b',
    ]);
    expect(result.sources).toEqual([
      { collection: 'books', ok: true, count: 1 },
      { collection: 'kb', ok: true, count: 2 },
    ]);
  });

  it('keeps the other shelves when one source fails or lies', async () => {
    const fetcher = vi.fn((url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('down')) return Promise.reject(new Error('refused'));
      if (u.includes('bad'))
        return respond({ items: [{ ...item('book', '9'), href: '//evil' }] });
      if (u.includes('err')) return respond({}, 500);
      return respond({ items: [item('notebook', 'n1')] });
    }) as unknown as typeof fetch;
    const result = await loadHallItems(
      {
        LIBRARY_BOOKS_URL: 'http://bad',
        LIBRARY_NOTEBOOKS_URL: 'http://ok',
        LIBRARY_RACK_URL: 'http://down',
        LIBRARY_KB_URL: 'http://err',
      },
      fetcher,
    );
    expect(result.items.map((i) => i.id)).toEqual(['n1']);
    expect(result.sources.map((s) => [s.collection, s.ok])).toEqual([
      ['books', true],
      ['notebooks', true],
      ['rack', false],
      ['kb', false],
    ]);
  });

  it('drops a bad item and keeps the rest of its shelf', async () => {
    const fetcher = vi.fn(() =>
      respond({
        items: [item('book', '1'), { ...item('book', '2'), color: 'teal' }],
      }),
    ) as unknown as typeof fetch;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const result = await loadHallItems(
      { LIBRARY_BOOKS_URL: 'http://calibre:8082' },
      fetcher,
    );
    expect(result.items.map((i) => i.id)).toEqual(['1']);
    expect(result.sources).toEqual([
      { collection: 'books', ok: true, count: 1, skipped: 1 },
    ]);
    warn.mockRestore();
  });
});
