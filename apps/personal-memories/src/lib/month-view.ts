import { pickCover } from './cover.ts';
import type { DayIndex } from './days.ts';
import { calendarWeeks, MONTH_RE, monthOf, shiftMonth } from './months.ts';
import { excerptOf } from './notes/attach.ts';
import type { DayNote } from './notes/types.ts';
import type { TimelineEvent } from './timeline.ts';

export type MonthCell = {
  date: string;
  day: number;
  total: number;
  noted: boolean;
  cover?: string;
  memory?: string;
  excerpt?: string;
};

export type MonthView = {
  month: string;
  weeks: (MonthCell | null)[][];
  total: number;
  prev?: string;
  next?: string;
};

export type NoteReader = (
  date: string,
) => { note: DayNote; parseError?: true } | undefined;

const MARKER = /^\s*(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+\.\s+)/;

export function firstLine(body: string): string | undefined {
  for (const raw of body.split('\n')) {
    const line = raw.replace(MARKER, '').trim();
    if (line) return line;
  }
  return undefined;
}

export function dayCell(
  date: string,
  events: readonly TimelineEvent[],
  noted: boolean,
  read: NoteReader,
): MonthCell {
  const cell: MonthCell = {
    date,
    day: Number(date.slice(8, 10)),
    total: events.length,
    noted,
  };
  const result = noted ? read(date) : undefined;
  const note = result && !result.parseError ? result.note : undefined;
  const cover = pickCover(events, note?.cover);
  if (cover) cell.cover = cover.id;
  const memory = note && firstLine(note.body);
  if (memory) cell.memory = memory;
  const message = events.find((e) => e.source !== 'photo' && e.text?.trim());
  if (message) cell.excerpt = excerptOf(message, 60);
  return cell;
}

export function monthView(
  index: DayIndex,
  month: string,
  noted: ReadonlySet<string>,
  read: NoteReader,
): MonthView | undefined {
  const first = index.dates[0];
  const last = index.dates.at(-1);
  if (!MONTH_RE.test(month) || !first || !last) return undefined;
  if (month < monthOf(first) || month > monthOf(last)) return undefined;
  let total = 0;
  const weeks = calendarWeeks(month).map((week) =>
    week.map((date) => {
      if (!date) return null;
      const events = index.byDate.get(date) ?? [];
      total += events.length;
      return dayCell(date, events, noted.has(date), read);
    }),
  );
  const view: MonthView = { month, weeks, total };
  if (month > monthOf(first)) view.prev = shiftMonth(month, -1);
  if (month < monthOf(last)) view.next = shiftMonth(month, 1);
  return view;
}

export function dayCells(
  index: DayIndex,
  noted: ReadonlySet<string>,
  read: NoteReader,
): Map<string, MonthCell> {
  return new Map(
    index.dates.map((date) => [
      date,
      dayCell(date, index.byDate.get(date) ?? [], noted.has(date), read),
    ]),
  );
}
