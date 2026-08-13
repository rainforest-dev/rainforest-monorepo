const STALE_REASONS = [
  'done-unfiled',
  'expired',
  'off-stack',
  'deferred-dead',
  'abandoned',
  'duplicate',
  'malformed',
] as const;

/**
 * Whether the content decays. Age only condemns what actually rots: a release
 * note is worthless after months, a book on design patterns is not. Judged from
 * the content by the skill, not inferred from dates.
 */
const DECAYS = ['time-sensitive', 'evergreen', 'unknown'] as const;

export type StaleReason = (typeof STALE_REASONS)[number];
export type Decay = (typeof DECAYS)[number];

export type QueueSort = {
  profileRank: number;
  wikiSources: number;
  readingMinutes: number;
  savedDaysAgo: number;
  progress: number;
};

export type QueueItem = {
  rank: number;
  tier: number;
  id: string;
  title: string;
  readerUrl: string;
  sourceUrl: string;
  siteName: string;
  tags: string[];
  why: string;
  decay: Decay;
  sort: QueueSort;
};

export type StaleItem = {
  id: string;
  title: string;
  reason: StaleReason;
  /** Why this specific item was set aside, in content terms — not the rule name. */
  why: string;
  decay: Decay;
  savedAt: string;
  readerUrl: string;
};

export type ReadingQueue = {
  generated: string;
  cutoffMonths: number;
  counts: {
    scanned: number;
    queued: number;
    stale: number;
    /** Candidates that did not make the cut this run — hidden, never silently. */
    backlog: number;
  };
  queue: QueueItem[];
  stale: StaleItem[];
};

const MAX_SNIPPET_LENGTH = 40;

/** Renders a runtime value for an error message: type-tagged and truncated. */
function describeValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') {
    const snippet =
      value.length > MAX_SNIPPET_LENGTH
        ? `${value.slice(0, MAX_SNIPPET_LENGTH)}…`
        : value;
    return `string "${snippet}"`;
  }
  if (typeof value === 'number' || typeof value === 'boolean')
    return `${typeof value} ${String(value)}`;
  if (Array.isArray(value)) return `array (length ${value.length})`;
  if (typeof value === 'object') return 'object';
  return typeof value;
}

function fail(path: string, expected: string, value: unknown): never {
  throw new Error(
    `reading-queue.json: ${path} — expected ${expected}, got ${describeValue(value)}`,
  );
}

function asObject(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    fail(path, 'an object', value);
  return value as Record<string, unknown>;
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'an array', value);
  return value;
}

function asString(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, 'a string', value);
  return value;
}

/** Like asString, but rejects empty/whitespace-only text. */
function asNonEmptyString(value: unknown, path: string): string {
  const text = asString(value, path);
  if (text.trim().length === 0) fail(path, 'a non-empty string', value);
  return text;
}

function asNumber(
  value: unknown,
  path: string,
  opts: { min?: number; max?: number } = {},
): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    fail(path, 'a finite number', value);
  if (opts.min !== undefined && value < opts.min)
    fail(path, `a number >= ${opts.min}`, value);
  if (opts.max !== undefined && value > opts.max)
    fail(path, `a number <= ${opts.max}`, value);
  return value;
}

function asInteger(
  value: unknown,
  path: string,
  opts: { min?: number } = {},
): number {
  const num = asNumber(value, path);
  if (!Number.isInteger(num)) fail(path, 'an integer', value);
  if (opts.min !== undefined && num < opts.min)
    fail(path, `an integer >= ${opts.min}`, value);
  return num;
}

function asStringArray(value: unknown, path: string): string[] {
  return asArray(value, path).map((v, i) => asString(v, `${path}[${i}]`));
}

function asStaleReason(value: unknown, path: string): StaleReason {
  const text = asString(value, path);
  if (!(STALE_REASONS as readonly string[]).includes(text))
    fail(path, `one of ${STALE_REASONS.join(' | ')}`, value);
  return text as StaleReason;
}

function asDecay(value: unknown, path: string): Decay {
  const text = asString(value, path);
  if (!(DECAYS as readonly string[]).includes(text))
    fail(path, `one of ${DECAYS.join(' | ')}`, value);
  return text as Decay;
}

function parseSort(value: unknown, path: string): QueueSort {
  const raw = asObject(value, path);
  return {
    profileRank: asNumber(raw.profileRank, `${path}.profileRank`),
    wikiSources: asNumber(raw.wikiSources, `${path}.wikiSources`, { min: 0 }),
    readingMinutes: asNumber(raw.readingMinutes, `${path}.readingMinutes`, {
      min: 0,
    }),
    savedDaysAgo: asNumber(raw.savedDaysAgo, `${path}.savedDaysAgo`, {
      min: 0,
    }),
    progress: asNumber(raw.progress, `${path}.progress`, { min: 0, max: 1 }),
  };
}

