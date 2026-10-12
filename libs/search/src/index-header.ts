export type IndexHeader = {
  model: string;
  dims: number;
  docs: { id: string; contentHash: string; retry?: true }[];
};

export function isIndexHeader(value: unknown): value is IndexHeader {
  const h = value as Partial<IndexHeader> | null;
  return (
    typeof h?.model === 'string' &&
    typeof h.dims === 'number' &&
    h.dims > 0 &&
    Array.isArray(h.docs) &&
    h.docs.every(
      (d) => typeof d?.id === 'string' && typeof d.contentHash === 'string',
    )
  );
}

export const vectorBytes = (header: IndexHeader) =>
  header.docs.length * header.dims * Float32Array.BYTES_PER_ELEMENT;
