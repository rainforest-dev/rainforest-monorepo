import { and, asc, desc, eq, inArray, like, notInArray, or, sql } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';

import { appDb, db, sqlite } from '@/db/client';
import {
  authors, books, booksAuthorsLink, booksLanguagesLink, booksPublishersLink,
  booksRatingsLink, booksSeriesLink, booksTagsLink, comments, data,
  languages, publishers, ratings, series, tags,
} from '@/db/schema';
import { bookDeliveries, deliveryPlatforms } from '@/db/schema-app';
import type { BookDetail, BookGroup, BookSummary, FilterOptions } from '@/types/calibre';

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

async function hydrateBooks(bookIds: number[]): Promise<BookSummary[]> {
  if (bookIds.length === 0) return [];

  const [bookRows, authorLinks, seriesLinks, formatRows, deliveryRows] = await Promise.all([
    db
      .select({ id: books.id, title: books.title, authorSort: books.authorSort, hasCover: books.hasCover, seriesIndex: books.seriesIndex })
      .from(books).where(inArray(books.id, bookIds)),
    db.select({ book: booksAuthorsLink.book, name: authors.name })
      .from(booksAuthorsLink).innerJoin(authors, eq(authors.id, booksAuthorsLink.author))
      .where(inArray(booksAuthorsLink.book, bookIds)),
    db.select({ book: booksSeriesLink.book, name: series.name })
      .from(booksSeriesLink).innerJoin(series, eq(series.id, booksSeriesLink.series))
      .where(inArray(booksSeriesLink.book, bookIds)),
    db.select({ book: data.book, format: data.format })
      .from(data).where(inArray(data.book, bookIds)),
    appDb
      .select({ bookId: bookDeliveries.bookId, key: deliveryPlatforms.key })
      .from(bookDeliveries)
      .innerJoin(deliveryPlatforms, eq(deliveryPlatforms.id, bookDeliveries.platformId))
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

async function buildBookConditions(
  params: Pick<BookListParams, 'q' | 'authorId' | 'tagId' | 'seriesId' | 'platformKey' | 'delivered'>,
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
      or(like(books.title, `%${q}%`), like(books.authorSort, `%${q}%`), inArray(books.id, authorBookIds)),
    );
  }
  if (authorId) {
    const ids = db.select({ id: booksAuthorsLink.book }).from(booksAuthorsLink).where(eq(booksAuthorsLink.author, authorId));
    conditions.push(inArray(books.id, ids));
  }
  if (tagId) {
    const ids = db.select({ id: booksTagsLink.book }).from(booksTagsLink).where(eq(booksTagsLink.tag, tagId));
    conditions.push(inArray(books.id, ids));
  }
  if (seriesId) {
    const ids = db.select({ id: booksSeriesLink.book }).from(booksSeriesLink).where(eq(booksSeriesLink.series, seriesId));
    conditions.push(inArray(books.id, ids));
  }

  if (platformKey) {
    const deliveredRows = await appDb
      .select({ bookId: bookDeliveries.bookId })
      .from(bookDeliveries)
      .innerJoin(deliveryPlatforms, eq(deliveryPlatforms.id, bookDeliveries.platformId))
      .where(eq(deliveryPlatforms.key, platformKey));
    const deliveredIds = deliveredRows.map((r) => r.bookId);

    if (delivered === false) {
      if (deliveredIds.length > 0) conditions.push(notInArray(books.id, deliveredIds));
    } else if (delivered === true) {
      if (deliveredIds.length === 0) return null;
      conditions.push(inArray(books.id, deliveredIds));
    }
  }

  return conditions;
}

function buildOrderExpr(sortBy: BookListParams['sortBy'], sortDir: BookListParams['sortDir']) {
  const dir = sortDir === 'desc' ? 'DESC' : 'ASC';
  if (sortBy === 'rating') {
    return sql.raw(
      `(SELECT COALESCE(r.rating, 0) FROM books_ratings_link brl LEFT JOIN ratings r ON r.id = brl.rating WHERE brl.book = books.id LIMIT 1) ${dir}`,
    );
  }
  const col = sortBy === 'author' ? books.authorSort
    : sortBy === 'pubdate' ? books.pubdate
    : sortBy === 'added' ? books.timestamp
    : books.sort;
  return sortDir === 'desc' ? desc(col) : asc(col);
}

export async function getBookList(params: BookListParams = {}): Promise<{ books: BookSummary[]; total: number }> {
  'use cache';
  cacheLife('minutes');
  cacheTag('books');

  const { page = 1, limit = 30, sortBy, sortDir } = params;
  const offset = (page - 1) * limit;

  const conditions = await buildBookConditions(params);
  if (conditions === null) return { books: [], total: 0 };

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const orderExpr = buildOrderExpr(sortBy, sortDir);

  const [pageRows, countResult] = await Promise.all([
    db.select({ id: books.id }).from(books).where(where).orderBy(orderExpr).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(books).where(where),
  ]);

  return {
    books: await hydrateBooks(pageRows.map((r) => r.id)),
    total: countResult[0]?.count ?? 0,
  };
}

const GROUP_CONFIG = {
  series: { joinTable: 'books_series_link', joinCol: 'series', groupTable: 'series', groupNameCol: 'name', groupSortCol: 'sort' },
  tag:    { joinTable: 'books_tags_link',   joinCol: 'tag',    groupTable: 'tags',   groupNameCol: 'name', groupSortCol: 'name' },
  author: { joinTable: 'books_authors_link',joinCol: 'author', groupTable: 'authors',groupNameCol: 'name', groupSortCol: 'sort' },
} as const;

export type GroupBy = keyof typeof GROUP_CONFIG;

export async function getGroupedBookList(
  params: BookListParams & { groupBy: GroupBy },
): Promise<{ groups: BookGroup[] }> {
  'use cache';
  cacheLife('minutes');
  cacheTag('books');

  const { groupBy, sortBy, sortDir } = params;
  const conditions = await buildBookConditions(params);
  if (conditions === null) return { groups: [] };

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const matchingRows = await db.select({ id: books.id }).from(books).where(where);

  const idList = matchingRows.map((r) => r.id);
  if (idList.length === 0) return { groups: [] };

  const cfg = GROUP_CONFIG[groupBy];
  const inClause = idList.map(() => '?').join(',');
  const sortDir_ = sortDir === 'desc' ? 'DESC' : 'ASC';
  const bookSortCol = sortBy === 'author' ? 'b.author_sort'
    : sortBy === 'pubdate' ? 'b.pubdate'
    : sortBy === 'added' ? 'b.timestamp'
    : groupBy === 'series' ? 'b.series_index'
    : 'b.sort';

  type RankedRow = {
    groupKey: number; groupLabel: string; groupSort: string | null;
    total: number; rn: number;
    id: number; title: string; author_sort: string | null; has_cover: number; series_index: number | null;
  };

  const rankedRows = sqlite.prepare(
    `SELECT * FROM (
      SELECT
        g.id AS groupKey,
        g.${cfg.groupNameCol} AS groupLabel,
        g.${cfg.groupSortCol} AS groupSort,
        COUNT(*) OVER (PARTITION BY g.id) AS total,
        ROW_NUMBER() OVER (PARTITION BY g.id ORDER BY ${bookSortCol} ${sortDir_} NULLS LAST) AS rn,
        b.id, b.title, b.author_sort, b.has_cover, b.series_index
      FROM ${cfg.groupTable} g
      INNER JOIN ${cfg.joinTable} j ON j.${cfg.joinCol} = g.id
      INNER JOIN books b ON b.id = j.book
      WHERE b.id IN (${inClause})
    ) ranked
    WHERE rn <= 6
    ORDER BY groupSort, rn`,
  ).all(...idList) as RankedRow[];

  type BookRow = { book: number };
  const inGroupSet = new Set(
    (sqlite.prepare(`SELECT DISTINCT book FROM ${cfg.joinTable} WHERE book IN (${inClause})`).all(...idList) as BookRow[])
      .map((r) => r.book),
  );
  const ungroupedIds = idList.filter((id) => !inGroupSet.has(id));

  const previewIds = rankedRows.map((r) => r.id);
  const allHydrateIds = [...new Set([...previewIds, ...ungroupedIds.slice(0, 6)])];
  const hydratedMap = new Map<number, BookSummary>();
  for (const b of await hydrateBooks(allHydrateIds)) hydratedMap.set(b.id, b);

  const groupMap = new Map<number, { label: string; total: number; bookIds: number[] }>();
  for (const row of rankedRows) {
    if (!groupMap.has(row.groupKey)) groupMap.set(row.groupKey, { label: row.groupLabel, total: row.total, bookIds: [] });
    groupMap.get(row.groupKey)!.bookIds.push(row.id);
  }

  const groups: BookGroup[] = [];
  for (const [groupKey, { label, total, bookIds }] of groupMap) {
    groups.push({ key: String(groupKey), label, total, books: bookIds.map((id) => hydratedMap.get(id)).filter((b): b is BookSummary => b !== undefined) });
  }

  if (ungroupedIds.length > 0) {
    groups.push({
      key: 'ungrouped',
      label: 'Ungrouped',
      total: ungroupedIds.length,
      books: ungroupedIds.slice(0, 6).map((id) => hydratedMap.get(id)).filter((b): b is BookSummary => b !== undefined),
    });
  }

  return { groups };
}

export async function getBook(id: number): Promise<BookDetail | null> {
  'use cache';
  cacheLife('hours');
  cacheTag(`book-${id}`);

  const bookRow = await db.select().from(books).where(eq(books.id, id)).get();
  if (!bookRow) return null;

  const [authorRows, tagRows, seriesRow, publisherRow, commentRow, ratingRow, formatRows, langRow] =
    await Promise.all([
      db.select({ name: authors.name }).from(booksAuthorsLink)
        .innerJoin(authors, eq(authors.id, booksAuthorsLink.author)).where(eq(booksAuthorsLink.book, id)),
      db.select({ id: tags.id, name: tags.name }).from(booksTagsLink)
        .innerJoin(tags, eq(tags.id, booksTagsLink.tag)).where(eq(booksTagsLink.book, id)),
      db.select({ name: series.name }).from(booksSeriesLink)
        .innerJoin(series, eq(series.id, booksSeriesLink.series)).where(eq(booksSeriesLink.book, id)).get(),
      db.select({ name: publishers.name }).from(booksPublishersLink)
        .innerJoin(publishers, eq(publishers.id, booksPublishersLink.publisher)).where(eq(booksPublishersLink.book, id)).get(),
      db.select({ text: comments.text }).from(comments).where(eq(comments.book, id)).get(),
      db.select({ rating: ratings.rating }).from(booksRatingsLink)
        .innerJoin(ratings, eq(ratings.id, booksRatingsLink.rating)).where(eq(booksRatingsLink.book, id)).get(),
      db.select({ format: data.format, name: data.name, size: data.uncompressedSize }).from(data).where(eq(data.book, id)),
      db.select({ langCode: languages.langCode }).from(booksLanguagesLink)
        .innerJoin(languages, eq(languages.id, booksLanguagesLink.langCode)).where(eq(booksLanguagesLink.book, id)).get(),
    ]);

  const deliveryRows = await appDb
    .select({ key: deliveryPlatforms.key })
    .from(bookDeliveries)
    .innerJoin(deliveryPlatforms, eq(deliveryPlatforms.id, bookDeliveries.platformId))
    .where(eq(bookDeliveries.bookId, id));

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
    tagIds: tagRows.filter((r): r is { id: number; name: string } => r.id !== null && r.name !== null).map((r) => ({ id: r.id, name: r.name })),
    publisher: publisherRow?.name ?? null,
    language: langRow?.langCode ?? null,
    formats: formatRows.map((r) => r.format ?? '').filter(Boolean),
    files: formatRows
      .filter((r): r is typeof r & { format: string; name: string } => !!(r.format && r.name))
      .map((r) => ({ format: r.format, name: r.name, size: r.size ?? 0 })),
    deliveredTo: deliveryRows.map((r) => r.key),
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

export async function listUndeliveredBooks(params: {
  platformKey: string;
  page?: number;
  limit?: number;
}): Promise<{ books: BookSummary[]; total: number }> {
  return getBookList({ platformKey: params.platformKey, delivered: false, page: params.page, limit: params.limit });
}