function parseQueueItem(value: unknown, path: string): QueueItem {
  const raw = asObject(value, path);
  return {
    rank: asInteger(raw.rank, `${path}.rank`, { min: 0 }),
    tier: asInteger(raw.tier, `${path}.tier`, { min: 0 }),
    id: asNonEmptyString(raw.id, `${path}.id`),
    title: asNonEmptyString(raw.title, `${path}.title`),
    readerUrl: asNonEmptyString(raw.readerUrl, `${path}.readerUrl`),
    sourceUrl: asNonEmptyString(raw.sourceUrl, `${path}.sourceUrl`),
    siteName: asString(raw.siteName, `${path}.siteName`),
    tags: asStringArray(raw.tags, `${path}.tags`),
    why: asString(raw.why, `${path}.why`),
    decay: asDecay(raw.decay, `${path}.decay`),
    sort: parseSort(raw.sort, `${path}.sort`),
  };
}

function parseStaleItem(value: unknown, path: string): StaleItem {
  const raw = asObject(value, path);
  return {
    id: asNonEmptyString(raw.id, `${path}.id`),
    title: asNonEmptyString(raw.title, `${path}.title`),
    reason: asStaleReason(raw.reason, `${path}.reason`),
    why: asNonEmptyString(raw.why, `${path}.why`),
    decay: asDecay(raw.decay, `${path}.decay`),
    savedAt: asString(raw.savedAt, `${path}.savedAt`),
    readerUrl: asNonEmptyString(raw.readerUrl, `${path}.readerUrl`),
  };
}

/**
 * `id` becomes a React key downstream, so a duplicate — e.g. from a Readwise
 * pagination glitch — must fail loudly here rather than render silently wrong.
 */
function checkUniqueIds(queue: QueueItem[], stale: StaleItem[]): void {
  const firstSeenAt = new Map<string, string>();
  const check = (id: string, path: string): void => {
    const firstPath = firstSeenAt.get(id);
    if (firstPath !== undefined)
      throw new Error(
        `reading-queue.json: duplicate id "${id}" — appears at both ${firstPath} and ${path}`,
      );
    firstSeenAt.set(id, path);
  };
  queue.forEach((item, i) => check(item.id, `queue[${i}]`));
  stale.forEach((item, i) => check(item.id, `stale[${i}]`));
}

export type SortMode = 'default' | 'shortest' | 'newest' | 'thinnest';

export const SORT_MODES: { mode: SortMode; label: string }[] = [
  { mode: 'default', label: 'Default' },
  { mode: 'shortest', label: 'Shortest first' },
  { mode: 'newest', label: 'Newest first' },
  { mode: 'thinnest', label: 'Thinnest wiki page' },
];

const SORT_KEYS: Record<
  Exclude<SortMode, 'default'>,
  (item: QueueItem) => number
> = {
  shortest: (item) => item.sort.readingMinutes,
  newest: (item) => item.sort.savedDaysAgo,
  thinnest: (item) => item.sort.wikiSources,
};

/** Returns a new array; ties break by rank so the order is always stable. */
export function sortQueue(items: QueueItem[], mode: SortMode): QueueItem[] {
  const sorted = [...items];
  if (mode === 'default') return sorted.sort((a, b) => a.rank - b.rank);
  const key = SORT_KEYS[mode];
  return sorted.sort((a, b) => key(a) - key(b) || a.rank - b.rank);
}

export function parseReadingQueue(content: string): ReadingQueue {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`reading-queue.json: not valid JSON — ${detail}`);
  }

  const raw = asObject(parsed, 'root');
  const counts = asObject(raw.counts, 'counts');

  const queue = asArray(raw.queue, 'queue').map((v, i) =>
    parseQueueItem(v, `queue[${i}]`),
  );
  const stale = asArray(raw.stale, 'stale').map((v, i) =>
    parseStaleItem(v, `stale[${i}]`),
  );
  checkUniqueIds(queue, stale);

  return {
    generated: asString(raw.generated, 'generated'),
    cutoffMonths: asNumber(raw.cutoffMonths, 'cutoffMonths'),
    counts: {
      scanned: asInteger(counts.scanned, 'counts.scanned', { min: 0 }),
      queued: asInteger(counts.queued, 'counts.queued', { min: 0 }),
      stale: asInteger(counts.stale, 'counts.stale', { min: 0 }),
      backlog: asInteger(counts.backlog, 'counts.backlog', { min: 0 }),
    },
    queue,
    stale,
  };
}
