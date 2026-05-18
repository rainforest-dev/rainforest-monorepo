# Personal Calibre UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign personal-calibre with composable group-by, platform delivery badges, tag editing UI + MCP tools, bulk action toast feedback, scalable filter comboboxes, and a full Playwright e2e project.

**Architecture:** URL params are the single source of truth for all filter state. `getBookList` (flat, paginated) and `getGroupedBookList` (grouped, 6-per-group preview) are two query paths sharing a `hydrateBooks` helper. `FilterBar` replaces `FilterPanel` — all filter values read directly from `useSearchParams()`, eliminating the back-navigation bug.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM, better-sqlite3 raw SQL (window functions for grouped queries), shadcn Command + Popover + Sonner, Playwright + `@nx/playwright`, Nx 22

---

## File Map

**New files**
- `apps/personal-calibre-e2e/package.json`
- `apps/personal-calibre-e2e/playwright.config.ts`
- `apps/personal-calibre-e2e/tsconfig.json`
- `apps/personal-calibre-e2e/src/support/global-setup.ts`
- `apps/personal-calibre-e2e/src/support/reset-db.ts`
- `apps/personal-calibre-e2e/src/search.spec.ts`
- `apps/personal-calibre-e2e/src/filter.spec.ts`
- `apps/personal-calibre-e2e/src/group-by.spec.ts`
- `apps/personal-calibre-e2e/src/tag-editing.spec.ts`
- `apps/personal-calibre-e2e/src/bulk-delivery.spec.ts`
- `apps/personal-calibre-e2e/src/book-detail.spec.ts`
- `apps/personal-calibre/src/components/FilterBar.tsx`
- `apps/personal-calibre/src/components/TagEditor.tsx`
- `apps/personal-calibre/src/app/api/books/[id]/tags/route.ts`
- `apps/personal-calibre/src/app/api/books/[id]/tags/[tagId]/route.ts`
- `apps/personal-calibre/src/lib/tags.ts`
- `apps/personal-calibre/src/components/ui/command.tsx` (via shadcn)
- `apps/personal-calibre/src/components/ui/popover.tsx` (via shadcn)
- `apps/personal-calibre/src/components/ui/sonner.tsx` (via shadcn)

**Modified files**
- `apps/personal-calibre/src/types/calibre.ts` — add `deliveredTo`, `BookGroup`
- `apps/personal-calibre/src/lib/queries.ts` — `hydrateBooks`, extended `getBookList`, new `getGroupedBookList`
- `apps/personal-calibre/src/lib/delivery.ts` — add `revalidateTag('books')` to `bulkCreateDeliveryEvents`
- `apps/personal-calibre/src/app/(library)/page.tsx` — parse new URL params, branch on groupBy
- `apps/personal-calibre/src/components/BookCard.tsx` — platform badge row + data-testid
- `apps/personal-calibre/src/components/BulkSelectionWrapper.tsx` — toast + `router.refresh()`
- `apps/personal-calibre/src/app/(library)/books/[id]/page.tsx` — add TagEditor
- `apps/personal-calibre/src/app/api/mcp/route.ts` — add_tag, remove_tag, list_tags, extend list_books
- `apps/personal-calibre/src/app/layout.tsx` — add `<Toaster />`
- `apps/personal-calibre/package.json` — add sonner

**Deleted files**
- `apps/personal-calibre/src/components/FilterPanel.tsx`

---

## Task 1: E2e project scaffold

**Files:**
- Create: `apps/personal-calibre-e2e/package.json`
- Create: `apps/personal-calibre-e2e/playwright.config.ts`
- Create: `apps/personal-calibre-e2e/tsconfig.json`
- Create: `apps/personal-calibre-e2e/src/support/global-setup.ts`
- Create: `apps/personal-calibre-e2e/src/support/reset-db.ts`

- [ ] **Step 1: Create `apps/personal-calibre-e2e/package.json`**

```json
{
  "name": "personal-calibre-e2e",
  "version": "0.0.1",
  "private": true,
  "nx": {
    "projectType": "application",
    "sourceRoot": "apps/personal-calibre-e2e/src",
    "implicitDependencies": ["personal-calibre"],
    "targets": {
      "e2e": {
        "executor": "@nx/playwright:playwright",
        "outputs": ["{workspaceRoot}/dist/.playwright/apps/personal-calibre-e2e"],
        "options": {
          "config": "apps/personal-calibre-e2e/playwright.config.ts"
        }
      }
    }
  },
  "devDependencies": {
    "@playwright/test": "^1.52.0",
    "@types/node": "catalog:",
    "better-sqlite3": "^12.2.0",
    "@types/better-sqlite3": "^7.6.13"
  }
}
```

- [ ] **Step 2: Create `apps/personal-calibre-e2e/playwright.config.ts`**

```typescript
import { workspaceRoot } from '@nx/devkit';
import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const baseURL = process.env['BASE_URL'] || 'http://localhost:3333';
const fixturesDir = path.join(__dirname, 'src/fixtures');

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  globalSetup: './src/support/global-setup.ts',
  webServer: {
    command: 'pnpm exec nx dev personal-calibre',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    cwd: workspaceRoot,
    env: {
      CALIBRE_LIBRARY_PATH: fixturesDir,
      CALIBRE_APP_DB_PATH: path.join(fixturesDir, 'app.db'),
      PORT: '3333',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

- [ ] **Step 3: Create `apps/personal-calibre-e2e/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "allowJs": true,
    "outDir": "out-tsc/playwright",
    "sourceMap": false,
    "moduleResolution": "nodenext",
    "module": "NodeNext"
  },
  "include": [
    "**/*.ts",
    "**/*.js",
    "playwright.config.ts",
    "src/**/*.spec.ts",
    "src/**/*.spec.js",
    "src/**/*.test.ts",
    "src/**/*.test.js",
    "src/**/*.d.ts"
  ],
  "exclude": ["out-tsc", "test-output"],
  "references": []
}
```

- [ ] **Step 4: Create `apps/personal-calibre-e2e/src/support/global-setup.ts`**

This script creates a fresh Calibre `metadata.db` fixture and removes any stale `app.db` so the Next.js app builds a fresh FTS index on first request.

```typescript
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const FIXTURES_DIR = path.join(__dirname, '../fixtures');

