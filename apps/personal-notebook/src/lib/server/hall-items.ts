import { type HallItem } from '@rainforest-dev/library-contract';
import { fnv1a } from '@rainforest-dev/search';
import { isNotNull, like, min } from 'drizzle-orm';

import { db, notebookPages } from '@/db';
import { withBase } from '@/lib/base-path';
import type { NotebookSummary } from '@/types';

import { listNotebooks } from './notebooks';

/**
 * Cover cloths a paper notebook comes in. A notebook has no colour of its own yet, so its name
 * picks one, and the same notebook keeps its colour on every shelf.
 */
export const NOTEBOOK_COLORS = [
  '#2f4858',
  '#7a3b2e',
  '#3d5a3a',
  '#5b4a7a',
  '#8a6d2f',
  '#2e5e6e',
  '#6e2f4f',
  '#4a4a4a',
] as const;

export const notebookColor = (name: string): string =>
  NOTEBOOK_COLORS[Number.parseInt(fnv1a(name), 16) % NOTEBOOK_COLORS.length] ??
  NOTEBOOK_COLORS[0];

/** Who wrote every notebook on the shelf. */
export const NOTEBOOK_AUTHOR = 'Rainforest';

/** The year and month a notebook's name carries, as in `Bullet Journal 2026-08`. */
const monthInName = (name: string) =>
  /(?:^|\D)(\d{4}-(?:0[1-9]|1[0-2]))(?!\d)/.exec(name)?.[1];

/**
 * When a notebook belongs: when it was started, else its earliest dated page, else the month its
 * name gives, and only then when it was added, which is usually long after it was written.
 */
const dateOfNotebook = (notebook: NotebookSummary, firstPageDate?: string) =>
  notebook.startedOn ??
  firstPageDate ??
  monthInName(notebook.name) ??
  notebook.createdAt;

/**
 * A `#tag` written on a page: `#` after a space or the start of a line, then a letter or digit.
 * A Markdown heading (`# Title`), `C#` and a URL's `#fragment` are not tags, nor is `#3`.
 */
const TAG = /(?<![\p{L}\p{N}_&/#])#([\p{L}\p{N}][\p{L}\p{N}_\-/]*)/gu;

/** The most topics a notebook sends; the hall shelves it under the first. */
const MAX_TOPICS = 8;

/**
 * The topics a notebook's pages name with `#tags`, most used first; a tie keeps the order they
 * were first written in. Case does not split a tag: the first spelling names it.
 */
export function notebookTopics(
  transcriptions: readonly (string | null)[],
): string[] {
  const counts = new Map<string, { tag: string; count: number }>();
  for (const text of transcriptions) {
    for (const [, tag = ''] of text?.matchAll(TAG) ?? []) {
      if (/^\d+$/.test(tag)) continue;
      const key = tag.toLowerCase();
      const seen = counts.get(key);
      if (seen) seen.count++;
      else counts.set(key, { tag, count: 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_TOPICS)
    .map(({ tag }) => tag);
}

export function toHallItem(
  notebook: NotebookSummary,
  firstPageDate?: string,
  topics: readonly string[] = [],
): HallItem {
  const date = dateOfNotebook(notebook, firstPageDate);
  return {
    kind: 'notebook',
    id: String(notebook.id),
    title: notebook.name,
    color: notebookColor(notebook.name),
    groups: [
      // The `#tags` on its pages; with none, the hall shelves it as having no topic.
      ...topics.map((topic) => `topic:${topic}`),
      `status:${notebook.status}`,
      // A notebook is the owner's own handwriting.
      `creator:${NOTEBOOK_AUTHOR}`,
      `year:${date.slice(0, 4)}`,
      ...(/^\d{4}-\d{2}/.test(date) ? [`month:${date.slice(0, 7)}`] : []),
    ],
    href: withBase(`/${notebook.id}`),
  };
}

/** Every notebook on the shelf, as the hall shelves it. Trash stays out. */
export async function notebookHallItems(): Promise<HallItem[]> {
  const firstPageDates = new Map(
    db
      .select({
        notebookId: notebookPages.notebookId,
        first: min(notebookPages.pageDate),
      })
      .from(notebookPages)
      .where(isNotNull(notebookPages.pageDate))
      .groupBy(notebookPages.notebookId)
      .all()
      .map(({ notebookId, first }) => [notebookId, first ?? undefined]),
  );
  const tagged = new Map<number, (string | null)[]>();
  for (const { notebookId, transcription } of db
    .select({
      notebookId: notebookPages.notebookId,
      transcription: notebookPages.transcription,
    })
    .from(notebookPages)
    .where(like(notebookPages.transcription, '%#%'))
    .all()) {
    tagged.set(notebookId, [...(tagged.get(notebookId) ?? []), transcription]);
  }
  return (await listNotebooks()).map((notebook) =>
    toHallItem(
      notebook,
      firstPageDates.get(notebook.id),
      notebookTopics(tagged.get(notebook.id) ?? []),
    ),
  );
}
