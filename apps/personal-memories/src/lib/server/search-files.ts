import { join } from 'node:path';

import { type IndexHeader, planReuse } from '@rainforest-dev/search';
import {
  type IndexFiles,
  readIndexFiles,
  writeIndexFiles,
} from '@rainforest-dev/search/node';

export type SearchFileHeader = IndexHeader;
export type SearchFiles = IndexFiles;

export const searchDir = (root: string) => join(root, 'search');

export const readSearchFiles = (root: string) =>
  readIndexFiles(searchDir(root));

export const writeSearchFiles = (
  root: string,
  header: SearchFileHeader,
  vectors: Float32Array,
) => writeIndexFiles(searchDir(root), header, vectors);

export function reuseVectors(
  previous: SearchFiles | undefined,
  docs: readonly { id: string; contentHash: string }[],
  model: string,
  dims: number,
): { vectors: Float32Array; missing: number[] } {
  const vectors = new Float32Array(docs.length * dims);
  if (
    !previous ||
    previous.header.model !== model ||
    previous.header.dims !== dims
  )
    return { vectors, missing: docs.map((_, i) => i) };
  const { reuse, missing } = planReuse(
    previous.header.docs.map((d) => ({
      id: d.id,
      hash: d.contentHash,
      retry: d.retry,
    })),
    docs.map((d) => ({ id: d.id, hash: d.contentHash })),
  );
  for (const [i, row] of reuse)
    vectors.set(
      previous.vectors.subarray(row * dims, (row + 1) * dims),
      i * dims,
    );
  return { vectors, missing };
}
