# Shared Search Task 4: calibre `searchBookIds`, indexing and search route

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** personal-calibre gains semantic search through Ollama: a background index, `searchBookIds`, and a search route that reports `semantic` and `reason`.

**Architecture:** `lib/server/search/` sits behind the `lib/server` barrel. `lexical.ts` holds today's FTS5 and n-gram ranking, unlimited. `docs.ts` builds one text per book. `index.ts` embeds missing rows into `<app data dir>/search` and keeps partial progress. `query.ts` fuses lexical and semantic ids with `rrf`, and falls back to the lexical order exactly whenever semantic search cannot answer.

**Tech Stack:** Next.js 16 route handlers, better-sqlite3, `@rainforest-dev/search` (root and `./node`), Vitest 4.

**Parent plan:** `docs/superpowers/plans/2026-10-12-shared-search-library.md`, Task 4. Its Global Constraints apply.

## Decisions

- The app data directory is the directory of the app database: `dirname(CALIBRE_APP_DB_PATH ?? <library>/personal-calibre-app.db)`. The index lives in its `search/` child.
- `syncBooksFts` runs once per process, so the index job also runs once per process: the first `searchBookIds` call starts it in the background. The job reuses every row whose id and content hash are unchanged, so a run with nothing new makes no embed calls. A job that fails with an `EmbedError` keeps the rows it finished and may run again after `BREAKER_MS`.
- Semantic results are used only after this process's job has completed. Until then the reason is `no-index`, so a half-built index never mixes into the order (parent plan, Review Focus 4).
- With no embedder configured the response carries `semantic: 'off'` and no `reason`, so it is today's response plus that one field.
- `CALIBRE_EMBED=fake` selects `conceptEmbedder` with concepts drawn from the e2e fixture titles, and needs no URL.
- `reason` is `EmbedFailure | 'no-index'`, the same shape as memories' `SearchReason`.

### Task 4.1: Lexical ranking moves out of the route

**Files:**

- Create: `apps/personal-calibre/src/lib/server/search/lexical.ts`
- Modify: `apps/personal-calibre/src/app/api/books/search/route.ts`

- [ ] **Step 1:** Move `sanitizeToken`, the FTS5 query and the n-gram fallback into `lexicalBookIds(q, sqlite): number[]`, with the FTS `LIMIT` removed and `ngramSimilarity` imported from `@rainforest-dev/search`. The first 20 ids equal today's 20 rows.
- [ ] **Step 2:** Add `"@rainforest-dev/search": "workspace:*"`, run `pnpm install`, then `pnpm nx sync`.

### Task 4.2: Book docs and env

**Files:**

- Create: `lib/server/search/docs.ts`, `lib/server/search/env.ts`, tests beside them
- Modify: `src/test/calibre-db.ts` (adds the `comments` table Calibre has, and an optional `comments` per book)

- [ ] **Step 1:** `bookDocText` joins title, authors, series, tags and stripped comments clipped to 1,000 characters. `readBookDocs(sqlite)` reads them in id order and sets `contentHash = fnv1a(text)`.
- [ ] **Step 2:** `embedderFromEnv(env)` returns `undefined` without `CALIBRE_OLLAMA_URL` (unless `CALIBRE_EMBED=fake`). `searchDirFromEnv(env)` returns the index directory.

### Task 4.3: Index job

**Files:** Create `lib/server/search/index.ts`, `index.test.ts`

- [ ] **Step 1:** `indexBooks({ dir, docs, embedder, batch })` reads the previous files, reuses rows through `planReuse`, embeds the rest in batches, and writes the finished rows on an `EmbedError` before returning `false`. On success it writes everything and returns the files.
- [ ] **Step 2:** Test (criterion 4): an embedder that fails on its second batch, then a counting embedder; the second run embeds only the rows the first run did not finish.

### Task 4.4: `searchBookIds`

**Files:** Create `lib/server/search/query.ts`, `query.test.ts`, `lib/server/search/barrel` export through `lib/server/index.ts`

- [ ] **Step 1:** `rankBookIds({ q, lexical, index, embedder, gate })` is pure over its inputs: no index gives `no-index`, an open breaker gives `timeout`, an `EmbedError` gives its reason and trips the breaker on `timeout`. Otherwise `topK` plus `semanticIds` give the semantic order and `rrf` fuses it with the lexical order.
- [ ] **Step 2:** `searchBookIds(q)` wires env, the shared breaker, `withQueryPriority` (foreground for queries, background for the job) and the once-per-process job.
- [ ] **Step 3:** Tests: criterion 2 (a `fake` concept hit on a query sharing no characters with the title) and criterion 3 (unreachable, timeout and open breaker each return the lexical order exactly).

### Task 4.5: Route

**Files:** Modify `app/api/books/search/route.ts`; create `route.search.test.ts`

- [ ] **Step 1:** The route returns the first 20 ids of `searchBookIds` as today's `results` rows, plus `semantic` and `reason`.
- [ ] **Step 2:** Test (criterion 1): with no `CALIBRE_OLLAMA_URL`, a fixture library returns today's results for an FTS query and an n-gram query, plus `semantic: 'off'` and no `reason`. `route.test.ts` stays unmodified.

### Task 4.6: Verify

- [ ] `pnpm format:check`
- [ ] `pnpm nx run-many -t lint test typecheck build -p personal-calibre`
- [ ] `pnpm nx smoke-artifact personal-calibre`
