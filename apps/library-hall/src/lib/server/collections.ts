import {
  type CollectionId,
  HALL_ITEMS_PATH,
  type HallItem,
  hallItemSchema,
} from '@rainforest-dev/library-contract';
import { z } from 'zod';

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
  /** Items the collection sent that did not match the contract and were left off the shelf. */
  skipped?: number;
}

/** The envelope only: each item is checked on its own, so one bad item never empties a shelf. */
const envelopeSchema = z.object({ items: z.array(z.unknown()) });

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
    const parsed = envelopeSchema.safeParse(await response.json());
    if (!parsed.success) return failed;
    const items: HallItem[] = [];
    for (const raw of parsed.data.items) {
      const item = hallItemSchema.safeParse(raw);
      if (item.success) items.push(item.data);
    }
    const skipped = parsed.data.items.length - items.length;
    if (skipped > 0)
      console.warn(
        `[hall] ${collection}: left ${skipped} of ${parsed.data.items.length} items off the shelf; they do not match the hall-items contract`,
      );
    return {
      status: {
        collection,
        ok: true,
        count: items.length,
        ...(skipped > 0 && { skipped }),
      },
      items,
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
