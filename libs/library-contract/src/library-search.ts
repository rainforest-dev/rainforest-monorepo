import { z } from 'zod';

import { COLLECTION_IDS } from './collections';
import { HALL_ITEM_KINDS, sameOriginPath } from './hall-items';

/** Every collection answers the library-wide search at `<basePath>/api/library-search?q=`. */
export const LIBRARY_SEARCH_PATH = '/api/library-search';

/** The longest query a collection reads; the rest is dropped. */
export const LIBRARY_SEARCH_MAX_QUERY = 200;

/** How many hits a collection returns, best first. */
export const LIBRARY_SEARCH_LIMIT = 20;

/**
 * One hit from one collection. The hall merges every collection's ranking with reciprocal rank
 * fusion, so a hit carries no score, only its place in the list.
 */
export const librarySearchHitSchema = z.object({
  kind: z.enum(HALL_ITEM_KINDS),
  id: z.string().min(1),
  title: z.string(),
  /** One line under the title: the authors, the notebook and page, the site or source. */
  subtitle: z.string().optional(),
  /** Plain text around the match. */
  snippet: z.string().max(400).optional(),
  /** The hit in its own collection. */
  href: sameOriginPath,
});
export type LibrarySearchHit = z.infer<typeof librarySearchHitSchema>;

export const librarySearchResponseSchema = z.object({
  results: z.array(librarySearchHitSchema),
});
export type LibrarySearchResponse = z.infer<typeof librarySearchResponseSchema>;

/** The query a collection searches for: trimmed and cut to the maximum, `''` when absent. */
export function librarySearchQuery(params: URLSearchParams): string {
  return (params.get('q') ?? '').trim().slice(0, LIBRARY_SEARCH_MAX_QUERY);
}

/** A snippet cut to fit the schema, on a character boundary. */
export function clipSnippet(text: string, max = 400): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const chars = Array.from(flat);
  return chars.length <= max ? flat : `${chars.slice(0, max - 1).join('')}…`;
}

/** The hall answers the whole library at `/api/search?q=`, every collection merged. */
export const LIBRARY_SEARCH_ENDPOINT = '/api/search';

export const mergedSearchResponseSchema = z.object({
  results: z.array(librarySearchHitSchema),
  /** Each collection asked, whether it answered, and how many hits it gave. */
  sources: z.array(
    z.object({
      collection: z.enum(COLLECTION_IDS),
      ok: z.boolean(),
      count: z.number().int().nonnegative(),
    }),
  ),
});
export type MergedSearchResponse = z.infer<typeof mergedSearchResponseSchema>;
