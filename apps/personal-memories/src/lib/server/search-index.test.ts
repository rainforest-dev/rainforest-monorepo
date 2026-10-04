import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SearchDoc } from '@/lib/search';

import { type Embedder, EmbedError, fakeEmbedder } from './embed.ts';
import { breaker, makeIndex, runSearch } from './search-index.ts';

const doc = (
  id: string,
  day: string,
  text: string,
  extra: Partial<SearchDoc> = {},
): SearchDoc => ({
  id,
  day,
  kind: 'chat',
  source: 'line',
  text,
  snippet: text,
  people: [],
  places: [],
  eventIds: [id],
  contentHash: `h-${id}`,
  ...extra,
});

const DOCS = [
  doc('ramen-chat', '2025-11-04', '09:00 Bob：台南的拉麵好好吃', {
    people: ['bob'],
  }),
  doc('photo', '2025-11-01', 'labels: Ramen', {
    kind: 'photo',
    source: 'photo',
  }),
  doc('rain', '2025-11-02', '10:00 Alice：下雨了'),
  doc('bob-other', '2025-11-03', '11:00 Bob：早安', { people: ['bob'] }),
];

const indexed = async (docs = DOCS, embedder: Embedder = fakeEmbedder()) => {
  const vectors = new Float32Array(docs.length * embedder.dims);
  const out = await embedder.embed(
    docs.map((d) => d.text),
    'document',
  );
  out.forEach((v, i) => vectors.set(v, i * embedder.dims));
  return makeIndex(docs, {
    header: {
      model: embedder.model,
      dims: embedder.dims,
      docs: docs.map(({ id, contentHash }) => ({ id, contentHash })),
    },
    vectors,
  });
};

const failing = (error: unknown): Embedder => ({
  ...fakeEmbedder(),
  embed: async () => {
    throw error;
  },
});

afterEach(() => {
  vi.useRealTimers();
});

describe('runSearch', () => {
  it('finds a photo across languages through the embedder', async () => {
    const res = await runSearch(
      await indexed(),
      { text: '吃麵' },
      fakeEmbedder(),
      breaker(),
    );
    expect(res.semantic).toBe('on');
    expect(res.results.map((r) => r.date)).toContain('2025-11-01');
  });

  it('ranks a day that matches both ways above one that matches one way', async () => {
    const res = await runSearch(
      await indexed(),
      { text: '拉麵' },
      fakeEmbedder(),
      breaker(),
    );
    expect(res.results[0]?.date).toBe('2025-11-04');
  });

  it('degrades to lexical with a reason when semantic search cannot run', async () => {
    const lexicalOnly = (r: Awaited<ReturnType<typeof runSearch>>) =>
      r.results.map((x) => x.date);
    const noIndex = await runSearch(
      makeIndex(DOCS),
      { text: '拉麵' },
      fakeEmbedder(),
      breaker(),
    );
    expect(noIndex).toMatchObject({ semantic: 'off', reason: 'no-index' });
    expect(lexicalOnly(noIndex)).toEqual(['2025-11-04']);

    const otherDims: Embedder = { ...fakeEmbedder(), dims: 4 };
    expect(
      await runSearch(await indexed(), { text: '拉麵' }, otherDims, breaker()),
    ).toMatchObject({ semantic: 'off', reason: 'model-mismatch' });

    const down = await runSearch(
      await indexed(),
      { text: '拉麵' },
      failing(new EmbedError('ollama-unreachable', 'down')),
      breaker(),
    );
    expect(down).toMatchObject({
      semantic: 'off',
      reason: 'ollama-unreachable',
    });
    expect(lexicalOnly(down)).toEqual(['2025-11-04']);

    const nanVector: Embedder = {
      ...fakeEmbedder(),
      embed: async () => [new Float32Array(8).fill(Number.NaN)],
    };
    expect(
      await runSearch(await indexed(), { text: '拉麵' }, nanVector, breaker()),
    ).toMatchObject({ semantic: 'off', reason: 'model-mismatch' });
  });

  it('times out after 800 ms and skips the embedder for 30 s', async () => {
    vi.useFakeTimers();
    const embed = vi.fn(() => new Promise<Float32Array[]>(() => undefined));
    const hanging: Embedder = { ...fakeEmbedder(), embed };
    const shared = breaker();
    const index = await indexed();
    const pending = runSearch(index, { text: '拉麵' }, hanging, shared);
    await vi.advanceTimersByTimeAsync(800);
    expect(await pending).toMatchObject({ semantic: 'off', reason: 'timeout' });
    expect((await pending).results.map((r) => r.date)).toEqual(['2025-11-04']);

    const skipped = await runSearch(index, { text: '拉麵' }, hanging, shared);
    expect(skipped).toMatchObject({ reason: 'timeout' });
    expect(embed).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);
    const retried = runSearch(index, { text: '拉麵' }, hanging, shared);
    await vi.advanceTimersByTimeAsync(800);
    await retried;
    expect(embed).toHaveBeenCalledTimes(2);
  });

  it("returns a person's days newest first when only a person is asked for", async () => {
    const res = await runSearch(
      await indexed(),
      { text: '', people: ['bob'] },
      fakeEmbedder(),
      breaker(),
    );
    expect(res.results.map((r) => r.date)).toEqual([
      '2025-11-04',
      '2025-11-03',
    ]);
  });

  it('returns nothing for an empty query', async () => {
    expect(
      (
        await runSearch(
          await indexed(),
          { text: '  ' },
          fakeEmbedder(),
          breaker(),
        )
      ).results,
    ).toEqual([]);
  });

  it('filters by range and caps the result at 20 days', async () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      doc(`d${i}`, `2025-10-${String(i + 1).padStart(2, '0')}`, '麵'),
    );
    const index = await indexed(many);
    const all = await runSearch(
      index,
      { text: '麵' },
      fakeEmbedder(),
      breaker(),
    );
    expect(all.results).toHaveLength(20);
    const ranged = await runSearch(
      index,
      { text: '麵', range: { start: '2025-10-05', end: '2025-10-06' } },
      fakeEmbedder(),
      breaker(),
    );
    expect(ranged.results.map((r) => r.date).sort()).toEqual([
      '2025-10-05',
      '2025-10-06',
    ]);
  });

  it('groups docs by day and shows the matching line as the snippet', async () => {
    const index = await indexed([
      doc('a', '2025-11-04', '09:00 Bob：早安\n09:05 Bob：去吃拉麵'),
      doc('b', '2025-11-04', '20:00 Alice：拉麵 拉麵'),
    ]);
    const res = await runSearch(
      index,
      { text: '拉麵' },
      fakeEmbedder(),
      breaker(),
    );
    expect(res.results).toHaveLength(1);
    expect(res.results[0]?.snippet).toContain('拉麵');
  });
});

describe('makeIndex', () => {
  it('counts docs whose text changed since the vectors were built as stale', async () => {
    const index = await indexed();
    const changed = makeIndex(
      DOCS.map((d) => (d.id === 'rain' ? { ...d, contentHash: 'new' } : d)),
      {
        header: {
          model: 'fake',
          dims: 8,
          docs: DOCS.map(({ id, contentHash }) => ({ id, contentHash })),
        },
        vectors: index.vectors ?? new Float32Array(),
      },
    );
    expect(changed.stale).toBe(1);
  });
});
