import {
  clipSnippet,
  LIBRARY_SEARCH_LIMIT,
  librarySearchDates,
  type LibrarySearchHit,
  librarySearchQuery,
} from '@rainforest-dev/library-contract';
import { connection, NextResponse } from 'next/server';

import { withBase } from '@/lib';
import { type PageHit, searchNotebookPages } from '@/lib/server';

/** How a page reads in a list of hits from every collection. */
function pageSearchHit(hit: PageHit): LibrarySearchHit {
  const where = [
    hit.notebookName,
    hit.pageNumber !== null ? `p. ${hit.pageNumber}` : null,
    hit.pageDate,
  ].filter(Boolean);
  const snippet = hit.snippet.map((part) => part.text).join('');
  return {
    kind: 'notebook',
    id: `page-${hit.id}`,
    title: hit.heading || where.join(' · '),
    subtitle: where.join(' · '),
    ...(snippet && { snippet: clipSnippet(snippet) }),
    href: withBase(`/${hit.notebookId}?page=${hit.id}`),
  };
}

/**
 * `GET /notebooks/api/library-search?q=`: transcribed pages for the library-wide search, kept to
 * the page dates between `from` and `to` when either is given.
 */
export async function GET(request: Request) {
  await connection();
  const params = new URL(request.url).searchParams;
  const q = librarySearchQuery(params);
  const { hits } = await searchNotebookPages(q, librarySearchDates(params));
  return NextResponse.json({
    results: hits.slice(0, LIBRARY_SEARCH_LIMIT).map(pageSearchHit),
  });
}
