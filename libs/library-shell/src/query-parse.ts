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
  type LanguageOptions,
  type ParseOutcome,
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

/** The words that name each collection. The model may narrow to a collection only when the search says one of them. */
const COLLECTION_WORDS: Partial<Record<CollectionId, string>> = {
  books: String.raw`\bbooks?\b|書`,
  notebooks: String.raw`\bnotebooks?\b|\bjournals?\b|筆記本|筆記|手帳|日記`,
  rack: String.raw`\brack\b|\barticles?\b|報架|文章`,
  kb: String.raw`\bkb\b|\bwiki\b|\bknowledge\b|\bhighlights?\b|知識庫|知識|劃線|畫線`,
};

/** Words that only frame a search; left in the search words they match nothing. */
const FILLER = String.raw`\b(?:about|on|in|my|the|pages?|notes?|from|of)\b`;

/** A hint that the search names a time; without one, the model's days are its own guess. */
const TIME_WORDS =
  /\d|年|月|週|周|天|日|昨|今|明|\b(?:yesterday|today|tomorrow|week|month|year|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;

const names = (raw: string, collection: CollectionId) => {
  const words = COLLECTION_WORDS[collection];
  return words ? new RegExp(words, 'i').test(raw) : false;
};

/** `text` without the collection names and filler the model left in, or as it was if nothing else is left. */
function subject(text: string): string {
  const words = [...Object.values(COLLECTION_WORDS), FILLER].join('|');
  const left = text
    .replace(new RegExp(words, 'gi'), ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return left || text;
}

/**
 * Drops what the model made up: collections the search never names, days it never mentions,
 * malformed days, a range that runs back, and collection names left in the search words.
 */
export function sanitizeAnswer(output: unknown, raw: string): unknown {
  if (!isRecord(output)) return output;
  const { text, collections, from, to } = output;
  const named = Array.isArray(collections)
    ? collections.filter(
        (c): c is CollectionId =>
          (SEARCHED as unknown[]).includes(c) && names(raw, c as CollectionId),
      )
    : [];
  const valid = (d: unknown): d is string =>
    typeof d === 'string' && isLibraryDay(d) && TIME_WORDS.test(raw);
  const range =
    valid(from) && valid(to) && from > to
      ? {}
      : { ...(valid(from) && { from }), ...(valid(to) && { to }) };
  return {
    text: typeof text === 'string' ? subject(text) : text,
    ...(named.length > 0 && { collections: [...new Set(named)] }),
    ...range,
  };
}

export function buildPrompt(raw: string, today: string): string {
  return [
    `Today is ${today}. Turn the library search below into JSON.`,
    'collections: only if it names one of books, notebooks (handwritten journal pages), rack (articles queued to read) or kb (wiki pages and reading highlights).',
    'from, to: the days it refers to, as YYYY-MM-DD; leave them out if it names no date.',
    'text: only the subject to look for, in the language it was written in. Leave out every word that names a collection or a date, and filler such as "about", "pages", "in", "from", 的, 裡, 寫.',
    'Examples: "books about lantern" -> text "lantern", collections ["books"]. "garden notes in my notebooks from September 2026" -> text "garden", collections ["notebooks"], from "2026-09-01", to "2026-09-30". "筆記本裡寫 react 的" -> text "react", collections ["notebooks"]. "上個月的筆記本" (today 2026-10-29) -> text "", collections ["notebooks"], from "2026-09-01", to "2026-09-30". "an" -> text "an".',
    `Search: ${raw}`,
  ].join('\n');
}

/**
 * The model reads Chinese well, but Chrome's built-in model is not offered for `zh` input, so
 * asking for it would rule the model out for every Chinese query. Ask for English only.
 */
const LANGUAGES: LanguageOptions = { input: ['en'], output: ['en'] };

/** A warm on-device prompt takes 0.6–1.4 s and a cold one longer; past this, search as typed. */
export const LIBRARY_PROMPT_TIMEOUT_MS = 3000;

const parser = createQueryParser<LibraryQuery, { raw: string }>({
  schema: () => schema,
  sanitize: (output, { raw }) => sanitizeAnswer(output, raw),
  local: (raw) => ({ text: raw }),
  timeoutMs: LIBRARY_PROMPT_TIMEOUT_MS,
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
  const languages = LANGUAGES;
  const ready = ai && (await ai.refresh(languages)).kind === 'ready';
  const outcome = await parser.parse(
    raw,
    { raw },
    ready
      ? async (jsonSchema, inner) => {
          const run = () =>
            ai.run(buildPrompt(raw, today), jsonSchema, {
              signal: inner,
              languages,
            });
          // Chrome now and then throws an UnknownError on a healthy session; one more try
          // usually answers within the time left.
          try {
            return await run();
          } catch (error) {
            if (inner.aborted) throw error;
            return run();
          }
        }
      : undefined,
    signal,
  );
  // A reading that kept no words searches the words as typed, still narrowed.
  return outcome.value.text.trim()
    ? outcome
    : { ...outcome, value: { ...outcome.value, text: raw } };
}

const warmed = new WeakSet<AiController>();

/**
 * Opens the model's session ahead of the first search, once per box: opening it can take
 * seconds, longer than a search waits. Only when the model is already on the device.
 */
export function warmLibraryModel(ai: AiController): void {
  if (warmed.has(ai)) return;
  warmed.add(ai);
  void ai
    .refresh(LANGUAGES)
    .then((state) =>
      state.kind === 'ready'
        ? ai.run(
            'Answer with an empty JSON object.',
            { type: 'object' },
            {
              languages: LANGUAGES,
            },
          )
        : undefined,
    )
    .catch(() => warmed.delete(ai));
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
