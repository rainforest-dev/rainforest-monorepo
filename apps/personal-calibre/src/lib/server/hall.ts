import { cacheLife, cacheTag } from 'next/cache';

import { sqlite } from '@/db';
import type { HallBook } from '@/lib/hall/model';

interface LinkRow {
  book: number;
  value: number;
}

/** First link per book, in Calibre's link order: a book's first author is its main author. */
function firstLinks(sql: string): Map<number, number> {
  const out = new Map<number, number>();
  for (const row of sqlite.prepare(sql).all() as LinkRow[]) {
    if (!out.has(row.book)) out.set(row.book, row.value);
  }
  return out;
}

/** Every book with where it belongs under each grouping; the hall regroups on the client. */
export async function getLibraryHall(): Promise<HallBook[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag('books');

  const series = firstLinks(
    'SELECT book, series AS value FROM books_series_link ORDER BY id',
  );
  const authors = firstLinks(
    'SELECT book, author AS value FROM books_authors_link ORDER BY id',
  );
  const tags = firstLinks(
    'SELECT book, tag AS value FROM books_tags_link ORDER BY id',
  );
  const rows = sqlite
    .prepare('SELECT id, title FROM books ORDER BY sort, id')
    .all() as Array<{ id: number; title: string | null }>;
  return rows.map((row) => ({
    id: row.id,
    title: row.title ?? '',
    series: series.get(row.id) ?? null,
    author: authors.get(row.id) ?? null,
    tag: tags.get(row.id) ?? null,
  }));
}
