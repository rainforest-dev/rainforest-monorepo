import { monthOf, nearestDate } from './months.ts';

const pad2 = (s: string) => s.padStart(2, '0');

export function queryPrefixes(raw: string): string[] {
  const q = raw.trim();
  if (!q) return [''];
  if (/^\d{8}$/.test(q))
    return [`${q.slice(0, 4)}-${q.slice(4, 6)}-${q.slice(6)}`];
  const [year, ...rest] = q.split(/\D+/).filter(Boolean);
  if (!year || year.length > 4 || rest.length > 2) return [];
  if (year.length < 4) return rest.length ? [] : [year];
  const last = rest[rest.length - 1];
  if (last === undefined) return [year];
  if (rest.some((p) => p.length > 2)) return [];
  const head = [year, ...rest.slice(0, -1).map(pad2)];
  const join = (tail: string) => [...head, tail].join('-');
  if (last.length === 2 || /\D$/.test(q)) return [join(pad2(last))];
  return [join(`0${last}`), join(last)];
}

export function matchDates(dates: readonly string[], raw: string): string[] {
  const prefixes = queryPrefixes(raw);
  return dates.filter((d) => prefixes.some((p) => d.startsWith(p)));
}

export function groupByMonth(
  dates: readonly string[],
): { month: string; dates: string[] }[] {
  const groups: { month: string; dates: string[] }[] = [];
  for (const date of dates) {
    const month = monthOf(date);
    const last = groups.at(-1);
    if (last?.month === month) last.dates.push(date);
    else groups.push({ month, dates: [date] });
  }
  return groups;
}

function probeDate(raw: string): string | undefined {
  const prefix = queryPrefixes(raw).find((p) => /^\d{4}/.test(p));
  if (!prefix) return undefined;
  const [year, month = '01', day = '01'] = prefix.split('-');
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export type JumpTarget = { date: string; exact: boolean };

export function jumpTarget(
  dates: readonly string[],
  raw: string,
): JumpTarget | undefined {
  const [first] = matchDates(dates, raw);
  if (first && raw.trim()) return { date: first, exact: true };
  const probe = probeDate(raw);
  const near = probe ? nearestDate(dates, probe) : undefined;
  return near ? { date: near, exact: false } : undefined;
}
