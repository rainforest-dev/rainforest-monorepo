import fs from 'node:fs';
import path from 'node:path';

import {
  breaker,
  type Embedder,
  EmbedError,
  type IndexHeader,
} from '@rainforest-dev/search';
import { conceptEmbedder } from '@rainforest-dev/search/node';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createCalibreDb } from '@/test';

import { FAKE_CONCEPTS } from './env';
import { lexicalBookIds } from './lexical';
import { ensureBookIndex, rankBookIds, searchBookIds } from './query';

const fake = conceptEmbedder(FAKE_CONCEPTS);
const TEXTS = ['Juniper Signal', 'Brine and Bell', 'Cold Lantern'];

async function fakeIndex() {
  const header: IndexHeader = {
    model: fake.model,
    dims: fake.dims,
    docs: TEXTS.map((_, i) => ({ id: String(i + 1), contentHash: `h${i}` })),
  };
  const rows = await fake.embed(TEXTS, 'document');
  const vectors = new Float32Array(rows.length * fake.dims);
  rows.forEach((row, i) => vectors.set(row, i * fake.dims));
  return { header, vectors };
}

const failing = (embed: Embedder['embed']): Embedder => ({ ...fake, embed });

describe('rankBookIds', () => {
  const lexical = [3, 1];

  it('fuses a semantic hit into the lexical order', async () => {
    const result = await rankBookIds({
      q: 'ocean',
      lexical,
      index: await fakeIndex(),
      embedder: fake,
      gate: breaker(),
    });
    expect(result.semantic).toBe('on');
    expect(result.ids).toContain(2);
    expect(result.ids).not.toEqual(lexical);
  });

  it('takes semantic hits only from the allowed ids', async () => {
    const result = await rankBookIds({
      q: 'lantern',
      lexical: [],
      index: await fakeIndex(),
      embedder: fake,
      gate: breaker(),
      allow: new Set(['1', '2']),
    });
    expect(result.semantic).toBe('on');
    expect(result.ids).not.toContain(3);
  });

  it('returns the lexical order exactly when Ollama is unreachable', async () => {
    const result = await rankBookIds({
      q: 'ocean',
      lexical,
      index: await fakeIndex(),
      embedder: failing(async () => {
        throw new EmbedError('ollama-unreachable', 'connect ECONNREFUSED');
      }),
      gate: breaker(),
    });
    expect(result).toEqual({
      ids: lexical,
      semantic: 'off',
      reason: 'ollama-unreachable',
    });
  });

  it('returns the lexical order exactly on a timeout, and trips the breaker', async () => {
    const gate = breaker();
    const result = await rankBookIds({
      q: 'ocean',
      lexical,
      index: await fakeIndex(),
      embedder: failing(() => new Promise(() => undefined)),
      gate,
      timeoutMs: 10,
    });
    expect(result).toEqual({
      ids: lexical,
      semantic: 'off',
      reason: 'timeout',
    });
    expect(gate.open(Date.now())).toBe(true);
  });

  it('returns the lexical order exactly behind an open breaker, without embedding', async () => {
    const gate = breaker();
    gate.trip(Date.now());
    const embed = vi.fn(fake.embed);
    const result = await rankBookIds({
      q: 'ocean',
      lexical,
      index: await fakeIndex(),
      embedder: failing(embed),
      gate,
    });
    expect(result).toEqual({
      ids: lexical,
      semantic: 'off',
      reason: 'timeout',
    });
    expect(embed).not.toHaveBeenCalled();
  });

  it('reports no-index until the index is ready, and nothing without an embedder', async () => {
    const args = { q: 'ocean', lexical, gate: breaker() };
    expect(
      await rankBookIds({ ...args, index: undefined, embedder: fake }),
    ).toEqual({ ids: lexical, semantic: 'off', reason: 'no-index' });
    expect(
      await rankBookIds({
        ...args,
        index: await fakeIndex(),
        embedder: undefined,
      }),
    ).toEqual({ ids: lexical, semantic: 'off' });
  });
});

describe('searchBookIds with CALIBRE_EMBED=fake', () => {
  let dir = '';

  beforeAll(() => {
    dir = createCalibreDb({
      authors: [[1, 'Mara Ostrand', 'Ostrand, Mara']],
      series: [],
      tags: [],
      books: [
        { id: 1, title: 'Juniper Signal', authorIds: [1] },
        { id: 2, title: 'Brine and Bell', authorIds: [1] },
        { id: 3, title: 'Cold Lantern', authorIds: [1] },
      ],
    });
    process.env.CALIBRE_LIBRARY_PATH = dir;
    process.env.CALIBRE_APP_DB_PATH = path.join(dir, 'app.db');
    process.env['CALIBRE_EMBED'] = 'fake';
  });

  afterAll(() => {
    delete process.env['CALIBRE_EMBED'];
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('finds a book through a concept when the query shares no characters with its title', async () => {
    const query = '海洋';
    const title = 'Brine and Bell';
    expect([...query].some((c) => title.toLowerCase().includes(c))).toBe(false);

    await searchBookIds(query);
    await ensureBookIndex();
    const { appSqlite } = await import('@/db');
    expect(lexicalBookIds(query, appSqlite)).toEqual([]);
    expect(await searchBookIds(query)).toEqual({ ids: [2], semantic: 'on' });
    expect(fs.existsSync(path.join(dir, 'search', 'docs.json'))).toBe(true);
  });
});
