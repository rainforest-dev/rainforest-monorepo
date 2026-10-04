import { stat } from 'node:fs/promises';
import { join } from 'node:path';

import { buildSearchDocs } from '@/lib/ingest';
import {
  lexicalRank,
  queryTerms,
  rrf,
  type SearchDoc,
  type SearchQuery,
  topK,
} from '@/lib/search';
import { searchQuerySchema } from '@/lib/search-schema';

import { type Embedder, EmbedError, type EmbedFailure } from './embed.ts';
import { getPeople } from './people-store.ts';
import {
  readSearchFiles,
  searchDir,
  type SearchFiles,
} from './search-files.ts';
import { dataDir, getTimeline } from './store.ts';

export const QUERY_EMBED_TIMEOUT_MS = 800;
export const BREAKER_MS = 30_000;
export const MAX_DAYS = 20;
const SEMANTIC_K = 50;

export type SearchResult = {
  kind: 'content';
  date: string;
  score: number;
  snippet: string;
  source: SearchDoc['source'];
};

export type SearchReason = EmbedFailure | 'no-index';

export type SearchResponse = {
  results: SearchResult[];
  semantic: 'on' | 'off';
  reason?: SearchReason;
  stale?: number;
};

export type SearchIndex = {
  docs: SearchDoc[];
  rowOf: Map<string, number>;
  vectors?: Float32Array;
  model?: string;
  dims?: number;
  stale: number;
};

export type Breaker = {
  open(now: number): boolean;
  trip(now: number): void;
};

export function breaker(ms = BREAKER_MS): Breaker {
  let until = 0;
  return {
    open: (now) => now < until,
    trip: (now) => {
      until = now + ms;
    },
  };
}

export function makeIndex(docs: SearchDoc[], files?: SearchFiles): SearchIndex {
  if (!files) return { docs, rowOf: new Map(), stale: 0 };
  const fileRow = new Map(
    files.header.docs.map((d, i) => [`${d.id}\u0000${d.contentHash}`, i]),
  );
  const rowOf = new Map<string, number>();
  for (const doc of docs) {
    const row = fileRow.get(`${doc.id}\u0000${doc.contentHash}`);
    if (row !== undefined) rowOf.set(doc.id, row);
  }
  return {
    docs,
    rowOf,
    vectors: files.vectors,
    model: files.header.model,
    dims: files.header.dims,
    stale: docs.length - rowOf.size,
  };
}

const matches = (doc: SearchDoc, query: SearchQuery) =>
  (!query.range ||
    (doc.day >= query.range.start && doc.day <= query.range.end)) &&
  (!query.people?.length || query.people.some((p) => doc.people.includes(p))) &&
  (!query.sources?.length ||
    (doc.source !== 'note' && query.sources.includes(doc.source)));

function snippetFor(doc: SearchDoc, terms: readonly string[]): string {
  const line = doc.text
    .split('\n')
    .find((l) =>
      terms.some((t) => l.normalize('NFKC').toLowerCase().includes(t)),
    );
  return line ? Array.from(line).slice(0, 80).join('') : doc.snippet;
}

async function embedQuery(
  embedder: Embedder,
  text: string,
): Promise<Float32Array> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new EmbedError('timeout', 'query embedding timed out'));
    }, QUERY_EMBED_TIMEOUT_MS);
  });
  try {
    const [vector] = await Promise.race([
      embedder.embed([text], 'query', controller.signal),
      timeout,
    ]);
    if (
      !vector ||
      vector.length !== embedder.dims ||
      !vector.every((v) => Number.isFinite(v))
    )
      throw new EmbedError('model-mismatch', 'bad query vector');
    return vector;
  } finally {
    clearTimeout(timer);
  }
}

type Semantic = { ids: string[] } | { reason: SearchReason };

async function semanticRank(
  index: SearchIndex,
  allowed: Set<string>,
  text: string,
  embedder: Embedder,
  gate: Breaker,
): Promise<Semantic> {
  if (!index.vectors || !index.dims) return { reason: 'no-index' };
  if (index.model !== embedder.model || index.dims !== embedder.dims)
    return { reason: 'model-mismatch' };
  if (gate.open(Date.now())) return { reason: 'timeout' };
  let vector: Float32Array;
  try {
    vector = await embedQuery(embedder, text);
  } catch (error) {
    if (!(error instanceof EmbedError)) throw error;
    if (error.reason === 'timeout') gate.trip(Date.now());
    return { reason: error.reason };
  }
  const idOfRow = new Map<number, string>();
  for (const [id, row] of index.rowOf)
    if (allowed.has(id)) idOfRow.set(row, id);
  const hits = topK(index.vectors, index.dims, vector, SEMANTIC_K, (row) =>
    idOfRow.has(row),
  );
  return {
    ids: hits
      .filter((h) => h.score >= embedder.minScore)
      .flatMap((h) => idOfRow.get(h.row) ?? []),
  };
}

