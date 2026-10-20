import { readFileSync } from 'node:fs';

import {
  hallItemsResponseSchema,
  librarySearchResponseSchema,
} from '@rainforest-dev/library-contract';
import { describe, expect, it } from 'vitest';

import { roomT } from '@/locales';

import {
  articleAnchor,
  rackHallItems,
  rackShelves,
  searchRack,
} from './rack.js';
import { parseReadingQueue, type ReadingQueue } from './readingQueue.js';

const t = roomT('en');

const QUEUE = parseReadingQueue(
  readFileSync(
    new URL('./fixtures/reading-queue.sample.json', import.meta.url),
    'utf-8',
  ),
);

function withItems(queue: ReadingQueue['queue']): ReadingQueue {
  return { ...QUEUE, queue };
}

describe('rackShelves', () => {
  it('puts each tier on its own shelf, in tier order, labelled', () => {
    const shelves = rackShelves(QUEUE, t);
    expect(shelves.map((s) => s.tier)).toEqual(
      [...new Set(QUEUE.queue.map((i) => i.tier))].sort((a, b) => a - b),
    );
    expect(shelves[0].label).toBe('Finish what you started');
    expect(shelves.flatMap((s) => s.items)).toHaveLength(QUEUE.queue.length);
  });

  it('orders a shelf by rank, whatever order the file lists it in', () => {
    const [first] = QUEUE.queue;
    const items = [
      { ...first, id: 'b', rank: 9 },
      { ...first, id: 'a', rank: 2 },
    ];
    const [shelf] = rackShelves(withItems(items), t);
    expect(shelf.items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('names a tier it has no label for', () => {
    const [first] = QUEUE.queue;
    const [shelf] = rackShelves(withItems([{ ...first, tier: 7 }]), t);
    expect(shelf.label).toBe('Tier 7');
  });

  it('has no shelves for an empty queue', () => {
    expect(rackShelves(withItems([]), t)).toEqual([]);
  });
});

describe('rackHallItems', () => {
  it('returns items the hall contract accepts', () => {
    const items = rackHallItems(QUEUE);
    expect(items).toHaveLength(QUEUE.queue.length);
    expect(hallItemsResponseSchema.parse({ items }).items).toEqual(items);
    expect(items.every((i) => i.kind === 'article')).toBe(true);
  });

  it('links each article to its card on the rack', () => {
    const [item] = rackHallItems(QUEUE);
    expect(item.href).toBe(`/rack#${articleAnchor(QUEUE.queue[0].id)}`);
  });

  it('groups by tier, decay, site and tags', () => {
    const [first] = QUEUE.queue;
    const [item] = rackHallItems(
      withItems([
        {
          ...first,
          tier: 2,
          decay: 'evergreen',
          siteName: 'a.example',
          tags: ['tech/x'],
        },
      ]),
    );
    expect(item.groups).toEqual([
      'tier:2',
      'decay:evergreen',
      'site:a.example',
      'tag:tech/x',
    ]);
  });

  it('keeps an id with URL characters inside the same-origin href', () => {
    const [first] = QUEUE.queue;
    const [item] = rackHallItems(withItems([{ ...first, id: 'a/b?c#d' }]));
    expect(item.href).toBe('/rack#article-a%2Fb%3Fc%23d');
    expect(() =>
      hallItemsResponseSchema.parse({ items: [item] }),
    ).not.toThrow();
  });

  it('is empty before the queue is generated', () => {
    expect(rackHallItems(null)).toEqual([]);
  });
});

describe('searchRack', () => {
  const [first] = QUEUE.queue;
  const items = [
    { ...first, id: 'body', title: 'Notes', tags: [], why: 'about signals' },
    { ...first, id: 'title', title: 'Signals in Solid', tags: [], why: '' },
    { ...first, id: 'none', title: 'Unrelated', tags: [], why: 'other' },
  ];

  it('ranks title hits above reason hits and leaves misses out', () => {
    const hits = searchRack(withItems(items), 'signals');
    expect(hits.map((h) => h.id)).toEqual(['title', 'body']);
    expect(hits[0].href).toBe(`/rack#${articleAnchor('title')}`);
    expect(
      librarySearchResponseSchema.safeParse({ results: hits }).success,
    ).toBe(true);
  });

  it('finds nothing for an empty query or a missing queue', () => {
    expect(searchRack(withItems(items), '  ')).toEqual([]);
    expect(searchRack(null, 'signals')).toEqual([]);
  });
});
