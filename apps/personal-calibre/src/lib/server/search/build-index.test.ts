import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type Embedder, EmbedError } from '@rainforest-dev/search';
import { readIndexFiles } from '@rainforest-dev/search/node';
import { afterEach, describe, expect, it } from 'vitest';

import { indexBooks } from './build-index';
import type { BookDoc } from './docs';

const DOCS: BookDoc[] = Array.from({ length: 5 }, (_, i) => ({
  id: String(i + 1),
  text: `book ${i + 1}`,
  contentHash: `h${i + 1}`,
}));

function countingEmbedder(failOnCall?: number) {
  const embedded: string[] = [];
  let calls = 0;
  const embedder: Embedder = {
    model: 'test',
    dims: 2,
    minScore: 0,
    images: false,
    async embed(texts) {
      calls += 1;
      if (calls === failOnCall)
        throw new EmbedError('ollama-unreachable', 'down');
      embedded.push(...texts.map(String));
      return texts.map((_, i) => Float32Array.from([i + 1, calls]));
    },
  };
  return { embedder, embedded };
}

let dir: string | undefined;

afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = undefined;
});

const quiet = () => undefined;

describe('indexBooks', () => {
  it('resumes an interrupted index without re-embedding finished rows', async () => {
    dir = await mkdtemp(join(tmpdir(), 'calibre-index-'));
    const first = countingEmbedder(2);
    expect(
      await indexBooks({
        dir,
        docs: DOCS,
        embedder: first.embedder,
        batch: 2,
        log: quiet,
      }),
    ).toBeUndefined();
    expect(first.embedded).toEqual(['book 1', 'book 2']);
    expect((await readIndexFiles(dir))?.header.docs.map((d) => d.id)).toEqual([
      '1',
      '2',
    ]);

    const second = countingEmbedder();
    const files = await indexBooks({
      dir,
      docs: DOCS,
      embedder: second.embedder,
      batch: 2,
      log: quiet,
    });
    expect(second.embedded).toEqual(['book 3', 'book 4', 'book 5']);
    expect(files?.header.docs.map((d) => d.id)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
    ]);
    expect(Array.from(files?.vectors.subarray(0, 4) ?? [])).toEqual([
      1, 1, 2, 1,
    ]);
    expect((await readIndexFiles(dir))?.header).toEqual(files?.header);
  });

  it('makes no embed calls when every row is unchanged', async () => {
    dir = await mkdtemp(join(tmpdir(), 'calibre-index-'));
    await indexBooks({
      dir,
      docs: DOCS,
      embedder: countingEmbedder().embedder,
    });
    const again = countingEmbedder();
    const changed = DOCS.map((d) =>
      d.id === '3' ? { ...d, text: 'book three', contentHash: 'h3b' } : d,
    );
    expect(
      await indexBooks({ dir, docs: DOCS, embedder: again.embedder }),
    ).toBeDefined();
    expect(again.embedded).toEqual([]);
    await indexBooks({ dir, docs: changed, embedder: again.embedder });
    expect(again.embedded).toEqual(['book three']);
  });

  it('re-embeds everything for another model', async () => {
    dir = await mkdtemp(join(tmpdir(), 'calibre-index-'));
    await indexBooks({
      dir,
      docs: DOCS,
      embedder: countingEmbedder().embedder,
    });
    const other = countingEmbedder();
    await indexBooks({
      dir,
      docs: DOCS,
      embedder: { ...other.embedder, model: 'other' },
    });
    expect(other.embedded).toHaveLength(5);
  });
});
