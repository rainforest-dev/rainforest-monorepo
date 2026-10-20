import fs from 'node:fs';
import path from 'node:path';

import { librarySearchResponseSchema } from '@rainforest-dev/library-contract';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createCalibreDb } from '@/test';

import { GET } from './route';

// `connection()` needs a request scope that a direct handler call does not have.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection: async () => undefined,
}));

let dir = '';

beforeAll(() => {
  dir = createCalibreDb({
    authors: [[1, 'Mara Ostrand', 'Ostrand, Mara']],
    series: [[1, 'Amber Road']],
    tags: [],
    books: [
      {
        id: 1,
        title: 'Harbour Ledger',
        authorIds: [1],
        seriesId: 1,
        seriesIndex: 1,
      },
      { id: 2, title: 'Lantern Signal', authorIds: [1] },
    ],
  });
  process.env.CALIBRE_LIBRARY_PATH = dir;
  process.env.CALIBRE_APP_DB_PATH = path.join(dir, 'app.db');
  delete process.env['CALIBRE_OLLAMA_URL'];
  delete process.env['CALIBRE_EMBED'];
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const search = async (q: string) =>
  (
    await GET(
      new Request(
        `http://calibre.test/books/api/library-search?q=${encodeURIComponent(q)}`,
      ),
    )
  ).json();

describe('GET /api/library-search', () => {
  it('answers books in the library search shape, linked to their pane', async () => {
    const body = await search('harbour');
    expect(librarySearchResponseSchema.safeParse(body).success).toBe(true);
    expect(body.results).toEqual([
      {
        kind: 'book',
        id: '1',
        title: 'Harbour Ledger',
        subtitle: 'Mara Ostrand',
        snippet: 'Amber Road',
        href: '/books?book=1',
      },
    ]);
  });

  it('finds nothing for an empty query', async () => {
    expect(await search('')).toEqual({ results: [] });
  });
});
