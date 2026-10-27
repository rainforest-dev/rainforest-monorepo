import {
  cityOfAddress,
  type EventKind,
  type EventSource,
  type EventsResponse,
  type LibraryEvent,
  libraryEventSchema,
  matchEventTopics,
  taipeiDay,
} from '@rainforest-dev/library-contract';
import { z } from 'zod';

/**
 * The magazine rack's events, read from two public sources with no key: the Ministry of
 * Culture's arts-events open data (every city, mostly exhibitions) and Taipei's travel API,
 * which lists the capital's exhibitions the ministry misses.
 */
export const MOC_URL =
  'https://cloud.culture.tw/frontsite/trans/SearchShowAction.do?method=doFindTypeJ';
export const TAIPEI_URL =
  'https://www.travel.taipei/open-api/zh-tw/Events/Activity';

/**
 * Ministry categories read: 6 exhibitions, whole; 4 family and 15 other, only for what is an
 * exhibition or a market by its title. The rest are performances and talks.
 */
/** An exhibition or a market by its title; `展演` is a performance. */
export function looksLikeShowOrMarket(title: string): boolean {
  return title.includes('市集') || title.replaceAll('展演', '').includes('展');
}

const MOC_CATEGORIES = [
  { category: 6, keep: () => true },
  { category: 4, keep: looksLikeShowOrMarket },
  { category: 15, keep: looksLikeShowOrMarket },
] as const;

/** Both sources change a few times a day at most. */
export const EVENTS_TTL_MS = 6 * 60 * 60_000;
/** After a failure, ask again this soon, so a dead source costs one request. */
const RETRY_MS = 15 * 60_000;
/** A source that keeps failing keeps its last events this long, then drops them. */
const STALE_MS = 48 * 60 * 60_000;
const TIMEOUT_MS = 20_000;
/** Taipei pages 30 events at a time; stop here whatever its total says. */
const TAIPEI_MAX_PAGES = 10;

const mocShowSchema = z.object({
  time: z.string().optional(),
  location: z.string().optional(),
  locationName: z.string().optional(),
  price: z.string().optional(),
  endTime: z.string().optional(),
});

