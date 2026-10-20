import { calendarWeeks } from '@rainforest-dev/journal-kit';

import { pageHeading } from './outline';

/** A page placed on the calendar by the date written on it. */
export interface CalendarPage {
  id: number;
  notebookId: number;
  notebookName: string;
  position: number;
  pageDate: string;
  transcription: string | null;
}

export interface CalendarDay {
  date: string;
  day: number;
  pages: CalendarPage[];
  /** The first page's heading, shown under its thumbnail. */
  heading?: string;
}

/** The month as weeks of days, each holding the pages dated that day in notebook then page order. */
export function calendarDays(
  month: string,
  pages: readonly CalendarPage[],
): (CalendarDay | null)[][] {
  const byDate = new Map<string, CalendarPage[]>();
  for (const page of pages) {
    const list = byDate.get(page.pageDate);
    if (list) list.push(page);
    else byDate.set(page.pageDate, [page]);
  }
  return calendarWeeks(month).map((week) =>
    week.map((date) => {
      if (!date) return null;
      const dayPages = (byDate.get(date) ?? []).sort(
        (a, b) => a.notebookId - b.notebookId || a.position - b.position,
      );
      const heading = dayPages
        .map((page) => pageHeading(page.transcription))
        .find(Boolean);
      return {
        date,
        day: Number(date.slice(8, 10)),
        pages: dayPages,
        ...(heading && { heading }),
      };
    }),
  );
}

/** Each notebook in the month gets a colour slot, in order of notebook id. */
export function notebookSlots(
  pages: readonly CalendarPage[],
  slots: number,
): Map<number, number> {
  const ids = [...new Set(pages.map((page) => page.notebookId))].sort(
    (a, b) => a - b,
  );
  return new Map(ids.map((id, i) => [id, i % slots]));
}
