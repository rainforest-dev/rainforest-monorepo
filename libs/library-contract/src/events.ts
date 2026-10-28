import { z } from 'zod';

import { type LibraryLocale } from './locale';

/**
 * Exhibitions and markets on the library's magazine rack. The reading room gathers them from
 * public sources and serves them at `/rack/api/events`; the hall shelves the ones the reader
 * subscribes to. Unlike a hall item, an event ends, and links off the library to its source.
 */
export const EVENTS_PATH = '/api/events';
/** The magazine rack's page in the reading room, where the reader picks what to subscribe to. */
export const EVENTS_PAGE_HREF = '/rack/events';
/**
 * An event's picture, served by the reading room from the library's own origin, so the hall can
 * draw it into its 3D scene; a picture on another site cannot be read back into WebGL.
 */
export const EVENT_COVER_PATH = '/api/events/cover';
export function eventCoverHref(id: string): string {
  return `/rack${EVENT_COVER_PATH}/${encodeURIComponent(id)}`;
}

export const EVENT_SOURCES = ['moc', 'taipei'] as const;
export type EventSource = (typeof EVENT_SOURCES)[number];

export const EVENT_KINDS = ['exhibition', 'market'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** A calendar day in Taipei, `YYYY-MM-DD`. */
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'a YYYY-MM-DD day');
const webUrl = z
  .string()
  .regex(/^https?:\/\//i, 'an http(s) URL')
  .max(2048);

export const libraryEventSchema = z.object({
  /** `<source>:<id at the source>`, stable across fetches. */
  id: z.string().min(1).max(200),
  source: z.enum(EVENT_SOURCES),
  kind: z.enum(EVENT_KINDS),
  title: z.string().min(1).max(300),
  /** First and last day, inclusive. */
  start: isoDay,
  end: isoDay,
  venue: z.string().max(200).optional(),
  /** Every city the event is held in, as the government writes it: `臺北市`, `新北市`. */
  cities: z.array(z.string().min(1).max(20)),
  address: z.string().max(300).optional(),
  /** Topic keys from {@link EVENT_TOPICS} that the title or description mention. */
  topics: z.array(z.string().min(1).max(40)),
  price: z.string().max(300).optional(),
  /** The event's own page at its source or organiser. */
  url: webUrl.optional(),
  /** A poster or photo: the source's own, or the `og:image` of the event's page. */
  image: webUrl.optional(),
});
export type LibraryEvent = z.infer<typeof libraryEventSchema>;

export const eventsResponseSchema = z.object({
  events: z.array(libraryEventSchema),
  /** When the sources were last read, ISO; `null` before the first read succeeds. */
  fetchedAt: z.string().nullable(),
  /** Sources whose last read failed, so the page can say a shelf may be short. */
  failed: z.array(z.enum(EVENT_SOURCES)),
});
export type EventsResponse = z.infer<typeof eventsResponseSchema>;

export interface EventTopic {
  key: string;
  labels: Record<LibraryLocale, string>;
  /** Words that mark an event as on this topic, matched in its title and description. */
  words: readonly string[];
}

/** What the reader can subscribe to beyond places: matched by keyword, so an event can have several. */
export const EVENT_TOPICS: readonly EventTopic[] = [
  {
    key: 'handmade',
    labels: { zh: '手作', en: 'Handmade' },
    words: ['手作', '手工', '工藝', '編織', '陶藝', '木工'],
  },
  {
    key: 'toys',
    labels: { zh: '玩具', en: 'Toys' },
    words: ['玩具', '公仔', '模型', '桌遊', '積木'],
  },
  {
    key: 'environment',
    labels: { zh: '環境', en: 'Environment' },
    words: ['環境', '生態', '永續', '環保', '氣候', '海洋', '自然'],
  },
  {
    key: 'vegetarian',
    labels: { zh: '無肉蔬食', en: 'Meat-free' },
    words: ['無肉', '蔬食', '素食', '純素', '植物肉'],
  },
  {
    key: 'design',
    labels: { zh: '設計', en: 'Design' },
    words: ['設計', '建築', '字體'],
  },
  {
    key: 'art',
    labels: { zh: '藝術', en: 'Art' },
    words: ['藝術', '美術', '畫展', '個展', '聯展', '雕塑', '水墨', '油畫'],
  },
  {
    key: 'photography',
    labels: { zh: '攝影', en: 'Photography' },
    words: ['攝影', '影像', '照片'],
  },
  {
    key: 'science',
    labels: { zh: '科學科技', en: 'Science' },
    words: ['科學', '科技', '自然史', '昆蟲', '恐龍', '天文'],
  },
  {
    key: 'history',
    labels: { zh: '歷史文物', en: 'History' },
    words: ['歷史', '文物', '考古', '古蹟', '文化資產'],
  },
  {
    key: 'kids',
    labels: { zh: '親子', en: 'Family' },
    words: ['親子', '兒童', '孩童', '小朋友'],
  },
];

/** The topic keys whose words appear in `text`. */
export function matchEventTopics(text: string): string[] {
  return EVENT_TOPICS.filter((topic) =>
    topic.words.some((word) => text.includes(word)),
  ).map((topic) => topic.key);
}

/** `台` and `臺` are the same city; sources mix them. */
export function normalizeCity(city: string): string {
  return city.trim().replace(/^台/, '臺');
}

/** Taiwan's cities and counties in the government's order, for the place checkboxes. */
export const TAIWAN_CITIES = [
  '臺北市',
  '新北市',
  '基隆市',
  '桃園市',
  '新竹市',
  '新竹縣',
  '苗栗縣',
  '臺中市',
  '彰化縣',
  '南投縣',
  '雲林縣',
  '嘉義市',
  '嘉義縣',
  '臺南市',
  '高雄市',
  '屏東縣',
  '宜蘭縣',
  '花蓮縣',
  '臺東縣',
  '澎湖縣',
  '金門縣',
  '連江縣',
] as const;

/**
 * The city a free-text address starts with, or `null`. Addresses lead with the city, sometimes
 * after a postcode or with `台` for `臺`: `臺中市40453 臺中市北區…`, `台北市中正區…`.
 */
export function cityOfAddress(address: string): string | null {
  const text = normalizeCity(address.replace(/^\d+\s*/, ''));
  return TAIWAN_CITIES.find((city) => text.startsWith(city)) ?? null;
}

/**
 * What the reader subscribes to. An empty list means everything of that kind: no places picked
 * is all of Taiwan, no topics picked is every topic.
 */
const subscriptionsSchema = z.object({
  cities: z.array(z.string().min(1).max(20)).max(40).catch([]),
  topics: z.array(z.string().min(1).max(40)).max(40).catch([]),
  sources: z.array(z.enum(EVENT_SOURCES)).max(10).catch([]),
});
export type EventSubscriptions = z.infer<typeof subscriptionsSchema>;

export const EMPTY_EVENT_SUBSCRIPTIONS: EventSubscriptions = {
  cities: [],
  topics: [],
  sources: [],
};

/** Starting points the subscription panel offers in one click. */
export const EVENT_PRESETS: readonly {
  key: string;
  labels: Record<LibraryLocale, string>;
  topics: readonly string[];
}[] = [
  {
    key: 'crafts',
    labels: { zh: '手作與玩具', en: 'Crafts and toys' },
    topics: ['handmade', 'toys'],
  },
  {
    key: 'green',
    labels: { zh: '環境與無肉', en: 'Green and meat-free' },
    topics: ['environment', 'vegetarian'],
  },
];

/** The subscriptions cookie, shared by the reading room's page and the hall's rack. */
export const LIBRARY_EVENTS_COOKIE = 'library-events';

export function parseEventSubscriptions(
  raw: string | undefined | null,
): EventSubscriptions {
  if (!raw) return { ...EMPTY_EVENT_SUBSCRIPTIONS };
  let value: unknown;
  for (const text of [raw, safeDecode(raw)]) {
    try {
      value = JSON.parse(text);
      break;
    } catch {
      value = undefined;
    }
  }
  if (typeof value !== 'object' || value === null)
    return { ...EMPTY_EVENT_SUBSCRIPTIONS };
  const result = subscriptionsSchema.safeParse({
    ...EMPTY_EVENT_SUBSCRIPTIONS,
    ...value,
  });
  return result.success ? result.data : { ...EMPTY_EVENT_SUBSCRIPTIONS };
}

function safeDecode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function serializeEventSubscriptions(subs: EventSubscriptions): string {
  return encodeURIComponent(JSON.stringify(subs));
}

/** The subscriptions cookie's raw value in a `Cookie` header. */
export function eventSubscriptionsFromCookieHeader(
  cookieHeader: string | null | undefined,
): string | null {
  for (const part of (cookieHeader ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === LIBRARY_EVENTS_COOKIE) return rest.join('=');
  }
  return null;
}

/** Whether an event is one the reader subscribes to. */
export function matchesSubscriptions(
  event: LibraryEvent,
  subs: EventSubscriptions,
): boolean {
  if (subs.sources.length > 0 && !subs.sources.includes(event.source))
    return false;
  if (
    subs.cities.length > 0 &&
    !event.cities.some((city) => subs.cities.includes(city))
  )
    return false;
  if (
    subs.topics.length > 0 &&
    !event.topics.some((topic) => subs.topics.includes(topic))
  )
    return false;
  return true;
}

/** The rack's shelves, top to bottom. */
export const EVENT_SHELVES = ['ending', 'now', 'market', 'soon'] as const;
export type EventShelf = (typeof EVENT_SHELVES)[number];

/** An exhibition that ends within this many days sits on the top shelf. */
export const ENDING_DAYS = 7;
/** Markets this close show on the market shelf. */
export const MARKET_DAYS = 14;
/** Exhibitions opening this close show on the bottom shelf; later ones only on the page. */
export const SOON_DAYS = 60;

const DAY_MS = 86_400_000;

function dayNumber(day: string): number {
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
}

/** Today in Taipei as `YYYY-MM-DD`. */
export function taipeiDay(now: Date = new Date()): string {
  return new Date(now.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

/** Days from `from` to `to`, both `YYYY-MM-DD`. */
export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

/**
 * The shelf an event belongs on today, or `null` when it is over or too far off to show. An
 * event that has not started is `soon` (or `market`), one that has is `now` until its last
 * week, then `ending`.
 */
export function eventShelf(
  event: Pick<LibraryEvent, 'kind' | 'start' | 'end'>,
  today: string,
): EventShelf | null {
  if (daysBetween(today, event.end) < 0) return null;
  const untilStart = daysBetween(today, event.start);
  if (event.kind === 'market')
    return untilStart <= MARKET_DAYS ? 'market' : null;
  if (untilStart > 0) return untilStart <= SOON_DAYS ? 'soon' : null;
  return daysBetween(today, event.end) < ENDING_DAYS ? 'ending' : 'now';
}

/**
 * Events on each shelf, each shelf in the order a reader scans it: what ends or opens first
 * comes first.
 */
export function shelveEvents(
  events: readonly LibraryEvent[],
  today: string,
): Record<EventShelf, LibraryEvent[]> {
  const shelves: Record<EventShelf, LibraryEvent[]> = {
    ending: [],
    now: [],
    market: [],
    soon: [],
  };
  for (const event of events) {
    const shelf = eventShelf(event, today);
    if (shelf) shelves[shelf].push(event);
  }
  const byEnd = (a: LibraryEvent, b: LibraryEvent) =>
    a.end.localeCompare(b.end) || a.title.localeCompare(b.title);
  const byStart = (a: LibraryEvent, b: LibraryEvent) =>
    a.start.localeCompare(b.start) || byEnd(a, b);
  shelves.ending.sort(byEnd);
  shelves.now.sort(byEnd);
  shelves.market.sort(byStart);
  shelves.soon.sort(byStart);
  return shelves;
}
