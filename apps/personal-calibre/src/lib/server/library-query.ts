import { and, asc, count, eq, inArray } from 'drizzle-orm';

import {
  authors,
  books,
  booksAuthorsLink,
  booksSeriesLink,
  booksTagsLink,
  db,
  sqlite,
  tags,
} from '@/db';
import type { GroupBy } from '@/lib/library-params';
import type { LibraryBook, LibraryEntry, LibraryResult } from '@/types';

import {
  type BookListParams,
  buildBookConditions,
  buildOrderExpr,
  hydrateBooks,
} from './book-query';

export interface LibraryQuery extends Omit<BookListParams, 'page' | 'limit'> {
  groupBy?: GroupBy;
  page: number;
  pageSize: number;
}

const GROUP_SQL = {
  series: {
    table: 'series',
    link: 'books_series_link',
    column: 'series',
    sort: 'g.sort',
    fallback: 'No series',
  },
  tag: {
    table: 'tags',
    link: 'books_tags_link',
    column: 'tag',
    sort: 'g.name',
    fallback: 'Untagged',
  },
  author: {
    table: 'authors',
    link: 'books_authors_link',
    column: 'author',
    sort: 'g.sort',
    fallback: 'No author',
  },
} as const;

const RATING_SQL =
  '(SELECT COALESCE(r.rating, 0) FROM books_ratings_link brl LEFT JOIN ratings r ON r.id = brl.rating WHERE brl.book = b.id LIMIT 1)';

interface GroupedRow {
  fallback: 0 | 1;
  gid: number | null;
  glabel: string | null;
  gtotal: number;
  goffset: number;
  bid: number;
}

function inGroupSort(groupBy: GroupBy, sortBy: LibraryQuery['sortBy']): string {
  switch (sortBy) {
    case 'author':
      return 'b.author_sort';
    case 'pubdate':
      return 'b.pubdate';
    case 'added':
      return 'b.timestamp';
    case 'rating':
      return RATING_SQL;
    default:
      return groupBy === 'series' ? 'b.series_index' : 'b.sort';
  }
}

function pageCountFor(matching: number, pageSize: number): number {
  return Math.max(1, Math.ceil(matching / pageSize));
}

// Clamped to `matching` so an astronomical ?page= still binds as a small, valid SQLite OFFSET.
function pageOffset(page: number, matching: number, pageSize: number): number {
  const offset = (page - 1) * pageSize;
  return offset < matching ? offset : matching;
}

function byBook<T extends { book: number | null }>(
  rows: T[],
): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const row of rows) {
    if (row.book === null) continue;
    const list = map.get(row.book) ?? [];
    list.push(row);
    map.set(row.book, list);
  }
  return map;
}

export async function hydrateLibraryBooks(
  ids: number[],
): Promise<LibraryBook[]> {
  if (ids.length === 0) return [];
  const [base, authorRows, seriesRows, tagRows, dateRows] = await Promise.all([
    hydrateBooks(ids),
    db
      .select({
        book: booksAuthorsLink.book,
        id: authors.id,
        name: authors.name,
      })
      .from(booksAuthorsLink)
      .innerJoin(authors, eq(authors.id, booksAuthorsLink.author))
      .where(inArray(booksAuthorsLink.book, ids))
      .orderBy(asc(booksAuthorsLink.id)),
    db
      .select({ book: booksSeriesLink.book, id: booksSeriesLink.series })
      .from(booksSeriesLink)
      .where(inArray(booksSeriesLink.book, ids)),
    db
      .select({ book: booksTagsLink.book, id: tags.id, name: tags.name })
      .from(booksTagsLink)
      .innerJoin(tags, eq(tags.id, booksTagsLink.tag))
      .where(inArray(booksTagsLink.book, ids))
      .orderBy(asc(tags.name)),
    db
      .select({ id: books.id, pubdate: books.pubdate })
      .from(books)
      .where(inArray(books.id, ids)),
  ]);

  const authorMap = byBook(authorRows);
  const tagMap = byBook(tagRows);
  const seriesMap = new Map<number, number>();
  for (const row of seriesRows) {
    if (row.book !== null && row.id !== null) seriesMap.set(row.book, row.id);
  }
  const dateMap = new Map(dateRows.map((row) => [row.id, row.pubdate]));

  return base.map((book) => {
    const named = (authorMap.get(book.id) ?? []).flatMap((a) =>
      a.name === null ? [] : [{ id: a.id, name: a.name }],
    );
    return {
      ...book,
      authors: named.map((a) => a.name),
      authorIds: named.map((a) => a.id),
      seriesId: seriesMap.get(book.id) ?? null,
      tags: (tagMap.get(book.id) ?? []).flatMap((t) =>
        t.name === null ? [] : [{ id: t.id, name: t.name }],
      ),
      pubdate: dateMap.get(book.id) ?? null,
    };
  });
}

