import type { Notebook, NotebookPage } from '@/types';

/** Characters a file system rejects in a name, replaced so every export saves anywhere. */
const safe = (value: string) => value.replace(/[\\/:*?"<>|]/g, '-').trim();

const day = (value: string | null | undefined) => value?.slice(0, 10) ?? null;

/**
 * The download name of an exported notebook: `BuJo <start>_<end> <name>.pdf`, so exports sort by
 * date wherever they are kept. The start is the notebook's start date or its first page's upload
 * date, the end its archive date or its last page's upload date; one date when they agree.
 */
export function notebookPdfFileName(
  notebook: Pick<Notebook, 'name' | 'startedOn' | 'endedOn'> & {
    pages: Pick<NotebookPage, 'createdAt'>[];
  },
): string {
  const uploaded = notebook.pages.map((page) => day(page.createdAt)).sort();
  const start = day(notebook.startedOn) ?? uploaded[0] ?? null;
  const end = day(notebook.endedOn) ?? uploaded.at(-1) ?? null;
  const dates =
    start && end && start !== end ? `${start}_${end}` : (start ?? end);
  return `${['BuJo', dates, safe(notebook.name)].filter(Boolean).join(' ')}.pdf`;
}

/**
 * The download name of one scanned page, in the same scheme as the notebook export:
 * `BuJo <notebook> p<position> <page date>.<ext>`, e.g. `BuJo 2026 Q3 p018 2026-08-20.jpg`. The
 * position is padded so pages sort in order and stays put when other pages are deleted; the date
 * is the one written on the page, left out until a transcription records it.
 */
export function notebookPageFileName(page: {
  notebookName: string;
  position: number;
  pageDate: string | null;
  mimeType: string;
}): string {
  const subtype = page.mimeType.split('/')[1] || 'jpeg';
  const extension = subtype === 'jpeg' ? 'jpg' : subtype;
  const position = `p${String(page.position).padStart(3, '0')}`;
  return `${['BuJo', safe(page.notebookName), position, day(page.pageDate)].filter(Boolean).join(' ')}.${extension}`;
}
