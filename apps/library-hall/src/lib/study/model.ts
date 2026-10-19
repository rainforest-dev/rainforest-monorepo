import type { HallItemKind } from '@rainforest-dev/library-contract';

import { type HallBook, kindLabel } from '@/lib/items';

export interface SpineDims {
  width: number;
  height: number;
  depth: number;
}

export interface StudyBook {
  id: number;
  navKey: string;
  itemId: string;
  kind: HallItemKind;
  title: string;
  authors: string[];
  series: string | null;
  seriesIndex: number | null;
  hasCover: boolean;
  cover: string | null;
  href: string;
  /** The collection's spine colour, as hex. */
  color: string;
  cjk: boolean;
  dims: SpineDims;
}

export interface StudyShelf {
  key: string;
  label: string;
  count: number;
  continued: boolean;
  books: StudyBook[];
}

export interface StudyModel {
  shelves: StudyShelf[];
  key: string;
}

/** Books on one Study page; a bookcase with more pages on through them. */
export const STUDY_PAGE_SIZE = 30;

const CJK = /[\u3000-\u9fff\uff00-\uffef]/;

export function spineDims(id: number): SpineDims {
  const height = 172 + ((id * 13) % 38);
  return {
    width: 26 + ((id * 7) % 16),
    height,
    depth: Math.round(height * 0.66),
  };
}

export function isCjk(title: string): boolean {
  return CJK.test(title);
}

export function navKey(shelfKey: string, id: number): string {
  return `${shelfKey}:${id}`;
}

export function bookIdOfNavKey(key: string): number {
  return Number(key.slice(key.lastIndexOf(':') + 1));
}

export function contentKey(books: readonly HallBook[]): string {
  return books.map((b) => `${b.key}|${b.title}|${b.cover ?? ''}`).join('\n');
}

export function booksLabel(n: number): string {
  return `${n} 件`;
}

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / STUDY_PAGE_SIZE));
}

export function pageOf<T>(items: readonly T[], page: number): T[] {
  const start = (page - 1) * STUDY_PAGE_SIZE;
  return items.slice(start, start + STUDY_PAGE_SIZE);
}

function toStudyBook(book: HallBook, shelfKey: string): StudyBook {
  return {
    id: book.id,
    navKey: navKey(shelfKey, book.id),
    itemId: book.itemId,
    kind: book.kind,
    title: book.title,
    authors: book.subtitle ? [book.subtitle] : [],
    series: null,
    seriesIndex: null,
    hasCover: book.cover !== null,
    cover: book.cover,
    href: book.href,
    color: book.color,
    cjk: isCjk(book.title),
    dims: spineDims(book.id),
  };
}

/**
 * One page of a bookcase as Study shelves: a shelf per collection when the bookcase mixes
 * them, otherwise one shelf named after the bookcase. A shelf that began on an earlier page is
 * marked continued.
 */
export function buildStudyModel(
  bookcase: { key: string; label: string },
  all: readonly HallBook[],
  page: number,
): StudyModel {
  const kinds = [...new Set(all.map((b) => b.kind))];
  const mixed = kinds.length > 1;
  const shelfOf = (book: HallBook) => (mixed ? book.kind : bookcase.key);
  const ordered = mixed
    ? kinds.flatMap((kind) => all.filter((b) => b.kind === kind))
    : [...all];
  const totals = new Map<string, number>();
  for (const book of ordered)
    totals.set(shelfOf(book), (totals.get(shelfOf(book)) ?? 0) + 1);
  const start = (page - 1) * STUDY_PAGE_SIZE;
  const shown = pageOf(ordered, page);
  const shelves: StudyShelf[] = [];
  for (const book of shown) {
    const key = shelfOf(book);
    let shelf = shelves.at(-1);
    if (!shelf || shelf.key !== key) {
      const before = ordered.slice(0, start).some((b) => shelfOf(b) === key);
      shelf = {
        key,
        label: mixed ? kindLabel(book.kind) : bookcase.label,
        count: totals.get(key) ?? 0,
        continued: before,
        books: [],
      };
      shelves.push(shelf);
    }
    shelf.books.push(toStudyBook(book, key));
  }
  return { shelves, key: `${bookcase.key}#${page}\n${contentKey(shown)}` };
}
