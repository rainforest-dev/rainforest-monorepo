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
