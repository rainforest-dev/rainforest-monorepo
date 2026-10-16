import { monthOf } from '@rainforest-dev/journal-kit';

import type { DaySummary } from './days.ts';

export {
  calendarWeeks,
  MONTH_RE,
  monthLabel,
  monthOf,
  shiftMonth,
} from '@rainforest-dev/journal-kit';

const dayNumber = (date: string) =>
  Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  );

export function nearestDate(
  dates: readonly string[],
  target: string,
): string | undefined {
  let lo = 0;
  let hi = dates.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((dates[mid] ?? '') < target) lo = mid + 1;
    else hi = mid;
  }
  const after = dates[lo];
  const before = dates[lo - 1];
  if (after === undefined || before === undefined) return after ?? before;
  const t = dayNumber(target);
  return Math.abs(t - dayNumber(before)) <= Math.abs(dayNumber(after) - t)
    ? before
    : after;
}

export type ScrubberMonth = { month: string; first: string; total: number };

export function scrubberMonths(
  summaries: readonly Pick<DaySummary, 'date' | 'total'>[],
): ScrubberMonth[] {
  const out: ScrubberMonth[] = [];
  for (const { date, total } of summaries) {
    const month = monthOf(date);
    const last = out.at(-1);
    if (last?.month === month) last.total += total;
    else out.push({ month, first: date, total });
  }
  return out;
}