export default async function globalSetup() {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });

  // Remove stale app DB so syncBooksFts rebuilds cleanly on first request.
  const appDbPath = path.join(FIXTURES_DIR, 'app.db');
  if (fs.existsSync(appDbPath)) fs.unlinkSync(appDbPath);

  // Recreate Calibre metadata.db from scratch each run.
  const metaPath = path.join(FIXTURES_DIR, 'metadata.db');
  if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
  const db = new Database(metaPath);

  // Schema — minimal Calibre tables required by the app
  db.prepare(`CREATE TABLE books (
    id INTEGER PRIMARY KEY, title TEXT NOT NULL, sort TEXT,
    timestamp TEXT, pubdate TEXT, series_index REAL, author_sort TEXT,
    path TEXT NOT NULL DEFAULT '', has_cover INTEGER DEFAULT 0,
    uuid TEXT, last_modified TEXT DEFAULT '2024-01-01T00:00:00+00:00'
  )`).run();
  db.prepare(`CREATE TABLE authors (id INTEGER PRIMARY KEY, name TEXT, sort TEXT, link TEXT DEFAULT '')`).run();
  db.prepare(`CREATE TABLE books_authors_link (id INTEGER PRIMARY KEY, book INTEGER, author INTEGER)`).run();
  db.prepare(`CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT)`).run();
  db.prepare(`CREATE TABLE books_tags_link (id INTEGER PRIMARY KEY, book INTEGER, tag INTEGER)`).run();
  db.prepare(`CREATE TABLE series (id INTEGER PRIMARY KEY, name TEXT, sort TEXT)`).run();
  db.prepare(`CREATE TABLE books_series_link (id INTEGER PRIMARY KEY, book INTEGER, series INTEGER)`).run();
  db.prepare(`CREATE TABLE data (id INTEGER PRIMARY KEY, book INTEGER, format TEXT, uncompressed_size INTEGER DEFAULT 0, name TEXT)`).run();
  db.prepare(`CREATE TABLE ratings (id INTEGER PRIMARY KEY, rating INTEGER)`).run();
  db.prepare(`CREATE TABLE books_ratings_link (id INTEGER PRIMARY KEY, book INTEGER, rating INTEGER)`).run();
  db.prepare(`CREATE TABLE publishers (id INTEGER PRIMARY KEY, name TEXT, sort TEXT)`).run();
  db.prepare(`CREATE TABLE books_publishers_link (id INTEGER PRIMARY KEY, book INTEGER, publisher INTEGER)`).run();
  db.prepare(`CREATE TABLE languages (id INTEGER PRIMARY KEY, lang_code TEXT)`).run();
  db.prepare(`CREATE TABLE books_languages_link (id INTEGER PRIMARY KEY, book INTEGER, lang_code INTEGER, item_order INTEGER DEFAULT 0)`).run();
  db.prepare(`CREATE TABLE comments (id INTEGER PRIMARY KEY, book INTEGER, text TEXT)`).run();

  // Seed books (8 total for good coverage of filter/group/series scenarios)
  const insBook = db.prepare(`INSERT INTO books (id, title, sort, series_index, author_sort) VALUES (?, ?, ?, ?, ?)`);
  const bookData: [number, string, string, number | null, string][] = [
    [1, 'Dune', 'Dune', 1.0, 'Herbert, Frank'],
    [2, 'Dune Messiah', 'Dune Messiah', 2.0, 'Herbert, Frank'],
    [3, 'Foundation', 'Foundation', 1.0, 'Asimov, Isaac'],
    [4, 'Foundation and Empire', 'Foundation and Empire', 2.0, 'Asimov, Isaac'],
    [5, 'The Hobbit', 'Hobbit, The', null, 'Tolkien, J.R.R.'],
    [6, 'The Fellowship of the Ring', 'Fellowship of the Ring, The', 1.0, 'Tolkien, J.R.R.'],
    [7, 'Thinking, Fast and Slow', 'Thinking Fast and Slow', null, 'Kahneman, Daniel'],
    [8, 'Atomic Habits', 'Atomic Habits', null, 'Clear, James'],
  ];
  for (const row of bookData) insBook.run(...row);

  // Authors
  const insAuthor = db.prepare(`INSERT INTO authors (id, name, sort) VALUES (?, ?, ?)`);
  const authorData: [number, string, string][] = [
    [1, 'Frank Herbert', 'Herbert, Frank'],
    [2, 'Isaac Asimov', 'Asimov, Isaac'],
    [3, 'J.R.R. Tolkien', 'Tolkien, J.R.R.'],
    [4, 'Daniel Kahneman', 'Kahneman, Daniel'],
    [5, 'James Clear', 'Clear, James'],
  ];
  for (const row of authorData) insAuthor.run(...row);

  // Books-Authors links
  const insBA = db.prepare(`INSERT INTO books_authors_link (book, author) VALUES (?, ?)`);
  for (const [b, a] of [[1,1],[2,1],[3,2],[4,2],[5,3],[6,3],[7,4],[8,5]] as [number,number][]) insBA.run(b, a);

  // Series
  const insSeries = db.prepare(`INSERT INTO series (id, name, sort) VALUES (?, ?, ?)`);
  insSeries.run(1, 'Dune Chronicles', 'Dune Chronicles');
  insSeries.run(2, 'Foundation Series', 'Foundation Series');
  insSeries.run(3, 'The Lord of the Rings', 'Lord of the Rings, The');

  // Books-Series links
  const insBS = db.prepare(`INSERT INTO books_series_link (book, series) VALUES (?, ?)`);
  for (const [b, s] of [[1,1],[2,1],[3,2],[4,2],[6,3]] as [number,number][]) insBS.run(b, s);

  // Tags: 1=sci-fi, 2=fantasy, 3=classic, 4=nonfiction, 5=self-help
  const insTag = db.prepare(`INSERT INTO tags (id, name) VALUES (?, ?)`);
  for (const [id, name] of [[1,'sci-fi'],[2,'fantasy'],[3,'classic'],[4,'nonfiction'],[5,'self-help']] as [number,string][]) insTag.run(id, name);

  // Books-Tags: Dune→[sci-fi,classic], DuneMessiah→[sci-fi], Foundation→[sci-fi,classic],
  //             FoundationEmpire→[sci-fi], Hobbit→[fantasy], FotR→[fantasy,classic],
  //             ThinkFast→[nonfiction], AtomicHabits→[nonfiction,self-help]
  const insBT = db.prepare(`INSERT INTO books_tags_link (book, tag) VALUES (?, ?)`);
  for (const [b, t] of [[1,1],[1,3],[2,1],[3,1],[3,3],[4,1],[5,2],[6,2],[6,3],[7,4],[8,4],[8,5]] as [number,number][]) insBT.run(b, t);

  // Formats (EPUB for all books, needed for download routes)
  const insData = db.prepare(`INSERT INTO data (book, format, name) VALUES (?, 'EPUB', ?)`);
  for (const [id] of bookData) insData.run(id, `book${id}`);

  // Ratings: Dune→10 (5★), Foundation→10 (5★), Hobbit→8 (4★)
  db.prepare(`INSERT INTO ratings (id, rating) VALUES (1, 10)`).run();
  db.prepare(`INSERT INTO ratings (id, rating) VALUES (2, 10)`).run();
  db.prepare(`INSERT INTO ratings (id, rating) VALUES (3, 8)`).run();
  db.prepare(`INSERT INTO books_ratings_link (book, rating) VALUES (1, 1)`).run();
  db.prepare(`INSERT INTO books_ratings_link (book, rating) VALUES (3, 2)`).run();
  db.prepare(`INSERT INTO books_ratings_link (book, rating) VALUES (5, 3)`).run();

  db.close();
  console.log('[e2e] Fixture DB created at', FIXTURES_DIR);
}
```

- [ ] **Step 5: Create `apps/personal-calibre-e2e/src/support/reset-db.ts`**

```typescript
import Database from 'better-sqlite3';
import path from 'path';

// Clears all delivery records between tests. Safe to call even if app.db doesn't exist yet.
export function resetAppDb() {
  const appDbPath = path.join(__dirname, '../fixtures/app.db');
  try {
    const db = new Database(appDbPath);
    db.prepare(`DELETE FROM book_deliveries`).run();
    db.close();
  } catch {
    // DB may not exist yet if no request has been made — that's fine.
  }
}
```

- [ ] **Step 6: Install dependencies**

```bash
pnpm install
```

Expected: resolves `better-sqlite3` and `@playwright/test` for `personal-calibre-e2e`.

- [ ] **Step 7: Verify Nx recognises the project**

```bash
pnpm nx show project personal-calibre-e2e
```

Expected: prints project config including `implicitDependencies: ['personal-calibre']`.

- [ ] **Step 8: Commit**

```bash
git -c commit.gpgsign=false add apps/personal-calibre-e2e/
git -c commit.gpgsign=false commit -m "feat(personal-calibre-e2e): scaffold Playwright project with fixture DB"
```

---

## Task 2: Install shadcn components + Sonner

**Files:**
- Create: `apps/personal-calibre/src/components/ui/command.tsx`
- Create: `apps/personal-calibre/src/components/ui/popover.tsx`
- Create: `apps/personal-calibre/src/components/ui/sonner.tsx`
- Modify: `apps/personal-calibre/package.json` (sonner added)

- [ ] **Step 1: Add Command, Popover, Sonner via shadcn CLI**

```bash
cd apps/personal-calibre
pnpm dlx shadcn@latest add command popover sonner
cd ../..
```

Expected: creates `src/components/ui/command.tsx`, `popover.tsx`, `sonner.tsx`. Also installs `cmdk` and `sonner` packages.

- [ ] **Step 2: Verify sonner is in package.json**

Check `apps/personal-calibre/package.json` has `"sonner": ...` in dependencies. If missing:

```bash
cd apps/personal-calibre && pnpm add sonner && cd ../..
```

- [ ] **Step 3: Commit**

```bash
git -c commit.gpgsign=false add apps/personal-calibre/src/components/ui/ apps/personal-calibre/package.json pnpm-lock.yaml
git -c commit.gpgsign=false commit -m "feat(personal-calibre): add shadcn Command, Popover, Sonner"
```

---

## Task 3: Types + queries refactor

**Files:**
- Modify: `apps/personal-calibre/src/types/calibre.ts`
- Modify: `apps/personal-calibre/src/lib/queries.ts`

- [ ] **Step 1: Replace `calibre.ts`**

```typescript
export interface BookSummary {
  id: number;
  title: string;
  authorSort: string | null;
  hasCover: boolean | null;
  seriesIndex: number | null;
  authors: string[];
  series: string | null;
  formats: string[];
  deliveredTo: string[];  // platform keys, e.g. ['readwise-reader']
}

export interface BookGroup {
  key: string;    // group entity id as string, or 'ungrouped'
  label: string;
  total: number;  // total books in this group (for "See all N →")
  books: BookSummary[];  // first 6 only
}

