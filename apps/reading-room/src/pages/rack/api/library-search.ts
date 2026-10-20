import { librarySearchQuery } from '@rainforest-dev/library-contract';
import type { APIRoute } from 'astro';

import { searchRack } from '@/lib';
import { readReadingQueue } from '@/server';

/** `GET /rack/api/library-search?q=`: queued articles for the library-wide search. */
export const GET: APIRoute = ({ url }) => {
  try {
    const q = librarySearchQuery(url.searchParams);
    return Response.json({ results: searchRack(readReadingQueue(), q) });
  } catch (err) {
    console.error('[rack]', err);
    return Response.json({ error: 'rack unavailable' }, { status: 500 });
  }
};
