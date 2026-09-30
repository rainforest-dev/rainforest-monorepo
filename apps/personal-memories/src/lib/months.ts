import type { DaySummary } from './days.ts';

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const pad = (n: number) => String(n).padStart(2, '0');

export const monthOf = (date: string) => date.slice(0, 7);

export const monthLabel = (month: string) =>
  `${month.slice(0, 4)} 年 ${Number(month.slice(5, 7))} 月`;

export function shiftMonth(month: string, delta: number): string {
  const i =
    Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + delta;
  return `${Math.floor(i / 12)}-${pad((i % 12) + 1)}`;
}

export function calendarWeeks(month: string): (string | null)[][] {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const lead = new Date(Date.UTC(year, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const slots: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => `${month}-${pad(i + 1)}`),
  ];
  while (slots.length % 7) slots.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < slots.length; i += 7) weeks.push(slots.slice(i, i + 7));
  return weeks;
}

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
