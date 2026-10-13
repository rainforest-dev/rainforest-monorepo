import fs from 'node:fs';
import path from 'node:path';

import { EmbedError } from '@rainforest-dev/search';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createCalibreDb } from '@/test';

const fault = vi.hoisted(() => ({ error: undefined as Error | undefined }));

vi.mock('next/cache', () => ({
  cacheLife: () => undefined,
  cacheTag: () => undefined,
}));

vi.mock('@rainforest-dev/search/node', async (importOriginal) => {
  const mod =
    await importOriginal<typeof import('@rainforest-dev/search/node')>();
  return {
    ...mod,
    conceptEmbedder: (concepts: Parameters<typeof mod.conceptEmbedder>[0]) => {
      const inner = mod.conceptEmbedder(concepts);
      return {
        ...inner,
        embed: (texts: string[], kind: 'query' | 'document') =>
          fault.error && kind === 'query'
            ? Promise.reject(fault.error)
            : inner.embed(texts, kind),
      };
    },
  };
});

const { GET } = await import('@/app/api/books/search/route');
const { queryLibrary } = await import('./library-query');
const { searchBookList } = await import('./queries');
const { ensureBookIndex, lexicalBookIds, searchBookIds } =
  await import('./search');

let dir = '';
const QUERY = 'harbour';

beforeAll(async () => {
  dir = createCalibreDb({
    authors: [
      [1, 'Mara Ostrand', 'Ostrand, Mara'],
      [2, 'Tobiah Quell', 'Quell, Tobiah'],
    ],
    series: [[1, 'Amber Road']],
    tags: [[1, 'sea']],
    books: [
      {
        id: 1,
        title: 'Salt Harbour',
        authorIds: [1],
        seriesId: 1,
        tagIds: [1],
      },
      { id: 2, title: 'Cold Lantern', authorIds: [1] },
      { id: 3, title: 'Port of Call', authorIds: [2], seriesId: 1 },
      { id: 4, title: 'Harbour Letters', authorIds: [2] },
      { id: 5, title: 'Quiet Orchard', authorIds: [2] },
    ],
  });
  process.env.CALIBRE_LIBRARY_PATH = dir;
  process.env.CALIBRE_APP_DB_PATH = path.join(dir, 'app.db');
  process.env['CALIBRE_EMBED'] = 'fake';
  await searchBookIds(QUERY);
  await ensureBookIndex();
});

afterAll(() => {
  delete process.env['CALIBRE_EMBED'];
  fs.rmSync(dir, { recursive: true, force: true });
});

type Listed = Awaited<ReturnType<typeof searchBookList>>;

function flat(result: Listed) {
  if (!('books' in result)) throw new Error('expected a flat list');
  return result;
}

const ids = (result: Listed) => flat(result).books.map((b) => b.id);

describe('searchBookList', () => {
  it('orders by relevance without sortBy, including a semantic-only match', async () => {
    const search = await searchBookIds(QUERY);
    expect(search.semantic).toBe('on');
    expect(search.ids).toContain(3);
    const result = await searchBookList({ q: QUERY });
    expect(result).toMatchObject({ semantic: 'on', total: search.ids.length });
    expect(ids(result)).toEqual(search.ids);
  });

  it('sorts the matched books by sortBy, and pages them', async () => {
    const result = await searchBookList({ q: QUERY, sortBy: 'title' });
    expect(ids(result)).toEqual([4, 3, 1]);
    expect(flat(result).total).toBe(3);
    const second = await searchBookList({
      q: QUERY,
      sortBy: 'title',
      page: 2,
      limit: 1,
    });
    expect(ids(second)).toEqual([3]);
    expect(flat(second).total).toBe(3);
  });

  it('applies filters to the matches', async () => {
    const result = await searchBookList({ q: QUERY, authorId: 2 });
    expect(flat(result).total).toBe(2);
    expect(ids(result).sort()).toEqual([3, 4]);
  });

  it('groups the matched books', async () => {
    const result = await searchBookList({ q: QUERY, groupBy: 'series' });
    expect(result.semantic).toBe('on');
    expect('groups' in result && result.groups).toEqual([
      expect.objectContaining({ label: 'Amber Road', total: 2 }),
      expect.objectContaining({ key: 'ungrouped', total: 1 }),
    ]);
  });

  it('keeps substring matching below three characters', async () => {
    const result = await searchBookList({ q: 'Po' });
    expect(result).toMatchObject({ semantic: 'off', total: 1 });
    expect(ids(result)).toEqual([3]);
  });

  it('returns the lexical order exactly when the embedder fails', async () => {
    fault.error = new EmbedError('ollama-unreachable', 'down');
    try {
      const { appSqlite } = await import('@/db');
      const lexical = lexicalBookIds(QUERY, appSqlite);
      const result = await searchBookList({ q: QUERY });
      expect(result).toMatchObject({
        semantic: 'off',
        reason: 'ollama-unreachable',
        total: lexical.length,
      });
      expect(ids(result)).toEqual(lexical);
    } finally {
      fault.error = undefined;
    }
  });
});

describe('the three entry points', () => {
  it.each([QUERY, 'Lantern', 'Ostrand'])(
    'return the same books for %j',
    async (q) => {
      const route = await GET(
        new NextRequest(
          `http://calibre.test/api/books/search?q=${encodeURIComponent(q)}`,
        ),
      );
      const box = ((await route.json()) as { results: { id: number }[] })
        .results;
      const list = await queryLibrary({
        q,
        sortBy: 'title',
        sortDir: 'asc',
        page: 1,
        pageSize: 50,
      });
      const mcp = await searchBookList({ q });
      const sorted = (values: number[]) => [...values].sort((a, b) => a - b);
      expect(box.length).toBeGreaterThan(0);
      expect(sorted(list.matchingIds)).toEqual(sorted(box.map((r) => r.id)));
      expect(sorted(ids(mcp))).toEqual(sorted(box.map((r) => r.id)));
    },
  );
});