export interface BookDetail extends BookSummary {
  path: string;
  pubdate: string | null;
  description: string | null;
  rating: number | null;
  tags: string[];
  tagIds: Array<{ id: number; name: string }>;  // for TagEditor DELETE calls
  publisher: string | null;
  language: string | null;
  files: Array<{ format: string; name: string; size: number }>;
}

export interface FilterOptions {
  authors: Array<{ id: number; name: string | null; sort: string | null }>;
  tags: Array<{ id: number; name: string | null }>;
  series: Array<{ id: number; name: string | null }>;
}
```

- [ ] **Step 2: Replace `queries.ts`**

Full file — extracts `hydrateBooks` helper, adds `buildBookConditions`, `buildOrderExpr`, `getGroupedBookList`, extends `getBookList` and `getBook`.

```typescript
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

// Fetches authors, series, formats, deliveredTo for an ordered list of book IDs.
// Preserves caller order. One appDb query for delivery data — never N+1.
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

  // Preserve the caller's ordering
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

// Returns null to signal "empty result" when delivered:true and nothing delivered.
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

// Group configuration. Table/column names are controlled values — no injection risk.
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

  // Single window-function query: first 6 books per group + per-group counts.
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

  // Find book IDs that belong to at least one group
  type BookRow = { book: number };
  const inGroupSet = new Set(
    (sqlite.prepare(`SELECT DISTINCT book FROM ${cfg.joinTable} WHERE book IN (${inClause})`).all(...idList) as BookRow[])
      .map((r) => r.book),
  );
  const ungroupedIds = idList.filter((id) => !inGroupSet.has(id));

  // Hydrate all preview books in one batch
  const previewIds = rankedRows.map((r) => r.id);
  const allHydrateIds = [...new Set([...previewIds, ...ungroupedIds.slice(0, 6)])];
  const hydratedMap = new Map<number, BookSummary>();
  for (const b of await hydrateBooks(allHydrateIds)) hydratedMap.set(b.id, b);

  // Build group map
  const groupMap = new Map<number, { label: string; total: number; bookIds: number[] }>();
  for (const row of rankedRows) {
    if (!groupMap.has(row.groupKey)) groupMap.set(row.groupKey, { label: row.groupLabel, total: row.total, bookIds: [] });
    groupMap.get(row.groupKey)!.bookIds.push(row.id);
  }

  const groups: BookGroup[] = [];
  for (const [groupKey, { label, total, bookIds }] of groupMap) {
    groups.push({ key: String(groupKey), label, total, books: bookIds.map((id) => hydratedMap.get(id)!).filter(Boolean) });
  }

  if (ungroupedIds.length > 0) {
    groups.push({
      key: 'ungrouped',
      label: 'Ungrouped',
      total: ungroupedIds.length,
      books: ungroupedIds.slice(0, 6).map((id) => hydratedMap.get(id)!).filter(Boolean),
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

// Kept for MCP backward compat.
export async function listUndeliveredBooks(params: {
  platformKey: string;
  format?: string;
  page?: number;
  limit?: number;
}): Promise<{ books: BookSummary[]; total: number }> {
  return getBookList({ platformKey: params.platformKey, delivered: false, page: params.page, limit: params.limit });
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm nx typecheck personal-calibre
```

Expected: no errors.

- [ ] **Step 4: Write search e2e spec**

Create `apps/personal-calibre-e2e/src/search.spec.ts`:

```typescript
import { expect, test } from '@playwright/test';

test.describe('search', () => {
  test('FTS returns results for partial title match', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder="Search books..."]', 'Dune');
    await expect(page.locator('.absolute.border').or(page.locator('[role="listbox"]'))).toBeVisible({ timeout: 2000 });
    await expect(page.locator('text=Dune').first()).toBeVisible();
  });

  test('selecting autocomplete suggestion navigates to book detail', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder="Search books..."]', 'Dune');
    // Wait for suggestion panel
    await page.waitForTimeout(400);
    // Click the first suggestion
    await page.locator('.absolute.border >> [role="button"]').first().click();
    await expect(page).toHaveURL(/\/books\/\d+/);
  });

  test('pressing Enter commits search to URL and shows results', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder="Search books..."]', 'Foundation');
    await page.press('input[placeholder="Search books..."]', 'Enter');
    await expect(page).toHaveURL(/q=Foundation/);
    await expect(page.locator('[data-testid="book-card"]').first()).toBeVisible();
  });

  test('clear button removes search from URL', async ({ page }) => {
    await page.goto('/?q=Dune');
    await page.click('button[aria-label="Clear search"]');
    await expect(page).toHaveURL('/');
  });
});
```

- [ ] **Step 5: Commit**

```bash
git -c commit.gpgsign=false add apps/personal-calibre/src/types/calibre.ts apps/personal-calibre/src/lib/queries.ts apps/personal-calibre-e2e/src/search.spec.ts
git -c commit.gpgsign=false commit -m "feat(personal-calibre): types + queries — hydrateBooks, deliveredTo, sort, getGroupedBookList"
```

---

## Task 4: Tag write lib + API routes

**Files:**
- Create: `apps/personal-calibre/src/lib/tags.ts`
- Create: `apps/personal-calibre/src/app/api/books/[id]/tags/route.ts`
- Create: `apps/personal-calibre/src/app/api/books/[id]/tags/[tagId]/route.ts`

- [ ] **Step 1: Create `lib/tags.ts`**

```typescript
import { revalidateTag } from 'next/cache';

import { sqlite } from '@/db/client';

// Get-or-create a tag by name in Calibre's SQLite. Returns the tag id.
// Writes go to the Calibre DB directly so tags round-trip to Calibre desktop.
export function getOrCreateTag(name: string): number {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Tag name is required');

  const existing = sqlite.prepare('SELECT id FROM tags WHERE name = ?').get(trimmed) as { id: number } | undefined;
  if (existing) return existing.id;

  const result = sqlite.prepare('INSERT INTO tags (name) VALUES (?)').run(trimmed);
  return result.lastInsertRowid as number;
}

// Link tag to book — idempotent via INSERT OR IGNORE.
export function addTagToBook(bookId: number, tagId: number): void {
  sqlite.prepare('INSERT OR IGNORE INTO books_tags_link (book, tag) VALUES (?, ?)').run(bookId, tagId);
}

// Remove tag link from book.
export function removeTagFromBook(bookId: number, tagId: number): void {
  sqlite.prepare('DELETE FROM books_tags_link WHERE book = ? AND tag = ?').run(bookId, tagId);
}

// Invalidate all relevant Next.js cache entries after any tag mutation.
export function revalidateBookTagCache(bookId: number): void {
  revalidateTag('books');
  revalidateTag('filters');
  revalidateTag(`book-${bookId}`);
}
```

- [ ] **Step 2: Create `POST /api/books/[id]/tags`**

File path: `apps/personal-calibre/src/app/api/books/[id]/tags/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { addTagToBook, getOrCreateTag, revalidateBookTagCache } from '@/lib/tags';

