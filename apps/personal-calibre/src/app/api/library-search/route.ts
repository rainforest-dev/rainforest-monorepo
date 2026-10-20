import {
  LIBRARY_SEARCH_LIMIT,
  librarySearchQuery,
} from '@rainforest-dev/library-contract';
import { connection, NextResponse } from 'next/server';

import { appSqlite } from '@/db';
import { BASE_PATH } from '@/lib';
import { ftsRowsById, searchBookIds } from '@/lib/server';

/**
 * `GET /books/api/library-search?q=`: books for the library-wide search, from the same search as
 * the library's own box. Each hit opens the book's pane.
 */
export async function GET(request: Request) {
  await connection();
  const q = librarySearchQuery(new URL(request.url).searchParams);
  const { ids } = await searchBookIds(q);
  let rows: ReturnType<typeof ftsRowsById> = [];
  try {
    rows = ftsRowsById(ids, appSqlite).slice(0, LIBRARY_SEARCH_LIMIT);
  } catch {
    rows = [];
  }
  return NextResponse.json({
    results: rows.map((row) => ({
      kind: 'book',
      id: String(row.id),
      title: row.title,
      ...(row.authors && { subtitle: row.authors }),
      ...(row.series && { snippet: row.series }),
      href: `${BASE_PATH}?book=${row.id}`,
    })),
  });
}
