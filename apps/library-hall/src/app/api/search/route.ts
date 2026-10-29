import {
  librarySearchDates,
  librarySearchQuery,
  librarySearchScope,
} from '@rainforest-dev/library-contract';
import { connection } from 'next/server';

import { searchLibrary } from '@/lib/server';

/**
 * `GET /api/search?q=`: the whole library, every collection's hits merged, best first.
 * `in=books,kb` asks only those collections; `from` and `to` (`YYYY-MM-DD`) keep dated items,
 * notebook pages, to those days.
 */
export async function GET(request: Request) {
  await connection();
  const params = new URL(request.url).searchParams;
  const q = librarySearchQuery(params);
  const scope = librarySearchScope(params);
  return Response.json(
    await searchLibrary(q, process.env, fetch, undefined, {
      ...(scope && { scope }),
      ...librarySearchDates(params),
    }),
    {
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
