import { type LibraryEvent } from '@rainforest-dev/library-contract';
import { afterEach, describe, expect, it } from 'vitest';

import {
  isPublicHost,
  ogImageOf,
  resetEventImages,
  settleEventImages,
  webImageUrl,
  withPageImages,
} from './event-images.js';

const event = (id: string, url?: string, image?: string): LibraryEvent => ({
  id,
  source: 'moc',
  kind: 'exhibition',
  title: id,
  start: '2026-10-01',
  end: '2026-12-01',
  cities: ['臺北市'],
  topics: [],
  ...(url ? { url } : {}),
  ...(image ? { image } : {}),
});

const page = (image: string) =>
  `<html><head><meta content="${image}" property="og:image"></head><body>`;

function stubPages(pages: Record<string, string>, calls: string[] = []) {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    const body = pages[url];
    return body === undefined
      ? new Response('nope', { status: 404 })
      : new Response(body, { headers: { 'content-type': 'text/html' } });
  }) as typeof fetch;
}

describe('ogImageOf', () => {
  it('reads og:image in either attribute order, resolved against the page', () => {
    expect(
      ogImageOf(
        '<meta property="og:image" content="/p/a.jpg?w=1&amp;h=2">',
        'https://museum.test/show/1',
      ),
    ).toBe('https://museum.test/p/a.jpg?w=1&h=2');
    expect(ogImageOf(page('https://cdn.test/b.png'), 'https://x.test/')).toBe(
      'https://cdn.test/b.png',
    );
  });

  it('falls back to twitter:image and ignores other tags', () => {
    expect(
      ogImageOf(
        '<meta name="description" content="/no.jpg"><meta name="twitter:image" content="https://cdn.test/t.jpg">',
        'https://x.test/',
      ),
    ).toBe('https://cdn.test/t.jpg');
    expect(ogImageOf('<title>none</title>', 'https://x.test/')).toBeUndefined();
  });
});

describe('webImageUrl', () => {
  it('keeps web URLs only', () => {
    expect(webImageUrl('data:image/png;base64,AAA')).toBeUndefined();
    expect(webImageUrl('not a url')).toBeUndefined();
    expect(webImageUrl('http://x.test/a.jpg')).toBe('http://x.test/a.jpg');
    expect(webImageUrl('https://x.test/a.jpg?q=&amp;quot;')).toBe(
      'https://x.test/a.jpg?q=&quot;',
    );
  });
});

describe('isPublicHost', () => {
  it.each([
    ['www.chimeimuseum.org', true],
    ['8.8.8.8', true],
    ['[2001:db8::1]', true],
    ['localhost', false],
    ['homelab-n8n', false],
    ['host.docker.internal', false],
    ['nas.local', false],
    ['127.0.0.1', false],
    ['10.0.0.5', false],
    ['172.20.1.1', false],
    ['192.168.1.10', false],
    ['169.254.169.254', false],
    ['100.100.1.1', false],
    ['[::1]', false],
    ['[fd00::1]', false],
    ['[::ffff:192.168.1.1]', false],
  ])('%s → %s', (host, ok) => {
    expect(isPublicHost(host)).toBe(ok);
  });
});

