import { type LibraryEvent } from '@rainforest-dev/library-contract';

import { openPublic, withTimeout } from './event-images.js';

/**
 * Event pictures served from the library's own origin, so the hall can draw them in its 3D
 * scene: WebGL refuses a picture from a site that sends no CORS headers, and most organisers
 * send none. Each picture is fetched once and kept in memory, within a small budget.
 */

/** Only raster pictures; an SVG can carry script. */
const IMAGE_TYPES = /^image\/(jpeg|png|webp|gif|avif)$/;
const MAX_COVER_BYTES = 2 * 1024 * 1024;
/** The container is small; the rack shows sixteen covers at a time. */
const CACHE_BYTES = 24 * 1024 * 1024;
const FOUND_TTL_MS = 24 * 60 * 60_000;
const FAILED_TTL_MS = 60 * 60_000;
const TIMEOUT_MS = 10_000;

export interface EventCover {
  type: string;
  bytes: Uint8Array<ArrayBuffer>;
}

interface Entry {
  cover: EventCover | null;
  at: number;
}

/** Keyed by picture URL, oldest use first, so the first key is the one to evict. */
const covers = new Map<string, Entry>();
let cached = 0;
const reading = new Map<string, Promise<EventCover | null>>();

/** Forgets every picture; for tests. */
export function resetEventCovers() {
  covers.clear();
  reading.clear();
  cached = 0;
}

function remember(url: string, entry: Entry) {
  forget(url);
  covers.set(url, entry);
  cached += entry.cover?.bytes.byteLength ?? 0;
  for (const [key, old] of covers) {
    if (cached <= CACHE_BYTES) break;
    if (key === url) continue;
    covers.delete(key);
    cached -= old.cover?.bytes.byteLength ?? 0;
  }
}

function forget(url: string) {
  const old = covers.get(url);
  if (!old) return;
  covers.delete(url);
  cached -= old.cover?.bytes.byteLength ?? 0;
}

async function fetchCover(
  fetcher: typeof fetch,
  url: string,
  allowPrivate: boolean,
): Promise<EventCover | null> {
  return withTimeout(TIMEOUT_MS, url, async (signal) => {
    const response = await openPublic(fetcher, url, {
      signal,
      accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif',
      allowPrivate,
    });
    const type = (response.headers.get('content-type') ?? '')
      .split(';')[0]
      ?.trim()
      .toLowerCase();
    const declared = Number(response.headers.get('content-length'));
    if (
      !type ||
      !IMAGE_TYPES.test(type) ||
      !response.body ||
      declared > MAX_COVER_BYTES
    ) {
      await response.body?.cancel().catch(() => undefined);
      return null;
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_COVER_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { type, bytes };
  });
}

/**
 * The picture of `event`, read through the same public-address checks as event pages, or `null`
 * when it has none, it is not a raster picture, it is too big, or it could not be read.
 */
export async function eventCover(
  event: Pick<LibraryEvent, 'image'>,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
  options: { allowPrivate?: boolean } = {},
): Promise<EventCover | null> {
  const url = event.image;
  if (!url) return null;
  const entry = covers.get(url);
  if (entry && now - entry.at < (entry.cover ? FOUND_TTL_MS : FAILED_TTL_MS)) {
    // Mark it recently used.
    covers.delete(url);
    covers.set(url, entry);
    return entry.cover;
  }
  const pending = reading.get(url);
  if (pending) return pending;
  const read = fetchCover(fetcher, url, options.allowPrivate ?? false)
    .catch(() => null)
    .then((cover) => {
      remember(url, { cover, at: now });
      reading.delete(url);
      return cover;
    });
  reading.set(url, read);
  return read;
}
