import { afterEach, describe, expect, it } from 'vitest';

import {
  dayOf,
  EVENTS_TTL_MS,
  fetchTaipeiEvents,
  loadEvents,
  looksLikeShowOrMarket,
  mergeEvents,
  mocEvent,
  resetEventsCache,
  taipeiEvent,
} from './events.js';

const MOC_ITEM = {
  UID: '5b3dd544',
  title: '昆蟲小腦袋大學問特展',
  showInfo: [
    {
      time: '2026/10/18 09:00:00',
      location: '臺中市40453 臺中市北區館前路一號',
      locationName: '科博館',
      price: '全票100元',
      endTime: '2027/04/30 17:00:00',
    },
  ],
  descriptionFilterHtml: '親子一起認識昆蟲',
  sourceWebPromote: '',
  startDate: '2026/10/18',
  endDate: '2027/04/30',
};

const TAIPEI_ITEM = {
  id: 42,
  title: '稻埕手作市集',
  description: '手作與無肉小吃',
  begin: '2026-11-07 00:00:00 +08:00',
  end: '2026-11-08 23:59:59 +08:00',
  address: '臺北市大同區',
  url: 'https://www.travel.taipei/zh-tw/event-calendar/details/42',
};

function stubFetch(routes: Record<string, unknown>, calls: string[] = []) {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key || routes[key] === undefined)
      return new Response('nope', { status: 404 });
    return Response.json(routes[key]);
  }) as typeof fetch;
}

describe('dayOf', () => {
  it.each([
    ['2026/10/27', '2026-10-27'],
    ['2026-10-03 00:00:00 +08:00', '2026-10-03'],
    ['2026/1/5 09:00', '2026-01-05'],
    ['2026/13/45', null],
    ['2026/02/30', null],
    ['', null],
    [undefined, null],
  ])('reads %s', (raw, day) => {
    expect(dayOf(raw)).toBe(day);
  });
});

describe('mocEvent', () => {
  it('reads an exhibition with its city, venue and topics', () => {
    expect(mocEvent(MOC_ITEM)).toEqual({
      id: 'moc:5b3dd544',
      source: 'moc',
      kind: 'exhibition',
      title: '昆蟲小腦袋大學問特展',
      start: '2026-10-18',
      end: '2027-04-30',
      venue: '科博館',
      cities: ['臺中市'],
      address: '臺中市40453 臺中市北區館前路一號',
      topics: ['science', 'kids'],
      price: '全票100元',
      url: 'https://cloud.culture.tw/frontsite/inquiry/eventInquiryAction.do?method=showEventDetail&uid=5b3dd544',
    });
  });

  it('falls back to the show dates', () => {
    const event = mocEvent({ ...MOC_ITEM, startDate: '', endDate: '' });
    expect(event?.start).toBe('2026-10-18');
    expect(event?.end).toBe('2027-04-30');
  });

  it('drops an item with no dates at all', () => {
    expect(
      mocEvent({ ...MOC_ITEM, startDate: '', endDate: '', showInfo: [] }),
    ).toBeNull();
  });

  it('drops a promotion link that is not a web page', () => {
    expect(
      mocEvent({ ...MOC_ITEM, sourceWebPromote: 'javascript:alert(1)' })?.url,
    ).toMatch(/^https:\/\/cloud\.culture\.tw/);
  });
});

describe('taipeiEvent', () => {
  it('reads a Taipei market', () => {
    expect(taipeiEvent(TAIPEI_ITEM)).toMatchObject({
      id: 'taipei:42',
      kind: 'market',
      start: '2026-11-07',
      end: '2026-11-08',
      cities: ['臺北市'],
      topics: ['handmade', 'vegetarian'],
    });
  });
});

describe('looksLikeShowOrMarket', () => {
  it.each([
    ['親子玩具特展', true],
    ['週末手作市集', true],
    ['年度舞蹈展演', false],
    ['兒童劇', false],
  ])('%s', (title, kept) => {
    expect(looksLikeShowOrMarket(title)).toBe(kept);
  });
});