const bodySchema = z.object({ name: z.string().min(1) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bookId = Number(id);
  if (!Number.isFinite(bookId)) return NextResponse.json({ error: 'Invalid book id' }, { status: 400 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  try {
    const tagId = getOrCreateTag(parsed.data.name);
    addTagToBook(bookId, tagId);
    revalidateBookTagCache(bookId);
    return NextResponse.json({ ok: true, tagId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create `DELETE /api/books/[id]/tags/[tagId]`**

File path: `apps/personal-calibre/src/app/api/books/[id]/tags/[tagId]/route.ts`

```typescript
import { NextResponse } from 'next/server';

import { revalidateBookTagCache, removeTagFromBook } from '@/lib/tags';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; tagId: string }> },
) {
  const { id, tagId } = await params;
  const bookId = Number(id);
  const tagIdNum = Number(tagId);
  if (!Number.isFinite(bookId) || !Number.isFinite(tagIdNum)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  try {
    removeTagFromBook(bookId, tagIdNum);
    revalidateBookTagCache(bookId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm nx typecheck personal-calibre
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git -c commit.gpgsign=false add apps/personal-calibre/src/lib/tags.ts "apps/personal-calibre/src/app/api/books/[id]/tags/"
git -c commit.gpgsign=false commit -m "feat(personal-calibre): tag write lib + POST/DELETE /api/books/[id]/tags"
```

---

## Task 5: FilterBar component + page.tsx update

**Files:**
- Create: `apps/personal-calibre/src/components/FilterBar.tsx`
- Delete: `apps/personal-calibre/src/components/FilterPanel.tsx`
- Modify: `apps/personal-calibre/src/app/(library)/page.tsx`

- [ ] **Step 1: Create `FilterBar.tsx`**

Key design points:
- No `useState` for filter values (author, tag, series, platform, delivered, groupBy, sortBy, sortDir) — all read from `useSearchParams()`
- Only `localQ` and `suggestions` use `useState` (for debounced search input)
- `useEffect` syncs `localQ` from URL on back-nav

```typescript
'use client';

import { Check, ChevronsUpDown, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { FilterOptions } from '@/types/calibre';
import type { DeliveryPlatform } from '@/types/delivery';

interface SearchResult { id: number; title: string; author: string; series: string | null }
interface Props { filters: FilterOptions; platforms: DeliveryPlatform[] }

function FilterCombobox({ label, options, paramKey }: {
  label: string;
  options: Array<{ id: number; name: string | null; sort?: string | null }>;
  paramKey: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const value = searchParams.get(paramKey);
  const selectedLabel = value ? (options.find((o) => String(o.id) === value)?.name ?? value) : null;

  function handleSelect(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set(paramKey, id); else params.delete(paramKey);
    params.delete('page');
    router.replace(`/?${params.toString()}`);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" role="combobox" aria-expanded={open}
          aria-label={`Filter by ${label.toLowerCase()}`}
          className="w-full justify-between sm:w-40">
          <span className="truncate text-sm font-normal">{selectedLabel ?? `All ${label}s`}</span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${label.toLowerCase()}…`} />
          <CommandEmpty>No {label.toLowerCase()} found.</CommandEmpty>
          <CommandList>
            <CommandItem value="__all__" onSelect={() => handleSelect(null)}>
              <Check className={cn('mr-2 h-4 w-4', value ? 'opacity-0' : 'opacity-100')} />
              All {label}s
            </CommandItem>
            {options.map((o) => (
              <CommandItem key={o.id} value={String(o.id)} onSelect={() => handleSelect(String(o.id))}>
                <Check className={cn('mr-2 h-4 w-4', String(o.id) === value ? 'opacity-100' : 'opacity-0')} />
                {o.name ?? o.sort ?? String(o.id)}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function FilterBarInner({ filters, platforms }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQ = searchParams.get('q') ?? '';
  const [localQ, setLocalQ] = useState(urlQ);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Sync localQ when URL changes (back/forward nav)
  useEffect(() => { setLocalQ(urlQ); }, [urlQ]);

  const updateParam = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    params.delete('page');
    router.replace(`/?${params.toString()}`);
  }, [router, searchParams]);

  useEffect(() => {
    const id = setTimeout(async () => {
      if (!localQ.trim()) { setSuggestions([]); return; }
      try {
        const res = await fetch(`/api/books/search?q=${encodeURIComponent(localQ)}`);
        setSuggestions(((await res.json()) as { results: SearchResult[] }).results ?? []);
      } catch { setSuggestions([]); }
    }, 300);
    return () => clearTimeout(id);
  }, [localQ]);

  const activePlatform = searchParams.get('platform');
  const activeDelivered = searchParams.get('delivered');
  const activeGroupBy = searchParams.get('groupBy');
  const activeSortBy = searchParams.get('sortBy');
  const activeSortDir = searchParams.get('sortDir') ?? 'asc';
  const activeAuthor = searchParams.get('author');
  const activeTag = searchParams.get('tag');
  const activeSeries = searchParams.get('series');
  const hasActiveFilters = !!(urlQ || activeAuthor || activeTag || activeSeries || activePlatform);

  const authorLabel = activeAuthor ? (filters.authors.find((a) => String(a.id) === activeAuthor)?.name ?? activeAuthor) : null;
  const tagLabel = activeTag ? (filters.tags.find((t) => String(t.id) === activeTag)?.name ?? activeTag) : null;
  const seriesLabel = activeSeries ? (filters.series.find((s) => String(s.id) === activeSeries)?.name ?? activeSeries) : null;
  const platformLabel = activePlatform ? (platforms.find((p) => p.key === activePlatform)?.name ?? activePlatform) : null;

  return (
    <div className="flex flex-col gap-2">
      {/* Search row */}
      <div className="relative">
        <Input
          placeholder="Search books..."
          value={localQ}
          className="w-full pr-8 sm:w-64"
          onChange={(e) => setLocalQ(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { updateParam('q', localQ); setShowSuggestions(false); }
            if (e.key === 'Escape') setShowSuggestions(false);
          }}
        />
        {localQ && (
          <button type="button" aria-label="Clear search"
            className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2"
            onClick={() => { setLocalQ(''); updateParam('q', null); }}>
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {showSuggestions && suggestions.length > 0 && (
          <div className="bg-background absolute top-full z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border shadow-lg">
            {suggestions.map((s) => (
              <div key={s.id} role="button" tabIndex={0}
                className="hover:bg-muted flex cursor-pointer flex-col px-3 py-2 text-sm"
                onClick={() => router.push(`/books/${s.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/books/${s.id}`); }}>
                <span className="truncate font-medium">{s.title}</span>
                <span className="text-muted-foreground truncate text-xs">{s.author}{s.series ? ` • ${s.series}` : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter + view controls row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <FilterCombobox label="Author" options={filters.authors} paramKey="author" />
        <FilterCombobox label="Tag" options={filters.tags} paramKey="tag" />
        <FilterCombobox label="Series" options={filters.series} paramKey="series" />

        <Select value={activePlatform ?? 'all'} onValueChange={(v) => {
          updateParam('platform', v === 'all' ? null : v);
          if (v === 'all') updateParam('delivered', null);
        }}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by platform">
            <span className="text-muted-foreground mr-1 shrink-0 text-xs">Platform</span>
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            {platforms.map((p) => <SelectItem key={p.key} value={p.key}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>

        {activePlatform && (
          <Select value={activeDelivered ?? 'all'} onValueChange={(v) => updateParam('delivered', v === 'all' ? null : v)}>
            <SelectTrigger className="w-full sm:w-40" aria-label="Filter by delivery status">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="true">Delivered</SelectItem>
              <SelectItem value="false">Not delivered</SelectItem>
            </SelectContent>
          </Select>
        )}

        <div className="sm:ml-auto flex items-center gap-2">
          <Select value={activeGroupBy ?? 'none'} onValueChange={(v) => { updateParam('groupBy', v === 'none' ? null : v); updateParam('page', null); }}>
            <SelectTrigger className="w-36" aria-label="Group by">
              <span className="text-muted-foreground mr-1 shrink-0 text-xs">Group</span>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="series">Series</SelectItem>
              <SelectItem value="tag">Tag</SelectItem>
              <SelectItem value="author">Author</SelectItem>
            </SelectContent>
          </Select>

          <Select value={activeSortBy ?? 'title'} onValueChange={(v) => updateParam('sortBy', v === 'title' ? null : v)}>
            <SelectTrigger className="w-36" aria-label="Sort by">
              <span className="text-muted-foreground mr-1 shrink-0 text-xs">Sort</span>
              <SelectValue placeholder="Title" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="title">Title</SelectItem>
              <SelectItem value="author">Author</SelectItem>
              <SelectItem value="added">Date added</SelectItem>
              <SelectItem value="pubdate">Published</SelectItem>
              <SelectItem value="rating">Rating</SelectItem>
            </SelectContent>
          </Select>

          <button type="button"
            aria-label={`Sort direction: ${activeSortDir === 'desc' ? 'descending' : 'ascending'}`}
            onClick={() => updateParam('sortDir', activeSortDir === 'desc' ? null : 'desc')}
            className="border-input hover:bg-accent rounded-md border px-2 py-1.5 text-xs">
            {activeSortDir === 'desc' ? '↓' : '↑'}
          </button>
        </div>
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5">
          {urlQ && <FilterChip label={`"${urlQ}"`} onRemove={() => { setLocalQ(''); updateParam('q', null); }} />}
          {authorLabel && <FilterChip label={`Author: ${authorLabel}`} onRemove={() => updateParam('author', null)} />}
          {tagLabel && <FilterChip label={`Tag: ${tagLabel}`} onRemove={() => updateParam('tag', null)} />}
          {seriesLabel && <FilterChip label={`Series: ${seriesLabel}`} onRemove={() => updateParam('series', null)} />}
          {platformLabel && (
            <FilterChip
              label={`Platform: ${platformLabel}${activeDelivered === 'false' ? ' (undelivered)' : activeDelivered === 'true' ? ' (delivered)' : ''}`}
              onRemove={() => { updateParam('platform', null); updateParam('delivered', null); }}
            />
          )}
          <button type="button" onClick={() => { setLocalQ(''); router.replace('/'); }}
            className="text-muted-foreground hover:text-foreground ml-1 text-xs underline underline-offset-2">
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Remove filter ${label}`} className="hover:text-foreground">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export function FilterBar(props: Props) {
  return (
    <Suspense fallback={<div className="bg-muted h-10 w-full animate-pulse rounded-md" />}>
      <FilterBarInner {...props} />
    </Suspense>
  );
}
```

- [ ] **Step 2: Replace `apps/personal-calibre/src/app/(library)/page.tsx`**

```typescript
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { BulkSelectionWrapper } from '@/components/BulkSelectionWrapper';
import { FilterBar } from '@/components/FilterBar';
import { BookCard } from '@/components/BookCard';
import { buildPageUrl, Pagination } from '@/components/Pagination';
import { listDeliveryPlatforms } from '@/lib/delivery';
import { type GroupBy, getBookList, getFilterOptions, getGroupedBookList } from '@/lib/queries';
import type { BookGroup } from '@/types/calibre';

interface Props {
  searchParams: Promise<{
    page?: string; q?: string; author?: string; tag?: string; series?: string;
    platform?: string; delivered?: string; groupBy?: string; sortBy?: string; sortDir?: string;
  }>;
}

export default function LibraryPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<div className="space-y-6" />}>
      <LibraryPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LibraryPageContent({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1') || 1);
  const authorId = params.author ? (parseInt(params.author) || undefined) : undefined;
  const tagId = params.tag ? (parseInt(params.tag) || undefined) : undefined;
  const seriesId = params.series ? (parseInt(params.series) || undefined) : undefined;
  const delivered = params.delivered === 'true' ? true : params.delivered === 'false' ? false : undefined;
  const groupBy = (['series', 'tag', 'author'] as const).find((v) => v === params.groupBy);
  const sortBy = (['title', 'author', 'pubdate', 'added', 'rating'] as const).find((v) => v === params.sortBy);
  const sortDir = params.sortDir === 'desc' ? 'desc' : 'asc';

  const [filters, platforms] = await Promise.all([getFilterOptions(), listDeliveryPlatforms()]);

  if (groupBy) {
    const { groups } = await getGroupedBookList({
      q: params.q, authorId, tagId, seriesId,
      platformKey: params.platform, delivered, groupBy, sortBy, sortDir,
    });
    const total = groups.reduce((n, g) => n + g.total, 0);

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Books</h1>
            <p className="text-muted-foreground text-sm">{total} books</p>
          </div>
          <FilterBar filters={filters} platforms={platforms} />
        </div>
        <GroupedView groups={groups} groupBy={groupBy} />
      </div>
    );
  }

  const { books, total } = await getBookList({
    page, q: params.q, authorId, tagId, seriesId,
    platformKey: params.platform, delivered, sortBy, sortDir,
  });

  const totalPages = Math.ceil(total / 30);
  if (page > totalPages && totalPages > 0) {
    redirect(buildPageUrl(1, { q: params.q, author: params.author, tag: params.tag, series: params.series }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Books</h1>
          <p className="text-muted-foreground text-sm">{total} books total</p>
        </div>
        <FilterBar filters={filters} platforms={platforms} />
      </div>
      <BulkSelectionWrapper books={books} from={params} platforms={platforms} />
      <Pagination page={page} totalPages={totalPages} searchParams={params} />
    </div>
  );
}

function GroupedView({ groups, groupBy }: { groups: BookGroup[]; groupBy: GroupBy }) {
  const filterParam = groupBy === 'series' ? 'series' : groupBy === 'tag' ? 'tag' : 'author';
  return (
    <div className="space-y-10">
      {groups.map((group) => (
        <section key={group.key}>
          <div className="mb-3 flex items-baseline justify-between border-b pb-1">
            <h2 className="text-sm font-semibold">{group.label}</h2>
            <span className="text-muted-foreground text-xs">{group.total} books</span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {group.books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
          {group.total > 6 && (
            <div className="mt-3 text-right">
              <Link href={`/?${filterParam}=${group.key}`} className="text-primary text-sm hover:underline">
                See all {group.total} →
              </Link>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Delete FilterPanel.tsx**

```bash
rm apps/personal-calibre/src/components/FilterPanel.tsx
```

- [ ] **Step 4: Write filter e2e spec**

Create `apps/personal-calibre-e2e/src/filter.spec.ts`:

```typescript
import { expect, test } from '@playwright/test';
import { resetAppDb } from './support/reset-db';

test.beforeEach(() => resetAppDb());

test.describe('filters', () => {
  test('author combobox filters grid', async ({ page }) => {
    await page.goto('/');
    await page.click('button[role="combobox"][aria-label="Filter by author"]');
    await page.fill('input[placeholder="Search author…"]', 'Herbert');
    await page.click('[cmdk-item]:has-text("Frank Herbert")');
    await expect(page).toHaveURL(/author=/);
    await expect(page.locator('[data-testid="book-card"]')).toHaveCount(2);
  });

  test('tag combobox filters grid', async ({ page }) => {
    await page.goto('/');
    await page.click('button[role="combobox"][aria-label="Filter by tag"]');
    await page.click('[cmdk-item]:has-text("fantasy")');
    await expect(page).toHaveURL(/tag=/);
    await expect(page.locator('[data-testid="book-card"]')).toHaveCount(2);
  });

  test('back navigation restores filter state', async ({ page }) => {
    await page.goto('/');
    await page.click('button[role="combobox"][aria-label="Filter by author"]');
    await page.click('[cmdk-item]:has-text("Frank Herbert")');
    const authorUrl = page.url();
    await page.click('[data-testid="book-card"] >> nth=0');
    await expect(page).toHaveURL(/\/books\/\d+/);
    await page.goBack();
    await expect(page).toHaveURL(authorUrl);
    await expect(page.locator('[data-testid="book-card"]')).toHaveCount(2);
  });

  test('platform filter shows undelivered books', async ({ page }) => {
    await page.goto('/');
    await page.selectOption('[aria-label="Filter by platform"]', 'readwise-reader');
    await expect(page.locator('[aria-label="Filter by delivery status"]')).toBeVisible();
    await page.selectOption('[aria-label="Filter by delivery status"]', 'false');
    await expect(page).toHaveURL(/platform=readwise-reader/);
    await expect(page.locator('[data-testid="book-card"]').first()).toBeVisible();
  });

  test('sort direction toggle changes URL', async ({ page }) => {
    await page.goto('/');
    await page.click('button[aria-label="Sort direction: ascending"]');
    await expect(page).toHaveURL(/sortDir=desc/);
    await page.click('button[aria-label="Sort direction: descending"]');
    await expect(page).not.toHaveURL(/sortDir=/);
  });

  test('clear all removes filter params', async ({ page }) => {
    await page.goto('/?author=1&tag=1');
    await page.click('button:has-text("Clear all")');
    await expect(page).toHaveURL('/');
  });
});
```

- [ ] **Step 5: Typecheck**

```bash
pnpm nx typecheck personal-calibre
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git -c commit.gpgsign=false add apps/personal-calibre/src/components/FilterBar.tsx "apps/personal-calibre/src/app/(library)/page.tsx" apps/personal-calibre-e2e/src/filter.spec.ts
git -c commit.gpgsign=false commit -m "feat(personal-calibre): FilterBar with comboboxes + page.tsx grouped/flat branching"
```

---

## Task 6: BookCard platform badges + delivery revalidation fix

**Files:**
- Modify: `apps/personal-calibre/src/components/BookCard.tsx`
- Modify: `apps/personal-calibre/src/lib/delivery.ts`

- [ ] **Step 1: Update BookCard.tsx**

Replace the full file content with the version below. Changes:
- Add `data-testid="book-card"` to the Card element
- Add `platformAbbr` helper function
- Add delivery badge row below format badges

```typescript
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { BookSummary } from '@/types/calibre';

function platformAbbr(key: string): string {
  const map: Record<string, string> = { 'readwise-reader': 'RW', notebooklm: 'NLM' };
  return map[key] ?? key.slice(0, 3).toUpperCase();
}

interface Props {
  book: BookSummary;
  from?: string;
  selected?: boolean;
  onToggle?: () => void;
}

export function BookCard({ book, from, selected, onToggle }: Props) {
  const href = from ? `/books/${book.id}?from=${encodeURIComponent(from)}` : `/books/${book.id}`;

  const cardContent = (
    <Card
      data-testid="book-card"
      className={`h-full overflow-hidden transition-shadow group-hover:shadow-md ${selected ? 'ring-primary ring-2' : ''}`}
    >
      <div className="bg-muted relative aspect-[2/3] w-full overflow-hidden">
        {book.hasCover ? (
          <img src={`/api/books/${book.id}/cover`} alt={`Cover of ${book.title}`} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center text-4xl">📚</div>
        )}
        {onToggle !== undefined && (
          <div className="absolute left-2 top-2">
            <input type="checkbox" checked={selected ?? false} onChange={onToggle}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 cursor-pointer accent-primary"
              aria-label={`Select ${book.title}`} />
          </div>
        )}
      </div>
      <CardContent className="p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{book.title}</p>
        {book.authors.length > 0 && (
          <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">{book.authors.join(', ')}</p>
        )}
        {book.series && (
          <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs italic">
            {book.series}{book.seriesIndex ? ` #${book.seriesIndex}` : ''}
          </p>
        )}
        {book.formats.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {book.formats.map((fmt) => (
              <Badge key={fmt} variant="outline" className="px-1 py-0 text-[10px]">{fmt}</Badge>
            ))}
          </div>
        )}
        {book.deliveredTo.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-0.5">
            {book.deliveredTo.map((key) => (
              <span key={key} title={key}
                className="bg-primary/15 text-primary inline-flex items-center rounded px-1 py-0 text-[9px] font-medium uppercase tracking-wide">
                {platformAbbr(key)}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (onToggle !== undefined) {
    return (
      <div className="group cursor-pointer" onClick={onToggle} role="checkbox"
        aria-checked={selected ?? false} tabIndex={0} onKeyDown={(e) => e.key === ' ' && onToggle()}>
        {cardContent}
      </div>
    );
  }

  return <Link href={href} className="group">{cardContent}</Link>;
}
```

- [ ] **Step 2: Fix `delivery.ts` — revalidate 'books' cache on bulk delivery**

In `bulkCreateDeliveryEvents`, after the insert loop, add `revalidateTag('books')`:

```typescript
// Replace the revalidation block at end of bulkCreateDeliveryEvents:
revalidateTag('books'); // invalidates list cache so delivery badges update
for (const bookId of bookIds) {
  revalidateTag(`book-${bookId}`);
}
```

Also add to `createBookDeliveryEvent` for single-book consistency:
```typescript
// Replace in createBookDeliveryEvent:
revalidateTag('books');
revalidateTag(`book-${bookId}`);
```

- [ ] **Step 3: Typecheck**

```bash
pnpm nx typecheck personal-calibre
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git -c commit.gpgsign=false add apps/personal-calibre/src/components/BookCard.tsx apps/personal-calibre/src/lib/delivery.ts
git -c commit.gpgsign=false commit -m "feat(personal-calibre): platform delivery badges on BookCard + revalidate books list on delivery"
```

---

## Task 7: Grouped grid e2e spec

**Files:**
- Create: `apps/personal-calibre-e2e/src/group-by.spec.ts`

The grouped grid is fully rendered by `GroupedView` in `page.tsx` (Task 5). This task adds the e2e spec.

- [ ] **Step 1: Create group-by spec**

```typescript
import { expect, test } from '@playwright/test';
import { resetAppDb } from './support/reset-db';

test.beforeEach(() => resetAppDb());

test.describe('group-by', () => {
  test('group by series shows series section headers', async ({ page }) => {
    await page.goto('/?groupBy=series');
    await expect(page.locator('h2:has-text("Dune Chronicles")')).toBeVisible();
    await expect(page.locator('h2:has-text("Foundation Series")')).toBeVisible();
    await expect(page.locator('h2:has-text("The Lord of the Rings")')).toBeVisible();
  });

  test('group by tag shows tag section headers', async ({ page }) => {
    await page.goto('/?groupBy=tag');
    await expect(page.locator('h2:has-text("sci-fi")')).toBeVisible();
    await expect(page.locator('h2:has-text("fantasy")')).toBeVisible();
    await expect(page.locator('h2:has-text("nonfiction")')).toBeVisible();
  });

  test('group by author shows author section headers', async ({ page }) => {
    await page.goto('/?groupBy=author');
    await expect(page.locator('h2:has-text("Frank Herbert")')).toBeVisible();
    await expect(page.locator('h2:has-text("Isaac Asimov")')).toBeVisible();
  });

  test('ungrouped section appears for books without a series', async ({ page }) => {
    await page.goto('/?groupBy=series');
    await expect(page.locator('h2:has-text("Ungrouped")')).toBeVisible();
  });

  test('See all link not shown when group has 6 or fewer books', async ({ page }) => {
    await page.goto('/?groupBy=series');
    // All series in fixture have <=6 books — no "See all" links
    await expect(page.locator('text=See all')).not.toBeVisible();
  });

  test('filter + group-by compose: nonfiction books grouped by author', async ({ page }) => {
    await page.goto('/?tag=4&groupBy=author');
    await expect(page.locator('h2:has-text("Daniel Kahneman")')).toBeVisible();
    await expect(page.locator('h2:has-text("James Clear")')).toBeVisible();
    await expect(page.locator('h2:has-text("Frank Herbert")')).not.toBeVisible();
  });
});
```

- [ ] **Step 2: Commit**

```bash
git -c commit.gpgsign=false add apps/personal-calibre-e2e/src/group-by.spec.ts
git -c commit.gpgsign=false commit -m "test(personal-calibre-e2e): group-by e2e spec"
```

---

## Task 8: Tag editor UI

**Files:**
- Create: `apps/personal-calibre/src/components/TagEditor.tsx`
- Modify: `apps/personal-calibre/src/app/(library)/books/[id]/page.tsx`
- Create: `apps/personal-calibre-e2e/src/tag-editing.spec.ts`

- [ ] **Step 1: Create TagEditor.tsx**

```typescript
'use client';

import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { FilterOptions } from '@/types/calibre';

interface Props {
  bookId: number;
  tagIds: Array<{ id: number; name: string }>;
  allTags: FilterOptions['tags'];
}

export function TagEditor({ bookId, tagIds, allTags }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inputValue, setInputValue] = useState('');

  async function removeTag(tagId: number) {
    setBusy(true);
    try {
      await fetch(`/api/books/${bookId}/tags/${tagId}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addTag(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setOpen(false);
    setInputValue('');
    try {
      await fetch(`/api/books/${bookId}/tags`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const existingIds = new Set(tagIds.map((t) => t.id));
  const availableTags = allTags.filter((t) => t.id !== null && !existingIds.has(t.id));
  const matchesExisting = allTags.some((t) => t.name?.toLowerCase() === inputValue.toLowerCase());

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tagIds.map((tag) => (
        <span key={tag.id}
          className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium">
          {tag.name}
          <button type="button" disabled={busy} onClick={() => removeTag(tag.id)}
            aria-label={`Remove tag ${tag.name}`}
            className="hover:text-destructive disabled:opacity-50">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" disabled={busy}
            className="border-input text-muted-foreground hover:text-foreground hover:bg-accent rounded-full border px-2.5 py-0.5 text-xs disabled:opacity-50">
            + Add tag
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search or create tag…" value={inputValue} onValueChange={setInputValue} />
            <CommandEmpty>
              {inputValue.trim() ? (
                <button type="button" className="w-full px-3 py-2 text-left text-sm" onClick={() => addTag(inputValue)}>
                  Create "{inputValue.trim()}"
                </button>
              ) : 'No tags found.'}
            </CommandEmpty>
            <CommandList>
              {availableTags.map((t) => (
                <CommandItem key={t.id} value={t.name ?? ''} onSelect={() => addTag(t.name ?? '')}>
                  {t.name}
                </CommandItem>
              ))}
              {inputValue.trim() && !matchesExisting && (
                <CommandItem value={`__create__${inputValue}`} onSelect={() => addTag(inputValue)}>
                  Create "{inputValue.trim()}"
                </CommandItem>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
```

- [ ] **Step 2: Update book detail page to include TagEditor**

In `apps/personal-calibre/src/app/(library)/books/[id]/page.tsx`:

Add imports:
```typescript
import { TagEditor } from '@/components/TagEditor';
import { getFilterOptions } from '@/lib/queries';
```

Add `getFilterOptions()` to the `Promise.all` in `BookDetailContent`:
```typescript
const [book, platforms, deliveryEvents, filterOptions] = await Promise.all([
  getBook(bookId),
  listDeliveryPlatforms(),
  listBookDeliveryEvents(bookId),
  getFilterOptions(),
]);
```

Replace the existing tags section (the `<div className="flex flex-wrap gap-2">` block with `Badge` elements):
```typescript
<div className="flex flex-col gap-1.5">
  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Tags</p>
  <TagEditor bookId={book.id} tagIds={book.tagIds} allTags={filterOptions.tags} />
</div>
```

- [ ] **Step 3: Typecheck**

```bash
pnpm nx typecheck personal-calibre
```

Expected: no errors.

- [ ] **Step 4: Create tag-editing e2e spec**

```typescript
import { expect, test } from '@playwright/test';
import { resetAppDb } from './support/reset-db';

test.beforeEach(() => resetAppDb());

test.describe('tag editing', () => {
  test('book detail shows existing tags', async ({ page }) => {
    await page.goto('/books/1'); // Dune has sci-fi, classic
    await expect(page.locator('text=sci-fi')).toBeVisible();
    await expect(page.locator('text=classic')).toBeVisible();
  });

  test('Add tag button is visible', async ({ page }) => {
    await page.goto('/books/1');
    await expect(page.locator('button:has-text("+ Add tag")')).toBeVisible();
  });

  test('adding an existing tag appears on page', async ({ page }) => {
    await page.goto('/books/7'); // Thinking Fast — has nonfiction, no self-help
    await page.click('button:has-text("+ Add tag")');
    await page.fill('input[placeholder="Search or create tag…"]', 'self');
    await page.locator('[cmdk-item]:has-text("self-help")').click();
    await expect(page.locator('text=self-help')).toBeVisible({ timeout: 5000 });
  });

  test('creating a new tag adds it to the book', async ({ page }) => {
    await page.goto('/books/5'); // The Hobbit
    await page.click('button:has-text("+ Add tag")');
    await page.fill('input[placeholder="Search or create tag…"]', 'adventure');
    await page.locator('text=Create "adventure"').first().click();
    await expect(page.locator('text=adventure')).toBeVisible({ timeout: 5000 });
  });

  test('removing a tag unlinks it from the book', async ({ page }) => {
    await page.goto('/books/1'); // Dune has classic
    await page.click('button[aria-label="Remove tag classic"]');
    await expect(page.locator('text=classic')).not.toBeVisible({ timeout: 5000 });
  });

  test('new tag appears in filter combobox', async ({ page }) => {
    await page.request.post('/api/books/5/tags', { data: { name: 'to-read' } });
    await page.goto('/');
    await page.click('button[role="combobox"][aria-label="Filter by tag"]');
    await expect(page.locator('[cmdk-item]:has-text("to-read")')).toBeVisible();
  });
});
```

Save to `apps/personal-calibre-e2e/src/tag-editing.spec.ts`.

- [ ] **Step 5: Commit**

```bash
git -c commit.gpgsign=false add apps/personal-calibre/src/components/TagEditor.tsx "apps/personal-calibre/src/app/(library)/books/[id]/page.tsx" apps/personal-calibre-e2e/src/tag-editing.spec.ts
git -c commit.gpgsign=false commit -m "feat(personal-calibre): TagEditor UI on book detail + tag-editing e2e spec"
```

---

## Task 9: MCP extensions

**Files:**
- Modify: `apps/personal-calibre/src/app/api/mcp/route.ts`

- [ ] **Step 1: Replace mcp/route.ts with extended version**

Add `add_tag`, `remove_tag`, `list_tags` tools. Extend `list_books` with `platformKey`, `delivered`, `groupBy`, `sortBy`, `sortDir`.

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp';
import { z } from 'zod';

import {
  bulkCreateDeliveryEvents, createBookDeliveryEvent, deleteBookDeliveryEvent, listBookDeliveryEvents,
} from '@/lib/delivery';
import {
  type GroupBy, getBook, getBookList, getFilterOptions, getGroupedBookList, listUndeliveredBooks,
} from '@/lib/queries';
import { addTagToBook, getOrCreateTag, revalidateBookTagCache, removeTagFromBook } from '@/lib/tags';

export async function POST(request: Request): Promise<Response> {
  const server = new McpServer({ name: 'calibre-mcp', version: '0.1.0' });

  server.registerTool('list_books', {
    description: 'Search and list books. When groupBy is set, returns { groups } with 6 preview books each; otherwise returns { books, total }.',
    inputSchema: {
      query: z.string().optional().describe('Full-text search'),
      authorId: z.number().int().optional(),
      tagId: z.number().int().optional(),
      seriesId: z.number().int().optional(),
      platformKey: z.string().optional().describe('Platform key, e.g. "readwise-reader"'),
      delivered: z.boolean().optional().describe('true=delivered only, false=undelivered only'),
      groupBy: z.enum(['series', 'tag', 'author']).optional(),
      sortBy: z.enum(['title', 'author', 'pubdate', 'added', 'rating']).optional(),
      sortDir: z.enum(['asc', 'desc']).optional(),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(30),
    },
  }, async (input) => {
    if (input.groupBy) {
      const result = await getGroupedBookList({
        q: input.query, authorId: input.authorId, tagId: input.tagId, seriesId: input.seriesId,
        platformKey: input.platformKey, delivered: input.delivered,
        groupBy: input.groupBy as GroupBy, sortBy: input.sortBy, sortDir: input.sortDir,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
    const result = await getBookList({
      q: input.query, authorId: input.authorId, tagId: input.tagId, seriesId: input.seriesId,
      platformKey: input.platformKey, delivered: input.delivered,
      sortBy: input.sortBy, sortDir: input.sortDir, page: input.page, limit: input.limit,
    });
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  });

  server.registerTool('get_book', {
    description: 'Get full details for a single book',
    inputSchema: { bookId: z.number().int() },
  }, async (input) => {
    const book = await getBook(input.bookId);
    if (!book) return { content: [{ type: 'text', text: `Book ${input.bookId} not found` }], isError: true };
    return { content: [{ type: 'text', text: JSON.stringify(book) }] };
  });

  server.registerTool('list_undelivered_books', {
    description: 'List books not yet delivered to a platform',
    inputSchema: {
      platformKey: z.string(),
      format: z.string().optional(),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(30),
    },
  }, async (input) => {
    const result = await listUndeliveredBooks({ platformKey: input.platformKey, format: input.format, page: input.page, limit: input.limit });
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  });

  server.registerTool('list_deliveries', {
    description: 'Get delivery history for a book',
    inputSchema: { bookId: z.number().int() },
  }, async (input) => {
    const events = await listBookDeliveryEvents(input.bookId);
    return { content: [{ type: 'text', text: JSON.stringify(events) }] };
  });

  server.registerTool('add_delivery', {
    description: 'Record a book as delivered to a platform',
    inputSchema: {
      bookId: z.number().int(),
      platformKey: z.string(),
      externalRef: z.string().optional(),
      note: z.string().optional(),
    },
  }, async (input) => {
    await createBookDeliveryEvent(input.bookId, { platformKey: input.platformKey, externalRef: input.externalRef, note: input.note });
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, bookId: input.bookId, platformKey: input.platformKey }) }] };
  });

  server.registerTool('bulk_add_delivery', {
    description: 'Record multiple books as delivered to a platform',
    inputSchema: {
      bookIds: z.array(z.number().int()),
      platformKey: z.string(),
      note: z.string().optional(),
    },
  }, async (input) => {
    const result = await bulkCreateDeliveryEvents(input.bookIds, { platformKey: input.platformKey, note: input.note });
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, count: result.count, platformKey: input.platformKey }) }] };
  });

  server.registerTool('remove_delivery', {
    description: 'Remove a delivery record',
    inputSchema: { bookId: z.number().int(), deliveryId: z.number().int() },
  }, async (input) => {
    await deleteBookDeliveryEvent(input.bookId, input.deliveryId);
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
  });

  server.registerTool('list_tags', {
    description: 'List all tags. Use to resolve tag names to IDs before calling remove_tag.',
    inputSchema: {},
  }, async () => {
    const { tags } = await getFilterOptions();
    return { content: [{ type: 'text', text: JSON.stringify(tags) }] };
  });

  server.registerTool('add_tag', {
    description: 'Add a tag to a book. Creates the tag if it does not exist. Idempotent.',
    inputSchema: { bookId: z.number().int(), tagName: z.string().min(1) },
  }, async (input) => {
    const tagId = getOrCreateTag(input.tagName);
    addTagToBook(input.bookId, tagId);
    revalidateBookTagCache(input.bookId);
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, bookId: input.bookId, tagId, tagName: input.tagName }) }] };
  });

  server.registerTool('remove_tag', {
    description: 'Remove a tag from a book. Call list_tags first to get tag IDs.',
    inputSchema: { bookId: z.number().int(), tagId: z.number().int() },
  }, async (input) => {
    removeTagFromBook(input.bookId, input.tagId);
    revalidateBookTagCache(input.bookId);
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
  });

  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(request);
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm nx typecheck personal-calibre
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git -c commit.gpgsign=false add apps/personal-calibre/src/app/api/mcp/route.ts
git -c commit.gpgsign=false commit -m "feat(personal-calibre): MCP add_tag/remove_tag/list_tags + extend list_books"
```

---

## Task 10: Bulk feedback + Toaster + remaining e2e specs

**Files:**
- Modify: `apps/personal-calibre/src/app/layout.tsx`
- Modify: `apps/personal-calibre/src/components/BulkSelectionWrapper.tsx`
- Create: `apps/personal-calibre-e2e/src/bulk-delivery.spec.ts`
- Create: `apps/personal-calibre-e2e/src/book-detail.spec.ts`

- [ ] **Step 1: Add Toaster to root layout**

```typescript
import './globals.css';

import { Geist } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata = {
  title: 'Personal Calibre Library',
  description: 'Browse your Calibre ebook library',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn('font-sans', geist.variable)}>
      <body className="bg-background text-foreground min-h-screen">
        {children}
        <Toaster richColors position="bottom-center" />
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Replace BulkSelectionWrapper.tsx**

Key changes: import `useRouter` + `toast` from `sonner`, call `toast.success()` + `router.refresh()` on success, `toast.error()` on failure.

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import type { BookSummary } from '@/types/calibre';
import type { DeliveryPlatform } from '@/types/delivery';
import { BookGrid } from './BookGrid';
import { BulkActionBar } from './BulkActionBar';

interface Props {
  books: BookSummary[];
  from?: Record<string, string | undefined>;
  platforms: DeliveryPlatform[];
}

export function BulkSelectionWrapper({ books, from, platforms }: Props) {
  const router = useRouter();
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectedPlatformKey, setSelectedPlatformKey] = useState(platforms[0]?.key ?? '');
  const [zipFormat, setZipFormat] = useState('EPUB');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function exitSelectMode() { setIsSelectMode(false); setSelectedIds(new Set()); }

  async function handleAddToPlatform() {
    if (selectedIds.size === 0 || !selectedPlatformKey) return;
    setError(null);
    setIsSubmitting(true);
    const count = selectedIds.size;
    const platformName = platforms.find((p) => p.key === selectedPlatformKey)?.name ?? selectedPlatformKey;
    try {
      const res = await fetch('/api/books/deliveries/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bookIds: Array.from(selectedIds), platformKey: selectedPlatformKey }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? 'Failed to add deliveries');
      }
      exitSelectMode();
      toast.success(`${count} book${count !== 1 ? 's' : ''} marked as delivered to ${platformName}`);
      router.refresh(); // re-runs RSC fetches so delivery badges update without full page reload
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected error';
      setError(msg);
      toast.error(`Delivery failed — ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDownloadZip() {
    if (selectedIds.size === 0) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/books/download/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bookIds: Array.from(selectedIds), format: zipFormat }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Failed to build ZIP');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'books.zip'; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected error';
      setError(msg);
      toast.error(`Download failed — ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <button type="button"
          onClick={() => (isSelectMode ? exitSelectMode() : setIsSelectMode(true))}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
            isSelectMode ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-accent'
          }`}>
          {isSelectMode ? 'Cancel select' : 'Select'}
        </button>
        {isSelectMode && selectedIds.size > 0 && (
          <button type="button" onClick={() => setSelectedIds(new Set(books.map((b) => b.id)))}
            className="text-muted-foreground hover:text-foreground text-sm underline">
            Select all ({books.length})
          </button>
        )}
      </div>

      <BookGrid
        books={books}
        from={isSelectMode ? undefined : from}
        selectedIds={isSelectMode ? selectedIds : undefined}
        onToggle={isSelectMode ? toggle : undefined}
      />

      <BulkActionBar
        selectedCount={selectedIds.size}
        platforms={platforms}
        selectedPlatformKey={selectedPlatformKey}
        onPlatformChange={setSelectedPlatformKey}
        onAddToPlatform={handleAddToPlatform}
        onDownloadZip={handleDownloadZip}
        onClear={() => setSelectedIds(new Set())}
        isSubmitting={isSubmitting}
        zipFormat={zipFormat}
        onZipFormatChange={setZipFormat}
        error={error}
      />
    </>
  );
}
```

- [ ] **Step 3: Create bulk-delivery.spec.ts**

```typescript
import { expect, test } from '@playwright/test';
import { resetAppDb } from './support/reset-db';

test.beforeEach(() => resetAppDb());

test.describe('bulk delivery', () => {
  test('select books, deliver, toast shown, badges update', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Select")');
    await page.click('[data-testid="book-card"] >> nth=0');
    await page.click('[data-testid="book-card"] >> nth=1');
    await expect(page.locator('text=2 selected')).toBeVisible();
    await page.click('button:has-text("Add to platform")');
    await expect(page.locator('text=marked as delivered')).toBeVisible({ timeout: 5000 });
    // Select mode should be cleared
    await expect(page.locator('text=2 selected')).not.toBeVisible();
    // After reload, RW badge should appear on delivered books
    await page.reload();
    await expect(page.locator('text=RW').first()).toBeVisible();
  });

  test('delivered=false filter shows zero results after delivering all books', async ({ page }) => {
    // Deliver all 8 books
    await page.goto('/');
    await page.click('button:has-text("Select")');
    await page.click('text=Select all (8)');
    await page.click('button:has-text("Add to platform")');
    await expect(page.locator('text=marked as delivered')).toBeVisible({ timeout: 5000 });

    // Filter for undelivered
    await page.goto('/?platform=readwise-reader&delivered=false');
    await expect(page.locator('[data-testid="book-card"]')).toHaveCount(0);
    await expect(page.locator('text=No books found')).toBeVisible();
  });
});
```

- [ ] **Step 4: Create book-detail.spec.ts**

```typescript
import { expect, test } from '@playwright/test';
import { resetAppDb } from './support/reset-db';

test.beforeEach(() => resetAppDb());

test.describe('book detail', () => {
  test('shows book title and author', async ({ page }) => {
    await page.goto('/books/1'); // Dune
    await expect(page.locator('h1')).toContainText('Dune');
    await expect(page.locator('text=Frank Herbert')).toBeVisible();
  });

  test('shows tags and tag editor', async ({ page }) => {
    await page.goto('/books/1');
    await expect(page.locator('text=sci-fi')).toBeVisible();
    await expect(page.locator('button:has-text("+ Add tag")')).toBeVisible();
  });

  test('back link with from param returns to filtered library', async ({ page }) => {
    await page.goto('/?author=1');
    await page.click('[data-testid="book-card"] >> nth=0');
    await expect(page).toHaveURL(/\/books\/\d+\?from=/);
    await page.click('text=← Back to library');
    await expect(page).toHaveURL(/author=1/);
    await expect(page.locator('[data-testid="book-card"]')).toHaveCount(2);
  });
});
```

- [ ] **Step 5: Final typecheck + lint**

```bash
pnpm nx typecheck personal-calibre
pnpm nx lint personal-calibre --fix
pnpm nx lint personal-calibre-e2e --fix 2>/dev/null || true
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git -c commit.gpgsign=false add \
  apps/personal-calibre/src/app/layout.tsx \
  apps/personal-calibre/src/components/BulkSelectionWrapper.tsx \
  apps/personal-calibre-e2e/src/bulk-delivery.spec.ts \
  apps/personal-calibre-e2e/src/book-detail.spec.ts
git -c commit.gpgsign=false commit -m "feat(personal-calibre): Sonner toast + router.refresh bulk feedback + remaining e2e specs"
```

---

## End-to-End Verification

- [ ] **Start app with fixture DB and run all e2e specs**

```bash
# Terminal 1: start app with fixture
CALIBRE_LIBRARY_PATH=apps/personal-calibre-e2e/src/fixtures \
CALIBRE_APP_DB_PATH=apps/personal-calibre-e2e/src/fixtures/app.db \
PORT=3333 pnpm nx dev personal-calibre

# Terminal 2: run e2e
pnpm nx e2e personal-calibre-e2e
```

Expected: all 6 spec files pass (search, filter, group-by, tag-editing, bulk-delivery, book-detail).

- [ ] **Typecheck**

```bash
pnpm nx typecheck personal-calibre
```

Expected: exit 0.

- [ ] **Lint**

```bash
pnpm nx lint personal-calibre --fix
```

Expected: exit 0.
