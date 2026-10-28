import { type LibraryEvent } from '@rainforest-dev/library-contract';
import { afterEach, describe, expect, it } from 'vitest';

import {
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
