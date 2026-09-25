import type { TimelineEvent, TimelineSource } from './timeline.ts';
import { taipeiHour } from './weeks.ts';

export type StreamEvent = TimelineEvent & { showTime: boolean };

export type Run =
  | {
      kind: 'text';
      author: string;
      source: TimelineSource;
      isOwner: boolean;
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

export function groupRuns(
  events: readonly TimelineEvent[],
  owners: ReadonlySet<string>,
): Run[] {
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
            isOwner: owners.has(event.author),
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

const accentCache = new WeakMap<
  readonly TimelineEvent[],
  Map<string, Accent>
>();

export function authorAccents(
  events: readonly TimelineEvent[],
): Map<string, Accent> {
  const hit = accentCache.get(events);
  if (hit) return hit;
  const counts = new Map<string, number>();
  for (const e of events)
    if (e.source !== 'photo')
      counts.set(e.author, (counts.get(e.author) ?? 0) + 1);
  const ranked = [...counts].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const accents = new Map(
    ranked.map(([author], i) => [author, ((i % 5) + 1) as Accent]),
  );
  accentCache.set(events, accents);
  return accents;
}

export const initialOf = (author: string) =>
  [...author.trim()][0]?.toUpperCase() ?? '?';

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
