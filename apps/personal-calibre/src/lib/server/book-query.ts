import { asc, desc, eq, inArray, like, notInArray, or, sql } from 'drizzle-orm';

import {
  appDb,
  authors,
  bookDeliveries,
  books,
  booksAuthorsLink,
  booksSeriesLink,
  booksTagsLink,
  data,
  db,
  deliveryPlatforms,
  series,
} from '@/db';
import type { BookSummary } from '@/types';

export interface BookListParams {
  page?: number;
  limit?: number;
  q?: string;
  authorId?: number;
  tagId?: number;
  seriesId?: number;
  platformKey?: string;
  delivered?: boolean;
  sortBy?: 'title' | 'author' | 'pubdate' | 'added' | 'rating';
  sortDir?: 'asc' | 'desc';
}

export async function hydrateBooks(bookIds: number[]): Promise<BookSummary[]> {
  if (bookIds.length === 0) return [];

  const [bookRows, authorLinks, seriesLinks, formatRows, deliveryRows] =
    await Promise.all([
      db
        .select({
          id: books.id,
          title: books.title,
          authorSort: books.authorSort,
          hasCover: books.hasCover,
          seriesIndex: books.seriesIndex,
        })
        .from(books)
        .where(inArray(books.id, bookIds)),
      db
        .select({ book: booksAuthorsLink.book, name: authors.name })
        .from(booksAuthorsLink)
        .innerJoin(authors, eq(authors.id, booksAuthorsLink.author))
        .where(inArray(booksAuthorsLink.book, bookIds)),
      db
        .select({ book: booksSeriesLink.book, name: series.name })
        .from(booksSeriesLink)
        .innerJoin(series, eq(series.id, booksSeriesLink.series))
        .where(inArray(booksSeriesLink.book, bookIds)),
      db
        .select({ book: data.book, format: data.format })
        .from(data)
        .where(inArray(data.book, bookIds)),
      appDb
        .select({ bookId: bookDeliveries.bookId, key: deliveryPlatforms.key })
        .from(bookDeliveries)
        .innerJoin(
          deliveryPlatforms,
          eq(deliveryPlatforms.id, bookDeliveries.platformId),
        )
        .where(inArray(bookDeliveries.bookId, bookIds)),
    ]);

  const authorsByBook = new Map<number, string[]>();
  for (const { book, name } of authorLinks) {
    if (book === null) continue;
    const list = authorsByBook.get(book) ?? [];
    if (name) list.push(name);
    authorsByBook.set(book, list);
  }

  const seriesByBook = new Map<number, string>();
  for (const { book, name } of seriesLinks) {
    if (book !== null && name) seriesByBook.set(book, name);
  }

  const formatsByBook = new Map<number, string[]>();
  for (const { book, format } of formatRows) {
    if (book === null) continue;
    const list = formatsByBook.get(book) ?? [];
    if (format) list.push(format);
    formatsByBook.set(book, list);
  }

  const deliveredToByBook = new Map<number, string[]>();
  for (const { bookId, key } of deliveryRows) {
    if (bookId === null) continue;
    const list = deliveredToByBook.get(bookId) ?? [];
    list.push(key);
    deliveredToByBook.set(bookId, list);
  }

  return bookIds
    .map((id) => bookRows.find((b) => b.id === id))
    .filter((b): b is NonNullable<typeof b> => b !== undefined)
    .map((b) => ({
      ...b,
      authors: authorsByBook.get(b.id) ?? [],
      series: seriesByBook.get(b.id) ?? null,
      formats: formatsByBook.get(b.id) ?? [],
      deliveredTo: deliveredToByBook.get(b.id) ?? [],
    }));
}

export async function buildBookConditions(
  params: Pick<
    BookListParams,
    'q' | 'authorId' | 'tagId' | 'seriesId' | 'platformKey' | 'delivered'
  >,
) {
  const { q, authorId, tagId, seriesId, platformKey, delivered } = params;
  const conditions = [];

  if (q) {
    const authorBookIds = db
      .select({ id: booksAuthorsLink.book })
      .from(booksAuthorsLink)
      .innerJoin(authors, eq(authors.id, booksAuthorsLink.author))
      .where(like(authors.name, `%${q}%`));
    conditions.push(
      or(
        like(books.title, `%${q}%`),
        like(books.authorSort, `%${q}%`),
        inArray(books.id, authorBookIds),
      ),
    );
  }
  if (authorId) {
    const ids = db
      .select({ id: booksAuthorsLink.book })
      .from(booksAuthorsLink)
      .where(eq(booksAuthorsLink.author, authorId));
    conditions.push(inArray(books.id, ids));
  }
  if (tagId) {
    const ids = db
      .select({ id: booksTagsLink.book })
      .from(booksTagsLink)
      .where(eq(booksTagsLink.tag, tagId));
    conditions.push(inArray(books.id, ids));
  }
  if (seriesId) {
    const ids = db
      .select({ id: booksSeriesLink.book })
      .from(booksSeriesLink)
      .where(eq(booksSeriesLink.series, seriesId));
    conditions.push(inArray(books.id, ids));
  }

  if (platformKey) {
    const deliveredRows = await appDb
      .select({ bookId: bookDeliveries.bookId })
      .from(bookDeliveries)
      .innerJoin(
        deliveryPlatforms,
        eq(deliveryPlatforms.id, bookDeliveries.platformId),
      )
      .where(eq(deliveryPlatforms.key, platformKey));
    const deliveredIds = deliveredRows.map((r) => r.bookId);

    if (delivered === false) {
      if (deliveredIds.length > 0)
        conditions.push(notInArray(books.id, deliveredIds));
    } else if (delivered === true) {
      if (deliveredIds.length === 0) return null;
      conditions.push(inArray(books.id, deliveredIds));
    }
  }

  return conditions;
}

export function buildOrderExpr(
  sortBy: BookListParams['sortBy'],
  sortDir: BookListParams['sortDir'],
) {
  const dir = sortDir === 'desc' ? 'DESC' : 'ASC';
  if (sortBy === 'rating') {
    return sql.raw(
      `(SELECT COALESCE(r.rating, 0) FROM books_ratings_link brl LEFT JOIN ratings r ON r.id = brl.rating WHERE brl.book = books.id LIMIT 1) ${dir}`,
    );
  }
  const col =
    sortBy === 'author'
      ? books.authorSort
      : sortBy === 'pubdate'
        ? books.pubdate
        : sortBy === 'added'
          ? books.timestamp
          : books.sort;
  return sortDir === 'desc' ? desc(col) : asc(col);
}
