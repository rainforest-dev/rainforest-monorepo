import {
  getCollection,
  hallGroup,
  type HallItem,
} from '@rainforest-dev/library-contract';

import { sqlite } from '@/db';

/**
 * Spine colours for books on the hall's shelves, picked by id so a book keeps its colour. The
 * hall mixes each with its own surface tone, so these only need to differ in hue.
 */
export const BOOK_SPINE_COLORS = [
  '#6d5bd0',
  '#3f7fbf',
  '#2f8f83',
  '#b0723a',
  '#a34a6a',
  '#5f7a3a',
] as const;

interface NameRow {
  book: number;
  name: string;
}

/** Each book's linked names, in Calibre's link order: a book's first author is its main one. */
function namesByBook(sql: string): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const row of sqlite.prepare(sql).all() as NameRow[]) {
    if (!row.name) continue;
    const names = out.get(row.book);
    if (names) names.push(row.name);
    else out.set(row.book, [row.name]);
  }
  return out;
}

/** `YYYY-MM` of a Calibre timestamp such as `2026-08-03 10:00:00+00:00`, or `null`. */
export function monthOf(timestamp: string | null): string | null {
  const match = timestamp?.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : null;
}

/**
 * Every book as an item for the library hall's shelves. Paths are where the library hostname
 * mounts this app (`/books`), so they resolve from the hall's page, not from this app's own.
 */
export function listBookHallItems(): HallItem[] {
  const base = getCollection('books').basePath;
  const authors = namesByBook(
    `SELECT l.book, a.name FROM books_authors_link l
     JOIN authors a ON a.id = l.author ORDER BY l.id`,
  );
  const tags = namesByBook(
    `SELECT l.book, t.name FROM books_tags_link l
     JOIN tags t ON t.id = l.tag ORDER BY l.id`,
  );
  const rows = sqlite
    .prepare(
      'SELECT id, title, timestamp, has_cover FROM books ORDER BY sort, id',
    )
    .all() as Array<{
    id: number;
    title: string | null;
    timestamp: string | null;
    has_cover: number | null;
  }>;

  return rows.map((row) => {
    const bookAuthors = authors.get(row.id) ?? [];
    const month = monthOf(row.timestamp);
    const groups = [
      ...(tags.get(row.id) ?? []).map((t) => hallGroup('topic', t)),
      ...bookAuthors.map((a) => hallGroup('creator', a)),
      ...(month ? [hallGroup('month', month)] : []),
    ];
    return {
      kind: 'book',
      id: String(row.id),
      title: row.title ?? '',
      color: BOOK_SPINE_COLORS[row.id % BOOK_SPINE_COLORS.length],
      groups,
      href: `${base}?book=${row.id}`,
      ...(bookAuthors.length > 0 && { subtitle: bookAuthors.join('、') }),
      ...(row.has_cover && { cover: `${base}/api/books/${row.id}/cover` }),
    };
  });
}
