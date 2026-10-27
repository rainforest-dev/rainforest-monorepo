import {
  EVENTS_PATH,
  eventsResponseSchema,
  type LibraryEvent,
} from '@rainforest-dev/library-contract';

/**
 * The reading room reads the event sources and keeps them for hours; the hall asks it at most
 * this often, so a page load never waits on the reading room twice in a row.
 */
export const HALL_EVENTS_TTL_MS = 5 * 60_000;
const TIMEOUT_MS = 5000;

let cached: { url: string; at: number; events: LibraryEvent[] } | null = null;
let warned = false;

/** Forgets the cached events; for tests. */
export function resetHallEventsCache() {
  cached = null;
  warned = false;
}

/** The reading room's events endpoint, from `LIBRARY_RACK_URL`, or `null` when there is none. */
export function eventsUrl(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const base = env['LIBRARY_RACK_URL']?.trim();
  if (!base) return null;
  return `${base.replace(/\/+$/, '')}${EVENTS_PATH}`;
}

/**
 * Every current event the reading room knows, read through to it at most every five minutes.
 * When it cannot be reached the last list stands; with none, the rack is empty.
 */
export async function loadHallEvents(
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<LibraryEvent[]> {
  const url = eventsUrl(env);
  if (!url) return [];
  const last = cached?.url === url ? cached : null;
  if (last && now - last.at < HALL_EVENTS_TTL_MS) return last.events;
  try {
    const response = await fetcher(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { events } = eventsResponseSchema.parse(await response.json());
    cached = { url, at: now, events };
    warned = false;
    return events;
  } catch (error) {
    if (!warned) {
      warned = true;
      console.warn(
        `[hall] events from ${url} could not be read; the magazine rack keeps its last events: ${String(error)}`,
      );
    }
    // Ask again on the next visit after the usual wait, not on every request.
    cached = { url, at: now, events: last?.events ?? [] };
    return cached.events;
  }
}
