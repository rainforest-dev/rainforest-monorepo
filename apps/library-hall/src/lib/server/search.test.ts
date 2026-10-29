import { describe, expect, it, vi } from 'vitest';

import { searchLibrary, searchUrl } from './search';

const hit = (kind: string, id: string, href = `/x/${id}`) => ({
  kind,
  id,
  title: id,
  href,
});

const respond = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );

describe('searchUrl', () => {
  it('joins the base, the search path and the query', () => {
    expect(
      searchUrl('notebooks', '胃 食道', {
        LIBRARY_NOTEBOOKS_URL: 'http://host.docker.internal:8086/notebooks/',
      }),
    ).toBe(
      'http://host.docker.internal:8086/notebooks/api/library-search?q=%E8%83%83+%E9%A3%9F%E9%81%93',
    );
  });

  it('passes the days on', () => {
    expect(
      searchUrl(
        'notebooks',
        'x',
        { LIBRARY_NOTEBOOKS_URL: 'http://nb' },
        { from: '2026-09-01', to: '2026-09-30' },
      ),
    ).toBe('http://nb/api/library-search?q=x&from=2026-09-01&to=2026-09-30');
  });

  it('skips a collection with no URL', () => {
    expect(searchUrl('kb', 'x', {})).toBeNull();
  });
});

describe('searchLibrary', () => {
  it('interleaves the collections by rank', async () => {
    const fetcher = vi.fn((url: string | URL | Request) =>
      String(url).startsWith('http://books')
        ? respond({ results: [hit('book', '1'), hit('book', '2')] })
        : respond({ results: [hit('kb', 'a'), hit('kb', 'b')] }),
    ) as unknown as typeof fetch;
    const result = await searchLibrary(
      'dune',
      { LIBRARY_BOOKS_URL: 'http://books', LIBRARY_KB_URL: 'http://kb' },
      fetcher,
    );
    expect(result.results.map((r) => `${r.kind}:${r.id}`)).toEqual([
      'book:1',
      'kb:a',
      'book:2',
      'kb:b',
    ]);
    expect(result.sources).toEqual([
      { collection: 'books', ok: true, count: 2 },
      { collection: 'kb', ok: true, count: 2 },
    ]);
  });

  it('keeps the other collections when one fails or lies', async () => {
    const fetcher = vi.fn((url: string | URL | Request) => {
      const u = String(url);
      if (u.startsWith('http://down'))
        return Promise.reject(new Error('refused'));
      if (u.startsWith('http://bad'))
        return respond({ results: [hit('book', '9', '//evil')] });
      if (u.startsWith('http://err')) return respond({}, 500);
      return respond({ results: [hit('notebook', 'page-1')] });
    }) as unknown as typeof fetch;
    const result = await searchLibrary(
      'x',
      {
        LIBRARY_BOOKS_URL: 'http://bad',
        LIBRARY_NOTEBOOKS_URL: 'http://ok',
        LIBRARY_RACK_URL: 'http://down',
        LIBRARY_KB_URL: 'http://err',
      },
      fetcher,
    );
    expect(result.results.map((r) => r.id)).toEqual(['page-1']);
    expect(result.sources.map((s) => [s.collection, s.ok])).toEqual([
      ['books', false],
      ['notebooks', true],
      ['rack', false],
      ['kb', false],
    ]);
  });

  it('gives up on a collection that hangs and answers with the rest', async () => {
    const fetcher = vi.fn((url: string | URL | Request, init?: RequestInit) =>
      String(url).startsWith('http://slow')
        ? new Promise<Response>((_, reject) =>
            init?.signal?.addEventListener('abort', () =>
              reject(init.signal?.reason),
            ),
          )
        : respond({ results: [hit('kb', 'a')] }),
    ) as unknown as typeof fetch;
    const result = await searchLibrary(
      'x',
      { LIBRARY_BOOKS_URL: 'http://slow', LIBRARY_KB_URL: 'http://kb' },
      fetcher,
      20,
    );
    expect(result.results.map((r) => r.id)).toEqual(['a']);
    expect(result.sources).toEqual([
      { collection: 'books', ok: false, count: 0 },
      { collection: 'kb', ok: true, count: 1 },
    ]);
  });

  it('asks only the collections in scope', async () => {
    const fetcher = vi.fn(() =>
      respond({ results: [hit('kb', 'a')] }),
    ) as unknown as typeof fetch;
    const result = await searchLibrary(
      'x',
      { LIBRARY_BOOKS_URL: 'http://books', LIBRARY_KB_URL: 'http://kb' },
      fetcher,
      undefined,
      { scope: ['kb', 'hall'] },
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetcher).mock.calls[0]?.[0])).toMatch(
      /^http:\/\/kb\//,
    );
    expect(result.sources.map((s) => s.collection)).toEqual(['kb']);
  });

  it('asks nobody for an empty query', async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;
    expect(
      await searchLibrary(' ', { LIBRARY_BOOKS_URL: 'http://books' }, fetcher),
    ).toEqual({ results: [], sources: [] });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('asks only the dated collections for days with no words', async () => {
    const fetcher = vi.fn(() =>
      respond({ results: [hit('notebook', 'page-1')] }),
    ) as unknown as typeof fetch;
    const result = await searchLibrary(
      '',
      { LIBRARY_BOOKS_URL: 'http://books', LIBRARY_NOTEBOOKS_URL: 'http://nb' },
      fetcher,
      undefined,
      { from: '2026-09-01', to: '2026-09-30' },
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetcher).mock.calls[0]?.[0])).toMatch(
      /^http:\/\/nb\/.*from=2026-09-01/,
    );
    expect(result.sources.map((s) => s.collection)).toEqual(['notebooks']);
  });
});
