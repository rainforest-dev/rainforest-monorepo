import type { TimelineEvent, TimelineSource } from './timeline.ts';
import { taipeiDate, weekSpan } from './weeks.ts';

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type DaySummary = {
  date: string;
  counts: Record<TimelineSource, number>;
  total: number;
};

export type DayIndex = {
  dates: string[];
  byDate: Map<string, TimelineEvent[]>;
};

const cache = new WeakMap<readonly TimelineEvent[], DayIndex>();

export function indexDays(events: readonly TimelineEvent[]): DayIndex {
  const hit = cache.get(events);
  if (hit) return hit;
  const byDate = new Map<string, TimelineEvent[]>();
  const sorted = events
    .map((event, i) => ({ event, i, t: Date.parse(event.at) }))
    .sort((a, b) => a.t - b.t || a.i - b.i);
  for (const { event } of sorted) {
    const date = taipeiDate(event.at);
    const list = byDate.get(date);
    if (list) list.push(event);
    else byDate.set(date, [event]);
  }
  const index = { dates: [...byDate.keys()].sort(), byDate };
  cache.set(events, index);
  return index;
}

export function summarize(index: DayIndex): DaySummary[] {
  return index.dates.map((date) => {
    const counts: Record<TimelineSource, number> = {
      line: 0,
      slack: 0,
      photo: 0,
    };
    const events = index.byDate.get(date) ?? [];
    for (const e of events) counts[e.source]++;
    return { date, counts, total: events.length };
  });
}

export function neighbours(index: DayIndex, date: string) {
  const i = index.dates.indexOf(date);
  const out: { prev?: string; next?: string } = {};
  if (i > 0) out.prev = index.dates[i - 1];
  if (i !== -1 && i < index.dates.length - 1) out.next = index.dates[i + 1];
  return out;
}

export function dayForWeek(index: DayIndex, isoWeek: string) {
  const span = weekSpan(isoWeek);
  if (!span) return undefined;
  return index.dates.find((d) => d >= span[0] && d <= span[1]);
}

export function heatLevels(totals: readonly number[]) {
  const sorted = totals.filter((t) => t > 0).sort((a, b) => a - b);
  const at = (q: number) =>
    sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)] ?? 0;
  const [p25, p50, p75] = [at(0.25), at(0.5), at(0.75)];
  return (total: number): 0 | 1 | 2 | 3 | 4 =>
    total <= 0 ? 0 : total <= p25 ? 1 : total <= p50 ? 2 : total <= p75 ? 3 : 4;
}