function byDay(
  docs: readonly SearchDoc[],
  scores: Map<string, number>,
  terms: readonly string[],
): SearchResult[] {
  const best = new Map<string, { doc: SearchDoc; score: number }>();
  for (const doc of docs) {
    const score = scores.get(doc.id);
    if (score === undefined) continue;
    const current = best.get(doc.day);
    if (!current || score > current.score) best.set(doc.day, { doc, score });
  }
  return [...best.values()]
    .sort((a, b) => b.score - a.score || b.doc.day.localeCompare(a.doc.day))
    .slice(0, MAX_DAYS)
    .map(({ doc, score }) => ({
      kind: 'content',
      date: doc.day,
      score,
      snippet: snippetFor(doc, terms).replace(/\s+/gu, ' ').trim(),
      source: doc.source,
    }));
}

export async function runSearch(
  index: SearchIndex,
  query: SearchQuery,
  embedder: Embedder,
  gate: Breaker,
): Promise<SearchResponse> {
  const docs = index.docs.filter((doc) => matches(doc, query));
  const terms = queryTerms(query.text);
  const stale = index.stale ? { stale: index.stale } : {};
  if (terms.length === 0) {
    if (!query.people?.length && !query.range)
      return { results: [], semantic: 'off', ...stale };
    const newest = [...docs].sort((a, b) => b.day.localeCompare(a.day));
    const scores = new Map(newest.map((d, i) => [d.id, -i]));
    return { results: byDay(newest, scores, terms), semantic: 'off', ...stale };
  }
  const lexical = lexicalRank(docs, terms);
  const semantic = await semanticRank(
    index,
    new Set(docs.map((d) => d.id)),
    query.text,
    embedder,
    gate,
  );
  const scores = rrf('ids' in semantic ? [lexical, semantic.ids] : [lexical]);
  return {
    results: byDay(docs, scores, terms),
    semantic: 'ids' in semantic ? 'on' : 'off',
    ...('reason' in semantic ? { reason: semantic.reason } : {}),
    ...stale,
  };
}

let cached:
  | { timeline: unknown; mtime: number | undefined; index: SearchIndex }
  | undefined;

export async function getSearchIndex(): Promise<SearchIndex | undefined> {
  const state = getTimeline();
  if (state.status !== 'ready') return undefined;
  const root = dataDir();
  const mtime = root
    ? await stat(join(searchDir(root), 'docs.json')).then(
        (s) => s.mtimeMs,
        () => undefined,
      )
    : undefined;
  if (cached?.timeline === state.timeline && cached.mtime === mtime)
    return cached.index;
  const docs = buildSearchDocs(state.timeline.events, getPeople().people);
  const files =
    root && mtime !== undefined ? await readSearchFiles(root) : undefined;
  const index = makeIndex(docs, files);
  cached = { timeline: state.timeline, mtime, index };
  return index;
}

const listParam = (value: string | null) => {
  const list = value
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list?.length ? list : undefined;
};

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-cache' },
  });

export async function handleSearch(
  url: URL,
  deps: {
    index: () => Promise<SearchIndex | undefined>;
    embedder: Embedder;
    breaker: Breaker;
  },
): Promise<Response> {
  const params = url.searchParams;
  const from = params.get('from');
  const to = params.get('to');
  if ((from === null) !== (to === null))
    return json({ error: 'from and to go together' }, 400);
  const people = listParam(params.get('people'));
  const sources = listParam(params.get('sources'));
  const parsed = searchQuerySchema.safeParse({
    text: params.get('q') ?? '',
    ...(from && to ? { range: { start: from, end: to } } : {}),
    ...(people ? { people } : {}),
    ...(sources ? { sources } : {}),
  });
  if (!parsed.success) return json({ error: 'invalid query' }, 400);
  const query: SearchQuery = parsed.data as SearchQuery;
  if (query.range && query.range.start > query.range.end)
    return json({ error: 'from is after to' }, 400);
  const index = await deps.index();
  if (!index) return json({ results: [], semantic: 'off', reason: 'no-index' });
  return json(await runSearch(index, query, deps.embedder, deps.breaker));
}
