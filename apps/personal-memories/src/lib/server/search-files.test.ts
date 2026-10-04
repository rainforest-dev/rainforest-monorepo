import { mkdtemp, rm, truncate } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  readSearchFiles,
  reuseVectors,
  searchDir,
  type SearchFileHeader,
  writeSearchFiles,
} from './search-files.ts';

let root: string | undefined;
afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
  root = undefined;
});

const HEADER: SearchFileHeader = {
  model: 'm',
  dims: 2,
  docs: [
    { id: 'a', contentHash: '1' },
    { id: 'b', contentHash: '2' },
  ],
};
const VECTORS = new Float32Array([1, 2, 3, 4]);

describe('search files', () => {
  it('round-trips the header and vectors', async () => {
    root = await mkdtemp(join(tmpdir(), 'memories-search-'));
    await writeSearchFiles(root, HEADER, VECTORS);
    const read = await readSearchFiles(root);
    expect(read?.header).toEqual(HEADER);
    expect(Array.from(read?.vectors ?? [])).toEqual([1, 2, 3, 4]);
  });

  it('treats missing or truncated files as no index', async () => {
    root = await mkdtemp(join(tmpdir(), 'memories-search-'));
    expect(await readSearchFiles(root)).toBeUndefined();
    await writeSearchFiles(root, HEADER, VECTORS);
    await truncate(join(searchDir(root), 'vectors.text.bin'), 12);
    expect(await readSearchFiles(root)).toBeUndefined();
  });
});

describe('reuseVectors', () => {
  const previous = { header: HEADER, vectors: VECTORS };

  it('copies rows whose id and hash match and lists the rest', () => {
    const { vectors, missing } = reuseVectors(
      previous,
      [
        { id: 'b', contentHash: '2' },
        { id: 'a', contentHash: 'changed' },
        { id: 'c', contentHash: '3' },
      ],
      'm',
      2,
    );
    expect(Array.from(vectors.slice(0, 2))).toEqual([3, 4]);
    expect(missing).toEqual([1, 2]);
  });

  it('reuses nothing when the model or dims changed', () => {
    expect(
      reuseVectors(previous, [{ id: 'a', contentHash: '1' }], 'other', 2)
        .missing,
    ).toEqual([0]);
    expect(
      reuseVectors(previous, [{ id: 'a', contentHash: '1' }], 'm', 3).missing,
    ).toEqual([0]);
    expect(
      reuseVectors(undefined, [{ id: 'a', contentHash: '1' }], 'm', 2).missing,
    ).toEqual([0]);
  });
});
