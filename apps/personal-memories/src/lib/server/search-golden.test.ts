import { describe, expect, it } from 'vitest';

import type { SearchDoc, SearchQuery } from '@/lib/search';

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
    places: ['台南'],
  }),
  doc('rain', '2025-11-02', '10:00 Alice：下雨了'),
  doc('bob-other', '2025-11-03', '11:00 Bob：早安', { people: ['bob'] }),
  doc('cat', '2025-11-03', '12:00 Alice：貓貓 coffee', {
    source: 'slack',
    people: ['alice'],
  }),
  doc('note:2025-11-05', '2025-11-05', '生日 cake', {
    kind: 'note',
    source: 'note',
  }),
];

const indexed = async (
  embedder: Embedder = fakeEmbedder(),
  model = embedder.model,
) => {
  const vectors = new Float32Array(DOCS.length * embedder.dims);
  const out = await embedder.embed(
    DOCS.map((d) => d.text),
    'document',
  );
  out.forEach((v, i) => vectors.set(v, i * embedder.dims));
  return makeIndex(DOCS, {
    header: {
      model,
      dims: embedder.dims,
      docs: DOCS.map(({ id, contentHash }) => ({ id, contentHash })),
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

const CASES: [string, SearchQuery][] = [
  ['cross-language semantic', { text: '吃麵' }],
  ['lexical and semantic', { text: '拉麵' }],
  ['place facet', { text: '台南' }],
  ['person filter', { text: '早安', people: ['bob'] }],
  ['people only', { text: '', people: ['bob'] }],
  ['range', { text: '雨', range: { start: '2025-11-02', end: '2025-11-03' } }],
  ['source filter', { text: 'ramen', sources: ['photo'] }],
  ['note text', { text: 'cake' }],
  ['no match', { text: 'xyzzy' }],
  ['empty', { text: '' }],
];

describe('runSearch golden', () => {
  it.each(CASES)('%s', async (_, query) => {
    expect(
      await runSearch(await indexed(), query, fakeEmbedder(), breaker()),
    ).toMatchSnapshot();
  });

  it('falls back to lexical when the embedder is unreachable', async () => {
    const res = await runSearch(
      await indexed(),
      { text: '拉麵' },
      failing(new EmbedError('ollama-unreachable', 'down')),
      breaker(),
    );
    expect(res).toMatchSnapshot();
  });

  it('falls back on a model mismatch', async () => {
    const res = await runSearch(
      await indexed(fakeEmbedder(), 'other-model'),
      { text: '拉麵' },
      fakeEmbedder(),
      breaker(),
    );
    expect(res).toMatchSnapshot();
  });

  describe('note vectors', () => {
    const dims = fakeEmbedder().dims;
    const vec = (...head: number[]) => {
      const v = new Float32Array(dims);
      v.set(head);
      return v;
    };
    const FILES: [SearchDoc, Float32Array][] = [
      [doc('best', '2025-12-01', '10:00 Alice：散步'), vec(1, 0)],
      [doc('tie', '2025-12-02', '11:00 Bob：看電影'), vec(1, 1)],
      [doc('weak', '2025-12-03', '12:00 Alice：逛街'), vec(1, 3)],
    ];
    const withNote = (vector: Float32Array) => {
      const note = doc('note:2025-12-04', '2025-12-04', '散步筆記', {
        kind: 'note',
        source: 'note',
      });
      const vectors = new Float32Array(FILES.length * dims);
      FILES.forEach(([, v], i) => vectors.set(v, i * dims));
      return {
        ...makeIndex(
          FILES.map(([d]) => d),
          {
            header: {
              model: fakeEmbedder().model,
              dims,
              docs: FILES.map(([{ id, contentHash }]) => ({ id, contentHash })),
            },
            vectors,
          },
        ),
        extra: {
          docs: () => [note],
          vector: (id: string) => (id === note.id ? vector : undefined),
        },
      };
    };

    it.each([
      ['scores between two file hits', vec(2, 1)],
      ['ties a file hit and wins on the smaller id', vec(1, 3)],
    ])('a note %s', async (_, vector) => {
      expect(
        await runSearch(
          withNote(vector),
          { text: '麵' },
          fakeEmbedder(),
          breaker(),
        ),
      ).toMatchSnapshot();
    });
  });

  it('skips semantic while the breaker is open', async () => {
    const gate = breaker();
    gate.trip(Date.now());
    expect(
      await runSearch(await indexed(), { text: '拉麵' }, fakeEmbedder(), gate),
    ).toMatchSnapshot();
  });
});
