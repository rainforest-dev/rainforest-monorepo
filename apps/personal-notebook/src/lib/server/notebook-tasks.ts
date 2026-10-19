import { and, asc, eq, isNotNull } from 'drizzle-orm';

import { db, notebookPages, notebooks } from '@/db';
import { type OpenTask, openTasks, type TaskPage } from '@/lib/notebook';

import { notInTrash } from './notebooks';

/**
 * The bullets still open across every notebook outside Trash. Notebooks are read in the order
 * they were written, by their earliest dated page, so an item copied into a newer notebook is
 * judged by its newer copy.
 */
export function notebookTasks(now = new Date()): OpenTask[] {
  const rows: TaskPage[] = db
    .select({
      id: notebookPages.id,
      notebookId: notebookPages.notebookId,
      notebookName: notebooks.name,
      position: notebookPages.position,
      pageNumber: notebookPages.pageNumber,
      pageDate: notebookPages.pageDate,
      transcription: notebookPages.transcription,
    })
    .from(notebookPages)
    .innerJoin(notebooks, eq(notebooks.id, notebookPages.notebookId))
    .where(and(isNotNull(notebookPages.transcription), notInTrash))
    .orderBy(asc(notebookPages.notebookId), asc(notebookPages.position))
    .all();
  const started = new Map<number, string>();
  for (const row of rows) {
    const seen = started.get(row.notebookId);
    if (row.pageDate && (!seen || row.pageDate < seen))
      started.set(row.notebookId, row.pageDate);
  }
  // Stable sort: pages keep their order within a notebook, and undated notebooks keep id order.
  const ordered = rows.toSorted((a, b) => {
    const x = started.get(a.notebookId) ?? '9999';
    const y = started.get(b.notebookId) ?? '9999';
    return x === y ? 0 : x < y ? -1 : 1;
  });
  return openTasks(ordered, now);
}
