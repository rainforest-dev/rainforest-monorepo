import { join } from 'node:path';

import {
  BREAKER_MS,
  fnv1a,
  lexicalRank,
  queryTerms,
} from '@rainforest-dev/search';
import type { IndexFiles } from '@rainforest-dev/search/node';
import { and, asc, eq, isNotNull } from 'drizzle-orm';

import { db, notebookPages, notebooks } from '@/db';
import { pageHeading, pageSnippet, type SnippetPart } from '@/lib/notebook';
import { notInTrash } from '@/lib/server/notebooks';

import { searchContext } from './context';
import {
  indexDocs,
  MIN_QUERY_LENGTH,
  rankIds,
  type SearchReason,
} from './rank';

const HAN = /\p{Script=Han}/u;

/** Long enough to search: two characters, or one Chinese character, which is a word on its own. */
export const pageQueryReady = (q: string) => {
  const text = q.trim();
  return text.length >= MIN_QUERY_LENGTH || HAN.test(text);
};

/** How much of a page's text is embedded; a page rarely holds more. */
const DOC_CHARS = 4000;
export const PAGE_HITS = 50;

export interface PageHit {
  id: number;
  notebookId: number;
  notebookName: string;
  position: number;
  pageNumber: number | null;
  pageDate: string | null;
  heading: string | undefined;
  /** `words` when the text contains the query, `meaning` when only the embedding matched. */
  match: 'words' | 'meaning';
  snippet: SnippetPart[];
}

export interface PageSearch {
  hits: PageHit[];
  semantic: 'on' | 'off';
  reason?: SearchReason;
}

export interface PageSearchOptions {
  /** Inclusive YYYY-MM-DD bounds on the page's own date; undated pages drop out when either is set. */
  from?: string;
  to?: string;
  /** Words only, no embedding. */
  exact?: boolean;
}

type PageRow = Omit<PageHit, 'heading' | 'match' | 'snippet'> & {
  transcription: string;
};

function transcribedPages(): PageRow[] {
  return db
    .select({
      id: notebookPages.id,
      notebookId: notebookPages.notebookId,
      notebookName: notebooks.name,
      position: notebookPages.position,
      pageNumber: notebookPages.pageNumber,
      pageDate: notebookPages.pageDate,
      transcription: notebookPages.transcription,
    })
    .from(notebookPages)
    .innerJoin(notebooks, eq(notebooks.id, notebookPages.notebookId))
    .where(and(isNotNull(notebookPages.transcription), notInTrash))
    .orderBy(asc(notebookPages.id))
    .all() as PageRow[];
}

const pageDoc = (row: PageRow) => {
  const text = Array.from(row.transcription).slice(0, DOC_CHARS).join('');
  return { id: String(row.id), text, contentHash: fnv1a(text) };
};

type PageDoc = ReturnType<typeof pageDoc>;

type PageIndexState = {
  ready?: IndexFiles;
  readyKey?: string;
  job?: Promise<void>;
  /** The newest docs asked for while a build was running; the job builds them next. */
  wanted?: { docs: PageDoc[]; key: string };
  failedAt?: number;
};

const state: PageIndexState = {};

/**
 * Brings the page index up to date with `docs` in the background. Only new or changed pages are
 * embedded; until it finishes, searches use the previous index. A call made while a build runs is
 * picked up when that build ends, so an edit is never left out of the index.
 */
function ensurePageIndex(docs: PageDoc[]): void {
  const { embedders, dir } = searchContext();
  if (!embedders || !dir) return;
  const key = fnv1a(docs.map((d) => `${d.id}:${d.contentHash}`).join('\n'));
  if (state.readyKey === key && !state.job) return;
  state.wanted = { docs, key };
  if (state.job) return;
  if (state.failedAt !== undefined && Date.now() - state.failedAt < BREAKER_MS)
    return;
  state.job = (async () => {
    try {
      while (state.wanted && state.wanted.key !== state.readyKey) {
        const wanted = state.wanted;
        const files = await indexDocs({
          dir: join(dir, 'notebook-pages'),
          docs: wanted.docs,
          embedder: embedders.background,
          label: 'notebook page',
        });
        if (!files) {
          state.failedAt = Date.now();
          break;
        }
        state.ready = files;
        state.readyKey = wanted.key;
        state.failedAt = undefined;
      }
    } catch (error) {
      state.failedAt = Date.now();
      console.error('notebook search: page indexing failed', error);
    } finally {
      state.wanted = undefined;
      state.job = undefined;
    }
  })();
}

/** Waits for a page index build in flight; for tests. */
export async function settlePageIndex(): Promise<void> {
  await state.job;
}

const inRange = (date: string | null, { from, to }: PageSearchOptions) =>
  (!from && !to) ||
  (date !== null && (!from || date >= from) && (!to || date <= to));

/** Notebook pages whose text contains the query's words, fused with pages close in meaning. */
export async function searchNotebookPages(
  q: string,
  options: PageSearchOptions = {},
): Promise<PageSearch> {
  const text = q.trim();
  if (!pageQueryReady(text)) return { hits: [], semantic: 'off' };
  const rows = transcribedPages();
  ensurePageIndex(rows.map(pageDoc));

  const shown = rows.filter((row) => inRange(row.pageDate, options));
  const byId = new Map(shown.map((row) => [row.id, row]));
  const terms = queryTerms(text);
  const lexical = lexicalRank(shown, terms, {
    id: (row) => String(row.id),
    text: (row) => row.transcription,
    facets: [{ values: (row) => [row.notebookName], match: 'substring' }],
  }).map(Number);

  const { embedders, gate } = searchContext();
  const ranked = await rankIds({
    q: text,
    lexical,
    index: state.ready,
    embedder: options.exact ? undefined : embedders?.foreground,
    gate,
    ...(shown.length < rows.length && {
      allow: new Set(shown.map((row) => String(row.id))),
    }),
  });
  const words = new Set(lexical);
  const hits = ranked.ids.flatMap((id) => {
    const row = byId.get(id);
    if (!row) return [];
    const { transcription, ...page } = row;
    return [
      {
        ...page,
        heading: pageHeading(transcription),
        match: words.has(id) ? ('words' as const) : ('meaning' as const),
        snippet: pageSnippet(transcription, terms),
      },
    ];
  });
  return {
    hits: hits.slice(0, PAGE_HITS),
    semantic: ranked.semantic,
    ...(ranked.reason && { reason: ranked.reason }),
  };
}
