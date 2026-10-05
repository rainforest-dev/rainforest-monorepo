import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const reads = vi.hoisted(() => ({
  offset: 0,
  last: undefined as Buffer | undefined,
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    readFile: (async (...args: Parameters<typeof actual.readFile>) => {
      const data = await actual.readFile(...args);
      if (typeof data === 'string' || !String(args[0]).endsWith('.bin'))
        return data;
      const backing = Buffer.alloc(data.byteLength + reads.offset);
      data.copy(backing, reads.offset);
      reads.last = backing.subarray(reads.offset);
      return reads.last;
    }) as typeof actual.readFile,
  };
});

const { readSearchFiles, writeSearchFiles } = await import('./search-files.ts');

const HEADER = {
  model: 'm',
  dims: 2,
  docs: [
    { id: 'a', contentHash: '1' },
    { id: 'b', contentHash: '2' },
  ],
};
const VECTORS = new Float32Array([1, 2, 3, 4]);

let root: string | undefined;
afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
  root = undefined;
});

const roundTrip = async (offset: number) => {
  root = await mkdtemp(join(tmpdir(), 'memories-load-'));
  await writeSearchFiles(root, HEADER, VECTORS);
  reads.offset = offset;
  return readSearchFiles(root);
};

describe('readSearchFiles memory', () => {
  it('uses the bytes it read in place instead of copying them', async () => {
    const files = await roundTrip(0);
    expect(files?.vectors).toEqual(VECTORS);
    expect(files?.vectors.buffer).toBe(reads.last?.buffer);
  });

  it('still reads vectors that land at an unaligned offset', async () => {
    const files = await roundTrip(1);
    expect(files?.vectors).toEqual(VECTORS);
  });
});
