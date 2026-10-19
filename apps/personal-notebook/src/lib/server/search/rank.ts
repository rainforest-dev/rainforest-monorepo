import {
  type Breaker,
  type Embedder,
  EmbedError,
  type EmbedFailure,
  embedQuery,
  type IndexHeader,
  planReuse,
  rrf,
  semanticIds,
  topK,
} from '@rainforest-dev/search';
import {
  type IndexFiles,
  readIndexFiles,
  writeIndexFiles,
} from '@rainforest-dev/search/node';

/** One document to embed: its id, the text, and a hash that says when the text changed. */
export interface IndexDoc {
  id: string;
  text: string;
  contentHash: string;
}

export const MIN_QUERY_LENGTH = 2;
export const SEMANTIC_K = 50;

export type SearchReason = EmbedFailure | 'no-index';

export type RankedIds = {
  ids: number[];
  semantic: 'on' | 'off';
  reason?: SearchReason;
};

export async function rankIds({
  q,
  lexical,
  index,
  embedder,
  gate,
  timeoutMs,
  allow,
}: {
  q: string;
  lexical: readonly number[];
  index: IndexFiles | undefined;
  embedder: Embedder | undefined;
  gate: Breaker;
  timeoutMs?: number;
  /** Only these doc ids may come back by meaning; the nearest are taken among them. */
  allow?: ReadonlySet<string>;
}): Promise<RankedIds> {
  const off = (reason?: SearchReason): RankedIds => ({
    ids: [...lexical],
    semantic: 'off',
    ...(reason ? { reason } : {}),
  });
  if (!embedder) return off();
  if (!index) return off('no-index');
  if (
    index.header.model !== embedder.model ||
    index.header.dims !== embedder.dims
  )
    return off('model-mismatch');
  if (gate.open(Date.now())) return off('timeout');
  let vector: Float32Array;
  try {
    vector = await embedQuery(embedder, q, timeoutMs);
  } catch (error) {
    if (!(error instanceof EmbedError)) throw error;
    if (error.reason === 'timeout') gate.trip(Date.now());
    return off(error.reason);
  }
  const hits = topK(
    index.vectors,
    index.header.dims,
    vector,
    allow ? index.header.docs.length : SEMANTIC_K,
  ).flatMap((h) => {
    const doc = index.header.docs[h.row];
    return doc && (!allow || allow.has(doc.id))
      ? [{ id: doc.id, score: h.score }]
      : [];
  });
  const semantic = semanticIds({
    hits,
    minScore: embedder.minScore,
    k: SEMANTIC_K,
  });
  const scores = rrf([lexical.map(String), semantic]);
  return {
    ids: [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => Number(id)),
    semantic: 'on',
  };
}

export const EMBED_BATCH = 32;

type Log = (line: string) => void;

function previousVectors(
  previous: IndexFiles | undefined,
  header: IndexHeader,
): { vectors: Float32Array; missing: number[] } {
  const { dims } = header;
  const vectors = new Float32Array(header.docs.length * dims);
  if (
    !previous ||
    previous.header.model !== header.model ||
    previous.header.dims !== dims
  )
    return { vectors, missing: header.docs.map((_, i) => i) };
  const { reuse, missing } = planReuse(
    previous.header.docs.map((d) => ({
      id: d.id,
      hash: d.contentHash,
      retry: d.retry,
    })),
    header.docs.map((d) => ({ id: d.id, hash: d.contentHash })),
  );
  for (const [i, row] of reuse)
    vectors.set(
      previous.vectors.subarray(row * dims, (row + 1) * dims),
      i * dims,
    );
  return { vectors, missing };
}

function withoutRows(
  { header, vectors }: IndexFiles,
  leaveOut: ReadonlySet<number>,
): IndexFiles {
  const { dims } = header;
  const rows = header.docs.flatMap((doc, row) =>
    leaveOut.has(row) ? [] : [{ doc, row }],
  );
  const kept = new Float32Array(rows.length * dims);
  rows.forEach(({ row }, i) =>
    kept.set(vectors.subarray(row * dims, (row + 1) * dims), i * dims),
  );
  return {
    header: { ...header, docs: rows.map(({ doc }) => doc) },
    vectors: kept,
  };
}

export async function indexDocs({
  dir,
  docs,
  embedder,
  batch = EMBED_BATCH,
  log = console.warn,
  label = 'doc',
}: {
  dir: string;
  docs: readonly IndexDoc[];
  embedder: Embedder;
  batch?: number;
  log?: Log;
  /** What a doc is, in log lines. */
  label?: string;
}): Promise<IndexFiles | undefined> {
  const previous = await readIndexFiles(dir);
  const header: IndexHeader = {
    model: embedder.model,
    dims: embedder.dims,
    docs: docs.map(({ id, contentHash }) => ({ id, contentHash })),
  };
  const { vectors, missing } = previousVectors(previous, header);
  const pending = new Set(missing);
  try {
    for (let start = 0; start < missing.length; start += batch) {
      const rows = missing.slice(start, start + batch);
      const out = await embedder.embed(
        rows.map((row) => docs[row]?.text ?? ''),
        'document',
      );
      rows.forEach((row, j) => {
        const vector = out[j];
        if (vector && usableVector(vector, embedder.dims)) {
          vectors.set(vector, row * embedder.dims);
          pending.delete(row);
          return;
        }
        log(
          `notebook search: ${label} ${docs[row]?.id} got an unusable ${vector?.length ?? 0}-dim vector from ${embedder.model} (expected ${embedder.dims}); it stays lexical-only`,
        );
      });
    }
  } catch (error) {
    if (!(error instanceof EmbedError)) throw error;
    log(
      `notebook search: embeddings skipped (${error.reason}: ${error.message}); lexical search still works`,
    );
    if (pending.size < missing.length)
      await writeAtDir(dir, withoutRows({ header, vectors }, pending));
    return undefined;
  }
  const files = withoutRows({ header, vectors }, pending);
  const unchanged =
    missing.length === 0 && previous?.header.docs.length === header.docs.length;
  if (!unchanged) await writeAtDir(dir, files);
  return files;
}

const usableVector = (vector: Float32Array, dims: number): boolean =>
  vector.length === dims && vector.every(Number.isFinite);

const writeAtDir = (dir: string, { header, vectors }: IndexFiles) =>
  writeIndexFiles(dir, header, vectors);
