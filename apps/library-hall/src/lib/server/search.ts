import {
  LIBRARY_SEARCH_LIMIT,
  LIBRARY_SEARCH_PATH,
  type LibrarySearchHit,
  librarySearchResponseSchema,
  type MergedSearchResponse,
} from '@rainforest-dev/library-contract';
import { rrf } from '@rainforest-dev/search';

import { SOURCE_COLLECTIONS, type SourceCollection } from './collections';

const TIMEOUT_MS = 5000;

/** How many merged hits the hall returns. */
export const MERGED_SEARCH_LIMIT = 30;

const hitKey = (hit: LibrarySearchHit) => `${hit.kind}:${hit.id}`;

/** A collection's search URL for `q`, or null when the collection has no URL configured. */
export function searchUrl(
  collection: SourceCollection,
  q: string,
  env: Record<string, string | undefined> = process.env,
): string | null {
  const base = env[`LIBRARY_${collection.toUpperCase()}_URL`]?.trim();
  if (!base) return null;
  const params = new URLSearchParams({ q });
  return `${base.replace(/\/+$/, '')}${LIBRARY_SEARCH_PATH}?${params}`;
}

async function searchSource(
  collection: SourceCollection,
  url: string,
  fetcher: typeof fetch,
  timeoutMs: number,
) {
  const failed = {
    status: { collection, ok: false, count: 0 },
    hits: [] as LibrarySearchHit[],
  };
  try {
    const response = await fetcher(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return failed;
    const parsed = librarySearchResponseSchema.safeParse(await response.json());
    if (!parsed.success) return failed;
    const hits = parsed.data.results.slice(0, LIBRARY_SEARCH_LIMIT);
    return { status: { collection, ok: true, count: hits.length }, hits };
  } catch {
    return failed;
  }
}

/**
 * Every configured collection searched in parallel, their rankings merged by reciprocal rank
 * fusion. Each collection ranks by its own measure, so only the places count. A collection
 * that fails, answers out of shape or takes longer than `timeoutMs` is reported and left out;
 * the rest still answer.
 */
export async function searchLibrary(
  q: string,
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
  timeoutMs = TIMEOUT_MS,
): Promise<MergedSearchResponse> {
  if (!q.trim()) return { results: [], sources: [] };
  const answers = await Promise.all(
    SOURCE_COLLECTIONS.flatMap((collection) => {
      const url = searchUrl(collection, q, env);
      return url ? [searchSource(collection, url, fetcher, timeoutMs)] : [];
    }),
  );
  const byKey = new Map<string, LibrarySearchHit>();
  for (const { hits } of answers)
    for (const hit of hits)
      if (!byKey.has(hitKey(hit))) byKey.set(hitKey(hit), hit);
  const scores = rrf(answers.map(({ hits }) => hits.map(hitKey)));
  const results = [...scores.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, MERGED_SEARCH_LIMIT)
    .flatMap(([key]) => {
      const hit = byKey.get(key);
      return hit ? [hit] : [];
    });
  return { results, sources: answers.map(({ status }) => status) };
}
