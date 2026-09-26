import type { TimelineEvent, TimelineSource } from './timeline.ts';
import { taipeiHour, taipeiTime } from './weeks.ts';

export type StreamEvent = TimelineEvent & { showTime: boolean };

export type Run =
  | {
      kind: 'text';
      author: string;
      source: TimelineSource;
      events: StreamEvent[];
    }
  | { kind: 'photos'; events: StreamEvent[] };

const continues = (run: Run | undefined, event: TimelineEvent) => {
  if (!run) return false;
  if (run.kind === 'photos') return event.source === 'photo';
  return (
    event.source !== 'photo' &&
    event.source === run.source &&
    event.author === run.author
  );
};

export function groupRuns(events: readonly TimelineEvent[]): Run[] {
  const runs: Run[] = [];
  for (const event of events) {
    const last = runs.at(-1);
    if (continues(last, event)) {
      last?.events.push({ ...event, showTime: false });
      continue;
    }
    const first = [{ ...event, showTime: true }];
    runs.push(
      event.source === 'photo'
        ? { kind: 'photos', events: first }
        : {
            kind: 'text',
            author: event.author,
            source: event.source,
            events: first,
          },
    );
  }
  return runs;
}

export function ownersFromEnv(
  env: Record<string, string | undefined> = process.env,
): Set<string> {
  return new Set(
    (env['MEMORIES_OWNER'] ?? '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean),
  );
}

export function hourCounts(events: readonly TimelineEvent[]): number[] {
  const counts = Array.from({ length: 24 }, () => 0);
  for (const event of events) counts[taipeiHour(event.at)] += 1;
  return counts;
}

export function firstEventPerHour(
  events: readonly TimelineEvent[],
): (string | undefined)[] {
  const firsts: (string | undefined)[] = Array.from(
    { length: 24 },
    () => undefined,
  );
  for (const event of events) firsts[taipeiHour(event.at)] ??= event.id;
  return firsts;
}

export type Accent = 1 | 2 | 3 | 4 | 5;

const OWNER_ACCENT: Accent = 2;
const PARTNER_ACCENT: Accent = 4;
const LATER_ACCENTS: readonly Accent[] = [1, 3, 5];

const accentCache = new WeakMap<
  readonly TimelineEvent[],
  { key: string; accents: Map<string, Accent> }
>();

export function authorAccents(
  events: readonly TimelineEvent[],
  owners: ReadonlySet<string>,
): Map<string, Accent> {
  const key = [...owners].sort().join('\n');
  const hit = accentCache.get(events);
  if (hit?.key === key) return hit.accents;
  const firstSeen = new Map<string, number>();
  for (const e of events) {
    if (e.source === 'photo' || !e.author) continue;
    const t = Date.parse(e.at);
    const seen = firstSeen.get(e.author);
    if (seen === undefined || t < seen) firstSeen.set(e.author, t);
  }
  const accents = new Map<string, Accent>();
  for (const author of firstSeen.keys())
    if (owners.has(author)) accents.set(author, OWNER_ACCENT);
  [...firstSeen]
    .filter(([author]) => !owners.has(author))
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .forEach(([author], i) =>
      accents.set(
        author,
        i === 0
          ? PARTNER_ACCENT
          : (LATER_ACCENTS[(i - 1) % LATER_ACCENTS.length] as Accent),
      ),
    );
  accentCache.set(events, { key, accents });
  return accents;
}

export const initialOf = (author: string) =>
  [...author.trim()][0]?.toUpperCase() ?? '?';

export const rowLabel = (author: string, at: string, excerpt: string) =>
  excerpt
    ? `${author}，${taipeiTime(at)}：${excerpt}`
    : `${author}，${taipeiTime(at)}`;

const THUMB_WIDTHS = [240, 480, 960] as const;

export const thumbUrl = (id: string, n: number, w: number) =>
  `/thumb/${encodeURIComponent(id)}?n=${n}&w=${w}`;

export function thumbSrcset(id: string, n: number, width?: number): string {
  const seen = new Set<number>();
  return THUMB_WIDTHS.flatMap((w) => {
    const actual = Math.min(w, width ?? w);
    if (seen.has(actual)) return [];
    seen.add(actual);
    return [`${thumbUrl(id, n, w)} ${actual}w`];
  }).join(', ');
}
