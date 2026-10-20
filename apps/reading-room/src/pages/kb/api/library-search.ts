import {
  clipSnippet,
  LIBRARY_SEARCH_LIMIT,
  librarySearchQuery,
} from '@rainforest-dev/library-contract';
import type { APIRoute } from 'astro';

import { searchKb, shelfLabel } from '@/lib/kb';
import { getKbIndex } from '@/server';

/** `GET /kb/api/library-search?q=`: wiki pages and Readwise notes for the library-wide search. */
export const GET: APIRoute = ({ url }) => {
  try {
    const q = librarySearchQuery(url.searchParams);
    const results = searchKb(getKbIndex().entries, q, LIBRARY_SEARCH_LIMIT).map(
      ({ doc, snippet }) => ({
        kind: 'kb' as const,
        id: doc.id,
        title: doc.title,
        subtitle: shelfLabel(doc.source, doc.shelf),
        ...(snippet && { snippet: clipSnippet(snippet) }),
        href: doc.href,
      }),
    );
    return Response.json({ results });
  } catch (err) {
    // The error can name mount paths and hidden files, so it stays in the server log.
    console.error('[kb]', err);
    return Response.json({ error: 'kb unavailable' }, { status: 500 });
  }
};
