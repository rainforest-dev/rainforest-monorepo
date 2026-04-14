import { and, eq, inArray, like, or, sql } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';

import { db } from '@/db/client';
import {
  authors,
  books,
  booksAuthorsLink,
  booksLanguagesLink,
  booksPublishersLink,
  booksRatingsLink,
  booksSeriesLink,
  booksTagsLink,
  comments,
  data,
  languages,
  publishers,
  ratings,
  series,
  tags,
} from '@/db/schema';
import type { BookDetail, BookSummary, FilterOptions } from '@/types/calibre';

export interface BookListParams {
  page?: number;
  limit?: number;
  authorId?: number;
  tagId?: number;
  seriesId?: number;
  q?: string;
}

export async function getBookList(params: BookListParams = {}): Promise<{
  books: BookSummary[];
  total: number;
}> {
  'use cache';
  cacheLife('minutes');
  cacheTag('books');

  const { page = 1, limit = 30, authorId, tagId, seriesId, q } = params;
  const offset = (page - 1) * limit;

  // Build WHERE conditions
  const conditions = [];

  if (q) {
    conditions.push(
      or(like(books.title, `%${q}%`), like(books.authorSort, `%${q}%`)),
    );
  }

  if (authorId) {
    const bookIds = db
      .select({ id: booksAuthorsLink.book })
      .from(booksAuthorsLink)
      .where(eq(booksAuthorsLink.author, authorId));
    conditions.push(inArray(books.id, bookIds));
  }

  if (tagId) {
    const bookIds = db
      .select({ id: booksTagsLink.book })
      .from(booksTagsLink)
      .where(eq(booksTagsLink.tag, tagId));
    conditions.push(inArray(books.id, bookIds));
  }

  if (seriesId) {
    const bookIds = db
      .select({ id: booksSeriesLink.book })
      .from(booksSeriesLink)
      .where(eq(booksSeriesLink.series, seriesId));
    conditions.push(inArray(books.id, bookIds));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [allBooks, countResult] = await Promise.all([
    db
      .select({
        id: books.id,
        title: books.title,
        authorSort: books.authorSort,
        hasCover: books.hasCover,
        seriesIndex: books.seriesIndex,
      })
      .from(books)
      .where(where)
      .orderBy(books.sort)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(books)
      .where(where),
  ]);

  const bookIds = allBooks.map((b) => b.id);

  if (bookIds.length === 0) {
    return { books: [], total: countResult[0]?.count ?? 0 };
  }

  // Fetch authors and formats for the page
  const [authorLinks, seriesLinks, formatRows] = await Promise.all([
    db
      .select({ book: booksAuthorsLink.book, name: authors.name })
      .from(booksAuthorsLink)
      .innerJoin(authors, eq(authors.id, booksAuthorsLink.author))
      .where(inArray(booksAuthorsLink.book, bookIds)),
    db
      .select({
        book: booksSeriesLink.book,
        name: series.name,
      })
      .from(booksSeriesLink)
      .innerJoin(series, eq(series.id, booksSeriesLink.series))
      .where(inArray(booksSeriesLink.book, bookIds)),
    db
      .select({ book: data.book, format: data.format })
      .from(data)
      .where(inArray(data.book, bookIds)),
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

  const result: BookSummary[] = allBooks.map((b) => ({
    ...b,
    authors: authorsByBook.get(b.id) ?? [],
    series: seriesByBook.get(b.id) ?? null,
    formats: formatsByBook.get(b.id) ?? [],
  }));

  return { books: result, total: countResult[0]?.count ?? 0 };
}

export async function getBook(id: number): Promise<BookDetail | null> {
  'use cache';
  cacheLife('hours');
  cacheTag(`book-${id}`);

  const bookRow = await db
    .select()
    .from(books)
    .where(eq(books.id, id))
    .get();

  if (!bookRow) return null;

  const [
    authorRows,
    tagRows,
    seriesRow,
    publisherRow,
    commentRow,
    ratingRow,
    formatRows,
    langRow,
  ] = await Promise.all([
    db
      .select({ name: authors.name })
      .from(booksAuthorsLink)
      .innerJoin(authors, eq(authors.id, booksAuthorsLink.author))
      .where(eq(booksAuthorsLink.book, id)),
    db
      .select({ name: tags.name })
      .from(booksTagsLink)
      .innerJoin(tags, eq(tags.id, booksTagsLink.tag))
      .where(eq(booksTagsLink.book, id)),
    db
      .select({ name: series.name })
      .from(booksSeriesLink)
      .innerJoin(series, eq(series.id, booksSeriesLink.series))
      .where(eq(booksSeriesLink.book, id))
      .get(),
    db
      .select({ name: publishers.name })
      .from(booksPublishersLink)
      .innerJoin(publishers, eq(publishers.id, booksPublishersLink.publisher))
      .where(eq(booksPublishersLink.book, id))
      .get(),
    db
      .select({ text: comments.text })
      .from(comments)
      .where(eq(comments.book, id))
      .get(),
    db
      .select({ rating: ratings.rating })
      .from(booksRatingsLink)
      .innerJoin(ratings, eq(ratings.id, booksRatingsLink.rating))
      .where(eq(booksRatingsLink.book, id))
      .get(),
    db
      .select({ format: data.format, name: data.name, size: data.uncompressedSize })
      .from(data)
      .where(eq(data.book, id)),
    db
      .select({ langCode: languages.langCode })
      .from(booksLanguagesLink)
      .innerJoin(languages, eq(languages.id, booksLanguagesLink.book))
      .where(eq(booksLanguagesLink.book, id))
      .get(),
  ]);

  return {
    id: bookRow.id,
    title: bookRow.title,
    authorSort: bookRow.authorSort,
    hasCover: bookRow.hasCover,
    seriesIndex: bookRow.seriesIndex,
    path: bookRow.path,
    pubdate: bookRow.pubdate,
    description: commentRow?.text ?? null,
    rating: ratingRow?.rating ?? null,
    authors: authorRows.map((r) => r.name ?? '').filter(Boolean),
    series: seriesRow?.name ?? null,
    tags: tagRows.map((r) => r.name ?? '').filter(Boolean),
    publisher: publisherRow?.name ?? null,
    language: langRow?.langCode ?? null,
    formats: formatRows.map((r) => r.format ?? '').filter(Boolean),
    files: formatRows
      .filter((r): r is typeof r & { format: string; name: string } => !!(r.format && r.name))
      .map((r) => ({
        format: r.format,
        name: r.name,
        size: r.size ?? 0,
      })),
  };
}

export async function getFilterOptions(): Promise<FilterOptions> {
  'use cache';
  cacheLife('hours');
  cacheTag('filters');

  const [authorRows, tagRows, seriesRows] = await Promise.all([
    db.select({ id: authors.id, name: authors.name, sort: authors.sort }).from(authors).orderBy(authors.sort),
    db.select({ id: tags.id, name: tags.name }).from(tags).orderBy(tags.name),
    db.select({ id: series.id, name: series.name }).from(series).orderBy(series.sort),
  ]);

  return { authors: authorRows, tags: tagRows, series: seriesRows };
}
