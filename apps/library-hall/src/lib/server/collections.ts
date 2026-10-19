import {
  type CollectionId,
  HALL_ITEMS_PATH,
  type HallItem,
  hallItemsResponseSchema,
} from '@rainforest-dev/library-contract';

/** The collections that put items on the hall's shelves, in shelf order. */
export const SOURCE_COLLECTIONS = [
  'books',
  'notebooks',
  'rack',
  'kb',
] as const satisfies readonly CollectionId[];
export type SourceCollection = (typeof SOURCE_COLLECTIONS)[number];

export interface SourceStatus {
  collection: SourceCollection;
  ok: boolean;
  count: number;
}

export interface HallItemsResult {
  items: HallItem[];
  sources: SourceStatus[];
}

const TIMEOUT_MS = 5000;

/**
 * Where to reach each collection from the hall's server, without Cloudflare: its origin plus
 * any base path, e.g. `http://host.docker.internal:8082/books`. A collection with no URL is
 * left off the shelves.
 */
export function sourceUrl(
  collection: SourceCollection,
  env: Record<string, string | undefined> = process.env,
): string | null {
  const base = env[`LIBRARY_${collection.toUpperCase()}_URL`]?.trim();
  if (!base) return null;
  return `${base.replace(/\/+$/, '')}${HALL_ITEMS_PATH}`;
}

async function fetchSource(
  collection: SourceCollection,
  url: string,
  fetcher: typeof fetch,
): Promise<{ status: SourceStatus; items: HallItem[] }> {
  const failed = { status: { collection, ok: false, count: 0 }, items: [] };
  try {
    const response = await fetcher(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return failed;
    const parsed = hallItemsResponseSchema.safeParse(await response.json());
    if (!parsed.success) return failed;
    return {
      status: { collection, ok: true, count: parsed.data.items.length },
      items: parsed.data.items,
    };
  } catch {
    return failed;
  }
}

/** Every configured collection's shelf, fetched in parallel. One failing source never blanks the rest. */
export async function loadHallItems(
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
): Promise<HallItemsResult> {
  const results = await Promise.all(
    SOURCE_COLLECTIONS.flatMap((collection) => {
      const url = sourceUrl(collection, env);
      return url ? [fetchSource(collection, url, fetcher)] : [];
    }),
  );
  return {
    items: results.flatMap((r) => r.items),
    sources: results.map((r) => r.status),
  };
}
