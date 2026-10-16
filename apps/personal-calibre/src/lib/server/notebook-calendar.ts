import { and, asc, eq, gt, isNotNull, isNull, lt, sql } from 'drizzle-orm';

import { appDb, notebookPages, notebooks } from '@/db';
import type { CalendarPage } from '@/lib/notebook';

import { MAX_OCR_ATTEMPTS } from './ocr';

/** Pages with no date yet, by why. */
export interface UndatedPages {
  /** No transcription yet; OCR will read them. */
  waiting: number;
  /** Transcribed, but no date was found on the page. */
  noDate: number;
  /** OCR failed on them too often and left them for a person. */
  gaveUp: number;
}

export interface NotebookCalendar {
  month: string;
  pages: CalendarPage[];
  /** The nearest earlier and later months that have dated pages. */
  prev?: string;
  next?: string;
}

const pageMonth = sql<string>`substr(${notebookPages.pageDate}, 1, 7)`;

/** The pages dated in `month` (YYYY-MM), across every notebook. */
export function notebookCalendar(month: string): NotebookCalendar {
  const pages = appDb
    .select({
      id: notebookPages.id,
      notebookId: notebookPages.notebookId,
      notebookName: notebooks.name,
      position: notebookPages.position,
      pageDate: sql<string>`${notebookPages.pageDate}`,
      transcription: notebookPages.transcription,
    })
    .from(notebookPages)
    .innerJoin(notebooks, eq(notebooks.id, notebookPages.notebookId))
    .where(eq(pageMonth, month))
    .orderBy(
      asc(notebookPages.pageDate),
      asc(notebookPages.notebookId),
      asc(notebookPages.position),
    )
    .all();
  const nearest = (before: boolean) =>
    appDb
      .select({ month: pageMonth })
      .from(notebookPages)
      .where(
        and(
          isNotNull(notebookPages.pageDate),
          before ? lt(pageMonth, month) : gt(pageMonth, month),
        ),
      )
      .orderBy(before ? sql`1 DESC` : sql`1 ASC`)
      .limit(1)
      .get()?.month;
  const prev = nearest(true);
  const next = nearest(false);
  return {
    month,
    pages,
    ...(prev && { prev }),
    ...(next && { next }),
  };
}

/** The month of the latest dated page, where the calendar opens by default. */
export function latestDatedMonth(): string | undefined {
  return (
    appDb
      .select({ month: sql<string>`max(${pageMonth})` })
      .from(notebookPages)
      .get()?.month ?? undefined
  );
}

export function undatedPages(): UndatedPages {
  const row = appDb
    .select({
      waiting: sql<number>`coalesce(sum(${notebookPages.transcription} IS NULL AND ${notebookPages.ocrAttempts} < ${MAX_OCR_ATTEMPTS}), 0)`,
      gaveUp: sql<number>`coalesce(sum(${notebookPages.transcription} IS NULL AND ${notebookPages.ocrAttempts} >= ${MAX_OCR_ATTEMPTS}), 0)`,
      noDate: sql<number>`coalesce(sum(${notebookPages.transcription} IS NOT NULL), 0)`,
    })
    .from(notebookPages)
    .where(isNull(notebookPages.pageDate))
    .get();
  return row ?? { waiting: 0, noDate: 0, gaveUp: 0 };
}