function emptyResult(page: number, libraryTotal: number): LibraryResult {
  return {
    entries: [],
    page,
    pageCount: 1,
    matching: 0,
    libraryTotal,
    matchingIds: [],
  };
}

async function groupedPage(
  query: LibraryQuery,
  groupBy: GroupBy,
  matchingIds: number[],
  libraryTotal: number,
): Promise<LibraryResult> {
  if (matchingIds.length === 0) return emptyResult(query.page, libraryTotal);
  const cfg = GROUP_SQL[groupBy];
  const dir = query.sortDir === 'desc' ? 'DESC' : 'ASC';
  const s = inGroupSort(groupBy, query.sortBy);
  const inGroupOrder = `s IS NULL, s ${dir}, tiebreak, bid`;
  const entriesSql = `
    WITH m(id) AS (SELECT value FROM json_each(?)),
    e AS (
      SELECT 0 AS fallback, g.id AS gid, g.name AS glabel, ${cfg.sort} AS gsort,
             b.id AS bid, ${s} AS s, b.sort AS tiebreak
      FROM ${cfg.table} g
      JOIN ${cfg.link} j ON j.${cfg.column} = g.id
      JOIN books b ON b.id = j.book
      WHERE b.id IN (SELECT id FROM m)
      UNION ALL
      SELECT 1, NULL, NULL, NULL, b.id, ${s}, b.sort
      FROM books b
      WHERE b.id IN (SELECT id FROM m)
        AND b.id NOT IN (SELECT book FROM ${cfg.link} WHERE book IS NOT NULL)
    ),
    r AS (
      SELECT fallback, gid, glabel, bid,
        COUNT(*) OVER (PARTITION BY fallback, gid) AS gtotal,
        ROW_NUMBER() OVER (PARTITION BY fallback, gid ORDER BY ${inGroupOrder}) - 1 AS goffset,
        ROW_NUMBER() OVER (ORDER BY fallback, gsort COLLATE NOCASE, gid, ${inGroupOrder}) AS pos
      FROM e
    )`;
  const idsJson = JSON.stringify(matchingIds);
  const { total } = sqlite
    .prepare(`${entriesSql} SELECT COUNT(*) AS total FROM r`)
    .get(idsJson) as { total: number };
  const rows = sqlite
    .prepare(
      `${entriesSql} SELECT fallback, gid, glabel, gtotal, goffset, bid FROM r ORDER BY pos LIMIT ? OFFSET ?`,
    )
    .all(
      idsJson,
      query.pageSize,
      pageOffset(query.page, total, query.pageSize),
    ) as GroupedRow[];

  const hydrated = await hydrateLibraryBooks([
    ...new Set(rows.map((r) => r.bid)),
  ]);
  const bookMap = new Map(hydrated.map((b) => [b.id, b]));
  const entries: LibraryEntry[] = rows.flatMap((row) => {
    const book = bookMap.get(row.bid);
    if (!book) return [];
    const fallback = row.fallback === 1;
    return [
      {
        book,
        group: {
          key: `${groupBy}:${fallback ? 'none' : row.gid}`,
          label: fallback ? cfg.fallback : (row.glabel ?? ''),
          total: row.gtotal,
          offset: row.goffset,
          id: fallback ? null : row.gid,
        },
      },
    ];
  });

  return {
    entries,
    page: query.page,
    pageCount: pageCountFor(total, query.pageSize),
    matching: total,
    libraryTotal,
    matchingIds,
  };
}

export async function queryLibrary(
  query: LibraryQuery,
): Promise<LibraryResult> {
  const libraryTotal =
    (await db.select({ total: count() }).from(books))[0]?.total ?? 0;
  const conditions = await buildBookConditions(query);
  if (conditions === null) return emptyResult(query.page, libraryTotal);
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const matchingIds = (
    await db
      .select({ id: books.id })
      .from(books)
      .where(where)
      .orderBy(asc(books.id))
  ).map((row) => row.id);

  if (query.groupBy)
    return groupedPage(query, query.groupBy, matchingIds, libraryTotal);

  const matching = matchingIds.length;
  const pageCount = pageCountFor(matching, query.pageSize);
  const rows = await db
    .select({ id: books.id })
    .from(books)
    .where(where)
    .orderBy(buildOrderExpr(query.sortBy, query.sortDir))
    .limit(query.pageSize)
    .offset(pageOffset(query.page, matching, query.pageSize));
  return {
    entries: (await hydrateLibraryBooks(rows.map((r) => r.id))).map((book) => ({
      book,
    })),
    page: query.page,
    pageCount,
    matching,
    libraryTotal,
    matchingIds,
  };
}
