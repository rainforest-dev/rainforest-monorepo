import { librarySearchQuery } from '@rainforest-dev/library-contract';
import { connection } from 'next/server';

import { searchLibrary } from '@/lib/server';

/** `GET /api/search?q=`: the whole library, every collection's hits merged, best first. */
export async function GET(request: Request) {
  await connection();
  const q = librarySearchQuery(new URL(request.url).searchParams);
  return Response.json(await searchLibrary(q), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
