import {
  COLLECTION_OF_KIND,
  type CollectionId,
  isLibraryDay,
  LIBRARY_SEARCH_MAX_QUERY,
  LIBRARY_SEARCH_SCOPE_PARAM,
} from '@rainforest-dev/library-contract';
import {
  type AiController,
  createQueryParser,
  languagesFor,
  type ParseOutcome,
  queryLanguage,
} from '@rainforest-dev/web-ai';
import { z } from 'zod';

/** The collections the library-wide search asks, one per kind of hit. */
const SEARCHED = [...new Set(Object.values(COLLECTION_OF_KIND))] as [
  CollectionId,
  ...CollectionId[],
];

/** A search as the library reads it: the words, and what the reader narrowed it to. */
export interface LibraryQuery {
  text: string;
  collections?: CollectionId[];
  from?: string;
  to?: string;
}

const day = z.string().refine(isLibraryDay);

const schema = z.object({
  text: z.string().max(LIBRARY_SEARCH_MAX_QUERY),
  collections: z.array(z.enum(SEARCHED)).min(1).optional(),
  from: day.optional(),
  to: day.optional(),
});

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Drops what the model made up: unknown collections, malformed days, a range that runs back. */
export function sanitizeAnswer(output: unknown): unknown {
  if (!isRecord(output)) return output;
  const { text, collections, from, to } = output;
  const known = Array.isArray(collections)
    ? collections.filter((c): c is CollectionId =>
        (SEARCHED as unknown[]).includes(c),
      )
    : [];
  const valid = (d: unknown): d is string =>
    typeof d === 'string' && isLibraryDay(d);
  const range =
    valid(from) && valid(to) && from > to
      ? {}
      : { ...(valid(from) && { from }), ...(valid(to) && { to }) };
  return {
    text,
    ...(known.length > 0 && { collections: [...new Set(known)] }),
    ...range,
  };
}

export function buildPrompt(raw: string, today: string): string {
  return [
    `Today is ${today}. Turn the library search below into JSON.`,
    'collections: only if it names one of books, notebooks (handwritten journal pages), rack (articles queued to read) or kb (wiki pages and reading highlights).',
    'from, to: the days it refers to, as YYYY-MM-DD; leave them out if it names no date.',
    'text: the words to look for once the collections and dates are taken out, in the language they were written in.',
    `Search: ${raw}`,
  ].join('\n');
}

const parser = createQueryParser<LibraryQuery, { raw: string }>({
  schema: () => schema,
  sanitize: (output) => sanitizeAnswer(output),
  local: (raw) => ({ text: raw }),
});

/**
 * Reads `raw` with the browser's own model when one is already on this device, so a search such
 * as "notebooks last month about react" asks only the notebooks, for those days. Without a ready
 * model, or when it is slow or wrong, the words are searched as typed. Never starts a download.
 */
export async function parseLibraryQuery(
  raw: string,
  today: string,
  ai: AiController | undefined,
  signal?: AbortSignal,
): Promise<ParseOutcome<LibraryQuery>> {
  const languages = languagesFor(queryLanguage(raw));
  const ready = ai && (await ai.refresh(languages)).kind === 'ready';
  const outcome = await parser.parse(
    raw,
    { raw },
    ready
      ? (jsonSchema, inner) =>
          ai.run(buildPrompt(raw, today), jsonSchema, {
            signal: inner,
            languages,
          })
      : undefined,
    signal,
  );
  // A reading that kept no words searches the words as typed, still narrowed.
  return outcome.value.text.trim()
    ? outcome
    : { ...outcome, value: { ...outcome.value, text: raw } };
}

/** Whether the model narrowed the search: worth showing the reader how it was read. */
export const isNarrowed = (query: LibraryQuery): boolean =>
  Boolean(query.collections?.length || query.from || query.to);

/** The merged search's parameters for `query`. */
export function searchParams(query: LibraryQuery): URLSearchParams {
  const params = new URLSearchParams({ q: query.text.trim() });
  if (query.collections?.length)
    params.set(LIBRARY_SEARCH_SCOPE_PARAM, query.collections.join(','));
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  return params;
}
