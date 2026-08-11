const STALE_REASONS = [
  'done-unfiled',
  'never-opened-stale',
  'deferred-dead',
  'abandoned',
  'duplicate',
  'malformed',
] as const;

export type StaleReason = (typeof STALE_REASONS)[number];

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
  sort: QueueSort;
};

export type StaleItem = {
  id: string;
  title: string;
  reason: StaleReason;
  savedAt: string;
  readerUrl: string;
};

export type ReadingQueue = {
  generated: string;
  cutoffMonths: number;
  counts: { scanned: number; queued: number; stale: number };
  queue: QueueItem[];
  stale: StaleItem[];
};

function fail(path: string, expected: string): never {
  throw new Error(`reading-queue.json: ${path} — expected ${expected}`);
}

function asObject(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    fail(path, 'an object');
  return value as Record<string, unknown>;
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'an array');
  return value;
}

function asString(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, 'a string');
  return value;
}

function asNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) fail(path, 'a number');
  return value;
}

function asStringArray(value: unknown, path: string): string[] {
  return asArray(value, path).map((v, i) => asString(v, `${path}[${i}]`));
}

function asStaleReason(value: unknown, path: string): StaleReason {
  const text = asString(value, path);
  if (!(STALE_REASONS as readonly string[]).includes(text))
    fail(path, `one of ${STALE_REASONS.join(' | ')}`);
  return text as StaleReason;
}

function parseSort(value: unknown, path: string): QueueSort {
  const raw = asObject(value, path);
  return {
    profileRank: asNumber(raw.profileRank, `${path}.profileRank`),
    wikiSources: asNumber(raw.wikiSources, `${path}.wikiSources`),
    readingMinutes: asNumber(raw.readingMinutes, `${path}.readingMinutes`),
    savedDaysAgo: asNumber(raw.savedDaysAgo, `${path}.savedDaysAgo`),
    progress: asNumber(raw.progress, `${path}.progress`),
  };
}

function parseQueueItem(value: unknown, path: string): QueueItem {
  const raw = asObject(value, path);
  return {
    rank: asNumber(raw.rank, `${path}.rank`),
    tier: asNumber(raw.tier, `${path}.tier`),
    id: asString(raw.id, `${path}.id`),
    title: asString(raw.title, `${path}.title`),
    readerUrl: asString(raw.readerUrl, `${path}.readerUrl`),
    sourceUrl: asString(raw.sourceUrl, `${path}.sourceUrl`),
    siteName: asString(raw.siteName, `${path}.siteName`),
    tags: asStringArray(raw.tags, `${path}.tags`),
    why: asString(raw.why, `${path}.why`),
    sort: parseSort(raw.sort, `${path}.sort`),
  };
}

function parseStaleItem(value: unknown, path: string): StaleItem {
  const raw = asObject(value, path);
  return {
    id: asString(raw.id, `${path}.id`),
    title: asString(raw.title, `${path}.title`),
    reason: asStaleReason(raw.reason, `${path}.reason`),
    savedAt: asString(raw.savedAt, `${path}.savedAt`),
    readerUrl: asString(raw.readerUrl, `${path}.readerUrl`),
  };
}

export function parseReadingQueue(content: string): ReadingQueue {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('reading-queue.json: not valid JSON');
  }

  const raw = asObject(parsed, 'root');
  const counts = asObject(raw.counts, 'counts');

  return {
    generated: asString(raw.generated, 'generated'),
    cutoffMonths: asNumber(raw.cutoffMonths, 'cutoffMonths'),
    counts: {
      scanned: asNumber(counts.scanned, 'counts.scanned'),
      queued: asNumber(counts.queued, 'counts.queued'),
      stale: asNumber(counts.stale, 'counts.stale'),
    },
    queue: asArray(raw.queue, 'queue').map((v, i) =>
      parseQueueItem(v, `queue[${i}]`),
    ),
    stale: asArray(raw.stale, 'stale').map((v, i) =>
      parseStaleItem(v, `stale[${i}]`),
    ),
  };
}
