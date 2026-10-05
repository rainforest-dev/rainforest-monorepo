import { describe, expect, it } from 'vitest';

import type { Topic } from '@/lib/registry.types';

import { filterTopics, topicStatusCounts } from './topics.js';

const topic = (
  name: string,
  status: Topic['status'],
  description = '',
  tags: string[] = [],
): Topic => ({ name, status, description, tags });

const TOPICS = [
  topic('Edge infrastructure', 'active', 'Caches and small servers', [
    'domain/infra',
  ]),
  topic('Home lab networking', 'proposed', 'VLANs and DNS', ['tech/network']),
  topic('Crypto markets', 'declined', 'Price news', ['domain/news']),
  topic('Data visualisation', 'proposed', 'Charts', ['domain/design']),
];

const names = (list: Topic[]) => list.map((t) => t.name);

describe('filterTopics', () => {
  it('orders proposed, active, declined when nothing is filtered', () => {
    expect(names(filterTopics(TOPICS, { tq: '', tstatus: null }))).toEqual([
      'Data visualisation',
      'Home lab networking',
      'Edge infrastructure',
      'Crypto markets',
    ]);
  });

  it('searches name, description and tags, case-insensitively', () => {
    expect(names(filterTopics(TOPICS, { tq: 'EDGE', tstatus: null }))).toEqual([
      'Edge infrastructure',
    ]);
    expect(names(filterTopics(TOPICS, { tq: 'dns', tstatus: null }))).toEqual([
      'Home lab networking',
    ]);
    expect(
      names(filterTopics(TOPICS, { tq: 'domain/news', tstatus: null })),
    ).toEqual(['Crypto markets']);
  });

  it('keeps one status', () => {
    expect(
      names(filterTopics(TOPICS, { tq: '', tstatus: 'proposed' })),
    ).toEqual(['Data visualisation', 'Home lab networking']);
    expect(
      names(filterTopics(TOPICS, { tq: 'dns', tstatus: 'active' })),
    ).toEqual([]);
  });
});

describe('topicStatusCounts', () => {
  it('counts every status against the search', () => {
    expect(topicStatusCounts(TOPICS, '')).toEqual({
      all: 4,
      proposed: 2,
      active: 1,
      declined: 1,
    });
    expect(topicStatusCounts(TOPICS, 'domain')).toEqual({
      all: 3,
      proposed: 1,
      active: 1,
      declined: 1,
    });
  });
});
