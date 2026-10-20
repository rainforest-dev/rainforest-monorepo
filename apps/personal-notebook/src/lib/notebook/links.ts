import { linkSegments } from '@rainforest-dev/journal-kit';

import { pageHeading, pageNumberOf, type PageText } from './outline';

export type PageSegment =
  | { kind: 'text'; text: string }
  | { kind: 'url'; href: string; text: string }
  /** A reference to another page of the same notebook: "p. 23", "→ 23". */
  | { kind: 'page'; pageId: number; text: string }
  /** A date that some page of the notebook is dated with. */
  | { kind: 'date'; pageId: number; date: string; text: string };

export interface NotebookIndex {
  byNumber: ReadonlyMap<number, number>;
  byDate: ReadonlyMap<string, number>;
}

/** Looks pages up by the number printed on them and by their date; the first page wins a tie. */
export function notebookIndex(pages: readonly PageText[]): NotebookIndex {
  const byNumber = new Map<number, number>();
  const byDate = new Map<string, number>();
  for (const page of pages) {
    const number = pageNumberOf(page);
    if (!byNumber.has(number)) byNumber.set(number, page.id);
    if (page.pageDate && !byDate.has(page.pageDate))
      byDate.set(page.pageDate, page.id);
  }
  return { byNumber, byDate };
}

const PAGE_REF = String.raw`(?:\bpp?\.?\s*|\bpage\s+|第\s*|→\s*(?:p\.?\s*)?|->\s*(?:p\.?\s*)?)(\d{1,3})(?!\d|\s*[/.-]\d)(?:\s*頁)?`;
const FULL_DATE = String.raw`\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b`;
const SHORT_DATE = String.raw`(?<![\d/.-])(\d{1,2})/(\d{1,2})(?![\d/])`;
const REF = new RegExp(`${PAGE_REF}|${FULL_DATE}|${SHORT_DATE}`, 'gi');

const pad = (n: string) => n.padStart(2, '0');

function refSegments(
  text: string,
  index: NotebookIndex,
  self: PageText,
): PageSegment[] {
  const out: PageSegment[] = [];
  let cursor = 0;
  const year = self.pageDate?.slice(0, 4);
  for (const match of text.matchAll(REF)) {
    const [whole, pageNo, y, m, d, sm, sd] = match;
    let target: PageSegment | undefined;
    if (pageNo !== undefined) {
      const pageId = index.byNumber.get(Number(pageNo));
      if (pageId !== undefined && pageId !== self.id)
        target = { kind: 'page', pageId, text: whole };
    } else {
      const date =
        y !== undefined && m !== undefined && d !== undefined
          ? `${y}-${pad(m)}-${pad(d)}`
          : year && sm !== undefined && sd !== undefined
            ? `${year}-${pad(sm)}-${pad(sd)}`
            : undefined;
      const pageId = date ? index.byDate.get(date) : undefined;
      if (date && pageId !== undefined && pageId !== self.id)
        target = { kind: 'date', pageId, date, text: whole };
    }
    if (!target) continue;
    if (match.index > cursor)
      out.push({ kind: 'text', text: text.slice(cursor, match.index) });
    out.push(target);
    cursor = match.index + whole.length;
  }
  if (cursor < text.length)
    out.push({ kind: 'text', text: text.slice(cursor) });
  return out;
}

/**
 * A page's text split into plain runs, web links, and links to other pages of the notebook. Only
 * references that resolve to a page are linked, so "p. 99" in a 57-page notebook stays text.
 */
export function pageSegments(
  page: PageText,
  index: NotebookIndex,
): PageSegment[] {
  if (!page.transcription) return [];
  return linkSegments(page.transcription).flatMap((segment) =>
    segment.kind === 'link'
      ? [{ kind: 'url' as const, href: segment.href, text: segment.text }]
      : refSegments(segment.text, index, page),
  );
}

export interface Backlink {
  pageId: number;
  number: number;
  title: string;
}

/** For each page, the other pages that link to it, in notebook order. */
export function notebookBacklinks(
  pages: readonly PageText[],
): Map<number, Backlink[]> {
  const index = notebookIndex(pages);
  const backlinks = new Map<number, Backlink[]>();
  for (const page of pages) {
    const seen = new Set<number>();
    for (const segment of pageSegments(page, index)) {
      if (segment.kind !== 'page' && segment.kind !== 'date') continue;
      if (seen.has(segment.pageId)) continue;
      seen.add(segment.pageId);
      const list = backlinks.get(segment.pageId) ?? [];
      list.push({
        pageId: page.id,
        number: pageNumberOf(page),
        title: pageHeading(page.transcription) ?? `Page ${pageNumberOf(page)}`,
      });
      backlinks.set(segment.pageId, list);
    }
  }
  return backlinks;
}
