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

const DAY_MS = 86_400_000;
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The days of the calendar period `today` falls in, moved back `back` periods. */
function period(
  today: string,
  unit: 'day' | 'week' | 'month' | 'year',
  back: number,
) {
  const now = Date.parse(`${today}T00:00:00Z`);
  const d = new Date(now);
  const [y, m] = [d.getUTCFullYear(), d.getUTCMonth()];
  if (unit === 'day')
    return { from: dayOf(now - back * DAY_MS), to: dayOf(now - back * DAY_MS) };
  if (unit === 'week') {
    const monday = now - (((d.getUTCDay() + 6) % 7) + 7 * back) * DAY_MS;
    return { from: dayOf(monday), to: dayOf(monday + 6 * DAY_MS) };
  }
  if (unit === 'month')
    return {
      from: dayOf(Date.UTC(y, m - back, 1)),
      to: dayOf(Date.UTC(y, m - back + 1, 0)),
    };
  return { from: `${y - back}-01-01`, to: `${y - back}-12-31` };
}

/**
 * Days the search names relative to today. The on-device model gets these wrong more often than
 * right, so they are read here and win over its answer. Longer phrases come first.
 */
const RELATIVE_DAYS = [
  [String.raw`上個?月|\blast month\b`, 'month', 1],
  [String.raw`這個?月|这个?月|本月|\bthis month\b`, 'month', 0],
  [String.raw`上個?(?:週|周|禮拜|礼拜|星期)|\blast week\b`, 'week', 1],
  [
    String.raw`這個?(?:週|周|禮拜|礼拜|星期)|这个?(?:周|礼拜|星期)|本(?:週|周)|\bthis week\b`,
    'week',
    0,
  ],
  [String.raw`去年|\blast year\b`, 'year', 1],
  [String.raw`今年|\bthis year\b`, 'year', 0],
  [String.raw`昨天|昨日|\byesterday\b`, 'day', 1],
  [String.raw`今天|今日|\btoday\b`, 'day', 0],
] as const;

export function relativeDays(
  raw: string,
  today: string,
): { from: string; to: string } | undefined {
  for (const [words, unit, back] of RELATIVE_DAYS)
    if (new RegExp(words, 'i').test(raw)) return period(today, unit, back);
  return undefined;
}

/** Chinese particles left at either end once the collection and date words are gone. */
const EDGES = /^[\s的裡里寫写中]+|[\s的裡里寫写中]+$/g;

/** `text` without the collection names, relative days and filler in it; `''` if nothing else is left. */
function subject(text: string): string {
  const words = [
    ...Object.values(COLLECTION_WORDS),
    ...RELATIVE_DAYS.map(([w]) => w),
    FILLER,
  ].join('|');
  return text
    .replace(new RegExp(words, 'gi'), ' ')
    .replace(/\s+/g, ' ')
    .replace(EDGES, '');
}

const namedIn = (raw: string) => SEARCHED.filter((c) => names(raw, c));

/** Whether the search says anything a reading could narrow by: a collection or a time. */
const readable = (raw: string) =>
  namedIn(raw).length > 0 || TIME_WORDS.test(raw);

/**
 * Drops what the model made up: collections the search never names, days it never mentions,
 * malformed days, a range that runs back, and collection names left in the search words. Days
 * relative to today are read here instead of taken from the model.
 */
export function sanitizeAnswer(
  output: unknown,
  raw: string,
  today?: string,
): unknown {
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
    (today && relativeDays(raw, today)) ||
    (valid(from) && valid(to) && from > to
      ? {}
      : { ...(valid(from) && { from }), ...(valid(to) && { to }) });
  return {
    text: typeof text === 'string' ? subject(text) : text,
    ...(named.length > 0 && { collections: [...new Set(named)] }),
    ...range,
  };
}

/** The reading made without the model: the collections named, the relative days, the rest. */
export function readByRules(raw: string, today: string): LibraryQuery {
  const collections = namedIn(raw);
  return {
    text: subject(raw),
    ...(collections.length > 0 && { collections }),
    ...relativeDays(raw, today),
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

/**
 * A warm on-device prompt answers in 0.6–1.4 s; when it is slower it rarely answers at all, and
 * the rules read the search instead. Past this, stop waiting for it.
 */
export const LIBRARY_PROMPT_TIMEOUT_MS = 2000;

const parser = createQueryParser<LibraryQuery, { raw: string; today: string }>({
  schema: () => schema,
  sanitize: (output, { raw, today }) => sanitizeAnswer(output, raw, today),
  local: (raw) => ({ text: raw }),
  timeoutMs: LIBRARY_PROMPT_TIMEOUT_MS,
});

/**
 * Reads `raw` with the browser's own model when one is already on this device, so a search such
 * as "notebooks last month about react" asks only the notebooks, for those days. The model is
 * asked only when the search names a collection or a time; plain words are searched as typed at
 * once. When the model is ready but slow or wrong, the collection and relative-day words are
 * read without it. Without a ready model the words are searched as typed. Never starts a
 * download. A reading with days and no words left asks for everything in those days.
 */
export async function parseLibraryQuery(
  raw: string,
  today: string,
  ai: AiController | undefined,
  signal?: AbortSignal,
): Promise<ParseOutcome<LibraryQuery>> {
  const languages = LANGUAGES;
  const ready =
    ai && readable(raw) && (await ai.refresh(languages)).kind === 'ready';
  const outcome = await parser.parse(
    raw,
    { raw, today },
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
  const value =
    ready && outcome.status !== 'ai' ? readByRules(raw, today) : outcome.value;
  // No words left: everything in the days, or the words as typed when no days were named.
  const text = value.text.trim() || (value.from || value.to ? '' : raw);
  return { ...outcome, value: { ...value, text } };
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
