import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type SearchFileHeader = {
  model: string;
  dims: number;
  docs: { id: string; contentHash: string }[];
};

export type SearchFiles = { header: SearchFileHeader; vectors: Float32Array };

export const searchDir = (root: string) => join(root, 'search');
const HEADER_FILE = 'docs.json';
const VECTOR_FILE = 'vectors.text.bin';

const isHeader = (value: unknown): value is SearchFileHeader => {
  const h = value as Partial<SearchFileHeader> | null;
  return (
    typeof h?.model === 'string' &&
    typeof h.dims === 'number' &&
    h.dims > 0 &&
    Array.isArray(h.docs) &&
    h.docs.every(
      (d) => typeof d?.id === 'string' && typeof d.contentHash === 'string',
    )
  );
};

export async function readSearchFiles(
  root: string,
): Promise<SearchFiles | undefined> {
  try {
    const dir = searchDir(root);
    const [json, bytes] = await Promise.all([
      readFile(join(dir, HEADER_FILE), 'utf8'),
      readFile(join(dir, VECTOR_FILE)),
    ]);
    const header: unknown = JSON.parse(json);
    if (!isHeader(header)) return undefined;
    if (bytes.byteLength !== header.docs.length * header.dims * 4)
      return undefined;
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return { header, vectors: new Float32Array(copy.buffer) };
  } catch {
    return undefined;
  }
}

async function writeAtomic(path: string, data: string | Uint8Array) {
  await writeFile(`${path}.tmp`, data);
  await rename(`${path}.tmp`, path);
}

export async function writeSearchFiles(
  root: string,
  header: SearchFileHeader,
  vectors: Float32Array,
): Promise<void> {
  const dir = searchDir(root);
  await mkdir(dir, { recursive: true });
  await writeAtomic(
    join(dir, VECTOR_FILE),
    new Uint8Array(vectors.buffer, vectors.byteOffset, vectors.byteLength),
  );
  await writeAtomic(join(dir, HEADER_FILE), JSON.stringify(header));
}

export function reuseVectors(
  previous: SearchFiles | undefined,
  docs: readonly { id: string; contentHash: string }[],
  model: string,
  dims: number,
): { vectors: Float32Array; missing: number[] } {
  const vectors = new Float32Array(docs.length * dims);
  const missing: number[] = [];
  const usable =
    previous &&
    previous.header.model === model &&
    previous.header.dims === dims;
  const rowOf = new Map(
    usable
      ? previous.header.docs.map((d, i) => [`${d.id}\u0000${d.contentHash}`, i])
      : [],
  );
  docs.forEach((doc, i) => {
    const row = rowOf.get(`${doc.id}\u0000${doc.contentHash}`);
    if (row === undefined || !previous) {
      missing.push(i);
      return;
    }
    vectors.set(
      previous.vectors.subarray(row * dims, (row + 1) * dims),
      i * dims,
    );
  });
  return { vectors, missing };
}
