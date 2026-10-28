import { afterEach, describe, expect, it, vi } from 'vitest';

import { eventCover, resetEventCovers } from './event-covers.js';

vi.mock('node:dns/promises', () => ({
  lookup: (host: string) =>
    Promise.resolve([
      {
        address: host === 'nas-alias.test' ? '192.168.1.20' : '93.184.216.34',
        family: 4,
      },
    ]),
}));

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

function stub(
  responses: Record<string, () => Response>,
  calls: string[] = [],
): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    return responses[url]?.() ?? new Response('nope', { status: 404 });
  }) as typeof fetch;
}

const png = () =>
  new Response(PNG, { headers: { 'content-type': 'image/png' } });

describe('eventCover', () => {
  afterEach(resetEventCovers);
  const now = Date.parse('2026-10-28T00:00:00Z');

  it('reads a raster picture once and keeps it', async () => {
    const calls: string[] = [];
    const fetcher = stub({ 'https://museum.test/a.png': png }, calls);
    const event = { image: 'https://museum.test/a.png' };
    const [first, second] = await Promise.all([
      eventCover(event, fetcher, now),
      eventCover(event, fetcher, now),
    ]);
    expect(first?.type).toBe('image/png');
    expect([...(first?.bytes ?? [])]).toEqual([...PNG]);
    expect(second).toEqual(first);
    expect((await eventCover(event, fetcher, now + 60_000))?.type).toBe(
      'image/png',
    );
    expect(calls).toHaveLength(1);
  });

  it('refuses an SVG, a page and a picture too big', async () => {
    const fetcher = stub({
      'https://museum.test/a.svg': () =>
        new Response('<svg/>', {
          headers: { 'content-type': 'image/svg+xml' },
        }),
      'https://museum.test/page': () =>
        new Response('<html>', { headers: { 'content-type': 'text/html' } }),
      'https://museum.test/huge.jpg': () =>
        new Response(new Uint8Array(3 * 1024 * 1024), {
          headers: { 'content-type': 'image/jpeg' },
        }),
    });
    for (const image of [
      'https://museum.test/a.svg',
      'https://museum.test/page',
      'https://museum.test/huge.jpg',
    ])
      expect(await eventCover({ image }, fetcher, now)).toBeNull();
  });

  it('never fetches a private address, nor follows a redirect to one', async () => {
    const calls: string[] = [];
    const fetcher = stub(
      {
        'https://museum.test/hop.png': () =>
          new Response(null, {
            status: 302,
            headers: { location: 'https://nas-alias.test/a.png' },
          }),
      },
      calls,
    );
    expect(
      await eventCover({ image: 'http://192.168.1.10/a.png' }, fetcher, now),
    ).toBeNull();
    expect(
      await eventCover({ image: 'https://museum.test/hop.png' }, fetcher, now),
    ).toBeNull();
    expect(calls).toEqual(['https://museum.test/hop.png']);
  });

  it('asks a picture that failed again after an hour', async () => {
    const calls: string[] = [];
    let up = false;
    const fetcher = stub(
      {
        'https://museum.test/a.png': () =>
          up ? png() : new Response('down', { status: 503 }),
      },
      calls,
    );
    const event = { image: 'https://museum.test/a.png' };
    expect(await eventCover(event, fetcher, now)).toBeNull();
    up = true;
    expect(await eventCover(event, fetcher, now + 59 * 60_000)).toBeNull();
    expect(await eventCover(event, fetcher, now + 60 * 60_000)).not.toBeNull();
    expect(calls).toHaveLength(2);
  });

  it('serves nothing for an event without a picture', async () => {
    const calls: string[] = [];
    expect(await eventCover({}, stub({}, calls), now)).toBeNull();
    expect(calls).toEqual([]);
  });
});
