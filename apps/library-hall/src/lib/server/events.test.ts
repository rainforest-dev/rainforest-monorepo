import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  eventsUrl,
  HALL_EVENTS_TTL_MS,
  loadHallEvents,
  resetHallEventsCache,
} from './events';

const EVENT = {
  id: 'moc:1',
  source: 'moc',
  kind: 'exhibition',
  title: '苔與石之庭',
  start: '2026-10-01',
  end: '2026-11-30',
  cities: ['臺北市'],
  topics: ['environment'],
};
const env = { LIBRARY_RACK_URL: 'http://rack.test/rack/' };

describe('loadHallEvents', () => {
  beforeEach(() => {
    resetHallEventsCache();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('asks the reading room under its base path', () => {
    expect(eventsUrl(env)).toBe('http://rack.test/rack/api/events');
    expect(eventsUrl({})).toBeNull();
  });

  it('reads the events and asks again only after five minutes', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ events: [EVENT], fetchedAt: null, failed: [] }),
    );
    const f = fetcher as typeof fetch;
    expect(await loadHallEvents(env, f, 0)).toEqual([EVENT]);
    await loadHallEvents(env, f, HALL_EVENTS_TTL_MS - 1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await loadHallEvents(env, f, HALL_EVENTS_TTL_MS);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('keeps the last events when the reading room is down', async () => {
    const ok = vi.fn(async () =>
      Response.json({ events: [EVENT], fetchedAt: null, failed: [] }),
    );
    await loadHallEvents(env, ok as typeof fetch, 0);
    const down = vi.fn(async () => new Response('', { status: 502 }));
    expect(
      await loadHallEvents(env, down as typeof fetch, HALL_EVENTS_TTL_MS),
    ).toEqual([EVENT]);
  });

  it('has no events without a reading room', async () => {
    const fetcher = vi.fn();
    expect(await loadHallEvents({}, fetcher as typeof fetch, 0)).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
