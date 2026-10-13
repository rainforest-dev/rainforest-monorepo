import fs from 'node:fs';
import path from 'node:path';

import { ngramSimilarity } from '@rainforest-dev/search';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { appSqlite } from '@/db';
import { createCalibreDb } from '@/test';

import { GET } from './route';

interface FtsRow {
  id: number;
  title: string;
  authors: string;
  series: string | null;
}

function legacyResults(q: string) {
  const normalize = (rows: FtsRow[]) =>
    rows.map(({ authors, ...r }) => ({ ...r, author: authors }));
  if (q.length < 2) return [];
  const tokens = q
    .split(/\s+/)
    .map((t) => t.replace(/["'*()^:+-]/g, '').trim())
    .filter((t) => t.length >= 3);
  const ftsRows = (): FtsRow[] => {
    try {
      return appSqlite
        .prepare(
          'SELECT id, title, authors, series FROM books_fts WHERE books_fts MATCH ? ORDER BY rank LIMIT 20',
        )
        .all(tokens.join(' ')) as FtsRow[];
    } catch {
      return [];
    }
  };
  const rows = tokens.length > 0 ? ftsRows() : [];
  if (rows.length > 0) return normalize(rows);
  const score = (row: FtsRow) =>
    Math.max(
      ngramSimilarity(q, row.title),
      ngramSimilarity(q, row.authors) * 0.85,
      row.series ? ngramSimilarity(q, row.series) * 0.7 : 0,
    );
  const all = appSqlite
    .prepare('SELECT id, title, authors, series FROM books_fts')
    .all() as FtsRow[];
  return normalize(
    all
      .map((row) => ({ row, s: score(row) }))
      .filter(({ s }) => s >= 0.25)
      .sort((a, b) => b.s - a.s)
      .slice(0, 20)
      .map(({ row }) => row),
  );
}

const WORDS = [
  'Ledger',
  'Harbour',
  'Tide',
  'Lantern',
  'Signal',
  '海港',
  '書店',
];

let dir = '';

beforeAll(() => {
  dir = createCalibreDb({
    authors: [
      [1, 'Mara Ostrand', 'Ostrand, Mara'],
      [2, 'Tobiah Quell', 'Quell, Tobiah'],
    ],
    series: [[1, 'Amber Road']],
    tags: [],
    books: Array.from({ length: 70 }, (_, i) => ({
      id: i + 1,
      title: `${WORDS[i % WORDS.length]} ${WORDS[(i * 3 + 1) % WORDS.length]} ${i + 1}`,
      authorIds: [(i % 2) + 1],
      ...(i % 4 === 0 ? { seriesId: 1, seriesIndex: i } : {}),
    })),
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
      new NextRequest(
        `http://calibre.test/api/books/search?q=${encodeURIComponent(q)}`,
      ),
    )
  ).json();

describe('GET /api/books/search without CALIBRE_OLLAMA_URL', () => {
  it.each([
    'ledger',
    'harbour tide',
    'Ostrand',
    'amber road',
    'Lantrn',
    '海港',
    '書',
    'ti',
    'x',
    '',
    'zzzz',
    '"tide"',
  ])('returns today’s results plus semantic off for %j', async (q) => {
    const body = await search(q);
    expect(body).toEqual({ results: legacyResults(q.trim()), semantic: 'off' });
  });

  it('caps an FTS match at 20 results', async () => {
    expect((await search('ledger')).results).toHaveLength(20);
  });
});
