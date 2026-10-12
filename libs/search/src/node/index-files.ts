import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { fnv1aBytes } from '../hash';
import { type IndexHeader, isIndexHeader, vectorBytes } from '../index-header';

export type IndexFiles = { header: IndexHeader; vectors: Float32Array };
export type IndexFileNames = { header: string; vectors: string };

export const DEFAULT_INDEX_FILES: IndexFileNames = {
  header: 'docs.json',
  vectors: 'vectors.text.bin',
};

export async function readIndexFiles(
  dir: string,
  names: IndexFileNames = DEFAULT_INDEX_FILES,
): Promise<IndexFiles | undefined> {
  try {
    const [json, bytes] = await Promise.all([
      readFile(join(dir, names.header), 'utf8'),
      readFile(join(dir, names.vectors)),
    ]);
    const file = JSON.parse(json) as unknown;
    if (!isIndexHeader(file)) return undefined;
    const { vectorsHash, ...header } = file as IndexHeader & {
      vectorsHash?: string;
    };
    if (bytes.byteLength !== vectorBytes(header)) return undefined;
    if (vectorsHash !== fnv1aBytes(bytes)) return undefined;
    const aligned =
      bytes.byteOffset % Float32Array.BYTES_PER_ELEMENT === 0
        ? bytes
        : Uint8Array.from(bytes);
    return {
      header,
      vectors: new Float32Array(
        aligned.buffer,
        aligned.byteOffset,
        aligned.byteLength / Float32Array.BYTES_PER_ELEMENT,
      ),
    };
  } catch {
    return undefined;
  }
}

async function writeAtomic(path: string, data: string | Uint8Array) {
  await writeFile(`${path}.tmp`, data);
  await rename(`${path}.tmp`, path);
}

export async function writeIndexFiles(
  dir: string,
  header: IndexHeader,
  vectors: Float32Array,
  names: IndexFileNames = DEFAULT_INDEX_FILES,
): Promise<void> {
  await mkdir(dir, { recursive: true });
  const bytes = new Uint8Array(
    vectors.buffer,
    vectors.byteOffset,
    vectors.byteLength,
  );
  await writeAtomic(join(dir, names.vectors), bytes);
  await writeAtomic(
    join(dir, names.header),
    JSON.stringify({ ...header, vectorsHash: fnv1aBytes(bytes) }),
  );
}
