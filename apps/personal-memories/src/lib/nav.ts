import { MONTH_RE, monthOf, nearestDate } from './months.ts';

export type Level = 'year' | 'month' | 'day';
export type Place =
  | { level: 'year' }
  | { level: 'month'; month: string }
  | { level: 'day'; date: string };

const DAY_PATH = /^\/day\/(\d{4}-\d{2}-\d{2})\/?$/;
const MONTH_PATH = /^\/month\/([^/]+)\/?$/;

export function placeOf(pathname: string): Place | undefined {
  if (pathname === '/') return { level: 'year' };
  const date = DAY_PATH.exec(pathname)?.[1];
  if (date) return { level: 'day', date };
  const month = MONTH_PATH.exec(pathname)?.[1];
  return month && MONTH_RE.test(month) ? { level: 'month', month } : undefined;
}

export function zoomOutHref(place: Place): string | undefined {
  if (place.level === 'day') return `/month/${monthOf(place.date)}`;
  if (place.level === 'month') return '/';
  return undefined;
}

export function levelHrefs(
  place: Place,
  dates: readonly string[],
): Record<Level, string> {
  if (place.level === 'day') {
    return {
      year: '/',
      month: `/month/${monthOf(place.date)}`,
      day: `/day/${place.date}`,
    };
  }
  if (place.level === 'month') {
    const day =
      dates.find((d) => monthOf(d) === place.month) ??
      nearestDate(dates, `${place.month}-01`);
    return {
      year: '/',
      month: `/month/${place.month}`,
      day: day ? `/day/${day}` : '/',
    };
  }
  const last = dates.at(-1);
  return {
    year: '/',
    month: last ? `/month/${monthOf(last)}` : '/',
    day: last ? `/day/${last}` : '/',
  };
}
