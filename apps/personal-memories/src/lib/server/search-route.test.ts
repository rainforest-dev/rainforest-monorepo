import { describe, expect, it } from 'vitest';

import type { SearchDoc } from '@/lib/search';

import { fakeEmbedder } from './embed.ts';
import { breaker, handleSearch, makeIndex } from './search-index.ts';

const DOCS: SearchDoc[] = [
  {
    id: 'a',
    day: '2025-11-04',
    kind: 'chat',
    source: 'line',
    text: '09:00 Bob：台南的拉麵',
    snippet: '台南的拉麵',
    people: ['bob'],
    places: [],
    eventIds: ['a'],
    contentHash: 'h',
  },
];

const deps = (docs: SearchDoc[] | undefined = DOCS) => ({
  index: async () => (docs ? makeIndex(docs) : undefined),
  embedder: fakeEmbedder(),
  breaker: breaker(),
});

const call = (query: string, d = deps()) =>
  handleSearch(new URL(`http://x/search.json?${query}`), d);

describe('handleSearch', () => {
  it('answers a query with results and private no-cache headers', async () => {
    const res = await call(`q=${encodeURIComponent('拉麵')}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-cache');
    const body = await res.json();
    expect(body.results.map((r: { date: string }) => r.date)).toEqual([
      '2025-11-04',
    ]);
  });

  it('passes people, sources and a range through', async () => {
    const hit = await (
      await call('q=&people=bob&from=2025-11-01&to=2025-11-30&sources=line')
    ).json();
    expect(hit.results).toHaveLength(1);
    const miss = await (
      await call('q=&people=bob&from=2025-12-01&to=2025-12-31')
    ).json();
    expect(miss.results).toHaveLength(0);
  });

  it('rejects an oversized query, a bad date, half a range or an unknown source', async () => {
    for (const query of [
      `q=${'a'.repeat(201)}`,
      'q=a&from=2025-13-01&to=2025-13-02',
      'q=a&from=2025-11-01',
      'q=a&from=2025-11-30&to=2025-11-01',
      'q=a&sources=fax',
    ])
      expect((await call(query)).status).toBe(400);
  });

  it('answers with no-index when there is no timeline', async () => {
    const body = await (await call('q=a', deps(undefined))).json();
    expect(body).toEqual({ results: [], semantic: 'off', reason: 'no-index' });
  });
});