describe('withPageImages', () => {
  afterEach(async () => {
    await settleEventImages();
    resetEventImages();
  });
  const now = Date.parse('2026-10-28T00:00:00Z');

  it('reads a page in the background and gives its picture on a later call', async () => {
    const calls: string[] = [];
    const fetcher = stubPages(
      { 'https://museum.test/1': page('https://museum.test/1.jpg') },
      calls,
    );
    const events = [event('a', 'https://museum.test/1')];
    expect(withPageImages(events, fetcher, now)[0]?.image).toBeUndefined();
    await settleEventImages();
    expect(withPageImages(events, fetcher, now)[0]?.image).toBe(
      'https://museum.test/1.jpg',
    );
    expect(calls).toEqual(['https://museum.test/1']);
  });

  it('keeps a source’s own picture and skips pages that need a login', async () => {
    const calls: string[] = [];
    const fetcher = stubPages({}, calls);
    const events = [
      event('own', 'https://museum.test/own', 'https://museum.test/own.jpg'),
      event('fb', 'https://www.facebook.com/events/1'),
      event('moc', 'https://cloud.culture.tw/frontsite/x'),
      event('none'),
    ];
    const out = withPageImages(events, fetcher, now);
    await settleEventImages();
    expect(out[0]?.image).toBe('https://museum.test/own.jpg');
    expect(calls).toEqual([]);
  });

  it('drops a picture three pages share, a site logo', async () => {
    const logo = 'https://gov.test/logo.png';
    const fetcher = stubPages({
      'https://gov.test/1': page(logo),
      'https://gov.test/2': page(logo),
      'https://gov.test/3': page(logo),
      'https://gov.test/4': page('https://gov.test/4.jpg'),
    });
    const events = [1, 2, 3, 4].map((n) =>
      event(`e${n}`, `https://gov.test/${n}`),
    );
    withPageImages(events, fetcher, now);
    await settleEventImages();
    expect(withPageImages(events, fetcher, now).map((e) => e.image)).toEqual([
      undefined,
      undefined,
      undefined,
      'https://gov.test/4.jpg',
    ]);
  });

  it('gives a site no pictures until all its pages are read, so a logo is never shown early', async () => {
    const logo = 'https://gov.test/logo.png';
    const { promise: gate, resolve: release } = Promise.withResolvers<void>();
    const fetcher = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url !== 'https://gov.test/1') await gate;
      return new Response(page(logo));
    }) as typeof fetch;
    const events = [1, 2, 3].map((n) =>
      event(`e${n}`, `https://gov.test/${n}`),
    );
    withPageImages(events, fetcher, now);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(withPageImages(events, fetcher, now)[0]?.image).toBeUndefined();
    release();
    await settleEventImages();
    expect(withPageImages(events, fetcher, now).map((e) => e.image)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('reads a page once while it is being read', async () => {
    const calls: string[] = [];
    const fetcher = stubPages(
      { 'https://museum.test/1': page('https://museum.test/1.jpg') },
      calls,
    );
    const events = [event('a', 'https://museum.test/1')];
    withPageImages(events, fetcher, now);
    withPageImages(events, fetcher, now);
    await settleEventImages();
    expect(calls).toHaveLength(1);
  });

  it('asks a page that failed again after an hour', async () => {
    const calls: string[] = [];
    const fetcher = stubPages({}, calls);
    const events = [event('a', 'https://museum.test/down')];
    withPageImages(events, fetcher, now);
    await settleEventImages();
    withPageImages(events, fetcher, now + 59 * 60_000);
    await settleEventImages();
    expect(calls).toHaveLength(1);
    withPageImages(events, fetcher, now + 60 * 60_000);
    await settleEventImages();
    expect(calls).toHaveLength(2);
  });

  it('keeps a page’s picture when a later read fails', async () => {
    let up = true;
    const fetcher = (async () =>
      up
        ? new Response(page('https://museum.test/1.jpg'))
        : new Response('down', { status: 503 })) as unknown as typeof fetch;
    const events = [event('a', 'https://museum.test/1')];
    withPageImages(events, fetcher, now);
    await settleEventImages();
    up = false;
    const week = 7 * 24 * 3_600_000;
    withPageImages(events, fetcher, now + week);
    await settleEventImages();
    expect(withPageImages(events, fetcher, now + week)[0]?.image).toBe(
      'https://museum.test/1.jpg',
    );
  });

  it('never reads a page on a private address, nor follows a redirect to one', async () => {
    const calls: string[] = [];
    const fetcher = (async (input: string | URL | Request) => {
      calls.push(String(input));
      return new Response(null, {
        status: 302,
        headers: { location: 'http://192.168.1.10/admin' },
      });
    }) as typeof fetch;
    const events = [
      event('lan', 'http://192.168.1.10/event'),
      event('hop', 'https://museum.test/hop'),
    ];
    withPageImages(events, fetcher, now);
    await settleEventImages();
    expect(calls).toEqual(['https://museum.test/hop']);
  });

  it('follows a redirect to a public page', async () => {
    const fetcher = (async (input: string | URL | Request) =>
      String(input) === 'http://museum.test/old'
        ? new Response(null, {
            status: 301,
            headers: { location: 'https://museum.test/new' },
          })
        : new Response(page('https://museum.test/new.jpg'))) as typeof fetch;
    const events = [event('a', 'http://museum.test/old')];
    withPageImages(events, fetcher, now);
    await settleEventImages();
    expect(withPageImages(events, fetcher, now)[0]?.image).toBe(
      'https://museum.test/new.jpg',
    );
  });

  it('asks a page with no picture again only after a day', async () => {
    const calls: string[] = [];
    const fetcher = stubPages(
      { 'https://museum.test/plain': '<html><head></head>' },
      calls,
    );
    const events = [event('a', 'https://museum.test/plain')];
    withPageImages(events, fetcher, now);
    await settleEventImages();
    withPageImages(events, fetcher, now + 23 * 3_600_000);
    await settleEventImages();
    expect(calls).toHaveLength(1);
    withPageImages(events, fetcher, now + 24 * 3_600_000);
    await settleEventImages();
    expect(calls).toHaveLength(2);
  });
});
