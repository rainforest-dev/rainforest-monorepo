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
  // No catch: an unreadable index must answer 500, so the hall names books as not answering
  // instead of showing an empty result.
  const rows = ftsRowsById(ids, appSqlite).slice(0, LIBRARY_SEARCH_LIMIT);
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
