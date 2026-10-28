import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseReadingQueue, type ReadingQueue } from '@/lib';

import { withArticleImages } from './article-images.js';
import { resetEventImages, settleEventImages } from './event-images.js';

vi.mock('node:dns/promises', () => ({
  lookup: () => Promise.resolve([{ address: '93.184.216.34', family: 4 }]),
}));

const QUEUE = parseReadingQueue(
  readFileSync(
    new URL('../lib/fixtures/reading-queue.sample.json', import.meta.url),
    'utf-8',
  ),
);

function queueOf(items: Partial<ReadingQueue['queue'][number]>[]) {
  const [first] = QUEUE.queue;
  return { ...QUEUE, queue: items.map((item) => ({ ...first, ...item })) };
}

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

describe('withArticleImages', () => {
  afterEach(resetEventImages);
  const now = Date.parse('2026-10-28T00:00:00Z');

  it("keeps Reader's picture and reads the page of an article without one", async () => {
    const calls: string[] = [];
    const fetcher = stubPages(
      {
        'https://blog.test/b': '<meta property="og:image" content="/b.png">',
      },
      calls,
    );
    const queue = queueOf([
      {
        id: 'a',
        sourceUrl: 'https://blog.test/a',
        imageUrl: 'https://r.test/a.jpg',
      },
      { id: 'b', sourceUrl: 'https://blog.test/b' },
    ]);
    const first = withArticleImages(queue, fetcher, now);
    expect(first?.queue.map((i) => i.imageUrl)).toEqual([
      'https://r.test/a.jpg',
      undefined,
    ]);
    await settleEventImages();
    expect(calls).toEqual(['https://blog.test/b']);
    const later = withArticleImages(queue, fetcher, now);
    expect(later?.queue.map((i) => i.imageUrl)).toEqual([
      'https://r.test/a.jpg',
      'https://blog.test/b.png',
    ]);
  });

  it('passes an empty queue through', () => {
    expect(withArticleImages(null)).toBeNull();
  });
});
