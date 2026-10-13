import {
  type Breaker,
  breaker,
  BREAKER_MS,
  type Embedder,
  EmbedError,
  type EmbedFailure,
  embedQuery,
  rrf,
  semanticIds,
  topK,
  withQueryPriority,
} from '@rainforest-dev/search';
import type { IndexFiles } from '@rainforest-dev/search/node';

import { appSqlite, sqlite } from '@/db';

import { indexBooks } from './build-index';
import { readBookDocs } from './docs';
import { embedderFromEnv, searchDirFromEnv } from './env';
import { lexicalBookIds } from './lexical';

export const MIN_QUERY_LENGTH = 2;
export const SEMANTIC_K = 50;

export type SearchReason = EmbedFailure | 'no-index';

export type BookSearch = {
  ids: number[];
  semantic: 'on' | 'off';
  reason?: SearchReason;
};

export async function rankBookIds({
  q,
  lexical,
  index,
  embedder,
  gate,
  timeoutMs,
}: {
  q: string;
  lexical: readonly number[];
  index: IndexFiles | undefined;
  embedder: Embedder | undefined;
  gate: Breaker;
  timeoutMs?: number;
}): Promise<BookSearch> {
  const off = (reason?: SearchReason): BookSearch => ({
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
    SEMANTIC_K,
  ).flatMap((h) => {
    const doc = index.header.docs[h.row];
    return doc ? [{ id: doc.id, score: h.score }] : [];
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

type SearchState = {
  embedders: ReturnType<typeof withQueryPriority> | undefined;
  dir: string | undefined;
  gate: Breaker;
  ready?: IndexFiles;
  job?: Promise<void>;
  failedAt?: number;
};

let state: SearchState | undefined;

function searchState(): SearchState {
  if (!state) {
    const embedder = embedderFromEnv();
    state = {
      embedders: embedder ? withQueryPriority(embedder) : undefined,
      dir: searchDirFromEnv(),
      gate: breaker(),
    };
  }
  return state;
}

export function ensureBookIndex(): Promise<void> {
  const s = searchState();
  if (!s.embedders || !s.dir || s.ready) return Promise.resolve();
  if (s.job) return s.job;
  if (s.failedAt !== undefined && Date.now() - s.failedAt < BREAKER_MS)
    return Promise.resolve();
  const { dir } = s;
  const { background } = s.embedders;
  s.job = (async () => {
    try {
      const files = await indexBooks({
        dir,
        docs: readBookDocs(sqlite),
        embedder: background,
      });
      if (files) s.ready = files;
      else s.failedAt = Date.now();
    } catch (error) {
      s.failedAt = Date.now();
      console.error('calibre search: indexing failed', error);
    } finally {
      s.job = undefined;
    }
  })();
  return s.job;
}

const unreachable: Embedder['embed'] = async () => {
  throw new EmbedError('ollama-unreachable', 'injected e2e fault');
};

export async function searchBookIds(
  q: string,
  { embedFault = false }: { embedFault?: boolean } = {},
): Promise<BookSearch> {
  const text = q.trim();
  if (text.length < MIN_QUERY_LENGTH) return { ids: [], semantic: 'off' };
  const lexical = lexicalBookIds(text, appSqlite);
  const s = searchState();
  void ensureBookIndex();
  return rankBookIds({
    q: text,
    lexical,
    index: s.ready,
    embedder:
      s.embedders && embedFault
        ? { ...s.embedders.foreground, embed: unreachable }
        : s.embedders?.foreground,
    gate: s.gate,
  });
}