describe('fetchTaipeiEvents', () => {
  it('reads every page up to the total', async () => {
    const calls: string[] = [];
    const page = (n: number) =>
      Array.from({ length: 30 }, (_, i) => ({
        ...TAIPEI_ITEM,
        id: n * 100 + i,
      }));
    const fetcher = (async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      const n = Number(new URL(url).searchParams.get('page'));
      return Response.json({
        total: 45,
        data: n === 1 ? page(1) : page(2).slice(0, 15),
      });
    }) as typeof fetch;
    const events = await fetchTaipeiEvents(fetcher, 'https://t.test/events');
    expect(events).toHaveLength(45);
    expect(calls).toEqual([
      'https://t.test/events?page=1',
      'https://t.test/events?page=2',
    ]);
  });
});

describe('mergeEvents', () => {
  it('drops what is over and the second copy of the same event', () => {
    const a = mocEvent(MOC_ITEM);
    if (!a) throw new Error('fixture did not parse');
    const merged = mergeEvents(
      [
        [a, { ...a, id: 'moc:old', title: '舊展', end: '2026-10-01' }],
        [{ ...a, id: 'taipei:1', source: 'taipei' }],
      ],
      '2026-10-27',
    );
    expect(merged.map((e) => e.id)).toEqual(['moc:5b3dd544']);
  });
});

describe('loadEvents', () => {
  afterEach(() => resetEventsCache());
  const env = {};
  const now = Date.parse('2026-10-27T04:00:00Z');
  const routes = {
    'category=6': [MOC_ITEM],
    'category=4': [{ ...MOC_ITEM, UID: 'k', title: '兒童劇' }],
    'category=15': [],
    'Events/Activity': { total: 1, data: [TAIPEI_ITEM] },
  };

  it('merges both sources and reads them once per six hours', async () => {
    const calls: string[] = [];
    const fetcher = stubFetch(routes, calls);
    const first = await loadEvents(env, fetcher, now);
    expect(first.events.map((e) => e.id)).toEqual([
      'moc:5b3dd544',
      'taipei:42',
    ]);
    expect(first.failed).toEqual([]);
    expect(first.fetchedAt).toBe('2026-10-27T04:00:00.000Z');
    const count = calls.length;
    await loadEvents(env, fetcher, now + EVENTS_TTL_MS - 1);
    expect(calls.length).toBe(count);
    await loadEvents(env, fetcher, now + EVENTS_TTL_MS);
    expect(calls.length).toBeGreaterThan(count);
  });

  it('keeps a failing source’s last events and says it failed', async () => {
    await loadEvents(env, stubFetch(routes), now);
    const later = now + EVENTS_TTL_MS;
    const result = await loadEvents(
      env,
      stubFetch({ ...routes, 'Events/Activity': undefined }),
      later,
    );
    expect(result.failed).toEqual(['taipei']);
    expect(result.events.map((e) => e.id)).toContain('taipei:42');
  });

  it('asks a failed source again only after 15 minutes, and drops its events after two days', async () => {
    await loadEvents(env, stubFetch(routes), now);
    const down = { ...routes, 'Events/Activity': undefined };
    const failedAt = now + EVENTS_TTL_MS;
    await loadEvents(env, stubFetch(down), failedAt);
    const calls: string[] = [];
    await loadEvents(env, stubFetch(down, calls), failedAt + 14 * 60_000);
    expect(calls.some((url) => url.includes('Events/Activity'))).toBe(false);
    const late = await loadEvents(env, stubFetch(down), now + 49 * 3_600_000);
    expect(late.failed).toContain('taipei');
    expect(late.events.map((e) => e.id)).not.toContain('taipei:42');
  });

  it('reads nothing when switched off', async () => {
    const calls: string[] = [];
    const result = await loadEvents(
      { EVENTS_SOURCES: 'off' },
      stubFetch(routes, calls),
      now,
    );
    expect(result).toEqual({ events: [], fetchedAt: null, failed: [] });
    expect(calls).toEqual([]);
  });
});
