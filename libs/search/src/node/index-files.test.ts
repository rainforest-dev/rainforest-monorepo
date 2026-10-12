import {
  copyFile,
  mkdtemp,
  readFile,
  rm,
  truncate,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import type { IndexHeader } from '../index-header';
import { readIndexFiles, writeIndexFiles } from './index-files';

const FIXTURE = fileURLToPath(new URL('./fixtures', import.meta.url));
const HEADER: IndexHeader = {
  model: 'fixture-model',
  dims: 3,
  docs: [
    { id: 'chat:a', contentHash: '0badf00d' },
    { id: 'photo:b', contentHash: '1234abcd', retry: true },
  ],
};
const VECTORS = new Float32Array([0.5, -1, 2, 0.25, 0, -0.75]);

let dir: string | undefined;
afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = undefined;
});

describe('index files', () => {
  it('reads files written by memories today', async () => {
    const files = await readIndexFiles(FIXTURE);
    expect(files?.header).toEqual(HEADER);
    expect(Array.from(files?.vectors ?? [])).toEqual(Array.from(VECTORS));
  });

  it('writes byte-identical files', async () => {
    dir = await mkdtemp(join(tmpdir(), 'search-index-'));
    await writeIndexFiles(dir, HEADER, VECTORS);
    for (const name of ['docs.json', 'vectors.text.bin'])
      expect(await readFile(join(dir, name))).toEqual(
        await readFile(join(FIXTURE, name)),
      );
  });

  it('round-trips the header and vectors', async () => {
    dir = await mkdtemp(join(tmpdir(), 'search-index-'));
    await writeIndexFiles(dir, HEADER, VECTORS);
    const read = await readIndexFiles(dir);
    expect(read?.header).toEqual(HEADER);
    expect(Array.from(read?.vectors ?? [])).toEqual(Array.from(VECTORS));
  });

  it('treats missing, truncated or mismatched files as no index', async () => {
    dir = await mkdtemp(join(tmpdir(), 'search-index-'));
    expect(await readIndexFiles(dir)).toBeUndefined();
    await writeIndexFiles(dir, HEADER, VECTORS);
    await truncate(join(dir, 'vectors.text.bin'), 12);
    expect(await readIndexFiles(dir)).toBeUndefined();
    await writeIndexFiles(dir, HEADER, VECTORS);
    await writeFile(join(dir, 'vectors.text.bin'), new Uint8Array(24));
    expect(await readIndexFiles(dir)).toBeUndefined();
  });

  it('rejects an old header next to new vectors of the same size', async () => {
    dir = await mkdtemp(join(tmpdir(), 'search-index-'));
    await writeIndexFiles(dir, HEADER, VECTORS);
    await copyFile(join(dir, 'docs.json'), join(dir, 'old-docs.json'));
    await writeIndexFiles(
      dir,
      {
        ...HEADER,
        docs: [
          { id: 'photo:b', contentHash: '1234abcd' },
          { id: 'chat:c', contentHash: '3' },
        ],
      },
      new Float32Array([3, 4, 5, 6, 7, 8]),
    );
    await copyFile(join(dir, 'old-docs.json'), join(dir, 'docs.json'));
    expect(await readIndexFiles(dir)).toBeUndefined();
  });

  it('honours custom file names', async () => {
    dir = await mkdtemp(join(tmpdir(), 'search-index-'));
    const names = { header: 'h.json', vectors: 'v.bin' };
    await writeIndexFiles(dir, HEADER, VECTORS, names);
    expect((await readIndexFiles(dir, names))?.header).toEqual(HEADER);
  });
});
