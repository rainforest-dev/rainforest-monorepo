# Shared Search Task 5: calibre list page, MCP `list_books`, e2e

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The list page and MCP `list_books` match books through `searchBookIds`, so the search box, the list page and MCP agree on a query. MCP orders by relevance unless `sortBy` is set, and reports `semantic` and `reason`.

**Architecture:** `buildBookConditions` restricts to `searchBookIds(q).ids` for queries of three or more characters and keeps `LIKE` below that. `BookListParams` gains `ids`, a precomputed match list: MCP runs `searchBookIds` once, passes the ids, and orders by their position when no `sortBy` is given. The search route reads an `embed` fault from the existing e2e test hooks so Playwright can switch the fake embedder to fail.

**Tech Stack:** Next.js 16, drizzle-orm over better-sqlite3, `@rainforest-dev/search`, `@rainforest-dev/mcp-kit`, Vitest 4, Playwright.

**Parent plan:** `docs/superpowers/plans/2026-10-12-shared-search-library.md`, Task 5. Its Global Constraints apply.

## Decisions

- `SEARCH_MIN_CHARS = 3` counts trimmed characters. Shorter queries keep today's `LIKE` everywhere, and MCP reports `semantic: 'off'` for them.
- Relevance order is SQL: the position of `books.id` in `json_each(<ids>)`. Pagination and `total` stay in SQL, so `total` is the match count after filters.
- `getBookList` and `getGroupedBookList` stay cached. MCP calls a new uncached `searchBookList`, which runs `searchBookIds` and then those two with `ids`, so `semantic` is never served from a stale cache entry.
- The list page already passes `sortBy` (default `title`) through `toLibraryQuery`, so it never falls into relevance order.
- The e2e fault is `calibre-e2e-fault=embed`, read only when `CALIBRE_E2E=1`. It wraps the foreground embedder in one that throws `EmbedError('ollama-unreachable')`, which does not trip the breaker.

### Task 5.1: Shared matching in `book-query.ts`

**Files:** Modify `lib/server/book-query.ts`, `lib/server/queries.ts`, `lib/server/library-query.ts`

- [ ] **Step 1:** `buildBookConditions` uses `ids` when given, else `inArray(books.id, (await searchBookIds(q)).ids)` for `q.trim().length >= 3`, else today's `LIKE`.
- [ ] **Step 2:** `bookOrder(params)` returns relevance order for `ids` without `sortBy`, otherwise `buildOrderExpr`. `getBookList` uses it.
- [ ] **Step 3:** `searchBookList({ query, groupBy, ...params })` returns `{ books, total }` or `{ groups }`, plus `semantic` and `reason?`.

### Task 5.2: MCP `list_books`

**Files:** Modify `lib/server/mcp/tools.ts`, `library.ts`, `testing.ts`, `tools.test.ts`

- [ ] **Step 1:** `list_books` calls `library.searchBookList`. The description says the query is full-text plus semantic, ordered by relevance unless `sortBy` is set, and lexical-only when the embedding service is unreachable.
- [ ] **Step 2:** Criterion 1 test in `lib/server/search-book-list.test.ts` against a temp Calibre DB with `CALIBRE_EMBED=fake`: relevance order without `sortBy`, title order with it, `total` equal to the match count, grouped output, and `semantic: 'off'` with the lexical order when the embedder throws.
- [ ] **Step 3:** Criterion 4 test: for a three-or-more-character query, the search route's ids, `queryLibrary`'s `matchingIds` and `searchBookList`'s ids are the same set.

### Task 5.3: e2e

**Files:** Modify `lib/test-hooks.ts`, `app/api/books/search/route.ts`, `personal-calibre-e2e/playwright.config.ts`, `personal-calibre-e2e/src/search.spec.ts`

- [ ] **Step 1:** `FaultScope` gains `embed`; the search route passes `{ embedFault }` to `searchBookIds`.
- [ ] **Step 2:** The e2e web server sets `CALIBRE_EMBED=fake`.
- [ ] **Step 3:** Criterion 2: `/?q=Halvik` lists the author's books in title-sort order, computed from the seed. Criterion 3: once the index reports `semantic: 'on'`, typing `harbor` suggests `海港來信`; with the fault cookie it does not, and the API reports `ollama-unreachable`.

### Task 5.4: Verify

- [ ] `pnpm nx run-many -t lint test typecheck build -p personal-calibre`, `pnpm nx e2e personal-calibre-e2e`, `pnpm nx smoke-artifact personal-calibre`, `pnpm format:check`.
- [ ] Screenshot of the `harbor` suggestion on the PR.
