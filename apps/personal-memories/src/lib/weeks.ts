import type { TimelineEvent, TimelineSource } from './timeline.ts';

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAYS_ZH = ['日', '一', '二', '三', '四', '五', '六'];

export const ISO_WEEK = /^(\d{4})-W(\d{2})$/;

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** Taipei calendar date as a UTC-midnight `Date`, so UTC getters read Taipei fields. */
function taipeiDay(at: string): Date {
  const shifted = new Date(Date.parse(at) + TAIPEI_OFFSET_MS);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ),
  );
}

const formatDate = (day: Date) =>
  `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`;

/** `YYYY-MM-DD` of the instant in Asia/Taipei. */
export function taipeiDate(at: string): string {
  return formatDate(taipeiDay(at));
}

/** `HH:mm` of the instant in Asia/Taipei. */
export function taipeiTime(at: string): string {
  const shifted = new Date(Date.parse(at) + TAIPEI_OFFSET_MS);
  return `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

/** ISO 8601 week (`2026-W38`) of the instant in Asia/Taipei. */
export function isoWeek(at: string): string {
  const day = taipeiDay(at);
  const weekday = day.getUTCDay() || 7;
  // The Thursday of this week decides the ISO year.
  const thursday = new Date(day.getTime() + (4 - weekday) * DAY_MS);
  const year = thursday.getUTCFullYear();
  const week =
    Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / (7 * DAY_MS)) + 1;
  return `${year}-W${pad(week)}`;
}

/** Monday and Sunday (`YYYY-MM-DD`) of an ISO week, or `undefined` if malformed. */
export function weekSpan(week: string): [string, string] | undefined {
  const match = ISO_WEEK.exec(week);
  if (!match) return undefined;
  const year = Number(match[1]);
  const jan4 = Date.UTC(year, 0, 4);
  const jan4Weekday = new Date(jan4).getUTCDay() || 7;
  const monday = jan4 - (jan4Weekday - 1) * DAY_MS;
  const start = monday + (Number(match[2]) - 1) * 7 * DAY_MS;
  return [
    formatDate(new Date(start)),
    formatDate(new Date(start + 6 * DAY_MS)),
  ];
}

/** `2025-11-01（週六）` */
export function dayHeading(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return `${date}（週${WEEKDAYS_ZH[weekday]}）`;
}

export type WeekDays = Map<string, TimelineEvent[]>;

/**
 * Groups events by ISO week, then by Taipei date. Days are ascending and
 * events keep ascending time order; weeks follow the first event seen.
 */
export function groupByWeek(
  events: readonly TimelineEvent[],
): Map<string, WeekDays> {
  const sorted = events
    .map((event, index) => ({ event, index, t: Date.parse(event.at) }))
    .sort((a, b) => a.t - b.t || a.index - b.index)
    .map(({ event }) => event);

  const weeks = new Map<string, WeekDays>();
  for (const event of sorted) {
    const week = isoWeek(event.at);
    const date = taipeiDate(event.at);
    let days = weeks.get(week);
    if (!days) weeks.set(week, (days = new Map()));
    let list = days.get(date);
    if (!list) days.set(date, (list = []));
    list.push(event);
  }
  return weeks;
}

export function countBySource(days: WeekDays): Record<TimelineSource, number> {
  const counts: Record<TimelineSource, number> = {
    line: 0,
    slack: 0,
    photo: 0,
  };
  for (const list of days.values()) {
    for (const event of list) counts[event.source]++;
  }
  return counts;
}