const mocItemSchema = z.object({
  UID: z.string().min(1),
  title: z.string().min(1),
  showInfo: z.array(mocShowSchema).optional().default([]),
  descriptionFilterHtml: z.string().optional(),
  sourceWebPromote: z.string().optional(),
  webSales: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const taipeiItemSchema = z.object({
  id: z.union([z.number(), z.string()]),
  title: z.string().min(1),
  description: z.string().nullish(),
  begin: z.string().nullish(),
  end: z.string().nullish(),
  address: z.string().nullish(),
  url: z.string().nullish(),
  ticket: z.string().nullish(),
});

const taipeiPageSchema = z.object({
  total: z.number().optional(),
  data: z.array(z.unknown()),
});

/** `2026/10/27`, `2026-10-27 09:00:00 +08:00` and the like, as `2026-10-27`. */
export function dayOf(raw: string | null | undefined): string | null {
  const match = raw?.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!match) return null;
  const [, y, m, d] = match;
  return `${y}-${m?.padStart(2, '0')}-${d?.padStart(2, '0')}`;
}

function kindOf(title: string): EventKind {
  return title.includes('市集') ? 'market' : 'exhibition';
}

function webUrl(...candidates: (string | null | undefined)[]) {
  return candidates
    .map((url) => url?.trim())
    .find((url) => url && /^https?:\/\//i.test(url) && url.length <= 2048);
}

const clip = (text: string | null | undefined, max: number) => {
  const trimmed = text?.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
};

/** One ministry item as an event, or `null` when it has no usable dates. */
export function mocEvent(raw: unknown): LibraryEvent | null {
  const parsed = mocItemSchema.safeParse(raw);
  if (!parsed.success) return null;
  const item = parsed.data;
  const shows = item.showInfo;
  const start =
    dayOf(item.startDate) ??
    shows.map((s) => dayOf(s.time)).find((d) => d !== null) ??
    null;
  const end =
    dayOf(item.endDate) ??
    shows
      .map((s) => dayOf(s.endTime))
      .filter((d): d is string => d !== null)
      .sort()
      .at(-1) ??
    start;
  if (!start || !end) return null;
  const cities = [
    ...new Set(
      shows
        .map((s) => (s.location ? cityOfAddress(s.location) : null))
        .filter((c): c is string => c !== null),
    ),
  ];
  const first = shows[0];
  const event = {
    id: `moc:${item.UID}`,
    source: 'moc' as const,
    kind: kindOf(item.title),
    title: clip(item.title, 300) ?? item.title,
    start,
    end: end < start ? start : end,
    venue: clip(first?.locationName, 200),
    cities,
    address: clip(first?.location, 300),
    topics: matchEventTopics(
      `${item.title} ${item.descriptionFilterHtml ?? ''}`,
    ),
    price: clip(first?.price, 300),
    url: webUrl(
      item.sourceWebPromote,
      `https://cloud.culture.tw/frontsite/inquiry/eventInquiryAction.do?method=showEventDetail&uid=${encodeURIComponent(item.UID)}`,
    ),
  };
  const checked = libraryEventSchema.safeParse(event);
  return checked.success ? checked.data : null;
}

/** One Taipei item as an event, or `null` when it has no usable dates. */
export function taipeiEvent(raw: unknown): LibraryEvent | null {
  const parsed = taipeiItemSchema.safeParse(raw);
  if (!parsed.success) return null;
  const item = parsed.data;
  const start = dayOf(item.begin);
  const end = dayOf(item.end) ?? start;
  if (!start || !end) return null;
  const event = {
    id: `taipei:${item.id}`,
    source: 'taipei' as const,
    kind: kindOf(item.title),
    title: clip(item.title, 300) ?? item.title,
    start,
    end: end < start ? start : end,
    cities: ['臺北市'],
    address: clip(item.address, 300),
    topics: matchEventTopics(`${item.title} ${item.description ?? ''}`),
    price: clip(item.ticket, 300),
    url: webUrl(item.url),
  };
  const checked = libraryEventSchema.safeParse(event);
  return checked.success ? checked.data : null;
}

type Fetcher = typeof fetch;

async function getJson(fetcher: Fetcher, url: string): Promise<unknown> {
  const response = await fetcher(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      accept: 'application/json',
      'user-agent':
        'rainforest-library/1.0 (+https://library.rainforest.tools)',
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  return response.json();
}

export async function fetchMocEvents(
  fetcher: Fetcher,
  base = MOC_URL,
): Promise<LibraryEvent[]> {
  const lists = await Promise.all(
    MOC_CATEGORIES.map(async ({ category, keep }) => {
      const body = await getJson(fetcher, `${base}&category=${category}`);
      if (!Array.isArray(body))
        throw new Error(`category ${category} is not a list`);
      return body
        .map(mocEvent)
        .filter((e): e is LibraryEvent => e !== null && keep(e.title));
    }),
  );
  return lists.flat();
}

export async function fetchTaipeiEvents(
  fetcher: Fetcher,
  base = TAIPEI_URL,
): Promise<LibraryEvent[]> {
  const events: LibraryEvent[] = [];
  for (let page = 1; page <= TAIPEI_MAX_PAGES; page++) {
    const body = taipeiPageSchema.parse(
      await getJson(fetcher, `${base}?page=${page}`),
    );
    for (const raw of body.data) {
      const event = taipeiEvent(raw);
      if (event) events.push(event);
    }
    const total = body.total ?? 0;
    if (body.data.length === 0 || page * 30 >= total) break;
  }
  return events;
}

/** The same event listed by both sources keeps the ministry's copy. */
export function mergeEvents(
  lists: readonly (readonly LibraryEvent[])[],
  today: string,
): LibraryEvent[] {
  const seen = new Set<string>();
  const out: LibraryEvent[] = [];
  for (const event of lists.flat()) {
    if (event.end < today) continue;
    const key = `${event.title.replace(/\s+/g, '')}|${event.start}`;
    if (seen.has(key) || seen.has(event.id)) continue;
    seen.add(key);
    seen.add(event.id);
    out.push(event);
  }
  return out;
}

interface SourceState {
  /** When the source was last asked, and when it last answered. */
  at: number;
  readAt: number;
  events: LibraryEvent[];
  ok: boolean;
}

const state = new Map<EventSource, SourceState>();
let inflight: Promise<EventsResponse> | null = null;
let warned = new Set<EventSource>();

/** Forgets every source's events; for tests. */
export function resetEventsCache() {
  state.clear();
  inflight = null;
  warned = new Set();
}

async function refresh(
  source: EventSource,
  read: () => Promise<LibraryEvent[]>,
  now: number,
) {
  const last = state.get(source);
  if (last && now - last.at < (last.ok ? EVENTS_TTL_MS : RETRY_MS)) return;
  try {
    const events = await read();
    state.set(source, { at: now, readAt: now, events, ok: true });
    warned.delete(source);
  } catch (error) {
    if (!warned.has(source)) {
      warned.add(source);
      console.warn(
        `[events] ${source} could not be read; keeping its last events for up to two days: ${String(error)}`,
      );
    }
    const kept =
      last && now - last.readAt < STALE_MS
        ? last.events
        : ([] as LibraryEvent[]);
    state.set(source, {
      at: now,
      readAt: last?.readAt ?? -Infinity,
      events: kept,
      ok: false,
    });
  }
}

/**
 * Every current or coming event from both sources, each read at most every six hours.
 * `EVENTS_SOURCES=off` turns reading off, for tests and the artifact smoke run; `EVENTS_MOC_URL`
 * and `EVENTS_TAIPEI_URL` point a source somewhere else.
 */
export async function loadEvents(
  env: Record<string, string | undefined> = process.env,
  fetcher: Fetcher = fetch,
  now = Date.now(),
): Promise<EventsResponse> {
  if (env['EVENTS_SOURCES']?.trim() === 'off')
    return { events: [], fetchedAt: null, failed: [] };
  if (inflight) return inflight;
  inflight = (async () => {
    await Promise.all([
      refresh(
        'moc',
        () => fetchMocEvents(fetcher, env['EVENTS_MOC_URL']?.trim() || MOC_URL),
        now,
      ),
      refresh(
        'taipei',
        () =>
          fetchTaipeiEvents(
            fetcher,
            env['EVENTS_TAIPEI_URL']?.trim() || TAIPEI_URL,
          ),
        now,
      ),
    ]);
    const moc = state.get('moc');
    const taipei = state.get('taipei');
    const readAt = Math.max(
      moc?.readAt ?? -Infinity,
      taipei?.readAt ?? -Infinity,
    );
    return {
      events: mergeEvents(
        [moc?.events ?? [], taipei?.events ?? []],
        taipeiDay(new Date(now)),
      ),
      fetchedAt: Number.isFinite(readAt)
        ? new Date(readAt).toISOString()
        : null,
      failed: (['moc', 'taipei'] as const).filter(
        (source) => state.get(source)?.ok === false,
      ),
    };
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
