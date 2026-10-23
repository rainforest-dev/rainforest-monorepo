import { hallItemsResponseSchema } from '@rainforest-dev/library-contract';
import { describe, expect, it } from 'vitest';

import { kbHallItems, WIKI_AUTHOR } from './hallItems';
import { type KbDoc } from './model';

const doc = (over: Partial<KbDoc>): KbDoc => ({
  id: 'wiki:kites',
  source: 'wiki',
  path: 'kites',
  title: 'Kites',
  href: '/kb/pages/kites',
  tags: ['wind'],
  shelf: 'topic',
  ...over,
});

describe('kbHallItems', () => {
  it('gives a wiki page its owner as author and its update month', () => {
    const [item] = kbHallItems([doc({ updated: '2026-09-14' })]);
    expect(item?.groups).toEqual([
      'source:wiki',
      'shelf:topic',
      'topic:wind',
      `creator:${WIKI_AUTHOR}`,
      'month:2026-09',
    ]);
    expect(() =>
      hallItemsResponseSchema.parse({ items: [item] }),
    ).not.toThrow();
  });

  it('gives a Readwise document its writer, and no month without a date', () => {
    const [item] = kbHallItems([
      doc({ id: 'readwise:a', source: 'readwise', author: ' Ada Vale ' }),
    ]);
    expect(item?.groups).toContain('creator:Ada Vale');
    expect(item?.groups.some((g) => g.startsWith('month:'))).toBe(false);
  });

  it('leaves a Readwise document with no author out of every author shelf', () => {
    const [item] = kbHallItems([doc({ id: 'readwise:b', source: 'readwise' })]);
    expect(item?.groups.some((g) => g.startsWith('creator:'))).toBe(false);
  });
});
