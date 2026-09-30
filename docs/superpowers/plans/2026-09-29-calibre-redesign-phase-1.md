# personal-calibre redesign, phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the calibre library's single cover grid and separate detail page with shared chrome
(search, filter panel, selection, bulk bar), two views over one server page (Shelf and Catalogue), a
`?book=` detail pane, a full keyboard map with `[` / `]` paging, loading and error states, a Read
button, made-up fixtures, Vitest and an axe-checked e2e suite.

**Architecture:** The server returns one page of `(group, book)` entries from a new `getLibrary`
(`'use cache'`, tag `books`), built on a pure `queryLibrary` that Vitest runs against a temp SQLite
file. The `(library)` layout reads the `calibre-prefs` cookie inside Suspense, mounts a client
`LibraryProvider` (view, panel, selection, focus, navigation) and a `LibraryShell` with
`children`, `@filters` and `@pane` slots. The URL is the source of truth for what is shown
(`library-params.ts`), the view choice is client state over the same page, and pure rules
(`pickTarget`, `resolveShortcut`, `groupEntries`, `parsePrefs`, selection helpers) carry unit tests;
DOM behaviour carries Playwright tests.

**Tech Stack:** Next.js 16.2.11 App Router with `cacheComponents: true`, React 19.2.3,
`@rainforest-dev/rainforest-react` (Base UI 1.8 + cmdk), `lucide-react` 1.46, Tailwind v4 with the
shared seed theme, drizzle-orm 0.45 + better-sqlite3 12, zod 3.25 (the app's own pin), Vitest 4.1.4
(root devDependency, no app pin), Playwright 1.63 with `@axe-core/playwright` (added in Task 12).

**Spec:** `docs/superpowers/specs/2026-09-29-calibre-redesign-design.md` (commit f18e04d). Phase 1
only. Study (phases 2 and 3) is out of scope except the seams listed in D19.

## Plan decisions (where the spec is silent or cannot be followed literally)

- D1 Fixtures move to `apps/personal-calibre-e2e/test-output/fixtures/`, which `.gitignore` already
  covers (`test-output`). Today's `src/fixtures/` is not ignored, so every e2e run leaves untracked
  databases in the worktree.
- D2 The e2e harness is broken today and is fixed in Task 1. Verified 2026-09-29: the inferred
  `dev` target passes `--port=8080`, which beats `PORT=3333`, so the webServer never becomes ready
  (60 s timeout); `nx dev personal-calibre --port=3333` does override it. Playwright starts the
  webServer before `globalSetup`, so the readiness URL is `/favicon.ico` (served from `public/`,
  opens no database) and the seed always lands before the app's first query. `reuseExistingServer`
  is `false`: a reused server would hold handles to the unlinked previous databases.
- D3 Task 1 deletes the eight existing specs: they assert real books and the old UI. Each behaviour
  is re-specified against the made-up fixture in the task that rebuilds it (map in Task 12 step 1).
- D4 `getLibrary` is a thin `'use cache'` wrapper in `queries.ts` over `queryLibrary` in
  `src/lib/library-query.ts`, which imports nothing from `next/*`, so Vitest can call it.
  `hydrateBooks`, `buildBookConditions`, `buildOrderExpr` and `BookListParams` move verbatim to
  `src/lib/book-query.ts`; `getBookList`, `getGroupedBookList`, MCP and OPDS output are unchanged.
- D5 An entry is `{ book, group?: { key, label, total, offset, id } }`. `offset` (0-based position
  inside the whole group) is what `(continued)` needs; `id` is the series/tag/author id for
  `See all N` (null for the fallback group).
- D6 `N books` / `N of M books` count distinct books (`matchingIds.length`). `matching` counts
  entries and drives `Page N of M`. With tag grouping, counting entries would print "75 of 70 books".
- D7 `LibraryBook.authors` and `authorIds` come from one query ordered by link id, so they pair by
  index. `BookSummary` and `hydrateBooks` are untouched.
- D8 `BookDetail` (the type) has no series or author ids, which the pane's filter links need, so
  `@pane/page.tsx` and `/books/[id]` also load `getLibraryBook(id)`.
- D9 `BookDetail` (the component) has two variants, `pane` and `page`. The phone bottom Sheet
  renders the same `@pane` node, so the pane variant adapts by breakpoint (cover 108px from `lg`,
  92px below; `Esc close` hidden below `lg`).
- D10 Search suggestions use cmdk's `Command` with its list positioned under its own input, not a
  Base UI `Popover`: rainforest-react's `PopoverContent` does not expose `anchor`, and cmdk keeps
  focus in the input with `aria-activedescendant`, which is what "↓ moves into it" needs. The list
  stays mounted (`hidden` when closed) so the input's `aria-controls` always resolves.
- D11 Test-hook faults are also read from a `calibre-e2e-fault` cookie (same values, same
  `CALIBRE_E2E=1` gate), so a test can arm a fault for a client navigation and disarm it before
  Retry. A URL fault would throw again on Retry.
- D12 Mutations expire their tags with `revalidateTag(tag, { expire: 0 })` instead of `'max'` in
  `lib/delivery.ts` and `lib/tags.ts`, and deleting a delivery also expires `books`. With `'max'`
  the `router.refresh()` after a mutation is served the stale entry, so the pane and the list marks
  lag one action behind. The routes themselves are unchanged.
- D13 `@filters/books/[id]/page.tsx` and `@pane/books/[id]/page.tsx` return `null`, so a soft
  navigation to the permalink (`Open full page`) also drops the panel and the pane; `default.tsx`
  covers hard loads.
- D14 Shelf tiles use a visual, non-focusable select mark (`aria-hidden` span) instead of a
  Checkbox: an option's children are presentational, and a focusable checkbox inside
  `role="option"` fails axe `nested-interactive`. Catalogue rows are `role="row"` in a
  `role="grid"` table, where a `Checkbox` with `tabIndex={-1}` is allowed.
- D15 The header `N filters` badge and the panel's `Filters · N` count author, tag, series and
  platform. `q` shows in the scope title and as a chip.
- D16 Scope title precedence: `q`, then series, author, tag, platform, else `All books`.
- D17 Delivery mark abbreviations: `KB` (Kobo), `NLM`, `RW`. The app seeds only Readwise Reader and
  NotebookLM, so the fixture adds `kobo` / `Kobo` to `app.db`.
- D18 Phone versus desktop layout uses `useIsDesktop()` (`matchMedia('(min-width: 64rem)')`, server
  snapshot `true`). Sheets and the compact Catalogue mount only below `lg`; desktop columns carry
  `hidden lg:block`, so the server render never flashes the desktop layout on a phone.
- D19 Phase-2 seams: `View` includes `'study'`; `ENABLED_VIEWS` is `['shelf', 'catalogue']`
  (phase 2 appends `'study'`); the cookie parses and keeps `renderer`, and `resolveRenderer` exists
  with tests; `KEY_HINTS` has the Study entry; `pickTarget` takes rows from its items, so Study can
  pass layout rows.
- D20 The app has no inferred `typecheck` target. Task 1 adds one (`tsc --noEmit -p tsconfig.json`).
- D21 The fixture has no cover images (`has_cover = 0`). Tiles and the pane show the P15 spine
  colour with the title. Each format is seeded as a small text file, so downloads and `ZIP` work.
- D22 The DOM nav key is `{groupKey}:{bookId}`, with `all` as the group key when ungrouped (P9).
- D23 The large fixture (`CALIBRE_FIXTURE=large`) is 250 books from this plan's own deterministic
  generator; the spike's generator lives on a local-only branch.
- D24 Spec budgets for phase 1 are measured by an opt-in spec (`CALIBRE_BUDGETS=1`) against
  `next start`, not in the default run.
- D25 E2E runs with one worker. Every spec shares one dev server and one SQLite library, and
  `resetAppDb` rewrites delivery rows, so parallel specs would race on shared state.

## Global Constraints

- Work only in `/Users/rainforest/Repositories/rainforest-monorepo/.claude/worktrees/calibre-redesign`
  (branch `feat/calibre-redesign`). Never `cd` to the repository root. Never `git stash`.
- Every task runs through `pnpm nx`:
  - Unit: `pnpm nx test personal-calibre -- src/lib/<file>.test.ts`
  - Types: `pnpm nx typecheck personal-calibre` (target added in Task 1) and
    `pnpm nx typecheck personal-calibre-e2e`
  - Lint: `pnpm nx run-many -t lint -p personal-calibre personal-calibre-e2e`
  - E2E: `pnpm nx e2e personal-calibre-e2e -- --grep "<title>"`; phone specs add
    `--project=phone`
  - Never call npm scripts, `vitest` or `playwright` directly.
- Node: the default asdf Node 22.14 runs this app's Vitest and e2e (verified 2026-09-29). If a tool
  fails with an `import.meta.main` or syntax error, prefix the command with
  `PATH="$HOME/.asdf/installs/nodejs/22.23.2/bin:$PATH"`.
- E2E servers: Playwright does not kill the `next dev` grandchild that `nx` spawns (verified: the
  port stays bound after the run). Before and after every e2e run:
  `pids=$(lsof -tiTCP:3333 -sTCP:LISTEN); [ -n "$pids" ] && kill $pids`.
- `next dev` rewrites `apps/personal-calibre/next-env.d.ts`. Restore it with
  `git checkout -- apps/personal-calibre/next-env.d.ts` before every commit; never commit it.
- Next.js warns about multiple lockfiles because the worktree sits inside the main checkout. It is
  harmless; do not set `turbopack.root` in this plan.
- Dev differs from build. Any task that changes a layout, a route file or a slot ends with the
  dev-server check below; Task 12 also runs `pnpm nx build personal-calibre`.

  ```bash
  pids=$(lsof -tiTCP:3335 -sTCP:LISTEN); [ -n "$pids" ] && kill $pids
  FIX="$PWD/apps/personal-calibre-e2e/test-output/fixtures"
  CALIBRE_LIBRARY_PATH="$FIX" CALIBRE_APP_DB_PATH="$FIX/app.db" CALIBRE_E2E=1 \
    pnpm nx dev personal-calibre --port=3335
  ```

  Run it in the background (the fixture exists after any e2e run), load the pages the task names
  in a browser, confirm each renders with no console error and no Next.js error overlay, stop the
  server, then restore `next-env.d.ts`.

- `cacheComponents` is on: request data (`cookies()`, `searchParams`, `useSearchParams`) is read only
  inside a Suspense boundary; no `export const dynamic`. `'use cache'` functions never read request
  data, so test hooks and faults run outside them.
- Imports sorted by `simple-import-sort` (`pnpm nx lint <project> --fix` sorts them). Single quotes.
  lint-staged runs prettier on commit; run `pnpm prettier --write <files>` when unsure.
- Semantic tokens only: no hex, no raw palette classes (`text-gray-500`), no `dark:`. Token mixes
  go through CSS variables (`color-mix(in_oklch,var(--chart-1)_45%,var(--muted))`).
- Comment allow-list, every language: one line naming an external constraint the code works
  around (browser behaviour, API quirk, library trap) without which a reader would "fix" it back;
  the reason on a lint suppression; `TODO(<ticket>)`. No JSDoc on private helpers, props or
  fields; no history or rationale. Last step of every task:
  `git diff -U0 HEAD | grep -E '^\+\s*(//|/\*|\*|#|\{/\*)'` and justify each hit against this list.
- Fixture data is made up only: no real people, no real books. Tests, captures and PR evidence use
  the seeded fixture (`apps/personal-calibre-e2e/src/support/seed.ts`) and nothing else.
- zod is the app's 3.25 pin: `import { z } from 'zod'`, v3 API (`z.enum`, `.catch`).
- Copy is verbatim from the spec's Copy section. The few strings this plan adds are listed where
  they appear (`Rated {n} of 5`, `Book not found.`, `Filter {facet}`, `Delivery status`,
  `Select all on this page`, `Download format`, `Loading book`).
- Commits: conventional, scope `personal-calibre` (or `personal-calibre-e2e` for an e2e-only
  change), path-scoped `git add` of the task's files only (never `git add -A` or `git add .`), and
  every message ends with exactly these two lines after a blank line:

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm
  ```

- Never `--no-verify`. Pass no signing flags (`-c commit.gpgsign=false`, `--no-gpg-sign`,
  `-S`). If signing fails, stop and report.
- The implementer of each task commits that task with the task's commit step. Touch only the files
  the task lists.
- E2E specs that change deliveries or tags touch only the books they name, because `resetAppDb`
  resets rows behind the app's `'use cache'` entries: deliveries spec 41 and 42, shelf spec 40,
  tags spec 43, 44 and 45, filters spec 46 (tag `to-read`), bulk and catalogue specs the books
  they select, always with `Readwise Reader` as the platform.
  Assertions about seeded deliveries use only the seed rows (books 1, 2, 3, 17, 38, 44).

## Review Focus

1. Malformed and out-of-range URLs: `?page=99`, `?page=0`, `?page=abc`, `?author=abc`,
   `?groupBy=nope`, `?delivered=false` without `platform`. Nothing throws; junk is ignored; an
   out-of-range page lands on the last page with every other param kept. Tests: Task 2 step 1
   (`ignores malformed values`), Task 5 step 1 (`an out-of-range page…`, `junk params…`).
2. What is on screen right after a mutation: Mark added, Remove, a tag change in the pane, and bulk
   Mark delivered show in the pane rows and in the list marks without a reload. Tests: Task 4 step 1
   (`Mark added shows at once`), Task 5 step 1 (`the tile shows a new mark…`), Task 8 step 1.
3. Tag grouping puts one book in several groups: `x` on one copy selects the book (every copy shows
   selected), focus stays on the copy pressed, arrows walk through both copies, `N selected` counts
   the book once. Tests: Task 2 step 1 (tag entries), Task 6 steps 1 and 2 (duplicate keys).
4. Focus after the pane closes for a book that is not on the current page (opened from `?book=` or
   a suggestion): `Esc` closes it without error and no stale focus request fires on a later page.
   Test: Task 10 step 2 (`Esc closes a pane whose book is on another page`).
5. Selection that the current filters hide: `N selected` keeps counting it and bulk Mark delivered
   logs it. Test: Task 8 step 1 (`selected books hidden by a filter…`).

## Execution order

Tasks run one at a time, 1 → 12. Most tasks touch `src/app/(library)/page.tsx`,
`LibraryProvider.tsx` or the e2e helpers, so none run in parallel.

## File map

Paths under `src/` are relative to `apps/personal-calibre/`; e2e paths are under
`apps/personal-calibre-e2e/`.

```
apps/personal-calibre/
  package.json                    typecheck target                                    (T1)
  vitest.config.ts                Vitest, node env, @ alias                           (T1)
  src/lib/files.test.ts           first unit test                                     (T1)
  src/types/calibre.ts            LibraryBook, LibraryEntry, LibraryResult            (T2)
  src/lib/book-query.ts           moved: BookListParams, hydrateBooks, conditions     (T2)
  src/lib/library-query.ts        queryLibrary, hydrateLibraryBooks                   (T2)
  src/lib/queries.ts              getLibrary, getLibraryBook                          (T2)
  src/lib/library-params.ts       parse/build hrefs, chips, scope title              (T2)
  src/lib/group-entries.ts        groupEntries, groupTitle, navKey, contentKey        (T2)
  src/lib/prefs.ts                cookie prefs, views, renderers                      (T2)
  src/test/calibre-db.ts          temp Calibre DB for Vitest                          (T2)
  src/lib/selection.ts            pure selection helpers                              (T3)
  src/lib/prefs-server.ts         readPrefs()                                         (T3)
  src/hooks/useIsDesktop.ts                                                           (T3)
  src/components/library/         LibraryProvider, LibraryShell, LibraryHeader,
                                  ViewSwitch (T3); SearchField, FilterPanel, Facet,
                                  DeliveredToggle, LibraryToolbar, SortControls,
                                  FilterChips (T7); BulkToolbar (T8); KeyHints (T10);
                                  ViewRegion, EmptyResult (T5); ViewSkeleton,
                                  LoadError (T11)
  src/lib/deliveries.ts, format.ts, spine.ts, description.ts                         (T4)
  src/components/detail/          BookDetail, PaneTopRow, DeliveryRows,
                                  DownloadMenu, BookDetailSkeleton                    (T4)
  src/components/TagEditor.tsx    restyled chips                                      (T4)
  src/lib/platforms.ts                                                                (T5)
  src/components/Pagination.tsx   restyled client pager                               (T5)
  src/components/views/           ShelfView, BookTile, DeliveryMarks, GroupHeading,
                                  SelectMark (T5); CatalogueView, CatalogueRow,
                                  DeliveryPills (T9)
  src/lib/roving.ts, src/hooks/useRovingNav.ts                                        (T6)
  src/lib/keyboard.ts, src/hooks/useLibraryShortcuts.ts                               (T10)
  src/lib/test-hooks.ts                                                               (T11)
  src/app/(library)/layout.tsx    slots, cookie, provider, shell                      (T3)
  src/app/(library)/page.tsx      T5, T7, T8, T10, T11
  src/app/(library)/error.tsx                                                         (T11)
  src/app/(library)/@filters/     default, books/[id] (T3); page (T7)
  src/app/(library)/@pane/        default, books/[id] (T3); page, loading (T4); error (T11)
  src/app/(library)/books/[id]/page.tsx   BookDetail variant page                     (T4)
  removed: BookGrid, BookCard, BulkSelectionWrapper (T5), FilterBar (T7),
           BulkActionBar (T8), DeliveryTracker (T4)
apps/personal-calibre-e2e/
  playwright.config.ts            port, readiness, phone project                      (T1)
  src/support/seed.ts, global-setup.ts, reset-db.ts, library.ts                       (T1)
  src/visual.spec.ts              opt-in before/after captures                        (T1, T12)
  src/fixtures.spec.ts                                                                (T1)
  src/shell.spec.ts, shell.phone.spec.ts                                              (T3)
  src/pane.spec.ts, deliveries.spec.ts, tags.spec.ts                                  (T4)
  src/shelf.spec.ts, pages.spec.ts                                                    (T5)
  src/keyboard.spec.ts                                                                (T6, T9)
  src/search.spec.ts, filters.spec.ts                                                 (T7)
  src/bulk.spec.ts                                                                    (T8, T9)
  src/catalogue.spec.ts                                                               (T9)
  src/shortcuts.spec.ts                                                               (T10)
  src/states.spec.ts                                                                  (T11)
  src/a11y.spec.ts, a11y.phone.spec.ts, library.phone.spec.ts, budgets.spec.ts        (T12)
```

---

### Task 1: E2E harness, made-up fixtures, before-captures and Vitest

**Files:**

- Modify: `apps/personal-calibre-e2e/playwright.config.ts` (whole file)
- Create: `apps/personal-calibre-e2e/src/support/seed.ts`
- Modify: `apps/personal-calibre-e2e/src/support/global-setup.ts` (whole file)
- Modify: `apps/personal-calibre-e2e/src/support/reset-db.ts` (whole file)
- Create: `apps/personal-calibre-e2e/src/support/library.ts`
- Create: `apps/personal-calibre-e2e/src/visual.spec.ts`
- Create: `apps/personal-calibre-e2e/src/fixtures.spec.ts`
- Delete: `apps/personal-calibre-e2e/src/{book-detail,book-list,bulk-delivery,example,filter,group-by,search,tag-editing}.spec.ts`
- Create: `apps/personal-calibre/vitest.config.ts`
- Create: `apps/personal-calibre/src/lib/files.test.ts`
- Modify: `apps/personal-calibre/package.json` (`nx.targets`)

**Interfaces:**

- Consumes: nothing.
- Produces:
  - From `src/support/seed.ts`: `FIXTURES_DIR`, `METADATA_DB_PATH`, `APP_DB_PATH`,
    `type FixtureSize = 'small' | 'large'`, `interface SeedBook`, `AUTHORS`, `SERIES`, `TAGS`,
    `PLATFORMS`, `SEED_DELIVERIES`, `BOOKS`, `fixtureSize()`, `libraryFor(size)`,
    `bookById(id): SeedBook`, `authorName(id)`, `tagName(id)`, `seedFixtures(size)`,
    `resetDeliveries(db)`.
  - From `src/support/library.ts`: `BASE_URL`, `PREFS_COOKIE`, `FAULT_COOKIE`,
    `gotoLibrary(page, url?)` (waits for `[data-library-ready]`, which Task 3 adds),
    `readPrefs(context)`, `setPrefs(context, prefs)`, `options(page)`, `pane(page)`,
    `tokenColor(page, token)`.
  - Fixture facts later tasks rely on: 70 books; series Amber Road (ids 2–9), Glass Orchard
    (10–16), Northbound (17–36), Tidewater Cycle (37–42); book 1 `The Salt Archive` (EPUB and PDF);
    book 38 is `Tidewater Cycle · Book 2`; 44 and 45 have CJK titles; 46 has no EPUB; 47 has two
    authors; 10 authors; 8 tags; seed deliveries: Kobo on 1, 2, 3, 38; NotebookLM on 1, 17;
    Readwise Reader on 44.
  - `pnpm nx typecheck personal-calibre`.

- [ ] **Step 1: Write the fixture test**

Create `apps/personal-calibre-e2e/src/fixtures.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

import { BOOKS, bookById } from './support/seed';

test.describe('fixture library', () => {
  test('seeds the made-up library', async ({ request }) => {
    const res = await request.get('/api/books?limit=100');
    const body = (await res.json()) as {
      total: number;
      books: Array<{ id: number; title: string }>;
    };
    expect(body.total).toBe(BOOKS.length);
    expect(body.books.map((b) => b.title)).toContain(bookById(1).title);
  });

  test('serves the seeded files', async ({ request }) => {
    const res = await request.post('/api/books/download/bulk', {
      data: { bookIds: [1, 2], format: 'EPUB' },
    });
    expect(res.ok()).toBe(true);
    expect(res.headers()['content-type']).toContain('zip');
  });

  test('seeds three platforms and the seed deliveries', async ({ request }) => {
    const res = await request.get('/api/books/1/deliveries');
    const body = (await res.json()) as {
      events: Array<{ platformKey: string }>;
    };
    expect(body.events.map((e) => e.platformKey).sort()).toEqual([
      'kobo',
      'notebooklm',
    ]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm nx e2e personal-calibre-e2e -- --grep "fixture library"`
Expected: FAIL. Either the webServer times out on port 3333 (D2) or `./support/seed` cannot be
resolved. Then clear the port (Global Constraints).

- [ ] **Step 3: Write the seed**

Create `apps/personal-calibre-e2e/src/support/seed.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

export const FIXTURES_DIR = path.join(
  __dirname,
  '..',
  '..',
  'test-output',
  'fixtures',
);
export const METADATA_DB_PATH = path.join(FIXTURES_DIR, 'metadata.db');
export const APP_DB_PATH = path.join(FIXTURES_DIR, 'app.db');

export type FixtureSize = 'small' | 'large';

export interface SeedBook {
  id: number;
  title: string;
  sort: string;
  authorIds: number[];
  seriesId: number | null;
  seriesIndex: number | null;
  tagIds: number[];
  formats: string[];
  pubdate: string;
  added: string;
  rating: number | null;
  publisherId: number;
  language: 'eng' | 'zho';
  description: string | null;
}

export const AUTHORS = [
  { id: 1, name: 'Mara Ostrand', sort: 'Ostrand, Mara' },
  { id: 2, name: 'Tobiah Quell', sort: 'Quell, Tobiah' },
  { id: 3, name: 'Ines Varrow', sort: 'Varrow, Ines' },
  { id: 4, name: 'Oren Halvik', sort: 'Halvik, Oren' },
  { id: 5, name: 'Petra Lunde-Asker', sort: 'Lunde-Asker, Petra' },
  { id: 6, name: 'Callum Vesk', sort: 'Vesk, Callum' },
  { id: 7, name: 'Yusra Pell', sort: 'Pell, Yusra' },
  { id: 8, name: '林霧川', sort: '林霧川' },
  { id: 9, name: 'Wren Adeyo-Holt', sort: 'Adeyo-Holt, Wren' },
  { id: 10, name: 'Soren Ilves', sort: 'Ilves, Soren' },
] as const;

export const SERIES = [
  { id: 1, name: 'Amber Road', first: 2, count: 8, authorId: 2 },
  { id: 2, name: 'Glass Orchard', first: 10, count: 7, authorId: 3 },
  { id: 3, name: 'Northbound', first: 17, count: 20, authorId: 4 },
  { id: 4, name: 'Tidewater Cycle', first: 37, count: 6, authorId: 1 },
] as const;

export const TAGS = [
  { id: 1, name: 'sea' },
  { id: 2, name: 'cities' },
  { id: 3, name: 'memoir' },
  { id: 4, name: 'essays' },
  { id: 5, name: 'maps' },
  { id: 6, name: 'winter' },
  { id: 7, name: 'letters' },
  { id: 8, name: 'craft' },
] as const;

const PUBLISHERS = [
  { id: 1, name: 'Lowtide Press' },
  { id: 2, name: 'Paper Lantern Books' },
] as const;

export const PLATFORMS = [
  { key: 'kobo', name: 'Kobo' },
  { key: 'notebooklm', name: 'NotebookLM' },
  { key: 'readwise-reader', name: 'Readwise Reader' },
] as const;

export const SEED_DELIVERIES = [
  { bookId: 1, platform: 'kobo' },
  { bookId: 2, platform: 'kobo' },
  { bookId: 3, platform: 'kobo' },
  { bookId: 38, platform: 'kobo' },
  { bookId: 1, platform: 'notebooklm' },
  { bookId: 17, platform: 'notebooklm' },
  { bookId: 44, platform: 'readwise-reader' },
] as const;

const SEED_DELIVERED_AT = '2026-09-01T08:30:00.000Z';

const ADJECTIVES = [
  'Amber',
  'Quiet',
  'Salt',
  'Lantern',
  'Copper',
  'Hollow',
  'Winter',
  'Paper',
  'Iron',
  'Silver',
  'Glass',
  'Tidal',
  'Northern',
  'Ember',
  'Harbour',
  'Linen',
  'Cinder',
  'Juniper',
  'Moss',
  'Signal',
];
const NOUNS = [
  'Archive',
  'Crossing',
  'Ledger',
  'Orchard',
  'Lighthouse',
  'Almanac',
  'Atlas',
  'Tidepool',
  'Station',
  'Garden',
  'Weather',
  'Letters',
  'Bridge',
  'Market',
  'River',
  'Choir',
  'Map',
  'Engine',
  'Gate',
  'Season',
];

const OVERRIDES: Record<number, Partial<SeedBook> & { title: string }> = {
  1: {
    title: 'The Salt Archive',
    formats: ['EPUB', 'PDF'],
    rating: 10,
    description:
      '<p>A made-up archive of salt, tides and borrowed letters.</p>',
  },
  44: { title: '霧中的書店', authorIds: [8], language: 'zho' },
  45: { title: '海港來信', authorIds: [8], language: 'zho' },
  46: { title: 'Ledger of Small Winds', formats: ['PDF'] },
  47: { title: 'Two Clocks at Low Water', authorIds: [2, 3] },
  48: { title: 'The Lamplighter’s Year' },
};

const STANDALONE_AUTHORS = [5, 6, 7, 9, 10, 1, 2, 3];

const CALIBRE_DDL = `
CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT NOT NULL, sort TEXT,
  timestamp TEXT, pubdate TEXT, series_index REAL, author_sort TEXT,
  path TEXT NOT NULL DEFAULT '', has_cover INTEGER DEFAULT 0, uuid TEXT,
  last_modified TEXT);
CREATE TABLE authors (id INTEGER PRIMARY KEY, name TEXT, sort TEXT, link TEXT DEFAULT '');
CREATE TABLE books_authors_link (id INTEGER PRIMARY KEY, book INTEGER, author INTEGER);
CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT UNIQUE);
CREATE TABLE books_tags_link (id INTEGER PRIMARY KEY, book INTEGER, tag INTEGER);
CREATE TABLE series (id INTEGER PRIMARY KEY, name TEXT, sort TEXT);
CREATE TABLE books_series_link (id INTEGER PRIMARY KEY, book INTEGER, series INTEGER);
CREATE TABLE data (id INTEGER PRIMARY KEY, book INTEGER, format TEXT,
  uncompressed_size INTEGER DEFAULT 0, name TEXT);
CREATE TABLE ratings (id INTEGER PRIMARY KEY, rating INTEGER);
CREATE TABLE books_ratings_link (id INTEGER PRIMARY KEY, book INTEGER, rating INTEGER);
CREATE TABLE publishers (id INTEGER PRIMARY KEY, name TEXT, sort TEXT);
CREATE TABLE books_publishers_link (id INTEGER PRIMARY KEY, book INTEGER, publisher INTEGER);
CREATE TABLE languages (id INTEGER PRIMARY KEY, lang_code TEXT);
CREATE TABLE books_languages_link (id INTEGER PRIMARY KEY, book INTEGER,
  lang_code INTEGER, item_order INTEGER DEFAULT 0);
CREATE TABLE comments (id INTEGER PRIMARY KEY, book INTEGER, text TEXT);
`;

const APP_DDL = `
CREATE TABLE IF NOT EXISTS delivery_platforms (
  id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS book_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT, book_id INTEGER NOT NULL,
  platform_id INTEGER NOT NULL, added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note TEXT, external_ref TEXT,
  FOREIGN KEY (platform_id) REFERENCES delivery_platforms(id));
`;

const pad = (n: number) => String(n).padStart(2, '0');

export function titleSort(title: string): string {
  const match = /^(The|A|An) (.+)$/.exec(title);
  return match ? `${match[2]}, ${match[1]}` : title;
}

function generatedTitle(id: number): string {
  const i = id - 1;
  const base = `The ${ADJECTIVES[i % 20]} ${NOUNS[(7 * i + Math.floor(i / 20)) % 20]}`;
  return id > 70 ? `${base}, Volume ${Math.floor(i / 20) + 1}` : base;
}

function tagsFor(id: number): number[] {
  if (id % 3 === 0) return [(id % 8) + 1, ((id + 3) % 8) + 1];
  if (id % 3 === 1) return [(id % 8) + 1];
  return [];
}

function makeBook(id: number): SeedBook {
  const series =
    id <= 70
      ? SERIES.find((s) => id >= s.first && id < s.first + s.count)
      : undefined;
  const override = OVERRIDES[id];
  const title = override?.title ?? generatedTitle(id);
  return {
    id,
    title,
    sort: titleSort(title),
    authorIds: override?.authorIds ?? [
      series?.authorId ?? STANDALONE_AUTHORS[id % STANDALONE_AUTHORS.length],
    ],
    seriesId: series?.id ?? null,
    seriesIndex: series ? id - series.first + 1 : null,
    tagIds: tagsFor(id),
    formats: override?.formats ?? (id % 5 === 0 ? ['EPUB', 'PDF'] : ['EPUB']),
    pubdate: `${1988 + (id % 37)}-${pad((id % 12) + 1)}-15T00:00:00+00:00`,
    added: `2026-${pad((id % 9) + 1)}-${pad((id % 28) + 1)}T10:00:00+00:00`,
    rating: override?.rating ?? (id % 4 === 0 ? (id % 10) + 1 : null),
    publisherId: id % 2 === 0 ? 1 : 2,
    language: override?.language ?? 'eng',
    description:
      override?.description ??
      (id % 10 === 3
        ? `<p>A made-up book, number ${id} in the fixture library.</p>`
        : null),
  };
}

export function fixtureSize(): FixtureSize {
  return process.env['CALIBRE_FIXTURE'] === 'large' ? 'large' : 'small';
}

export function libraryFor(size: FixtureSize): SeedBook[] {
  const books = Array.from({ length: size === 'large' ? 250 : 70 }, (_, i) =>
    makeBook(i + 1),
  );
  if (new Set(books.map((b) => b.title)).size !== books.length) {
    throw new Error('Fixture titles must be unique');
  }
  return books;
}

export const BOOKS = libraryFor(fixtureSize());

export function bookById(id: number): SeedBook {
  const book = BOOKS.find((b) => b.id === id);
  if (!book) throw new Error(`No fixture book ${id}`);
  return book;
}

export function authorName(id: number): string {
  const author = AUTHORS.find((a) => a.id === id);
  if (!author) throw new Error(`No fixture author ${id}`);
  return author.name;
}

export function tagName(id: number): string {
  const tag = TAGS.find((t) => t.id === id);
  if (!tag) throw new Error(`No fixture tag ${id}`);
  return tag.name;
}

const bookDir = (id: number) => `book-${id}`;

function seedCalibre(books: SeedBook[]): void {
  const db = new Database(METADATA_DB_PATH);
  try {
    db.exec(CALIBRE_DDL);
    const stamp = new Date().toISOString();
    const run = (sql: string, rows: ReadonlyArray<readonly unknown[]>) => {
      const stmt = db.prepare(sql);
      for (const row of rows) stmt.run(...row);
    };
    db.transaction(() => {
      run(
        'INSERT INTO authors (id, name, sort) VALUES (?, ?, ?)',
        AUTHORS.map((a) => [a.id, a.name, a.sort]),
      );
      run(
        'INSERT INTO series (id, name, sort) VALUES (?, ?, ?)',
        SERIES.map((s) => [s.id, s.name, s.name]),
      );
      run(
        'INSERT INTO tags (id, name) VALUES (?, ?)',
        TAGS.map((t) => [t.id, t.name]),
      );
      run(
        'INSERT INTO publishers (id, name, sort) VALUES (?, ?, ?)',
        PUBLISHERS.map((p) => [p.id, p.name, p.name]),
      );
      run('INSERT INTO languages (id, lang_code) VALUES (?, ?)', [
        [1, 'eng'],
        [2, 'zho'],
      ]);
      run(
        'INSERT INTO ratings (id, rating) VALUES (?, ?)',
        Array.from({ length: 10 }, (_, i) => [i + 1, i + 1]),
      );
      run(
        `INSERT INTO books (id, title, sort, timestamp, pubdate, series_index,
           author_sort, path, has_cover, uuid, last_modified)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        books.map((b) => [
          b.id,
          b.title,
          b.sort,
          b.added,
          b.pubdate,
          b.seriesIndex,
          b.authorIds
            .map((id) => AUTHORS.find((a) => a.id === id)?.sort ?? '')
            .join(' & '),
          bookDir(b.id),
          `fixture-${b.id}`,
          stamp,
        ]),
      );
      run(
        'INSERT INTO books_authors_link (book, author) VALUES (?, ?)',
        books.flatMap((b) => b.authorIds.map((a) => [b.id, a])),
      );
      run(
        'INSERT INTO books_series_link (book, series) VALUES (?, ?)',
        books.flatMap((b) => (b.seriesId ? [[b.id, b.seriesId]] : [])),
      );
      run(
        'INSERT INTO books_tags_link (book, tag) VALUES (?, ?)',
        books.flatMap((b) => b.tagIds.map((t) => [b.id, t])),
      );
      run(
        'INSERT INTO data (book, format, uncompressed_size, name) VALUES (?, ?, ?, ?)',
        books.flatMap((b) =>
          b.formats.map((f) => [
            b.id,
            f,
            2048 * ((b.id % 7) + 1),
            bookDir(b.id),
          ]),
        ),
      );
      run(
        'INSERT INTO books_ratings_link (book, rating) VALUES (?, ?)',
        books.flatMap((b) => (b.rating ? [[b.id, b.rating]] : [])),
      );
      run(
        'INSERT INTO books_publishers_link (book, publisher) VALUES (?, ?)',
        books.map((b) => [b.id, b.publisherId]),
      );
      run(
        'INSERT INTO books_languages_link (book, lang_code) VALUES (?, ?)',
        books.map((b) => [b.id, b.language === 'zho' ? 2 : 1]),
      );
      run(
        'INSERT INTO comments (book, text) VALUES (?, ?)',
        books.flatMap((b) => (b.description ? [[b.id, b.description]] : [])),
      );
    })();
  } finally {
    db.close();
  }
}

function writeBookFiles(books: SeedBook[]): void {
  for (const book of books) {
    const dir = path.join(FIXTURES_DIR, bookDir(book.id));
    fs.mkdirSync(dir, { recursive: true });
    for (const format of book.formats) {
      fs.writeFileSync(
        path.join(dir, `${bookDir(book.id)}.${format.toLowerCase()}`),
        `made-up ${format} for fixture book ${book.id}\n`,
      );
    }
  }
}

export function resetDeliveries(db: Database.Database): void {
  db.prepare('DELETE FROM book_deliveries').run();
  const insert = db.prepare(
    `INSERT INTO book_deliveries (book_id, platform_id, added_at)
     SELECT ?, id, ? FROM delivery_platforms WHERE key = ?`,
  );
  for (const d of SEED_DELIVERIES) {
    insert.run(d.bookId, SEED_DELIVERED_AT, d.platform);
  }
}

function seedApp(): void {
  const db = new Database(APP_DB_PATH);
  try {
    db.exec(APP_DDL);
    const insert = db.prepare(
      'INSERT OR IGNORE INTO delivery_platforms (key, name) VALUES (?, ?)',
    );
    for (const p of PLATFORMS) insert.run(p.key, p.name);
    resetDeliveries(db);
  } finally {
    db.close();
  }
}

export function seedFixtures(size: FixtureSize): void {
  fs.rmSync(FIXTURES_DIR, { recursive: true, force: true });
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  const books = libraryFor(size);
  seedCalibre(books);
  writeBookFiles(books);
  seedApp();
}
```

Replace `apps/personal-calibre-e2e/src/support/global-setup.ts`:

```ts
import { FIXTURES_DIR, fixtureSize, seedFixtures } from './seed';

export default function globalSetup(): void {
  if (process.env['CALIBRE_SKIP_SEED'] === '1') return;
  const size = fixtureSize();
  seedFixtures(size);
  console.log(`[e2e] ${size} fixture library at ${FIXTURES_DIR}`);
}
```

Replace `apps/personal-calibre-e2e/src/support/reset-db.ts`:

```ts
import fs from 'node:fs';

import Database from 'better-sqlite3';

import { APP_DB_PATH, resetDeliveries } from './seed';

export function resetAppDb(): void {
  if (!fs.existsSync(APP_DB_PATH)) return;
  const db = new Database(APP_DB_PATH);
  try {
    resetDeliveries(db);
  } finally {
    db.close();
  }
}
```

Create `apps/personal-calibre-e2e/src/support/library.ts`:

```ts
import { type BrowserContext, expect, type Page } from '@playwright/test';

export const BASE_URL = process.env['BASE_URL'] ?? 'http://localhost:3333';
export const PREFS_COOKIE = 'calibre-prefs';
export const FAULT_COOKIE = 'calibre-e2e-fault';

export async function gotoLibrary(page: Page, url = '/'): Promise<void> {
  await page.goto(url);
  await expect(page.locator('[data-library-ready]')).toHaveCount(1);
}

export async function readPrefs(
  context: BrowserContext,
): Promise<Record<string, unknown> | null> {
  const cookie = (await context.cookies()).find((c) => c.name === PREFS_COOKIE);
  return cookie
    ? (JSON.parse(decodeURIComponent(cookie.value)) as Record<string, unknown>)
    : null;
}

export async function setPrefs(
  context: BrowserContext,
  prefs: { view?: string; panel?: boolean; renderer?: string },
): Promise<void> {
  const value = { view: 'shelf', panel: true, renderer: 'three-tsl', ...prefs };
  await context.addCookies([
    {
      name: PREFS_COOKIE,
      value: encodeURIComponent(JSON.stringify(value)),
      url: BASE_URL,
    },
  ]);
}

export function options(page: Page) {
  return page.getByRole('listbox', { name: 'Books' }).getByRole('option');
}

export function pane(page: Page) {
  return page.getByRole('complementary', { name: 'Book details' });
}

export async function tokenColor(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('div');
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, token);
}
```

Replace `apps/personal-calibre-e2e/playwright.config.ts`:

```ts
import { workspaceRoot } from '@nx/devkit';
import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';

import { APP_DB_PATH, FIXTURES_DIR } from './src/support/seed';

const PORT = 3333;
const externalServer = process.env['BASE_URL'];
const baseURL = externalServer ?? `http://localhost:${PORT}`;

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  fullyParallel: false,
  workers: 1,
  use: { baseURL, trace: 'on-first-retry' },
  globalSetup: './src/support/global-setup.ts',
  webServer: externalServer
    ? undefined
    : {
        command: `pnpm exec nx dev personal-calibre --port=${PORT}`,
        url: `http://localhost:${PORT}/favicon.ico`,
        reuseExistingServer: false,
        timeout: 180_000,
        cwd: workspaceRoot,
        env: {
          CALIBRE_LIBRARY_PATH: FIXTURES_DIR,
          CALIBRE_APP_DB_PATH: APP_DB_PATH,
          CALIBRE_E2E: '1',
        },
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /\.phone\.spec\.ts$/,
    },
    {
      name: 'phone',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
      testMatch: /\.phone\.spec\.ts$/,
    },
  ],
});
```

Delete the old specs:

```bash
git rm apps/personal-calibre-e2e/src/book-detail.spec.ts \
  apps/personal-calibre-e2e/src/book-list.spec.ts \
  apps/personal-calibre-e2e/src/bulk-delivery.spec.ts \
  apps/personal-calibre-e2e/src/example.spec.ts \
  apps/personal-calibre-e2e/src/filter.spec.ts \
  apps/personal-calibre-e2e/src/group-by.spec.ts \
  apps/personal-calibre-e2e/src/search.spec.ts \
  apps/personal-calibre-e2e/src/tag-editing.spec.ts
```

- [ ] **Step 4: Run the fixture test to verify it passes**

Run: `pnpm nx e2e personal-calibre-e2e -- --grep "fixture library"`
Expected: PASS (3 tests). `git status --short` shows no untracked files under
`apps/personal-calibre-e2e/src/`. Clear port 3333.

- [ ] **Step 5: Capture the before state**

Create `apps/personal-calibre-e2e/src/visual.spec.ts`:

```ts
import path from 'node:path';

import { expect, type Page, test } from '@playwright/test';

const PHASE = process.env['CALIBRE_VISUAL'];
const OUT = path.join(__dirname, '..', 'test-output', 'visual');
const SCHEMES = ['light', 'dark'] as const;
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, isMobile: false, scale: 1 },
  { name: 'phone', width: 390, height: 844, isMobile: true, scale: 2 },
] as const;

interface Surface {
  name: string;
  url: string;
  afterOnly?: true;
  phoneOnly?: true;
  act?: (page: Page, phone: boolean) => Promise<void>;
}

const SURFACES: Surface[] = [
  { name: 'library', url: '/' },
  { name: 'grouped', url: '/?groupBy=series' },
  { name: 'page-2', url: '/?page=2' },
  { name: 'book', url: '/books/38' },
  { name: 'pane', url: '/?book=38', afterOnly: true },
  { name: 'catalogue', url: '/?view=catalogue', afterOnly: true },
  { name: 'catalogue-pane', url: '/?view=catalogue&book=38', afterOnly: true },
  {
    name: 'selection',
    url: '/',
    afterOnly: true,
    act: async (page, phone) => {
      const tiles = page
        .getByRole('listbox', { name: 'Books' })
        .getByRole('option');
      if (phone) {
        await page.getByRole('button', { name: 'Select', exact: true }).click();
        await tiles.nth(0).click();
        await tiles.nth(1).click();
      } else {
        await tiles.nth(0).focus();
        await page.keyboard.press('x');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('x');
      }
    },
  },
  {
    name: 'filters-sheet',
    url: '/',
    afterOnly: true,
    phoneOnly: true,
    act: async (page) => {
      await page.getByRole('button', { name: /^Filters/ }).click();
      await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible();
    },
  },
];

test.skip(
  PHASE !== 'before' && PHASE !== 'after',
  'captures run with CALIBRE_VISUAL=before or CALIBRE_VISUAL=after',
);
test.describe.configure({ mode: 'serial' });

const settle = async (page: Page) => {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
};

for (const scheme of SCHEMES) {
  for (const vp of VIEWPORTS) {
    test.describe(`visual ${scheme} ${vp.name}`, () => {
      test.use({
        colorScheme: scheme,
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile,
        hasTouch: vp.isMobile,
        deviceScaleFactor: vp.scale,
      });
      for (const surface of SURFACES) {
        test(surface.name, async ({ page }) => {
          test.skip(PHASE === 'before' && !!surface.afterOnly, 'after-only');
          test.skip(!!surface.phoneOnly && !vp.isMobile, 'phone-only');
          await page.goto(surface.url);
          await settle(page);
          await surface.act?.(page, vp.isMobile);
          await settle(page);
          await page.screenshot({
            path: path.join(
              OUT,
              `${PHASE}-${surface.name}-${scheme}-${vp.width}.png`,
            ),
            fullPage: true,
          });
        });
      }
    });
  }
}
```

Run: `CALIBRE_VISUAL=before pnpm nx e2e personal-calibre-e2e -- --grep "visual"`
Expected: PASS; 16 files `apps/personal-calibre-e2e/test-output/visual/before-*.png` (4 surfaces ×
2 schemes × 2 widths). Read `before-library-light-1440.png` and `before-book-dark-390.png` and
confirm they show the old UI with the made-up titles, not an error page. These files are
gitignored and never committed. Clear port 3333.

- [ ] **Step 6: Add Vitest and the typecheck target**

Create `apps/personal-calibre/vitest.config.ts`:

```ts
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

Create `apps/personal-calibre/src/lib/files.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { resolveFilePath, staticDownloadUrl } from './files';

describe('staticDownloadUrl', () => {
  it('encodes each path segment and lowercases the extension', () => {
    expect(
      staticDownloadUrl(
        'Mara Ostrand/The Salt Archive (1)',
        'The Salt Archive',
        'EPUB',
      ),
    ).toBe(
      '/files/Mara%20Ostrand/The%20Salt%20Archive%20(1)/The%20Salt%20Archive.epub',
    );
  });
});

describe('resolveFilePath', () => {
  it('resolves a file inside the library', () => {
    expect(resolveFilePath('/library', 'book-1', 'book-1', 'PDF')).toBe(
      '/library/book-1/book-1.pdf',
    );
  });

  it('rejects a path that leaves the library', () => {
    expect(() =>
      resolveFilePath('/library', '../etc', 'passwd', 'txt'),
    ).toThrow('Path traversal detected');
  });
});
```

In `apps/personal-calibre/package.json`, add to `nx.targets` (next to `dev` and `build`):

```json
"typecheck": {
  "executor": "nx:run-commands",
  "options": {
    "cwd": "apps/personal-calibre",
    "command": "tsc --noEmit -p tsconfig.json"
  },
  "dependsOn": ["^build"]
}
```

Run: `pnpm nx test personal-calibre`
Expected: PASS, 3 tests in `src/lib/files.test.ts` (Vitest 4.1.4 from the root; no app pin).
Run: `pnpm nx typecheck personal-calibre`
Expected: PASS.

- [ ] **Step 7: Lint, types and comment audit**

Run: `pnpm nx run-many -t lint -p personal-calibre personal-calibre-e2e`
Run: `pnpm nx typecheck personal-calibre-e2e`
Run: `git diff -U0 HEAD | grep -E '^\+\s*(//|/\*|\*|#|\{/\*)'`
Expected: PASS; no comment hits.

- [ ] **Step 8: Commit**

```bash
git add apps/personal-calibre-e2e/playwright.config.ts \
  apps/personal-calibre-e2e/src/support/seed.ts \
  apps/personal-calibre-e2e/src/support/global-setup.ts \
  apps/personal-calibre-e2e/src/support/reset-db.ts \
  apps/personal-calibre-e2e/src/support/library.ts \
  apps/personal-calibre-e2e/src/visual.spec.ts \
  apps/personal-calibre-e2e/src/fixtures.spec.ts \
  apps/personal-calibre/vitest.config.ts \
  apps/personal-calibre/src/lib/files.test.ts \
  apps/personal-calibre/package.json
git commit -m "$(cat <<'EOF'
test(personal-calibre): made-up fixtures, a working e2e harness and Vitest

The e2e webServer waited on port 3333 while nx started next dev on 8080,
and the seed held real titles. The seed is now a made-up library of 70
books (250 with CALIBRE_FIXTURE=large) under test-output.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm
EOF
)"
```

The `git rm` from step 3 is already staged and goes into this commit.

---

### Task 2: Data layer: `getLibrary`, URL params, grouping and prefs

**Files:**

- Modify: `apps/personal-calibre/src/types/calibre.ts` (append)
- Create: `apps/personal-calibre/src/lib/book-query.ts` (moved code)
- Modify: `apps/personal-calibre/src/lib/queries.ts:1-256` (imports, moved helpers removed,
  `getLibrary` and `getLibraryBook` added)
- Create: `apps/personal-calibre/src/lib/library-query.ts`
- Create: `apps/personal-calibre/src/lib/library-query.test.ts`
- Create: `apps/personal-calibre/src/test/calibre-db.ts`
- Create: `apps/personal-calibre/src/lib/library-params.ts`
- Create: `apps/personal-calibre/src/lib/library-params.test.ts`
- Create: `apps/personal-calibre/src/lib/group-entries.ts`
- Create: `apps/personal-calibre/src/lib/group-entries.test.ts`
- Create: `apps/personal-calibre/src/lib/prefs.ts`
- Create: `apps/personal-calibre/src/lib/prefs.test.ts`

**Interfaces:**

- Consumes: `BookSummary`, `FilterOptions` (`src/types/calibre.ts`), `DeliveryPlatform`
  (`src/types/delivery.ts`), `db`, `appDb`, `sqlite` (`src/db/client.ts`).
- Produces:
  - Types: `LibraryBook extends BookSummary { seriesId: number | null; authorIds: number[];
tags: Array<{ id: number; name: string }>; pubdate: string | null }`;
    `EntryGroupRef { key: string; label: string; total: number; offset: number; id: number | null }`;
    `LibraryEntry { book: LibraryBook; group?: EntryGroupRef }`;
    `LibraryResult { entries: LibraryEntry[]; page: number; pageCount: number; matching: number;
libraryTotal: number; matchingIds: number[] }`.
  - `src/lib/library-query.ts`: `interface LibraryQuery`, `queryLibrary(query): Promise<LibraryResult>`,
    `hydrateLibraryBooks(ids): Promise<LibraryBook[]>`.
  - `src/lib/queries.ts`: `getLibrary(query: LibraryQuery): Promise<LibraryResult>`,
    `getLibraryBook(id: number): Promise<LibraryBook | null>`.
  - `src/lib/library-params.ts`: `PAGE_SIZE = 30`, `GROUP_BYS`, `type GroupBy`, `SORT_BYS`,
    `type SortBy`, `type SortDir`, `interface LibraryParams`, `type RawSearchParams`,
    `type SearchParamsInput`, `interface ParamPatch`, `toSearchParams`, `parseLibraryParams`,
    `buildLibraryHref(current, patch): string`, `clearFiltersHref(current): string`,
    `filterCount(params)`, `hasFilters(params)`, `interface FilterLabels`,
    `interface ActiveFilter`, `activeFilters(params, labels)`, `scopeTitle(params, labels)`,
    `toLibraryQuery(params, pageSize): LibraryQuery`.
  - `src/lib/group-entries.ts`: `interface EntryGroup { key; label; total; continued; filter:
{ param: GroupBy; id: number } | null; entries: LibraryEntry[] }`,
    `groupEntries(entries, groupBy): EntryGroup[]`, `groupTitle(group): string`,
    `navKey(entry): string`, `bookIdOfNavKey(key): number`, `contentKey(entries): string`,
    `booksLabel(n): string`.
  - `src/lib/prefs.ts`: `VIEWS`, `type View`, `ENABLED_VIEWS`, `VIEW_LABELS`, `RENDERERS`,
    `type Renderer`, `PREFS_COOKIE`, `interface Prefs`, `DEFAULT_PREFS`, `isView`, `parsePrefs`,
    `resolveView`, `resolveRenderer`, `nextView`, `serializePrefs`.

- [ ] **Step 1: Write the failing unit tests**

Create `apps/personal-calibre/src/test/calibre-db.ts`:

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';

export interface TestBook {
  id: number;
  title: string;
  authorIds: number[];
  seriesId?: number;
  seriesIndex?: number;
  tagIds?: number[];
  pubdate?: string;
}

export interface TestLibrary {
  authors: Array<[number, string, string]>;
  series: Array<[number, string]>;
  tags: Array<[number, string]>;
  books: TestBook[];
}

const DDL = `
CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT NOT NULL, sort TEXT,
  timestamp TEXT, pubdate TEXT, series_index REAL, author_sort TEXT,
  path TEXT NOT NULL DEFAULT '', has_cover INTEGER DEFAULT 0, uuid TEXT,
  last_modified TEXT);
CREATE TABLE authors (id INTEGER PRIMARY KEY, name TEXT, sort TEXT, link TEXT DEFAULT '');
CREATE TABLE books_authors_link (id INTEGER PRIMARY KEY, book INTEGER, author INTEGER);
CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT UNIQUE);
CREATE TABLE books_tags_link (id INTEGER PRIMARY KEY, book INTEGER, tag INTEGER);
CREATE TABLE series (id INTEGER PRIMARY KEY, name TEXT, sort TEXT);
CREATE TABLE books_series_link (id INTEGER PRIMARY KEY, book INTEGER, series INTEGER);
CREATE TABLE data (id INTEGER PRIMARY KEY, book INTEGER, format TEXT,
  uncompressed_size INTEGER DEFAULT 0, name TEXT);
CREATE TABLE ratings (id INTEGER PRIMARY KEY, rating INTEGER);
CREATE TABLE books_ratings_link (id INTEGER PRIMARY KEY, book INTEGER, rating INTEGER);
`;

export function createCalibreDb(library: TestLibrary): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'calibre-test-'));
  const db = new Database(path.join(dir, 'metadata.db'));
  try {
    db.exec(DDL);
    for (const [id, name, sort] of library.authors) {
      db.prepare('INSERT INTO authors (id, name, sort) VALUES (?, ?, ?)').run(
        id,
        name,
        sort,
      );
    }
    for (const [id, name] of library.series) {
      db.prepare('INSERT INTO series (id, name, sort) VALUES (?, ?, ?)').run(
        id,
        name,
        name,
      );
    }
    for (const [id, name] of library.tags) {
      db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)').run(id, name);
    }
    for (const book of library.books) {
      db.prepare(
        `INSERT INTO books (id, title, sort, pubdate, series_index, path, last_modified)
         VALUES (?, ?, ?, ?, ?, ?, '2026-01-01T00:00:00+00:00')`,
      ).run(
        book.id,
        book.title,
        book.title,
        book.pubdate ?? null,
        book.seriesIndex ?? null,
        `b${book.id}`,
      );
      for (const author of book.authorIds) {
        db.prepare(
          'INSERT INTO books_authors_link (book, author) VALUES (?, ?)',
        ).run(book.id, author);
      }
      if (book.seriesId) {
        db.prepare(
          'INSERT INTO books_series_link (book, series) VALUES (?, ?)',
        ).run(book.id, book.seriesId);
      }
      for (const tag of book.tagIds ?? []) {
        db.prepare('INSERT INTO books_tags_link (book, tag) VALUES (?, ?)').run(
          book.id,
          tag,
        );
      }
      db.prepare(
        "INSERT INTO data (book, format, name) VALUES (?, 'EPUB', ?)",
      ).run(book.id, `b${book.id}`);
    }
  } finally {
    db.close();
  }
  return dir;
}
```

Create `apps/personal-calibre/src/lib/library-query.test.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createCalibreDb } from '@/test/calibre-db';

import {
  hydrateLibraryBooks,
  type LibraryQuery,
  queryLibrary,
} from './library-query';

let dir = '';

beforeAll(() => {
  dir = createCalibreDb({
    authors: [
      [1, 'Mara Ostrand', 'Ostrand, Mara'],
      [2, 'Tobiah Quell', 'Quell, Tobiah'],
    ],
    series: [
      [1, 'Amber Road'],
      [2, 'Northbound'],
    ],
    tags: [
      [1, 'sea'],
      [2, 'winter'],
    ],
    books: [
      {
        id: 1,
        title: 'Brine and Bell',
        authorIds: [1],
        seriesId: 1,
        seriesIndex: 2,
        tagIds: [1, 2],
      },
      {
        id: 2,
        title: 'Cold Lantern',
        authorIds: [1],
        seriesId: 1,
        seriesIndex: 1,
      },
      {
        id: 3,
        title: 'Driftwood Hours',
        authorIds: [2],
        seriesId: 1,
        seriesIndex: 3,
      },
      {
        id: 4,
        title: 'Ferry at Dusk',
        authorIds: [2],
        seriesId: 2,
        seriesIndex: 1,
        tagIds: [1],
      },
      {
        id: 5,
        title: 'Gull Weather',
        authorIds: [2],
        seriesId: 2,
        seriesIndex: 2,
      },
      { id: 6, title: 'Harbour Ledger', authorIds: [1], tagIds: [1] },
      { id: 7, title: 'Iron Tide Almanac', authorIds: [2], tagIds: [2] },
      { id: 8, title: 'Juniper Signal', authorIds: [] },
      {
        id: 9,
        title: 'Kelp Forest Letters',
        authorIds: [2, 1],
        pubdate: '2001-04-15T00:00:00+00:00',
      },
    ],
  });
  process.env.CALIBRE_LIBRARY_PATH = dir;
  process.env.CALIBRE_APP_DB_PATH = path.join(dir, 'app.db');
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const base: LibraryQuery = {
  page: 1,
  pageSize: 4,
  sortBy: 'title',
  sortDir: 'asc',
};
const ids = (r: Awaited<ReturnType<typeof queryLibrary>>) =>
  r.entries.map((e) => e.book.id);

describe('queryLibrary, ungrouped', () => {
  it('pages books in title order and counts the whole library', async () => {
    const result = await queryLibrary(base);
    expect(ids(result)).toEqual([1, 2, 3, 4]);
    expect(result).toMatchObject({
      page: 1,
      pageCount: 3,
      matching: 9,
      libraryTotal: 9,
      matchingIds: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    });
    expect(result.entries[0]?.group).toBeUndefined();
  });

  it('reverses the order with sortDir desc', async () => {
    expect(ids(await queryLibrary({ ...base, sortDir: 'desc' }))).toEqual([
      9, 8, 7, 6,
    ]);
  });

  it('returns an empty page past the end with the real page count', async () => {
    const result = await queryLibrary({ ...base, page: 5 });
    expect(result.entries).toEqual([]);
    expect(result.pageCount).toBe(3);
  });

  it('filters before paging', async () => {
    const result = await queryLibrary({ ...base, tagId: 1 });
    expect(ids(result)).toEqual([1, 4, 6]);
    expect(result).toMatchObject({
      matching: 3,
      libraryTotal: 9,
      matchingIds: [1, 4, 6],
    });
  });
});

describe('queryLibrary, grouped', () => {
  it('orders series by name, books by series index, and pages over entries', async () => {
    const page1 = await queryLibrary({ ...base, groupBy: 'series' });
    expect(ids(page1)).toEqual([2, 1, 3, 4]);
    expect(page1.entries[0]?.group).toEqual({
      key: 'series:1',
      label: 'Amber Road',
      total: 3,
      offset: 0,
      id: 1,
    });
    expect(page1).toMatchObject({ pageCount: 3, matching: 9 });

    const page2 = await queryLibrary({ ...base, groupBy: 'series', page: 2 });
    expect(ids(page2)).toEqual([5, 6, 7, 8]);
    expect(page2.entries[0]?.group).toMatchObject({
      key: 'series:2',
      offset: 1,
      total: 2,
    });
    expect(page2.entries[1]?.group).toEqual({
      key: 'series:none',
      label: 'No series',
      total: 4,
      offset: 0,
      id: null,
    });

    const page3 = await queryLibrary({ ...base, groupBy: 'series', page: 3 });
    expect(ids(page3)).toEqual([9]);
    expect(page3.entries[0]?.group).toMatchObject({
      key: 'series:none',
      offset: 3,
    });
  });

  it('lists a book once per tag, puts Untagged last, and counts the book once', async () => {
    const result = await queryLibrary({
      ...base,
      pageSize: 20,
      groupBy: 'tag',
    });
    expect(result.entries.map((e) => `${e.group?.key}:${e.book.id}`)).toEqual([
      'tag:1:1',
      'tag:1:4',
      'tag:1:6',
      'tag:2:1',
      'tag:2:7',
      'tag:none:2',
      'tag:none:3',
      'tag:none:5',
      'tag:none:8',
      'tag:none:9',
    ]);
    expect(result.matching).toBe(10);
    expect(result.matchingIds).toHaveLength(9);
    expect(result.entries.at(-1)?.group?.label).toBe('Untagged');
  });

  it('groups by author with No author last', async () => {
    const result = await queryLibrary({
      ...base,
      pageSize: 20,
      groupBy: 'author',
    });
    expect(result.entries.at(-1)?.group).toMatchObject({
      key: 'author:none',
      label: 'No author',
    });
    expect(result.entries.filter((e) => e.book.id === 9)).toHaveLength(2);
  });

  it('applies filters before grouping', async () => {
    const result = await queryLibrary({ ...base, groupBy: 'series', tagId: 1 });
    expect(result.entries.map((e) => `${e.group?.key}:${e.book.id}`)).toEqual([
      'series:1:1',
      'series:2:4',
      'series:none:6',
    ]);
  });
});

describe('hydrateLibraryBooks', () => {
  it('pairs authors with ids in link order and adds series, tags and pubdate', async () => {
    const [nine, one] = await hydrateLibraryBooks([9, 1]);
    expect(nine).toMatchObject({
      id: 9,
      authors: ['Tobiah Quell', 'Mara Ostrand'],
      authorIds: [2, 1],
      seriesId: null,
      tags: [],
      pubdate: '2001-04-15T00:00:00+00:00',
    });
    expect(one).toMatchObject({
      id: 1,
      seriesId: 1,
      series: 'Amber Road',
      tags: [
        { id: 1, name: 'sea' },
        { id: 2, name: 'winter' },
      ],
    });
  });
});
```

Create `apps/personal-calibre/src/lib/library-params.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  activeFilters,
  buildLibraryHref,
  clearFiltersHref,
  type FilterLabels,
  filterCount,
  parseLibraryParams,
  scopeTitle,
  toLibraryQuery,
} from './library-params';

const labels: FilterLabels = {
  authors: [{ id: 4, name: 'Oren Halvik', sort: 'Halvik, Oren' }],
  tags: [{ id: 6, name: 'winter' }],
  series: [{ id: 3, name: 'Northbound' }],
  platforms: [{ id: 1, key: 'kobo', name: 'Kobo' }],
};

describe('parseLibraryParams', () => {
  it('reads every param', () => {
    expect(
      parseLibraryParams(
        new URLSearchParams(
          'q=salt&author=4&tag=6&series=3&platform=kobo&delivered=false&groupBy=tag&sortBy=added&sortDir=desc&page=2&book=38',
        ),
      ),
    ).toEqual({
      q: 'salt',
      author: 4,
      tag: 6,
      series: 3,
      platform: 'kobo',
      delivered: false,
      groupBy: 'tag',
      sortBy: 'added',
      sortDir: 'desc',
      page: 2,
      book: 38,
    });
  });

  it('defaults an empty URL', () => {
    expect(parseLibraryParams({})).toEqual({
      q: null,
      author: null,
      tag: null,
      series: null,
      platform: null,
      delivered: null,
      groupBy: null,
      sortBy: 'title',
      sortDir: 'asc',
      page: 1,
      book: null,
    });
  });

  it('ignores malformed values', () => {
    const params = parseLibraryParams({
      page: 'abc',
      author: 'abc',
      tag: '-2',
      series: '0',
      groupBy: 'nope',
      sortBy: 'colour',
      sortDir: 'sideways',
      book: '1.5',
      q: '   ',
    });
    expect(params).toMatchObject({
      page: 1,
      author: null,
      tag: null,
      series: null,
      groupBy: null,
      sortBy: 'title',
      sortDir: 'asc',
      book: null,
      q: null,
    });
    expect(parseLibraryParams({ page: '0' }).page).toBe(1);
  });

  it('reads delivered only with a platform, and absent means On', () => {
    expect(parseLibraryParams({ delivered: 'false' }).delivered).toBeNull();
    expect(parseLibraryParams({ platform: 'kobo' }).delivered).toBe(true);
    expect(
      parseLibraryParams({ platform: 'kobo', delivered: 'false' }).delivered,
    ).toBe(false);
  });

  it('takes the first value of a repeated param', () => {
    expect(parseLibraryParams({ author: ['4', '5'] }).author).toBe(4);
  });
});

describe('buildLibraryHref', () => {
  const current = new URLSearchParams(
    'q=salt&page=3&book=38&view=catalogue&__delay=10',
  );

  it('drops page on a filter, sort or group change and keeps everything else', () => {
    expect(buildLibraryHref(current, { author: 4 })).toBe(
      '/?q=salt&book=38&view=catalogue&__delay=10&author=4',
    );
    expect(buildLibraryHref(current, { sortDir: 'desc' })).toBe(
      '/?q=salt&book=38&view=catalogue&__delay=10&sortDir=desc',
    );
    expect(buildLibraryHref(current, { groupBy: 'series' })).toBe(
      '/?q=salt&book=38&view=catalogue&__delay=10&groupBy=series',
    );
  });

  it('keeps book and every other param on a page change', () => {
    expect(buildLibraryHref(current, { page: 2 })).toBe(
      '/?q=salt&page=2&book=38&view=catalogue&__delay=10',
    );
    expect(buildLibraryHref(current, { page: 1 })).toBe(
      '/?q=salt&book=38&view=catalogue&__delay=10',
    );
  });

  it('opens and closes the pane without touching page', () => {
    expect(buildLibraryHref(new URLSearchParams('page=2'), { book: 7 })).toBe(
      '/?page=2&book=7',
    );
    expect(
      buildLibraryHref(new URLSearchParams('page=2&book=7'), { book: null }),
    ).toBe('/?page=2');
  });

  it('writes defaults as absent params', () => {
    const sp = new URLSearchParams(
      'sortBy=added&sortDir=desc&platform=kobo&delivered=false',
    );
    expect(buildLibraryHref(sp, { sortBy: 'title' })).toBe(
      '/?sortDir=desc&platform=kobo&delivered=false',
    );
    expect(buildLibraryHref(sp, { sortDir: 'asc' })).toBe(
      '/?sortBy=added&platform=kobo&delivered=false',
    );
    expect(buildLibraryHref(sp, { delivered: true })).toBe(
      '/?sortBy=added&sortDir=desc&platform=kobo',
    );
    expect(buildLibraryHref(sp, { q: '  ' })).toBe(
      '/?sortBy=added&sortDir=desc&platform=kobo&delivered=false',
    );
  });

  it('drops delivered with the platform', () => {
    expect(
      buildLibraryHref(new URLSearchParams('platform=kobo&delivered=false'), {
        platform: null,
      }),
    ).toBe('/');
  });

  it('accepts a searchParams record from a server page', () => {
    expect(
      buildLibraryHref(
        { groupBy: 'series', sortDir: 'desc', page: '99' },
        { page: 3 },
      ),
    ).toBe('/?groupBy=series&sortDir=desc&page=3');
  });
});

describe('clearFiltersHref', () => {
  it('removes filters and page, and keeps book, view, groupBy and sort', () => {
    expect(
      clearFiltersHref(
        new URLSearchParams(
          'q=salt&author=4&tag=6&series=3&platform=kobo&delivered=false&page=2&book=38&view=catalogue&groupBy=series&sortDir=desc',
        ),
      ),
    ).toBe('/?book=38&view=catalogue&groupBy=series&sortDir=desc');
  });
});

describe('labels', () => {
  it('counts panel filters, not the search', () => {
    expect(
      filterCount(
        parseLibraryParams({ q: 'salt', author: '4', platform: 'kobo' }),
      ),
    ).toBe(2);
  });

  it('names chips and their removal patches', () => {
    const params = parseLibraryParams({
      q: 'salt',
      series: '3',
      author: '4',
      tag: '6',
      platform: 'kobo',
      delivered: 'false',
    });
    expect(activeFilters(params, labels)).toEqual([
      { key: 'q', label: '"salt"', patch: { q: null } },
      { key: 'series', label: 'Series: Northbound', patch: { series: null } },
      { key: 'author', label: 'Author: Oren Halvik', patch: { author: null } },
      { key: 'tag', label: 'Tag: winter', patch: { tag: null } },
      { key: 'platform', label: 'Not on Kobo', patch: { platform: null } },
    ]);
    expect(
      activeFilters(parseLibraryParams({ tag: '99' }), labels)[0]?.label,
    ).toBe('Tag: #99');
  });

  it('titles the scope by precedence', () => {
    expect(scopeTitle(parseLibraryParams({}), labels)).toBe('All books');
    expect(
      scopeTitle(parseLibraryParams({ q: 'salt', series: '3' }), labels),
    ).toBe('Results for "salt"');
    expect(
      scopeTitle(parseLibraryParams({ series: '3', author: '4' }), labels),
    ).toBe('Northbound');
    expect(scopeTitle(parseLibraryParams({ tag: '6' }), labels)).toBe('winter');
    expect(scopeTitle(parseLibraryParams({ platform: 'kobo' }), labels)).toBe(
      'On Kobo',
    );
    expect(
      scopeTitle(
        parseLibraryParams({ platform: 'kobo', delivered: 'false' }),
        labels,
      ),
    ).toBe('Not on Kobo');
  });

  it('maps params to a library query', () => {
    expect(
      toLibraryQuery(
        parseLibraryParams({ tag: '6', groupBy: 'series', page: '2' }),
        30,
      ),
    ).toEqual({
      q: undefined,
      authorId: undefined,
      tagId: 6,
      seriesId: undefined,
      platformKey: undefined,
      delivered: undefined,
      groupBy: 'series',
      sortBy: 'title',
      sortDir: 'asc',
      page: 2,
      pageSize: 30,
    });
  });
});
```

Create `apps/personal-calibre/src/lib/group-entries.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { LibraryBook, LibraryEntry } from '@/types/calibre';

import {
  bookIdOfNavKey,
  booksLabel,
  contentKey,
  groupEntries,
  groupTitle,
  navKey,
} from './group-entries';

const book = (id: number, title = `Book ${id}`): LibraryBook => ({
  id,
  title,
  authorSort: null,
  hasCover: false,
  seriesIndex: null,
  authors: [],
  series: null,
  formats: ['EPUB'],
  deliveredTo: [],
  seriesId: null,
  authorIds: [],
  tags: [],
  pubdate: null,
});

const entry = (
  id: number,
  key: string,
  label: string,
  total: number,
  offset: number,
): LibraryEntry => ({
  book: book(id),
  group: {
    key,
    label,
    total,
    offset,
    id: key.endsWith(':none') ? null : Number(key.split(':')[1]),
  },
});

describe('groupEntries', () => {
  it('turns consecutive entries into groups', () => {
    const groups = groupEntries(
      [
        entry(1, 'series:1', 'Amber Road', 2, 0),
        entry(2, 'series:1', 'Amber Road', 2, 1),
        entry(3, 'series:3', 'Northbound', 20, 0),
      ],
      'series',
    );
    expect(groups.map((g) => [g.key, g.entries.map((e) => e.book.id)])).toEqual(
      [
        ['series:1', [1, 2]],
        ['series:3', [3]],
      ],
    );
    expect(groups[1]).toMatchObject({
      label: 'Northbound',
      total: 20,
      continued: false,
      filter: { param: 'series', id: 3 },
    });
  });

  it('marks a group that started on an earlier page as continued', () => {
    const [group] = groupEntries(
      [entry(21, 'series:3', 'Northbound', 20, 15)],
      'series',
    );
    expect(group?.continued).toBe(true);
    expect(group && groupTitle(group)).toBe('Northbound (continued)');
  });

  it('puts the fallback group last and gives it no filter', () => {
    const groups = groupEntries(
      [entry(9, 'tag:none', 'Untagged', 1, 0), entry(1, 'tag:1', 'sea', 1, 0)],
      'tag',
    );
    expect(groups.map((g) => g.key)).toEqual(['tag:1', 'tag:none']);
    expect(groups[1]?.filter).toBeNull();
  });

  it('keeps a book that appears under two tags in both groups', () => {
    const groups = groupEntries(
      [entry(3, 'tag:4', 'essays', 1, 0), entry(3, 'tag:7', 'letters', 1, 0)],
      'tag',
    );
    expect(groups.map((g) => g.entries[0]?.book.id)).toEqual([3, 3]);
  });
});

describe('nav keys', () => {
  it('prefixes the group key, or all when ungrouped', () => {
    expect(navKey({ book: book(5) })).toBe('all:5');
    expect(navKey(entry(5, 'tag:7', 'letters', 1, 0))).toBe('tag:7:5');
    expect(bookIdOfNavKey('tag:7:5')).toBe(5);
    expect(bookIdOfNavKey('all:12')).toBe(12);
  });
});

describe('contentKey', () => {
  it('is equal for equal content and changes with a new delivery', () => {
    const a = [{ book: book(1, 'Salt') }];
    const b = [{ book: book(1, 'Salt') }];
    expect(contentKey(a)).toBe(contentKey(b));
    const delivered = [{ book: { ...book(1, 'Salt'), deliveredTo: ['kobo'] } }];
    expect(contentKey(delivered)).not.toBe(contentKey(a));
  });
});

describe('booksLabel', () => {
  it('pluralises', () => {
    expect(booksLabel(1)).toBe('1 book');
    expect(booksLabel(20)).toBe('20 books');
  });
});
```

Create `apps/personal-calibre/src/lib/prefs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PREFS,
  nextView,
  parsePrefs,
  PREFS_COOKIE,
  resolveRenderer,
  resolveView,
  serializePrefs,
} from './prefs';

describe('parsePrefs', () => {
  it('defaults when the cookie is missing or not JSON', () => {
    expect(parsePrefs(undefined)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('{not json')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('"shelf"')).toEqual(DEFAULT_PREFS);
  });

  it('defaults the renderer to three-tsl', () => {
    expect(DEFAULT_PREFS).toEqual({
      view: 'shelf',
      panel: true,
      renderer: 'three-tsl',
    });
  });

  it('keeps good fields and replaces bad ones', () => {
    expect(
      parsePrefs('{"view":"attic","panel":false,"renderer":"webgl9"}'),
    ).toEqual({
      view: 'shelf',
      panel: false,
      renderer: 'three-tsl',
    });
  });

  it('reads an encoded cookie value', () => {
    const raw = encodeURIComponent(
      JSON.stringify({ view: 'catalogue', panel: false, renderer: 'css' }),
    );
    expect(parsePrefs(raw)).toEqual({
      view: 'catalogue',
      panel: false,
      renderer: 'css',
    });
  });
});

describe('resolveView', () => {
  it('lets ?view= override the cookie', () => {
    expect(resolveView('shelf', 'catalogue')).toBe('catalogue');
    expect(resolveView('catalogue', null)).toBe('catalogue');
    expect(resolveView('catalogue', 'nope')).toBe('catalogue');
  });

  it('falls back when a view is not enabled yet', () => {
    expect(resolveView('study', null)).toBe('shelf');
    expect(resolveView('catalogue', 'study')).toBe('catalogue');
    expect(resolveView('study', null, ['shelf', 'catalogue', 'study'])).toBe(
      'study',
    );
  });
});

describe('resolveRenderer', () => {
  it('lets ?renderer= override the cookie', () => {
    expect(resolveRenderer('three-tsl', 'css')).toBe('css');
    expect(resolveRenderer('css', null)).toBe('css');
    expect(resolveRenderer('three-glsl', 'bogus')).toBe('three-glsl');
  });
});

describe('nextView', () => {
  it('cycles the enabled views', () => {
    expect(nextView('shelf')).toBe('catalogue');
    expect(nextView('catalogue')).toBe('shelf');
    expect(nextView('catalogue', ['shelf', 'catalogue', 'study'])).toBe(
      'study',
    );
    expect(nextView('study', ['shelf', 'catalogue', 'study'])).toBe('shelf');
  });
});

describe('serializePrefs', () => {
  it('writes a one-year Lax cookie on /', () => {
    const cookie = serializePrefs({
      view: 'catalogue',
      panel: false,
      renderer: 'three-tsl',
    });
    expect(cookie.startsWith(`${PREFS_COOKIE}=`)).toBe(true);
    expect(cookie).toContain('; Path=/; Max-Age=31536000; SameSite=Lax');
    expect(
      parsePrefs(cookie.split(';')[0]?.slice(PREFS_COOKIE.length + 1)),
    ).toEqual({
      view: 'catalogue',
      panel: false,
      renderer: 'three-tsl',
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm nx test personal-calibre`
Expected: FAIL: `./library-query`, `./library-params`, `./group-entries` and `./prefs` cannot be
resolved. `files.test.ts` still passes.

- [ ] **Step 3: Add the types**

Append to `apps/personal-calibre/src/types/calibre.ts`:

```ts
export interface LibraryBook extends BookSummary {
  seriesId: number | null;
  authorIds: number[];
  tags: Array<{ id: number; name: string }>;
  pubdate: string | null;
}

export interface EntryGroupRef {
  key: string;
  label: string;
  total: number;
  offset: number;
  id: number | null;
}

export interface LibraryEntry {
  book: LibraryBook;
  group?: EntryGroupRef;
}

export interface LibraryResult {
  entries: LibraryEntry[];
  page: number;
  pageCount: number;
  matching: number;
  libraryTotal: number;
  matchingIds: number[];
}
```

- [ ] **Step 4: Move the query helpers**

Create `apps/personal-calibre/src/lib/book-query.ts` starting with this import block:

```ts
import { asc, desc, eq, inArray, like, notInArray, or, sql } from 'drizzle-orm';

import { appDb, db } from '@/db/client';
import {
  authors,
  books,
  booksAuthorsLink,
  booksSeriesLink,
  booksTagsLink,
  data,
  series,
} from '@/db/schema';
import { bookDeliveries, deliveryPlatforms } from '@/db/schema-app';
import type { BookSummary } from '@/types/calibre';
```

Then move four declarations out of `src/lib/queries.ts` into it, byte for byte, adding only the
`export` keyword where it is missing: `interface BookListParams` (queries.ts:40-51, already
exported), `async function hydrateBooks` (53-131), `async function buildBookConditions`
(133-199) and `function buildOrderExpr` (201-220). Check the move with
`git diff --stat` (queries.ts loses about 180 lines, book-query.ts gains the same) and
`git diff -M` showing no edits inside the moved bodies.

Replace the import block of `src/lib/queries.ts` with:

```ts
import { and, eq, sql } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';

import { appDb, db, sqlite } from '@/db/client';
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
import { bookDeliveries, deliveryPlatforms } from '@/db/schema-app';
import {
  type BookListParams,
  buildBookConditions,
  buildOrderExpr,
  hydrateBooks,
} from '@/lib/book-query';
import {
  hydrateLibraryBooks,
  type LibraryQuery,
  queryLibrary,
} from '@/lib/library-query';
import type {
  BookDetail,
  BookGroup,
  BookSummary,
  FilterOptions,
  LibraryBook,
  LibraryResult,
} from '@/types/calibre';

export type { BookListParams };
```

Append to `src/lib/queries.ts`:

```ts
export async function getLibrary(query: LibraryQuery): Promise<LibraryResult> {
  'use cache';
  cacheLife('minutes');
  cacheTag('books');
  return queryLibrary(query);
}

export async function getLibraryBook(id: number): Promise<LibraryBook | null> {
  'use cache';
  cacheLife('hours');
  cacheTag('books', `book-${id}`);
  return (await hydrateLibraryBooks([id]))[0] ?? null;
}
```

If `tsc` reports an import in either file as unused, remove it; nothing else changes in
`getBookList`, `getGroupedBookList`, `getBook`, `getFilterOptions` or `listUndeliveredBooks`.

- [ ] **Step 5: Implement `library-query.ts`**

Create `apps/personal-calibre/src/lib/library-query.ts`:

```ts
import { and, asc, count, eq, inArray } from 'drizzle-orm';

import { db, sqlite } from '@/db/client';
import {
  authors,
  books,
  booksAuthorsLink,
  booksSeriesLink,
  booksTagsLink,
  tags,
} from '@/db/schema';
import {
  type BookListParams,
  buildBookConditions,
  buildOrderExpr,
  hydrateBooks,
} from '@/lib/book-query';
import type { GroupBy } from '@/lib/library-params';
import type { LibraryBook, LibraryEntry, LibraryResult } from '@/types/calibre';

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
      (query.page - 1) * query.pageSize,
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

  const rows = await db
    .select({ id: books.id })
    .from(books)
    .where(where)
    .orderBy(buildOrderExpr(query.sortBy, query.sortDir))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);
  const matching = matchingIds.length;
  return {
    entries: (await hydrateLibraryBooks(rows.map((r) => r.id))).map((book) => ({
      book,
    })),
    page: query.page,
    pageCount: pageCountFor(matching, query.pageSize),
    matching,
    libraryTotal,
    matchingIds,
  };
}
```

The `tag` config sorts by `g.name`; `series` and `author` by their `sort` columns, as
`getGroupedBookList` does.

- [ ] **Step 6: Implement `library-params.ts`, `group-entries.ts` and `prefs.ts`**

Create `apps/personal-calibre/src/lib/prefs.ts`:

```ts
import { z } from 'zod';

export const VIEWS = ['shelf', 'catalogue', 'study'] as const;
export type View = (typeof VIEWS)[number];
export const ENABLED_VIEWS: readonly View[] = ['shelf', 'catalogue'];
export const VIEW_LABELS: Record<View, string> = {
  shelf: 'Shelf',
  catalogue: 'Catalogue',
  study: 'Study',
};

export const RENDERERS = ['css', 'three-glsl', 'three-tsl'] as const;
export type Renderer = (typeof RENDERERS)[number];

export const PREFS_COOKIE = 'calibre-prefs';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export interface Prefs {
  view: View;
  panel: boolean;
  renderer: Renderer;
}

export const DEFAULT_PREFS: Prefs = {
  view: 'shelf',
  panel: true,
  renderer: 'three-tsl',
};

const prefsSchema = z.object({
  view: z.enum(VIEWS).catch(DEFAULT_PREFS.view),
  panel: z.boolean().catch(DEFAULT_PREFS.panel),
  renderer: z.enum(RENDERERS).catch(DEFAULT_PREFS.renderer),
});

export function isView(value: unknown): value is View {
  return VIEWS.some((v) => v === value);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function decodeCookie(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function parsePrefs(raw: string | undefined): Prefs {
  if (!raw) return { ...DEFAULT_PREFS };
  const value = parseJson(raw) ?? parseJson(decodeCookie(raw));
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_PREFS };
  return prefsSchema.parse(value);
}

export function resolveView(
  prefView: View,
  param: string | null,
  enabled: readonly View[] = ENABLED_VIEWS,
): View {
  const wanted = VIEWS.find((v) => v === param);
  if (wanted && enabled.includes(wanted)) return wanted;
  if (enabled.includes(prefView)) return prefView;
  return enabled[0] ?? 'shelf';
}

export function resolveRenderer(
  prefRenderer: Renderer,
  param: string | null,
): Renderer {
  return RENDERERS.find((r) => r === param) ?? prefRenderer;
}

export function nextView(
  view: View,
  enabled: readonly View[] = ENABLED_VIEWS,
): View {
  const index = enabled.indexOf(view);
  return enabled[(index + 1) % enabled.length] ?? 'shelf';
}

export function serializePrefs(prefs: Prefs): string {
  return `${PREFS_COOKIE}=${encodeURIComponent(JSON.stringify(prefs))}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}
```

Create `apps/personal-calibre/src/lib/library-params.ts`:

```ts
import type { LibraryQuery } from '@/lib/library-query';
import type { View } from '@/lib/prefs';
import type { FilterOptions } from '@/types/calibre';
import type { DeliveryPlatform } from '@/types/delivery';

export const PAGE_SIZE = 30;

export const GROUP_BYS = ['series', 'tag', 'author'] as const;
export type GroupBy = (typeof GROUP_BYS)[number];
export const SORT_BYS = [
  'title',
  'author',
  'added',
  'pubdate',
  'rating',
] as const;
export type SortBy = (typeof SORT_BYS)[number];
export type SortDir = 'asc' | 'desc';

export interface LibraryParams {
  q: string | null;
  author: number | null;
  tag: number | null;
  series: number | null;
  platform: string | null;
  delivered: boolean | null;
  groupBy: GroupBy | null;
  sortBy: SortBy;
  sortDir: SortDir;
  page: number;
  book: number | null;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;
export type SearchParamsInput = URLSearchParams | RawSearchParams;

export interface ParamPatch {
  q?: string | null;
  author?: number | null;
  tag?: number | null;
  series?: number | null;
  platform?: string | null;
  delivered?: boolean | null;
  groupBy?: GroupBy | null;
  sortBy?: SortBy | null;
  sortDir?: SortDir | null;
  page?: number | null;
  book?: number | null;
  view?: View | null;
}

const RESETS_PAGE: ReadonlyArray<keyof ParamPatch> = [
  'q',
  'author',
  'tag',
  'series',
  'platform',
  'delivered',
  'groupBy',
  'sortBy',
  'sortDir',
];
const FILTER_PARAMS = ['q', 'author', 'tag', 'series', 'platform', 'delivered'];

export function toSearchParams(input: SearchParamsInput): URLSearchParams {
  if (input instanceof URLSearchParams)
    return new URLSearchParams(input.toString());
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) out.append(key, first);
  }
  return out;
}

function positiveInt(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 ? n : null;
}

function oneOf<T extends string>(
  allowed: readonly T[],
  value: string | null,
): T | null {
  return allowed.find((v) => v === value) ?? null;
}

export function parseLibraryParams(input: SearchParamsInput): LibraryParams {
  const sp = toSearchParams(input);
  const platform = sp.get('platform') || null;
  return {
    q: sp.get('q')?.trim() || null,
    author: positiveInt(sp.get('author')),
    tag: positiveInt(sp.get('tag')),
    series: positiveInt(sp.get('series')),
    platform,
    delivered: platform ? sp.get('delivered') !== 'false' : null,
    groupBy: oneOf(GROUP_BYS, sp.get('groupBy')),
    sortBy: oneOf(SORT_BYS, sp.get('sortBy')) ?? 'title',
    sortDir: sp.get('sortDir') === 'desc' ? 'desc' : 'asc',
    page: positiveInt(sp.get('page')) ?? 1,
    book: positiveInt(sp.get('book')),
  };
}

function isDefault(key: keyof ParamPatch, value: unknown): boolean {
  return (
    (key === 'delivered' && value === true) ||
    (key === 'sortBy' && value === 'title') ||
    (key === 'sortDir' && value === 'asc') ||
    (key === 'page' && typeof value === 'number' && value <= 1) ||
    (key === 'q' && typeof value === 'string' && value.trim() === '')
  );
}

function hrefOf(sp: URLSearchParams): string {
  const qs = sp.toString();
  return qs ? `/?${qs}` : '/';
}

export function buildLibraryHref(
  current: SearchParamsInput,
  patch: ParamPatch,
): string {
  const sp = toSearchParams(current);
  const keys = Object.keys(patch) as Array<keyof ParamPatch>;
  for (const key of keys) {
    const value = patch[key];
    if (value === null || value === undefined || isDefault(key, value))
      sp.delete(key);
    else sp.set(key, key === 'q' ? String(value).trim() : String(value));
  }
  if (patch.platform === null) sp.delete('delivered');
  if (keys.some((k) => RESETS_PAGE.includes(k)) && !keys.includes('page'))
    sp.delete('page');
  return hrefOf(sp);
}

export function clearFiltersHref(current: SearchParamsInput): string {
  const sp = toSearchParams(current);
  for (const key of [...FILTER_PARAMS, 'page']) sp.delete(key);
  return hrefOf(sp);
}

export function filterCount(params: LibraryParams): number {
  return [params.author, params.tag, params.series, params.platform].filter(
    (v) => v !== null,
  ).length;
}

export function hasFilters(params: LibraryParams): boolean {
  return params.q !== null || filterCount(params) > 0;
}

export interface FilterLabels {
  authors: FilterOptions['authors'];
  tags: FilterOptions['tags'];
  series: FilterOptions['series'];
  platforms: DeliveryPlatform[];
}

export interface ActiveFilter {
  key: 'q' | 'author' | 'tag' | 'series' | 'platform';
  label: string;
  patch: ParamPatch;
}

function nameOf(
  options: ReadonlyArray<{ id: number; name: string | null }>,
  id: number,
): string {
  return options.find((o) => o.id === id)?.name ?? `#${id}`;
}

function platformPhrase(params: LibraryParams, labels: FilterLabels): string {
  const name =
    labels.platforms.find((p) => p.key === params.platform)?.name ??
    params.platform;
  return `${params.delivered === false ? 'Not on' : 'On'} ${name}`;
}

export function activeFilters(
  params: LibraryParams,
  labels: FilterLabels,
): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  if (params.q)
    out.push({ key: 'q', label: `"${params.q}"`, patch: { q: null } });
  if (params.series) {
    out.push({
      key: 'series',
      label: `Series: ${nameOf(labels.series, params.series)}`,
      patch: { series: null },
    });
  }
  if (params.author) {
    out.push({
      key: 'author',
      label: `Author: ${nameOf(labels.authors, params.author)}`,
      patch: { author: null },
    });
  }
  if (params.tag) {
    out.push({
      key: 'tag',
      label: `Tag: ${nameOf(labels.tags, params.tag)}`,
      patch: { tag: null },
    });
  }
  if (params.platform) {
    out.push({
      key: 'platform',
      label: platformPhrase(params, labels),
      patch: { platform: null },
    });
  }
  return out;
}

export function scopeTitle(
  params: LibraryParams,
  labels: FilterLabels,
): string {
  if (params.q) return `Results for "${params.q}"`;
  if (params.series) return nameOf(labels.series, params.series);
  if (params.author) return nameOf(labels.authors, params.author);
  if (params.tag) return nameOf(labels.tags, params.tag);
  if (params.platform) return platformPhrase(params, labels);
  return 'All books';
}

export function toLibraryQuery(
  params: LibraryParams,
  pageSize: number,
): LibraryQuery {
  return {
    q: params.q ?? undefined,
    authorId: params.author ?? undefined,
    tagId: params.tag ?? undefined,
    seriesId: params.series ?? undefined,
    platformKey: params.platform ?? undefined,
    delivered: params.delivered ?? undefined,
    groupBy: params.groupBy ?? undefined,
    sortBy: params.sortBy,
    sortDir: params.sortDir,
    page: params.page,
    pageSize,
  };
}
```

Create `apps/personal-calibre/src/lib/group-entries.ts`:

```ts
import type { GroupBy } from '@/lib/library-params';
import type { LibraryEntry } from '@/types/calibre';

export interface EntryGroup {
  key: string;
  label: string;
  total: number;
  continued: boolean;
  filter: { param: GroupBy; id: number } | null;
  entries: LibraryEntry[];
}

export function groupEntries(
  entries: readonly LibraryEntry[],
  groupBy: GroupBy,
): EntryGroup[] {
  const groups: EntryGroup[] = [];
  for (const entry of entries) {
    const ref = entry.group;
    const key = ref?.key ?? `${groupBy}:none`;
    const last = groups.at(-1);
    if (last?.key === key) {
      last.entries.push(entry);
      continue;
    }
    groups.push({
      key,
      label: ref?.label ?? '',
      total: ref?.total ?? 1,
      continued: (ref?.offset ?? 0) > 0,
      filter: ref?.id != null ? { param: groupBy, id: ref.id } : null,
      entries: [entry],
    });
  }
  const isFallback = (g: EntryGroup) => g.key.endsWith(':none');
  return [
    ...groups.filter((g) => !isFallback(g)),
    ...groups.filter(isFallback),
  ];
}

export function groupTitle(group: EntryGroup): string {
  return group.continued ? `${group.label} (continued)` : group.label;
}

export function navKey(entry: LibraryEntry): string {
  return `${entry.group?.key ?? 'all'}:${entry.book.id}`;
}

export function bookIdOfNavKey(key: string): number {
  return Number(key.slice(key.lastIndexOf(':') + 1));
}

export function contentKey(entries: readonly LibraryEntry[]): string {
  return entries
    .map((e) =>
      [
        e.group?.key ?? '',
        e.book.id,
        e.book.title,
        e.book.series ?? '',
        e.book.deliveredTo.join('+'),
      ].join('|'),
    )
    .join('\n');
}

export function booksLabel(n: number): string {
  return `${n} book${n === 1 ? '' : 's'}`;
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm nx test personal-calibre`
Expected: PASS: `files`, `library-query`, `library-params`, `group-entries`, `prefs`.
Run: `pnpm nx typecheck personal-calibre`
Expected: PASS (the app still builds on `getBookList` and `getGroupedBookList`; nothing calls
`getLibrary` yet).

- [ ] **Step 8: Lint and comment audit**

Run: `pnpm nx lint personal-calibre --fix` then `pnpm nx lint personal-calibre`
Run: `git diff -U0 HEAD | grep -E '^\+\s*(//|/\*|\*|#|\{/\*)'`
Expected: PASS; no comment hits.

- [ ] **Step 9: Commit**

```bash
git add apps/personal-calibre/src/types/calibre.ts \
  apps/personal-calibre/src/lib/book-query.ts apps/personal-calibre/src/lib/queries.ts \
  apps/personal-calibre/src/lib/library-query.ts apps/personal-calibre/src/lib/library-query.test.ts \
  apps/personal-calibre/src/test/calibre-db.ts \
  apps/personal-calibre/src/lib/library-params.ts apps/personal-calibre/src/lib/library-params.test.ts \
  apps/personal-calibre/src/lib/group-entries.ts apps/personal-calibre/src/lib/group-entries.test.ts \
  apps/personal-calibre/src/lib/prefs.ts apps/personal-calibre/src/lib/prefs.test.ts
git commit -m "$(cat <<'EOF'
feat(personal-calibre): page library entries on the server and model the URL

getLibrary pages (group, book) entries, grouped or not, with group
totals, offsets for continued groups and every matching id. The URL,
the prefs cookie and grouping get pure helpers with unit tests.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm
EOF
)"
```

---

### Task 3: Shell: slots, provider, header and view switch

**Files:**

- Create: `apps/personal-calibre/src/lib/selection.ts`
- Create: `apps/personal-calibre/src/lib/selection.test.ts`
- Create: `apps/personal-calibre/src/lib/prefs-server.ts`
- Create: `apps/personal-calibre/src/hooks/useIsDesktop.ts`
- Create: `apps/personal-calibre/src/components/library/LibraryProvider.tsx`
- Create: `apps/personal-calibre/src/components/library/LibraryShell.tsx`
- Create: `apps/personal-calibre/src/components/library/LibraryHeader.tsx`
- Create: `apps/personal-calibre/src/components/library/ViewSwitch.tsx`
- Modify: `apps/personal-calibre/src/app/(library)/layout.tsx` (whole file)
- Create: `apps/personal-calibre/src/app/(library)/@filters/default.tsx`
- Create: `apps/personal-calibre/src/app/(library)/@filters/books/[id]/page.tsx`
- Create: `apps/personal-calibre/src/app/(library)/@pane/default.tsx`
- Create: `apps/personal-calibre/src/app/(library)/@pane/books/[id]/page.tsx`
- Create: `apps/personal-calibre-e2e/src/shell.spec.ts`
- Create: `apps/personal-calibre-e2e/src/shell.phone.spec.ts`

**Interfaces:**

- Consumes: `Prefs`, `View`, `ENABLED_VIEWS`, `VIEW_LABELS`, `isView`, `resolveView`,
  `serializePrefs`, `parsePrefs`, `PREFS_COOKIE` (`prefs.ts`); `buildLibraryHref`,
  `clearFiltersHref`, `parseLibraryParams`, `ParamPatch` (`library-params.ts`).
- Produces:
  - `src/lib/selection.ts`: `toggleId(set, id)`, `addIds(set, ids)`, `removeIds(set, ids)`,
    `type CheckState = 'none' | 'some' | 'all'`, `pageCheckState(set, pageIds)`,
    `togglePage(set, pageIds)`; all take and return `ReadonlySet<number>`.
  - `readPrefs(): Promise<Prefs>` (`prefs-server.ts`), `useIsDesktop(): boolean`.
  - `useLibrary()` from `LibraryProvider.tsx`, returning:
    `view`, `setView(view)`, `panelOpen`, `togglePanel()`, `filtersOpen`, `setFiltersOpen(open)`,
    `selected: ReadonlySet<number>`, `toggle(id)`, `addMany(ids)`, `removeMany(ids)`, `clear()`,
    `selectMode`, `setSelectMode(on)`, `bulkPlatform`, `setBulkPlatform(key)`, `zipFormat`,
    `setZipFormat(format)`, `focusId`, `setFocusId(id)`, `pendingFocus: PendingFocus | null`,
    `requestFocus(f | null)`, `pageInfo: { page; pageCount }`, `setPageInfo(info)`, `isPending`,
    `replaceParams(patch)`, `clearFilters()`, `goToPage(page)`, `openBook(id)`, `closeBook()`.
    `type PendingFocus = { kind: 'first'; page: number } | { kind: 'book'; id: number }`.
  - Markup: `[data-library-ready]` on the shell root after hydration; `aside#library-filters`
    (label `Filters`) and `aside` labelled `Book details` on desktop; `main#library-main`.

- [ ] **Step 1: Write the failing tests**

Create `apps/personal-calibre/src/lib/selection.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  addIds,
  pageCheckState,
  removeIds,
  toggleId,
  togglePage,
} from './selection';

describe('selection', () => {
  it('toggles one id without mutating the input', () => {
    const start = new Set([1]);
    expect([...toggleId(start, 2)]).toEqual([1, 2]);
    expect([...toggleId(start, 1)]).toEqual([]);
    expect([...start]).toEqual([1]);
  });

  it('selects every matching id across pages for Select all N', () => {
    const matchingIds = Array.from({ length: 70 }, (_, i) => i + 1);
    expect(addIds(new Set([3]), matchingIds).size).toBe(70);
  });

  it('keeps ids from another page when the page changes', () => {
    const fromPageOne = new Set([1, 2]);
    const pageTwo = [31, 32, 33];
    expect(pageCheckState(fromPageOne, pageTwo)).toBe('none');
    expect(addIds(fromPageOne, [31]).size).toBe(3);
  });

  it('acts on the current page only from the header checkbox', () => {
    const selected = new Set([1, 31]);
    const pageTwo = [31, 32];
    expect(pageCheckState(selected, pageTwo)).toBe('some');
    const all = togglePage(selected, pageTwo);
    expect([...all].sort((a, b) => a - b)).toEqual([1, 31, 32]);
    expect(pageCheckState(all, pageTwo)).toBe('all');
    expect([...togglePage(all, pageTwo)]).toEqual([1]);
    expect([...removeIds(all, [1])].sort((a, b) => a - b)).toEqual([31, 32]);
  });

  it('reads an empty page as none', () => {
    expect(pageCheckState(new Set([1]), [])).toBe('none');
  });
});
```

Create `apps/personal-calibre-e2e/src/shell.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

import { gotoLibrary, readPrefs, setPrefs } from './support/library';
import { bookById } from './support/seed';

test.describe('shell', () => {
  test('switches views and remembers the choice', async ({ page, context }) => {
    await gotoLibrary(page);
    const shelf = page.getByRole('button', { name: 'Shelf view' });
    const catalogue = page.getByRole('button', { name: 'Catalogue view' });
    await expect(shelf).toHaveAttribute('aria-pressed', 'true');
    await catalogue.click();
    await expect(catalogue).toHaveAttribute('aria-pressed', 'true');
    expect(await readPrefs(context)).toMatchObject({ view: 'catalogue' });
    await gotoLibrary(page);
    await expect(
      page.getByRole('button', { name: 'Catalogue view' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test('?view= overrides the cookie for one load without writing it', async ({
    page,
    context,
  }) => {
    await setPrefs(context, { view: 'shelf' });
    await gotoLibrary(page, '/?view=catalogue');
    await expect(
      page.getByRole('button', { name: 'Catalogue view' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(await readPrefs(context)).toMatchObject({ view: 'shelf' });
  });

  test('hides and shows the filter panel and remembers it', async ({
    page,
    context,
  }) => {
    await gotoLibrary(page);
    await expect(page.locator('#library-filters')).toBeVisible();
    await page.getByRole('button', { name: 'Hide filters' }).click();
    await expect(page.locator('#library-filters')).toBeHidden();
    expect(await readPrefs(context)).toMatchObject({ panel: false });
    await gotoLibrary(page);
    await expect(
      page.getByRole('button', { name: 'Show filters' }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  test('the permalink renders without the panel or the pane', async ({
    page,
  }) => {
    await gotoLibrary(page, '/books/1');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      bookById(1).title,
    );
    await expect(page.locator('#library-filters')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Shelf view' })).toHaveCount(
      0,
    );
  });
});
```

Create `apps/personal-calibre-e2e/src/shell.phone.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

import { gotoLibrary } from './support/library';

test.describe('shell on phone', () => {
  test('shows the view switch as icons and no panel toggle', async ({
    page,
  }) => {
    await gotoLibrary(page);
    const catalogue = page.getByRole('button', { name: 'Catalogue view' });
    await expect(catalogue).toBeVisible();
    await expect(
      catalogue.getByText('Catalogue', { exact: true }),
    ).toBeHidden();
    await expect(
      page.getByRole('button', { name: 'Hide filters' }),
    ).toBeHidden();
    await expect(page.locator('#library-filters')).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm nx test personal-calibre -- src/lib/selection.test.ts`
Expected: FAIL: `./selection` cannot be resolved.
Run: `pnpm nx e2e personal-calibre-e2e -- --grep "shell"` (runs both projects)
Expected: FAIL: `[data-library-ready]` never appears. Clear port 3333.

- [ ] **Step 3: Implement the pure helpers and the prefs reader**

Create `apps/personal-calibre/src/lib/selection.ts`:

```ts
export type CheckState = 'none' | 'some' | 'all';

export function toggleId(
  set: ReadonlySet<number>,
  id: number,
): ReadonlySet<number> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function addIds(
  set: ReadonlySet<number>,
  ids: readonly number[],
): ReadonlySet<number> {
  const next = new Set(set);
  for (const id of ids) next.add(id);
  return next;
}

export function removeIds(
  set: ReadonlySet<number>,
  ids: readonly number[],
): ReadonlySet<number> {
  const next = new Set(set);
  for (const id of ids) next.delete(id);
  return next;
}

export function pageCheckState(
  set: ReadonlySet<number>,
  pageIds: readonly number[],
): CheckState {
  const selectedOnPage = pageIds.filter((id) => set.has(id)).length;
  if (selectedOnPage === 0) return 'none';
  return selectedOnPage === pageIds.length ? 'all' : 'some';
}

export function togglePage(
  set: ReadonlySet<number>,
  pageIds: readonly number[],
): ReadonlySet<number> {
  return pageCheckState(set, pageIds) === 'all'
    ? removeIds(set, pageIds)
    : addIds(set, pageIds);
}
```

Create `apps/personal-calibre/src/lib/prefs-server.ts`:

```ts
import { cookies } from 'next/headers';

import { parsePrefs, type Prefs, PREFS_COOKIE } from '@/lib/prefs';

export async function readPrefs(): Promise<Prefs> {
  return parsePrefs((await cookies()).get(PREFS_COOKIE)?.value);
}
```

Create `apps/personal-calibre/src/hooks/useIsDesktop.ts`:

```ts
'use client';

import { useSyncExternalStore } from 'react';

const DESKTOP_QUERY = '(min-width: 64rem)';

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}
```

- [ ] **Step 4: Implement the provider**

Create `apps/personal-calibre/src/components/library/LibraryProvider.tsx`:

```tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
} from 'react';

import {
  buildLibraryHref,
  clearFiltersHref,
  type ParamPatch,
  parseLibraryParams,
} from '@/lib/library-params';
import {
  type Prefs,
  resolveView,
  serializePrefs,
  type View,
} from '@/lib/prefs';
import { addIds, removeIds, toggleId } from '@/lib/selection';

export type PendingFocus =
  { kind: 'first'; page: number } | { kind: 'book'; id: number };

export interface PageInfo {
  page: number;
  pageCount: number;
}

interface LibraryContextValue {
  view: View;
  setView: (view: View) => void;
  panelOpen: boolean;
  togglePanel: () => void;
  filtersOpen: boolean;
  setFiltersOpen: (open: boolean) => void;
  selected: ReadonlySet<number>;
  toggle: (id: number) => void;
  addMany: (ids: readonly number[]) => void;
  removeMany: (ids: readonly number[]) => void;
  clear: () => void;
  selectMode: boolean;
  setSelectMode: (on: boolean) => void;
  bulkPlatform: string;
  setBulkPlatform: (key: string) => void;
  zipFormat: string;
  setZipFormat: (format: string) => void;
  focusId: number | null;
  setFocusId: (id: number | null) => void;
  pendingFocus: PendingFocus | null;
  requestFocus: (focus: PendingFocus | null) => void;
  pageInfo: PageInfo;
  setPageInfo: (info: PageInfo) => void;
  isPending: boolean;
  replaceParams: (patch: ParamPatch) => void;
  clearFilters: () => void;
  goToPage: (page: number) => void;
  openBook: (id: number) => void;
  closeBook: () => void;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function useLibrary(): LibraryContextValue {
  const value = useContext(LibraryContext);
  if (!value) throw new Error('useLibrary needs a LibraryProvider');
  return value;
}

export function LibraryProvider({
  initialPrefs,
  children,
}: {
  initialPrefs: Prefs;
  children: ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [prefs, setPrefs] = useState(initialPrefs);
  const [view, setViewState] = useState<View>(() =>
    resolveView(initialPrefs.view, searchParams.get('view')),
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const [selectMode, setSelectMode] = useState(false);
  const [bulkPlatform, setBulkPlatform] = useState('');
  const [zipFormat, setZipFormat] = useState('EPUB');
  const [focusId, setFocusId] = useState<number | null>(null);
  const [pendingFocus, requestFocus] = useState<PendingFocus | null>(null);
  const [pageInfo, setPageInfo] = useState<PageInfo>({ page: 1, pageCount: 1 });
  const [isPending, startTransition] = useTransition();

  const savePrefs = useCallback(
    (patch: Partial<Prefs>) => {
      const next = { ...prefs, ...patch };
      setPrefs(next);
      document.cookie = serializePrefs(next);
    },
    [prefs],
  );

  const setView = useCallback(
    (next: View) => {
      setViewState(next);
      savePrefs({ view: next });
    },
    [savePrefs],
  );

  const togglePanel = useCallback(
    () => savePrefs({ panel: !prefs.panel }),
    [prefs.panel, savePrefs],
  );
  const toggle = useCallback(
    (id: number) => setSelected((s) => toggleId(s, id)),
    [],
  );
  const addMany = useCallback(
    (ids: readonly number[]) => setSelected((s) => addIds(s, ids)),
    [],
  );
  const removeMany = useCallback(
    (ids: readonly number[]) => setSelected((s) => removeIds(s, ids)),
    [],
  );
  const clear = useCallback(() => setSelected(new Set()), []);

  const replaceParams = useCallback(
    (patch: ParamPatch) => {
      const href = buildLibraryHref(searchParams, patch);
      startTransition(() => router.replace(href, { scroll: false }));
    },
    [router, searchParams],
  );

  const clearFilters = useCallback(() => {
    const href = clearFiltersHref(searchParams);
    startTransition(() => router.replace(href, { scroll: false }));
  }, [router, searchParams]);

  const goToPage = useCallback(
    (page: number) => {
      requestFocus({ kind: 'first', page });
      const href = buildLibraryHref(searchParams, { page });
      startTransition(() => router.push(href, { scroll: false }));
    },
    [router, searchParams],
  );

  const openBook = useCallback(
    (id: number) => {
      setFocusId(id);
      router.push(buildLibraryHref(searchParams, { book: id }), {
        scroll: false,
      });
    },
    [router, searchParams],
  );

  const closeBook = useCallback(() => {
    const id = parseLibraryParams(searchParams).book;
    if (id === null) return;
    router.replace(buildLibraryHref(searchParams, { book: null }), {
      scroll: false,
    });
    requestFocus({ kind: 'book', id });
  }, [router, searchParams]);

  const value = useMemo<LibraryContextValue>(
    () => ({
      view,
      setView,
      panelOpen: prefs.panel,
      togglePanel,
      filtersOpen,
      setFiltersOpen,
      selected,
      toggle,
      addMany,
      removeMany,
      clear,
      selectMode,
      setSelectMode,
      bulkPlatform,
      setBulkPlatform,
      zipFormat,
      setZipFormat,
      focusId,
      setFocusId,
      pendingFocus,
      requestFocus,
      pageInfo,
      setPageInfo,
      isPending,
      replaceParams,
      clearFilters,
      goToPage,
      openBook,
      closeBook,
    }),
    [
      view,
      setView,
      prefs.panel,
      togglePanel,
      filtersOpen,
      selected,
      toggle,
      addMany,
      removeMany,
      clear,
      selectMode,
      bulkPlatform,
      zipFormat,
      focusId,
      pendingFocus,
      pageInfo,
      isPending,
      replaceParams,
      clearFilters,
      goToPage,
      openBook,
      closeBook,
    ],
  );

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
}
```

- [ ] **Step 5: Implement the header, view switch and shell**

Create `apps/personal-calibre/src/components/library/ViewSwitch.tsx`:

```tsx
'use client';

import {
  Kbd,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@rainforest-dev/rainforest-react';
import { LayoutGrid, type LucideIcon, Rows3 } from 'lucide-react';

import { ENABLED_VIEWS, isView, type View, VIEW_LABELS } from '@/lib/prefs';
import { cn } from '@/lib/utils';

import { useLibrary } from './LibraryProvider';

const ITEMS: Array<{ view: View; tooltip: string; Icon: LucideIcon }> = [
  { view: 'shelf', tooltip: '書架 Shelf', Icon: LayoutGrid },
  { view: 'catalogue', tooltip: '目錄 Catalogue', Icon: Rows3 },
];

export function ViewSwitch({ className }: { className?: string }) {
  const { view, setView } = useLibrary();
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <ToggleGroup
        aria-label="View"
        variant="outline"
        size="sm"
        value={[view]}
        onValueChange={(values) => {
          const next: unknown = values[0];
          if (isView(next)) setView(next);
        }}
      >
        {ITEMS.filter((item) => ENABLED_VIEWS.includes(item.view)).map(
          ({ view: item, tooltip, Icon }) => (
            <Tooltip key={item}>
              <TooltipTrigger
                render={
                  <ToggleGroupItem
                    value={item}
                    aria-label={`${VIEW_LABELS[item]} view`}
                  />
                }
              >
                <Icon aria-hidden />
                <span className="hidden lg:inline">{VIEW_LABELS[item]}</span>
              </TooltipTrigger>
              <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
          ),
        )}
      </ToggleGroup>
      <Kbd className="hidden lg:inline-flex">v</Kbd>
    </div>
  );
}
```

Create `apps/personal-calibre/src/components/library/LibraryHeader.tsx`:

```tsx
'use client';

import { Button } from '@rainforest-dev/rainforest-react';
import { LibraryBig, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';

import { useLibrary } from './LibraryProvider';
import { ViewSwitch } from './ViewSwitch';

export function LibraryHeader({ isList }: { isList: boolean }) {
  const { panelOpen, togglePanel } = useLibrary();
  return (
    <header className="bg-background sticky top-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2 lg:h-14 lg:flex-nowrap lg:px-4 lg:py-0">
      {isList && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="hidden lg:inline-flex"
          aria-label={panelOpen ? 'Hide filters' : 'Show filters'}
          aria-expanded={panelOpen}
          aria-controls="library-filters"
          onClick={togglePanel}
        >
          {panelOpen ? (
            <PanelLeftClose aria-hidden />
          ) : (
            <PanelLeftOpen aria-hidden />
          )}
        </Button>
      )}
      <Link
        href="/"
        className="flex items-center gap-2 font-semibold tracking-tight"
      >
        <LibraryBig className="size-5" aria-hidden />
        Library
      </Link>
      {isList && <ViewSwitch className="ml-auto lg:ml-2" />}
    </header>
  );
}
```

Create `apps/personal-calibre/src/components/library/LibraryShell.tsx`:

```tsx
'use client';

import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@rainforest-dev/rainforest-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';

import { useIsDesktop } from '@/hooks/useIsDesktop';
import { parseLibraryParams } from '@/lib/library-params';
import { cn } from '@/lib/utils';

import { LibraryHeader } from './LibraryHeader';
import { useLibrary } from './LibraryProvider';

const COLUMNS = {
  both: 'lg:grid-cols-[248px_minmax(0,1fr)_420px]',
  filters: 'lg:grid-cols-[248px_minmax(0,1fr)]',
  pane: 'lg:grid-cols-[minmax(0,1fr)_420px]',
  none: 'lg:grid-cols-1',
} as const;

const SIDE_COLUMN =
  'hidden lg:sticky lg:top-14 lg:block lg:h-[calc(100dvh-3.5rem)] lg:overflow-y-auto';

export function LibraryShell({
  children,
  filters,
  pane,
}: {
  children: ReactNode;
  filters: ReactNode;
  pane: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDesktop = useIsDesktop();
  const { panelOpen, filtersOpen, setFiltersOpen, closeBook } = useLibrary();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const isList = pathname === '/';
  const bookOpen = isList && parseLibraryParams(searchParams).book !== null;
  const columns = panelOpen
    ? bookOpen
      ? 'both'
      : 'filters'
    : bookOpen
      ? 'pane'
      : 'none';

  return (
    <div className="min-h-dvh" data-library-ready={ready || undefined}>
      <LibraryHeader isList={isList} />
      {isList ? (
        <div className={cn('lg:grid', COLUMNS[columns])}>
          {isDesktop && (
            <aside
              id="library-filters"
              aria-label="Filters"
              hidden={!panelOpen}
              className={cn(
                'bg-sidebar text-sidebar-foreground border-r',
                SIDE_COLUMN,
              )}
            >
              {filters}
            </aside>
          )}
          <main
            id="library-main"
            className="min-w-0 px-3 pb-24 lg:px-6 lg:pb-0"
          >
            {children}
          </main>
          {isDesktop && bookOpen && (
            <aside
              aria-label="Book details"
              className={cn('bg-card border-l', SIDE_COLUMN)}
            >
              {pane}
            </aside>
          )}
        </div>
      ) : (
        <main id="library-main" className="px-3 py-6 lg:px-6">
          {children}
        </main>
      )}
      {isList && !isDesktop && (
        <>
          <Sheet side="left" open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetContent closeLabel="Close filters" className="bg-sidebar">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <SheetBody className="px-0">{filters}</SheetBody>
            </SheetContent>
          </Sheet>
          <Sheet
            side="bottom"
            open={bookOpen}
            onOpenChange={(open) => {
              if (!open) closeBook();
            }}
          >
            <SheetContent showCloseButton={false} className="h-[92dvh]">
              <SheetTitle className="sr-only">Book details</SheetTitle>
              <SheetBody className="px-0">{pane}</SheetBody>
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Wire the layout and the slots**

Replace `apps/personal-calibre/src/app/(library)/layout.tsx`:

```tsx
import { type ReactNode, Suspense } from 'react';

import { LibraryProvider } from '@/components/library/LibraryProvider';
import { LibraryShell } from '@/components/library/LibraryShell';
import { readPrefs } from '@/lib/prefs-server';

interface Props {
  children: ReactNode;
  filters: ReactNode;
  pane: ReactNode;
}

export default function LibraryLayout(props: Props) {
  return (
    <Suspense fallback={<div className="bg-background h-14 border-b" />}>
      <LibraryRoot {...props} />
    </Suspense>
  );
}

async function LibraryRoot({ children, filters, pane }: Props) {
  const prefs = await readPrefs();
  return (
    <LibraryProvider initialPrefs={prefs}>
      <LibraryShell filters={filters} pane={pane}>
        {children}
      </LibraryShell>
    </LibraryProvider>
  );
}
```

Create each of these four files with the same body, naming the function after the file
(`FiltersDefault`, `FiltersOnPermalink`, `PaneDefault`, `PaneOnPermalink`):

- `apps/personal-calibre/src/app/(library)/@filters/default.tsx`
- `apps/personal-calibre/src/app/(library)/@filters/books/[id]/page.tsx`
- `apps/personal-calibre/src/app/(library)/@pane/default.tsx`
- `apps/personal-calibre/src/app/(library)/@pane/books/[id]/page.tsx`

```tsx
export default function FiltersDefault() {
  return null;
}
```

The existing `page.tsx` and `books/[id]/page.tsx` stay as they are in this task; they now render
inside `main#library-main`.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm nx test personal-calibre -- src/lib/selection.test.ts`
Expected: PASS.
Run: `pnpm nx e2e personal-calibre-e2e -- --grep "shell"`
Expected: PASS: 4 tests in `chromium`, 1 in `phone`. Clear port 3333.

- [ ] **Step 8: Dev server check, lint, types and comment audit**

Dev-server check (Global Constraints): load `/`, `/?view=catalogue`, `/books/38`, and `/` at 390px
wide. The header shows the view switch on `/` only, `Hide filters` toggles an empty sidebar
column, no console error.

Run: `pnpm nx run-many -t lint -p personal-calibre personal-calibre-e2e`
Run: `pnpm nx typecheck personal-calibre` and `pnpm nx typecheck personal-calibre-e2e`
Run: `git diff -U0 HEAD | grep -E '^\+\s*(//|/\*|\*|#|\{/\*)'`
Expected: PASS; no comment hits.

- [ ] **Step 9: Commit**

```bash
git checkout -- apps/personal-calibre/next-env.d.ts
git add apps/personal-calibre/src/lib/selection.ts apps/personal-calibre/src/lib/selection.test.ts \
  apps/personal-calibre/src/lib/prefs-server.ts apps/personal-calibre/src/hooks/useIsDesktop.ts \
  apps/personal-calibre/src/components/library/LibraryProvider.tsx \
  apps/personal-calibre/src/components/library/LibraryShell.tsx \
  apps/personal-calibre/src/components/library/LibraryHeader.tsx \
  apps/personal-calibre/src/components/library/ViewSwitch.tsx \
  'apps/personal-calibre/src/app/(library)/layout.tsx' \
  'apps/personal-calibre/src/app/(library)/@filters' \
  'apps/personal-calibre/src/app/(library)/@pane' \
  apps/personal-calibre-e2e/src/shell.spec.ts apps/personal-calibre-e2e/src/shell.phone.spec.ts
git commit -m "$(cat <<'EOF'
feat(personal-calibre): library shell with filter and pane slots

The library layout reads the calibre-prefs cookie, mounts the provider
that holds view, panel, selection and focus, and lays out @filters and
@pane beside the list, as Sheets below lg.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm
EOF
)"
```

---

### Task 4: Detail pane and permalink

**Files:**

- Create: `apps/personal-calibre/src/lib/deliveries.ts`
- Create: `apps/personal-calibre/src/lib/deliveries.test.ts`
- Create: `apps/personal-calibre/src/lib/format.ts`
- Create: `apps/personal-calibre/src/lib/format.test.ts`
- Create: `apps/personal-calibre/src/lib/spine.ts`
- Create: `apps/personal-calibre/src/lib/spine.test.ts`
- Create: `apps/personal-calibre/src/lib/description.ts`
- Modify: `apps/personal-calibre/src/lib/delivery.ts:216-217, 230, 265-268`
- Modify: `apps/personal-calibre/src/lib/tags.ts:303-307`
- Create: `apps/personal-calibre/src/components/detail/BookDetail.tsx`
- Create: `apps/personal-calibre/src/components/detail/PaneTopRow.tsx`
- Create: `apps/personal-calibre/src/components/detail/DeliveryRows.tsx`
- Create: `apps/personal-calibre/src/components/detail/DownloadMenu.tsx`
- Create: `apps/personal-calibre/src/components/detail/BookDetailSkeleton.tsx`
- Modify: `apps/personal-calibre/src/components/TagEditor.tsx` (whole file)
- Delete: `apps/personal-calibre/src/components/DeliveryTracker.tsx`
- Create: `apps/personal-calibre/src/app/(library)/@pane/page.tsx`
- Create: `apps/personal-calibre/src/app/(library)/@pane/loading.tsx`
- Modify: `apps/personal-calibre/src/app/(library)/books/[id]/page.tsx` (whole file)
- Create: `apps/personal-calibre-e2e/src/pane.spec.ts`
- Create: `apps/personal-calibre-e2e/src/deliveries.spec.ts`
- Create: `apps/personal-calibre-e2e/src/tags.spec.ts`

**Interfaces:**

- Consumes: `useLibrary().closeBook` (Task 3); `getBook`, `getFilterOptions`, `getLibraryBook`
  (`queries.ts`); `listBookDeliveryEvents`, `listDeliveryPlatforms` (`delivery.ts`);
  `buildLibraryHref`, `parseLibraryParams`, `RawSearchParams`, `ParamPatch`.
- Produces:
  - `src/lib/deliveries.ts`: `formatDeliveryTime(value): string` (`YYYY-MM-DD HH:mm`, local),
    `formatDeliveryDate(value): string` (`YYYY-MM-DD`), `latestByPlatform(events):
Map<string, BookDeliveryEvent>`.
  - `src/lib/format.ts`: `formatBytes(n): string`, `seriesLine(series, index): string`,
    `yearOf(pubdate): string | null`.
  - `src/lib/spine.ts`: `spineClass(id): string`.
  - `src/lib/description.ts`: `sanitizeDescription(html): string | null`.
  - `<BookDetail variant="pane" | "page" book library events platforms allTags currentParams />`,
    `<BookDetailSkeleton />`.
  - Markup: the pane title is an `h2`; the permalink title an `h1`; `[data-book-detail]` on the
    article; each delivery row is `li[data-platform="<key>"]`.

- [ ] **Step 1: Write the failing tests**

Create `apps/personal-calibre/src/lib/deliveries.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { BookDeliveryEvent } from '@/types/delivery';

import {
  formatDeliveryDate,
  formatDeliveryTime,
  latestByPlatform,
} from './deliveries';

const pad = (n: number) => String(n).padStart(2, '0');
const local = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

describe('formatDeliveryTime', () => {
  it('shows an ISO time as local YYYY-MM-DD HH:mm', () => {
    const iso = '2026-09-01T08:30:00.000Z';
    expect(formatDeliveryTime(iso)).toBe(local(new Date(iso)));
  });

  it('reads the SQLite datetime format as UTC', () => {
    expect(formatDeliveryTime('2026-09-01 08:30:00')).toBe(
      local(new Date('2026-09-01T08:30:00Z')),
    );
  });

  it('returns anything unparseable as it came', () => {
    expect(formatDeliveryTime('yesterday')).toBe('yesterday');
  });
});

describe('formatDeliveryDate', () => {
  it('shows the local date only', () => {
    const iso = '2026-09-01T08:30:00.000Z';
    expect(formatDeliveryDate(iso)).toBe(local(new Date(iso)).slice(0, 10));
  });
});

describe('latestByPlatform', () => {
  const event = (id: number, platformKey: string): BookDeliveryEvent => ({
    id,
    bookId: 1,
    platformKey,
    platformName: platformKey,
    addedAt: '2026-09-01T08:30:00.000Z',
    note: null,
    externalRef: null,
  });

  it('keeps the newest event per platform from a newest-first list', () => {
    const latest = latestByPlatform([
      event(9, 'kobo'),
      event(7, 'notebooklm'),
      event(3, 'kobo'),
    ]);
    expect(latest.get('kobo')?.id).toBe(9);
    expect(latest.get('notebooklm')?.id).toBe(7);
    expect(latest.has('readwise-reader')).toBe(false);
  });
});
```

Create `apps/personal-calibre/src/lib/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { formatBytes, seriesLine, yearOf } from './format';

describe('format', () => {
  it('formats sizes', () => {
    expect(formatBytes(0)).toBe('');
    expect(formatBytes(900)).toBe('900 B');
    expect(formatBytes(4096)).toBe('4 KB');
    expect(formatBytes(3_500_000)).toBe('3.3 MB');
  });

  it('writes the series line', () => {
    expect(seriesLine('Tidewater Cycle', 2)).toBe('Tidewater Cycle · Book 2');
    expect(seriesLine('Tidewater Cycle', 2.5)).toBe(
      'Tidewater Cycle · Book 2.5',
    );
    expect(seriesLine('Tidewater Cycle', null)).toBe('Tidewater Cycle');
  });

  it('reads a year and drops Calibre’s undefined date', () => {
    expect(yearOf('2001-04-15T00:00:00+00:00')).toBe('2001');
    expect(yearOf('0101-01-01T00:00:00+00:00')).toBeNull();
    expect(yearOf(null)).toBeNull();
  });
});
```

Create `apps/personal-calibre/src/lib/spine.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { spineClass } from './spine';

describe('spineClass', () => {
  it('uses chart-(id % 5 + 1) mixed with muted', () => {
    expect(spineClass(5)).toContain('var(--chart-1)');
    expect(spineClass(4)).toContain('var(--chart-5)');
    expect(spineClass(4)).toContain('var(--muted)');
  });
});
```

Create `apps/personal-calibre-e2e/src/pane.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

import { gotoLibrary, pane } from './support/library';
import { authorName, bookById } from './support/seed';

const tidewater2 = bookById(38);

test.describe('detail pane', () => {
  test('?book= opens the pane and survives a reload', async ({ page }) => {
    await gotoLibrary(page, '/?book=38');
    await expect(
      pane(page).getByRole('heading', { level: 2, name: tidewater2.title }),
    ).toBeVisible();
    await expect(
      pane(page).getByText('Tidewater Cycle · Book 2'),
    ).toBeVisible();
    await page.reload();
    await expect(
      pane(page).getByRole('heading', { level: 2, name: tidewater2.title }),
    ).toBeVisible();
  });

  test('Close details closes the pane', async ({ page }) => {
    await gotoLibrary(page, '/?book=38');
    await pane(page).getByRole('button', { name: 'Close details' }).click();
    await expect(page).not.toHaveURL(/book=/);
    await expect(pane(page)).toHaveCount(0);
  });

  test('Back closes the pane', async ({ page }) => {
    await gotoLibrary(page, '/');
    await gotoLibrary(page, '/?book=38');
    await page.goBack();
    await expect(page).not.toHaveURL(/book=/);
    await expect(pane(page)).toHaveCount(0);
  });

  test('Open full page loads the permalink', async ({ page }) => {
    await gotoLibrary(page, '/?book=38');
    await pane(page).getByRole('link', { name: 'Open full page' }).click();
    await expect(page).toHaveURL(/\/books\/38$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      tidewater2.title,
    );
    await expect(pane(page)).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: 'Library' }).first(),
    ).toHaveAttribute('href', '/');
  });

  test('Read links to the reader and is absent without an EPUB', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?book=38');
    await expect(
      pane(page).getByRole('link', { name: 'Read' }),
    ).toHaveAttribute('href', '/read/38');
    await gotoLibrary(page, '/?book=46');
    await expect(
      pane(page).getByRole('heading', { level: 2, name: bookById(46).title }),
    ).toBeVisible();
    await expect(pane(page).getByRole('link', { name: 'Read' })).toHaveCount(0);
  });

  test('series and author links set the filter and keep the pane', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?book=38');
    await pane(page)
      .getByRole('link', { name: 'Tidewater Cycle · Book 2' })
      .click();
    await expect(page).toHaveURL(/series=4/);
    await expect(page).toHaveURL(/book=38/);
    await pane(page)
      .getByRole('link', { name: authorName(1) })
      .click();
    await expect(page).toHaveURL(/author=1/);
  });

  test('Download lists each format with its size', async ({ page }) => {
    await gotoLibrary(page, '/?book=1');
    await pane(page).getByRole('button', { name: 'Download' }).click();
    await expect(page.getByRole('menuitem', { name: /EPUB/ })).toHaveAttribute(
      'href',
      '/files/book-1/book-1.epub',
    );
    await expect(page.getByRole('menuitem', { name: /PDF/ })).toContainText(
      'KB',
    );
  });

  test('shows the metadata and the rating', async ({ page }) => {
    await gotoLibrary(page, '/?book=1');
    await expect(
      pane(page).getByRole('img', { name: 'Rated 5 of 5' }),
    ).toBeVisible();
    await expect(pane(page).getByText('Paper Lantern Books')).toBeVisible();
    await expect(pane(page).getByText('EPUB · PDF')).toBeVisible();
  });
});
```

Create `apps/personal-calibre-e2e/src/deliveries.spec.ts`:

```ts
import { expect, type Page, test } from '@playwright/test';

import { gotoLibrary, pane } from './support/library';
import { resetAppDb } from './support/reset-db';

test.beforeEach(() => resetAppDb());

const pad = (n: number) => String(n).padStart(2, '0');
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const row = (page: Page, platformKey: string) =>
  pane(page).locator(`[data-platform="${platformKey}"]`);

test.describe('deliveries', () => {
  test('Mark added shows at once, with URL and note in History', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?book=41');
    await expect(row(page, 'kobo')).toContainText('Not added');
    await row(page, 'kobo').getByRole('button', { name: 'Mark added' }).click();
    const dialog = page.getByRole('dialog', { name: 'Mark as added to Kobo' });
    await expect(
      dialog.getByText("Logs today's date. Both fields are optional."),
    ).toBeVisible();
    await dialog
      .getByLabel('Reference URL')
      .fill('https://example.com/shelf/41');
    await dialog.getByLabel('Note').fill('first read');
    await dialog.getByLabel('Note').press('Enter');
    await expect(page.getByText('Logged Kobo')).toBeVisible();
    await expect(row(page, 'kobo')).toContainText(today());
    await expect(
      row(page, 'kobo').getByRole('button', { name: 'Log again' }),
    ).toBeVisible();
    await pane(page).getByText('History (1)').click();
    await expect(pane(page).getByText('first read')).toBeVisible();
    await expect(
      pane(page).getByRole('link', { name: 'https://example.com/shelf/41' }),
    ).toBeVisible();
  });

  test('History removes an event', async ({ page }) => {
    await gotoLibrary(page, '/?book=42');
    await row(page, 'notebooklm')
      .getByRole('button', { name: 'Mark added' })
      .click();
    await page
      .getByRole('dialog', { name: 'Mark as added to NotebookLM' })
      .getByRole('button', { name: 'Save' })
      .click();
    await pane(page).getByText('History (1)').click();
    await pane(page)
      .getByRole('button', { name: 'Remove NotebookLM event' })
      .click();
    await expect(row(page, 'notebooklm')).toContainText('Not added');
    await expect(pane(page).getByText(/History \(/)).toHaveCount(0);
  });

  test('seeded deliveries show their date', async ({ page }) => {
    await gotoLibrary(page, '/?book=1');
    await expect(row(page, 'kobo')).toContainText('2026-09-01');
    await expect(row(page, 'readwise-reader')).toContainText('Not added');
  });
});
```

Create `apps/personal-calibre-e2e/src/tags.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

import { gotoLibrary, pane } from './support/library';
import { bookById, tagName } from './support/seed';

test.describe('tags', () => {
  test('shows the book’s tags on the permalink', async ({ page }) => {
    await gotoLibrary(page, '/books/3');
    for (const id of bookById(3).tagIds) {
      await expect(page.getByText(tagName(id), { exact: true })).toBeVisible();
    }
  });

  test('adds an existing tag in the pane', async ({ page }) => {
    await gotoLibrary(page, '/?book=43');
    await pane(page).getByRole('button', { name: 'Add tag' }).click();
    await page.getByPlaceholder('Search or create tag…').fill('win');
    await page.getByRole('option', { name: 'winter' }).click();
    await expect(
      pane(page).getByRole('button', { name: 'Remove tag winter' }),
    ).toBeVisible();
  });

  test('creates a new tag', async ({ page }) => {
    await gotoLibrary(page, '/?book=44');
    await pane(page).getByRole('button', { name: 'Add tag' }).click();
    await page.getByPlaceholder('Search or create tag…').fill('reading-group');
    await page.getByRole('option', { name: 'Create "reading-group"' }).click();
    await expect(
      pane(page).getByRole('button', { name: 'Remove tag reading-group' }),
    ).toBeVisible();
  });

  test('removes a tag', async ({ page }) => {
    await gotoLibrary(page, '/?book=45');
    await pane(page).getByRole('button', { name: 'Remove tag sea' }).click();
    await expect(
      pane(page).getByRole('button', { name: 'Remove tag sea' }),
    ).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm nx test personal-calibre -- src/lib/deliveries.test.ts src/lib/format.test.ts src/lib/spine.test.ts`
Expected: FAIL: modules not found.
Run: `pnpm nx e2e personal-calibre-e2e -- --grep "detail pane|deliveries|tags"`
Expected: FAIL: no `Book details` complementary region. Clear port 3333.

- [ ] **Step 3: Implement the pure helpers and the revalidation fix**

Create `apps/personal-calibre/src/lib/deliveries.ts`:

```ts
import type { BookDeliveryEvent } from '@/types/delivery';

const pad = (n: number) => String(n).padStart(2, '0');

function parseStoredTime(value: string): Date {
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value;
  return new Date(iso);
}

export function formatDeliveryTime(value: string): string {
  const d = parseStoredTime(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDeliveryDate(value: string): string {
  const time = formatDeliveryTime(value);
  return time === value ? value : time.slice(0, 10);
}

export function latestByPlatform(
  events: readonly BookDeliveryEvent[],
): Map<string, BookDeliveryEvent> {
  const latest = new Map<string, BookDeliveryEvent>();
  for (const event of events) {
    if (!latest.has(event.platformKey)) latest.set(event.platformKey, event);
  }
  return latest;
}
```

Create `apps/personal-calibre/src/lib/format.ts`:

```ts
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function seriesLine(series: string, index: number | null): string {
  if (index === null) return series;
  return `${series} · Book ${Number.isInteger(index) ? index : String(index)}`;
}

export function yearOf(pubdate: string | null): string | null {
  const year = pubdate ? Number(pubdate.slice(0, 4)) : NaN;
  return Number.isFinite(year) && year >= 1000 ? String(year) : null;
}
```

Create `apps/personal-calibre/src/lib/spine.ts`:

```ts
const SPINE_CLASSES = [
  'bg-[color:color-mix(in_oklch,var(--chart-1)_45%,var(--muted))]',
  'bg-[color:color-mix(in_oklch,var(--chart-2)_45%,var(--muted))]',
  'bg-[color:color-mix(in_oklch,var(--chart-3)_45%,var(--muted))]',
  'bg-[color:color-mix(in_oklch,var(--chart-4)_45%,var(--muted))]',
  'bg-[color:color-mix(in_oklch,var(--chart-5)_45%,var(--muted))]',
] as const;

export function spineClass(id: number): string {
  return SPINE_CLASSES[id % SPINE_CLASSES.length] ?? SPINE_CLASSES[0];
}
```

Create `apps/personal-calibre/src/lib/description.ts` (the options are today's, from
`books/[id]/page.tsx`):

```ts
import sanitizeHtml from 'sanitize-html';

export function sanitizeDescription(html: string | null): string | null {
  if (!html) return null;
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['class'],
    },
  });
}
```

In `apps/personal-calibre/src/lib/delivery.ts`, replace every `revalidateTag(<tag>, 'max')` with
`revalidateTag(<tag>, { expire: 0 })`, and in `deleteBookDeliveryEvent` expire `books` too:

```ts
revalidateTag('books', { expire: 0 });
revalidateTag(`book-${bookId}`, { expire: 0 });
```

In `apps/personal-calibre/src/lib/tags.ts`, `revalidateBookTagCache` becomes:

```ts
export function revalidateBookTagCache(bookId: number): void {
  revalidateTag('books', { expire: 0 });
  revalidateTag('filters', { expire: 0 });
  revalidateTag(`book-${bookId}`, { expire: 0 });
}
```

Run: `pnpm nx test personal-calibre -- src/lib/deliveries.test.ts src/lib/format.test.ts src/lib/spine.test.ts`
Expected: PASS.

- [ ] **Step 4: Implement the detail components**

Create `apps/personal-calibre/src/components/detail/PaneTopRow.tsx`:

```tsx
'use client';

import { Button, buttonVariants, Kbd } from '@rainforest-dev/rainforest-react';
import { ExternalLink, X } from 'lucide-react';
import Link from 'next/link';

import { useLibrary } from '@/components/library/LibraryProvider';
import { cn } from '@/lib/utils';

export function PaneTopRow({ bookId }: { bookId: number }) {
  const { closeBook } = useLibrary();
  return (
    <div className="flex items-center gap-1">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        Details
      </p>
      <span className="text-muted-foreground ml-auto hidden items-center gap-1 pr-1 text-xs lg:inline-flex">
        <Kbd>Esc</Kbd> close
      </span>
      <Link
        href={`/books/${bookId}`}
        aria-label="Open full page"
        title="Open full page"
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
          'ml-auto lg:ml-0',
        )}
      >
        <ExternalLink aria-hidden />
      </Link>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Close details"
        onClick={closeBook}
      >
        <X aria-hidden />
      </Button>
    </div>
  );
}
```

Create `apps/personal-calibre/src/components/detail/DownloadMenu.tsx`:

```tsx
'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@rainforest-dev/rainforest-react';
import { Download } from 'lucide-react';

import { formatBytes } from '@/lib/format';

export interface DownloadFile {
  format: string;
  size: number;
  href: string;
  fileName: string;
}

export function DownloadMenu({ files }: { files: DownloadFile[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <Download aria-hidden />
        Download
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {files.map((file) => (
          <DropdownMenuItem
            key={file.format}
            render={<a href={file.href} download={file.fileName} />}
          >
            {file.format}
            <span className="text-muted-foreground ml-auto pl-6 font-mono text-xs">
              {formatBytes(file.size)}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

Create `apps/personal-calibre/src/components/detail/DeliveryRows.tsx`:

```tsx
'use client';

import {
  Badge,
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  toast,
} from '@rainforest-dev/rainforest-react';
import { Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

import {
  formatDeliveryDate,
  formatDeliveryTime,
  latestByPlatform,
} from '@/lib/deliveries';
import type { BookDeliveryEvent, DeliveryPlatform } from '@/types/delivery';

interface Props {
  bookId: number;
  platforms: DeliveryPlatform[];
  events: BookDeliveryEvent[];
  headingAs: 'h2' | 'h3';
}

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : 'Unexpected error';

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    return ((await res.json()) as { error?: string }).error ?? fallback;
  } catch {
    return fallback;
  }
}

export function DeliveryRows({
  bookId,
  platforms,
  events,
  headingAs: Heading,
}: Props) {
  const headingId = useId();
  const latest = latestByPlatform(events);
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <Heading
        id={headingId}
        className="text-muted-foreground text-xs font-medium uppercase tracking-wide"
      >
        Deliveries
      </Heading>
      <ul className="divide-y rounded-lg border">
        {platforms.map((platform) => (
          <DeliveryRow
            key={platform.key}
            bookId={bookId}
            platform={platform}
            latest={latest.get(platform.key) ?? null}
          />
        ))}
      </ul>
      {events.length > 0 && (
        <details className="text-sm">
          <summary className="text-muted-foreground cursor-pointer select-none">
            History ({events.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {events.map((event) => (
              <HistoryItem key={event.id} bookId={bookId} event={event} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function DeliveryRow({
  bookId,
  platform,
  latest,
}: {
  bookId: number;
  platform: DeliveryPlatform;
  latest: BookDeliveryEvent | null;
}) {
  const router = useRouter();
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [externalRef, setExternalRef] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/books/${bookId}/deliveries`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ platformKey: platform.key, note, externalRef }),
      });
      if (!res.ok)
        throw new Error(await readError(res, 'Failed to add delivery event'));
      toast.success(`Logged ${platform.name}`);
      setOpen(false);
      setNote('');
      setExternalRef('');
      router.refresh();
    } catch (error) {
      toast.error(`Delivery failed — ${messageOf(error)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li
      data-platform={platform.key}
      className="flex items-center gap-3 px-3 py-2 text-sm"
    >
      <span className="font-medium">{platform.name}</span>
      {latest ? (
        <Badge variant="success">
          <Check aria-hidden />
          {formatDeliveryDate(latest.addedAt)}
        </Badge>
      ) : (
        <Badge variant="muted">Not added</Badge>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={<Button variant="outline" size="xs" className="ml-auto" />}
        >
          {latest ? 'Log again' : 'Mark added'}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <PopoverHeader>
            <PopoverTitle>Mark as added to {platform.name}</PopoverTitle>
            <PopoverDescription>
              Logs today&apos;s date. Both fields are optional.
            </PopoverDescription>
          </PopoverHeader>
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <label htmlFor={`${fieldId}-ref`} className="text-xs font-medium">
              Reference URL
            </label>
            <Input
              id={`${fieldId}-ref`}
              inputMode="url"
              value={externalRef}
              onChange={(e) => setExternalRef(e.target.value)}
            />
            <label htmlFor={`${fieldId}-note`} className="text-xs font-medium">
              Note
            </label>
            <Input
              id={`${fieldId}-note`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button type="submit" size="sm" disabled={saving}>
              Save
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </li>
  );
}

function HistoryItem({
  bookId,
  event,
}: {
  bookId: number;
  event: BookDeliveryEvent;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/books/${bookId}/deliveries?deliveryId=${event.id}`,
        {
          method: 'DELETE',
        },
      );
      if (!res.ok)
        throw new Error(
          await readError(res, 'Failed to delete delivery event'),
        );
      router.refresh();
    } catch (error) {
      toast.error(`Delivery failed — ${messageOf(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-start gap-2 rounded-md border p-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p>
          <span className="font-medium">{event.platformName}</span>{' '}
          <span className="text-muted-foreground font-mono text-xs">
            {formatDeliveryTime(event.addedAt)}
          </span>
        </p>
        {event.note && <p className="text-muted-foreground">{event.note}</p>}
        {event.externalRef && (
          <a
            href={event.externalRef}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground truncate underline"
          >
            {event.externalRef}
          </a>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Remove ${event.platformName} event`}
        disabled={busy}
        onClick={() => void remove()}
      >
        <X aria-hidden />
      </Button>
    </li>
  );
}
```

Replace `apps/personal-calibre/src/components/TagEditor.tsx` (same props, same API calls; chips
restyled, trigger renamed `Add tag`):

```tsx
'use client';

import {
  Button,
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@rainforest-dev/rainforest-react';
import { Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

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
  const availableTags = allTags.filter((t) => !existingIds.has(t.id));
  const trimmed = inputValue.trim();
  const matchesExisting = allTags.some(
    (t) => t.name?.toLowerCase() === trimmed.toLowerCase(),
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tagIds.map((tag) => (
        <span
          key={tag.id}
          className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-xs font-medium"
        >
          {tag.name}
          <button
            type="button"
            disabled={busy}
            onClick={() => void removeTag(tag.id)}
            aria-label={`Remove tag ${tag.name}`}
            className="hover:bg-foreground/10 rounded-full p-0.5 disabled:opacity-50"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={busy}
          render={
            <Button variant="outline" size="xs" className="rounded-full" />
          }
        >
          <Plus aria-hidden />
          Add tag
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search or create tag…"
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList>
              <CommandEmpty>
                {trimmed ? `Create "${trimmed}"` : 'No tags found.'}
              </CommandEmpty>
              {availableTags.map((t) => (
                <CommandItem
                  key={t.id}
                  value={t.name ?? ''}
                  onSelect={() => void addTag(t.name ?? '')}
                >
                  {t.name}
                </CommandItem>
              ))}
              {trimmed && !matchesExisting && (
                <CommandItem
                  value={`__create__${trimmed}`}
                  onSelect={() => void addTag(trimmed)}
                >
                  Create &quot;{trimmed}&quot;
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

Create `apps/personal-calibre/src/components/detail/BookDetail.tsx`:

```tsx
import { buttonVariants } from '@rainforest-dev/rainforest-react';
import { BookOpen, Star } from 'lucide-react';
import Link from 'next/link';
import { Fragment } from 'react';

import { TagEditor } from '@/components/TagEditor';
import { sanitizeDescription } from '@/lib/description';
import { staticDownloadUrl } from '@/lib/files';
import { seriesLine } from '@/lib/format';
import {
  buildLibraryHref,
  type ParamPatch,
  type RawSearchParams,
} from '@/lib/library-params';
import { spineClass } from '@/lib/spine';
import { cn } from '@/lib/utils';
import type {
  BookDetail as BookDetailData,
  FilterOptions,
  LibraryBook,
} from '@/types/calibre';
import type { BookDeliveryEvent, DeliveryPlatform } from '@/types/delivery';

import { DeliveryRows } from './DeliveryRows';
import { DownloadMenu } from './DownloadMenu';
import { PaneTopRow } from './PaneTopRow';

interface Props {
  variant: 'pane' | 'page';
  book: BookDetailData;
  library: LibraryBook | null;
  events: BookDeliveryEvent[];
  platforms: DeliveryPlatform[];
  allTags: FilterOptions['tags'];
  currentParams: RawSearchParams;
}

export function BookDetail({
  variant,
  book,
  library,
  events,
  platforms,
  allTags,
  currentParams,
}: Props) {
  const inPane = variant === 'pane';
  const Title = inPane ? 'h2' : 'h1';
  const Section = inPane ? 'h3' : 'h2';
  const hrefFor = (patch: ParamPatch) =>
    buildLibraryHref(inPane ? currentParams : {}, patch);
  const stars = book.rating === null ? null : Math.round(book.rating / 2);
  const hasEpub = book.formats.some((f) => f.toUpperCase() === 'EPUB');
  const description = sanitizeDescription(book.description);
  const authorLinks = library
    ? library.authors.map((name, i) => ({
        name,
        id: library.authorIds[i] ?? null,
      }))
    : book.authors.map((name) => ({ name, id: null }));
  const linkProps = { replace: inPane, scroll: false } as const;
  const sectionHeading =
    'text-muted-foreground text-xs font-medium uppercase tracking-wide';

  return (
    <article
      data-book-detail={book.id}
      className={cn(
        'flex flex-col gap-6',
        inPane ? 'p-4 lg:p-5' : 'mx-auto w-full max-w-3xl',
      )}
    >
      {inPane && <PaneTopRow bookId={book.id} />}
      <header className="flex gap-4">
        <div
          className={cn(
            'relative aspect-[2/3] shrink-0 overflow-hidden rounded-md',
            inPane ? 'w-[92px] lg:w-[108px]' : 'w-[108px] sm:w-[160px]',
          )}
        >
          {book.hasCover ? (
            <img
              src={`/api/books/${book.id}/cover`}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <div className={cn('size-full', spineClass(book.id))} />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {book.series &&
            (library?.seriesId ? (
              <Link
                href={hrefFor({ series: library.seriesId })}
                {...linkProps}
                className="text-muted-foreground w-fit text-sm hover:underline"
              >
                {seriesLine(book.series, book.seriesIndex)}
              </Link>
            ) : (
              <p className="text-muted-foreground text-sm">
                {seriesLine(book.series, book.seriesIndex)}
              </p>
            ))}
          <Title className="text-xl font-semibold leading-tight">
            {book.title}
          </Title>
          {authorLinks.length > 0 && (
            <p className="text-sm">
              {authorLinks.map((author, i) => (
                <Fragment key={`${author.name}-${i}`}>
                  {i > 0 && ', '}
                  {author.id !== null ? (
                    <Link
                      href={hrefFor({ author: author.id })}
                      {...linkProps}
                      className="hover:underline"
                    >
                      {author.name}
                    </Link>
                  ) : (
                    author.name
                  )}
                </Fragment>
              ))}
            </p>
          )}
          {stars !== null && (
            <p
              role="img"
              aria-label={`Rated ${stars} of 5`}
              className="text-chart-4 flex gap-0.5"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  aria-hidden
                  className={cn(
                    'size-4',
                    n <= stars ? 'fill-current' : 'opacity-35',
                  )}
                />
              ))}
            </p>
          )}
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {hasEpub && (
          <Link
            href={`/read/${book.id}`}
            className={buttonVariants({ size: 'sm' })}
          >
            <BookOpen aria-hidden />
            Read
          </Link>
        )}
        {book.files.length > 0 && (
          <DownloadMenu
            files={book.files.map((file) => ({
              format: file.format,
              size: file.size,
              href: staticDownloadUrl(book.path, file.name, file.format),
              fileName: `${file.name}.${file.format.toLowerCase()}`,
            }))}
          />
        )}
      </div>

      <section className="flex flex-col gap-2">
        <Section className={sectionHeading}>Tags</Section>
        <TagEditor bookId={book.id} tagIds={book.tagIds} allTags={allTags} />
      </section>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {book.publisher && (
          <>
            <dt className="text-muted-foreground">Publisher</dt>
            <dd>{book.publisher}</dd>
          </>
        )}
        {book.pubdate && (
          <>
            <dt className="text-muted-foreground">Published</dt>
            <dd>{book.pubdate.slice(0, 10)}</dd>
          </>
        )}
        {book.language && (
          <>
            <dt className="text-muted-foreground">Language</dt>
            <dd>{book.language}</dd>
          </>
        )}
        {book.formats.length > 0 && (
          <>
            <dt className="text-muted-foreground">Formats</dt>
            <dd className="font-mono text-xs">{book.formats.join(' · ')}</dd>
          </>
        )}
      </dl>

      <DeliveryRows
        bookId={book.id}
        platforms={platforms}
        events={events}
        headingAs={Section}
      />

      {description && (
        <section className="flex flex-col gap-2">
          <Section className={sectionHeading}>Description</Section>
          <div
            className="text-sm leading-relaxed [&_p]:mb-2"
            dangerouslySetInnerHTML={{ __html: description }}
          />
        </section>
      )}
    </article>
  );
}
```

Create `apps/personal-calibre/src/components/detail/BookDetailSkeleton.tsx`:

```tsx
import { Skeleton } from '@rainforest-dev/rainforest-react';

export function BookDetailSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading book"
      className="flex flex-col gap-6 p-4 lg:p-5"
    >
      <div className="flex gap-4">
        <Skeleton className="aspect-[2/3] w-[92px] shrink-0 lg:w-[108px]" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-6 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-28" />
      </div>
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((n) => (
          <Skeleton key={n} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add the pane slot and rebuild the permalink**

Create `apps/personal-calibre/src/app/(library)/@pane/page.tsx`:

```tsx
import { BookDetail } from '@/components/detail/BookDetail';
import { listBookDeliveryEvents, listDeliveryPlatforms } from '@/lib/delivery';
import { parseLibraryParams, type RawSearchParams } from '@/lib/library-params';
import { getBook, getFilterOptions, getLibraryBook } from '@/lib/queries';

export default async function PanePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const id = parseLibraryParams(raw).book;
  if (id === null) return null;
  const [book, library, events, platforms, options] = await Promise.all([
    getBook(id),
    getLibraryBook(id),
    listBookDeliveryEvents(id),
    listDeliveryPlatforms(),
    getFilterOptions(),
  ]);
  if (!book)
    return <p className="text-muted-foreground p-5 text-sm">Book not found.</p>;
  return (
    <BookDetail
      variant="pane"
      book={book}
      library={library}
      events={events}
      platforms={platforms}
      allTags={options.tags}
      currentParams={raw}
    />
  );
}
```

Create `apps/personal-calibre/src/app/(library)/@pane/loading.tsx`:

```tsx
import { BookDetailSkeleton } from '@/components/detail/BookDetailSkeleton';

export default function PaneLoading() {
  return <BookDetailSkeleton />;
}
```

Replace `apps/personal-calibre/src/app/(library)/books/[id]/page.tsx`:

```tsx
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { BookDetail } from '@/components/detail/BookDetail';
import { BookDetailSkeleton } from '@/components/detail/BookDetailSkeleton';
import { listBookDeliveryEvents, listDeliveryPlatforms } from '@/lib/delivery';
import { getBook, getFilterOptions, getLibraryBook } from '@/lib/queries';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}

export async function generateMetadata({
  params,
}: Pick<Props, 'params'>): Promise<Metadata> {
  const { id } = await params;
  const book = await getBook(Number(id));
  if (!book) return { title: 'Book Not Found — Personal Calibre Library' };
  return { title: `${book.title} — Personal Calibre Library` };
}

export default function BookPage(props: Props) {
  return (
    <Suspense fallback={<BookDetailSkeleton />}>
      <BookPageContent {...props} />
    </Suspense>
  );
}

async function BookPageContent({ params, searchParams }: Props) {
  const { id } = await params;
  const { from } = await searchParams;
  const bookId = Number(id);
  if (!Number.isInteger(bookId) || bookId < 1) notFound();

  const [book, library, events, platforms, options] = await Promise.all([
    getBook(bookId),
    getLibraryBook(bookId),
    listBookDeliveryEvents(bookId),
    listDeliveryPlatforms(),
    getFilterOptions(),
  ]);
  if (!book) notFound();

  const back =
    typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')
      ? from
      : '/';

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link
        href={back}
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Library
      </Link>
      <BookDetail
        variant="page"
        book={book}
        library={library}
        events={events}
        platforms={platforms}
        allTags={options.tags}
        currentParams={{}}
      />
    </div>
  );
}
```

Delete `apps/personal-calibre/src/components/DeliveryTracker.tsx` (`git rm`).

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm nx e2e personal-calibre-e2e -- --grep "detail pane|deliveries|tags|shell"`
Expected: PASS. If the Read link shows for book 46, check `hasEpub` against the seeded formats; if
`Logged Kobo` appears but the row still reads `Not added`, D12's `{ expire: 0 }` is missing from
`createBookDeliveryEvent`. Clear port 3333.

- [ ] **Step 7: Dev server check, lint, types and comment audit**

Dev-server check: load `/?book=38`, `/?book=46`, `/books/38`, and `/?book=38` at 390px (the
bottom Sheet opens; its close is the pane's `Close details`). Open the Download menu and a
`Mark added` popover in each; no console error.

Run: `pnpm nx run-many -t lint -p personal-calibre personal-calibre-e2e`
Run: `pnpm nx typecheck personal-calibre` and `pnpm nx typecheck personal-calibre-e2e`
Run: `pnpm nx test personal-calibre`
Run: `git diff -U0 HEAD | grep -E '^\+\s*(//|/\*|\*|#|\{/\*)'`
Expected: PASS; no comment hits. `books/[id]/page.tsx` loses its old open-redirect comment; the
`//` guard in `back` is the code now.

- [ ] **Step 8: Commit**

```bash
git checkout -- apps/personal-calibre/next-env.d.ts
git add apps/personal-calibre/src/lib/deliveries.ts apps/personal-calibre/src/lib/deliveries.test.ts \
  apps/personal-calibre/src/lib/format.ts apps/personal-calibre/src/lib/format.test.ts \
  apps/personal-calibre/src/lib/spine.ts apps/personal-calibre/src/lib/spine.test.ts \
  apps/personal-calibre/src/lib/description.ts \
  apps/personal-calibre/src/lib/delivery.ts apps/personal-calibre/src/lib/tags.ts \
  apps/personal-calibre/src/components/detail \
  apps/personal-calibre/src/components/TagEditor.tsx \
  apps/personal-calibre/src/components/DeliveryTracker.tsx \
  'apps/personal-calibre/src/app/(library)/@pane/page.tsx' \
  'apps/personal-calibre/src/app/(library)/@pane/loading.tsx' \
  'apps/personal-calibre/src/app/(library)/books/[id]/page.tsx' \
  apps/personal-calibre-e2e/src/pane.spec.ts apps/personal-calibre-e2e/src/deliveries.spec.ts \
  apps/personal-calibre-e2e/src/tags.spec.ts
git commit -m "$(cat <<'EOF'
feat(personal-calibre): detail pane with delivery rows, Read and Download

?book= opens BookDetail in the @pane slot; /books/[id] renders the same
component as the permalink. Deliveries show one row per platform with a
Mark added popover and a History list. Mutations now expire their cache
tags at once so the refresh after them shows the change.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm
EOF
)"
```

---

### Task 5: Shelf view, pager and the redirect fix

**Files:**

- Create: `apps/personal-calibre/src/lib/platforms.ts`
- Create: `apps/personal-calibre/src/lib/platforms.test.ts`
- Create: `apps/personal-calibre/src/components/library/ViewRegion.tsx`
- Create: `apps/personal-calibre/src/components/library/EmptyResult.tsx`
- Create: `apps/personal-calibre/src/components/views/ShelfView.tsx`
- Create: `apps/personal-calibre/src/components/views/BookTile.tsx`
- Create: `apps/personal-calibre/src/components/views/SelectMark.tsx`
- Create: `apps/personal-calibre/src/components/views/DeliveryMarks.tsx`
- Create: `apps/personal-calibre/src/components/views/GroupHeading.tsx`
- Modify: `apps/personal-calibre/src/components/Pagination.tsx` (whole file)
- Modify: `apps/personal-calibre/src/app/(library)/page.tsx` (whole file)
- Delete: `apps/personal-calibre/src/components/BookGrid.tsx`, `BookCard.tsx`,
  `BulkSelectionWrapper.tsx`
- Create: `apps/personal-calibre-e2e/src/shelf.spec.ts`
- Create: `apps/personal-calibre-e2e/src/pages.spec.ts`

**Interfaces:**

- Consumes: `getLibrary`, `getFilterOptions` (Task 2), `listDeliveryPlatforms`;
  `parseLibraryParams`, `toLibraryQuery`, `buildLibraryHref`, `hasFilters`, `PAGE_SIZE`,
  `RawSearchParams`, `GroupBy`, `ParamPatch`; `groupEntries`, `groupTitle`, `navKey`,
  `contentKey`, `booksLabel`, `EntryGroup`; `seriesLine`, `spineClass`; `useLibrary()` (Task 3).
- Produces:
  - `platformAbbr(key)`, `platformName(platforms, key)` (`src/lib/platforms.ts`).
  - `<ViewRegion library groupBy platforms filtered />`: `section[data-view-region=<view>]`
    named `{View} view`, `aria-busy` while a transition is pending; sets `pageInfo`.
  - `<BookTile book navKey row? selected open marksVisible platforms tabIndex onFocus? onActivate
onToggle className? />`: `div[role=option][data-nav-key][data-book-id][data-nav-row?]`,
    name `{title}, {authors}`; inner `[data-tile-cover]`, `[data-select-mark]`.
  - `<GroupHeading group shown />`, `<DeliveryMarks keys platforms />`, `<SelectMark />`,
    `<EmptyResult filtered />`.
  - `<Pagination page pageCount />`: client; `nav` named `Pagination`, links call `goToPage`.
  - `ShelfView` props `{ entries: LibraryEntry[]; groupBy: GroupBy | null;
platforms: DeliveryPlatform[]; page: number }`; its listbox is named `Books`.

- [ ] **Step 1: Write the failing tests**

Create `apps/personal-calibre/src/lib/platforms.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { platformAbbr, platformName } from './platforms';

describe('platforms', () => {
  it('abbreviates the known platforms and falls back to three letters', () => {
    expect(platformAbbr('kobo')).toBe('KB');
    expect(platformAbbr('notebooklm')).toBe('NLM');
    expect(platformAbbr('readwise-reader')).toBe('RW');
    expect(platformAbbr('pocketbook')).toBe('POC');
  });

  it('names a platform by key', () => {
    const platforms = [{ id: 1, key: 'kobo', name: 'Kobo' }];
    expect(platformName(platforms, 'kobo')).toBe('Kobo');
    expect(platformName(platforms, 'other')).toBe('other');
  });
});
```

Create `apps/personal-calibre-e2e/src/shelf.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

import { gotoLibrary, options, pane } from './support/library';

test.describe('shelf', () => {
  test('shows the first page as a cover grid', async ({ page }) => {
    await gotoLibrary(page);
    await expect(
      page.getByRole('region', { name: 'Shelf view' }),
    ).toBeVisible();
    await expect(options(page)).toHaveCount(30);
    await expect(
      page.getByRole('navigation', { name: 'Pagination' }),
    ).toContainText('Page 1 of 3');
  });

  test('clicking a tile opens the pane and Back closes it', async ({
    page,
  }) => {
    await gotoLibrary(page);
    const first = options(page).first();
    const id = await first.getAttribute('data-book-id');
    await first.click();
    await expect(page).toHaveURL(new RegExp(`book=${id}`));
    await expect(
      pane(page).locator(`[data-book-detail="${id}"]`),
    ).toBeVisible();
    await page.goBack();
    await expect(page).not.toHaveURL(/book=/);
  });

  test('marks show the platforms a book is on', async ({ page }) => {
    await gotoLibrary(page, '/?author=1');
    const tile = page.locator('[role="option"][data-book-id="1"]');
    await expect(tile.locator('[title="On Kobo"]')).toContainText('KB');
    await expect(tile.locator('[title="On NotebookLM"]')).toContainText('NLM');
  });

  test('groups by series with See all for a group this page cuts short', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?groupBy=series');
    await expect(
      page.getByRole('group', { name: 'Amber Road, 8 books' }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('group', { name: 'Glass Orchard, 7 books' })
        .getByRole('button', { name: /See all/ }),
    ).toHaveCount(0);
    await page
      .getByRole('group', { name: 'Northbound, 20 books' })
      .getByRole('button', { name: 'See all 20' })
      .click();
    await expect(page).toHaveURL(/series=3/);
    await expect(page).not.toHaveURL(/groupBy=/);
  });

  test('a group split across pages repeats its heading with (continued)', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?groupBy=series&page=2');
    await expect(page.getByRole('group').first()).toHaveAccessibleName(
      'Northbound (continued), 20 books',
    );
    await expect(
      page.getByRole('heading', { name: 'Northbound (continued)' }),
    ).toBeVisible();
  });

  test('the tile shows a new mark after Mark added in the pane', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?series=4&book=40');
    await pane(page)
      .locator('[data-platform="kobo"]')
      .getByRole('button', { name: /Mark added|Log again/ })
      .click();
    await page
      .getByRole('dialog', { name: 'Mark as added to Kobo' })
      .getByRole('button', { name: 'Save' })
      .click();
    await expect(
      page.locator('[role="option"][data-book-id="40"] [title="On Kobo"]'),
    ).toBeVisible();
  });

  test('an empty result offers Clear filters', async ({ page }) => {
    await gotoLibrary(page, '/?q=zzzz-no-such-book');
    await expect(page.getByText('No books match these filters.')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page).not.toHaveURL(/q=/);
    await expect(options(page)).toHaveCount(30);
  });
});
```

Create `apps/personal-calibre-e2e/src/pages.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

import { gotoLibrary, options, pane } from './support/library';

const pager = (page: import('@playwright/test').Page) =>
  page.getByRole('navigation', { name: 'Pagination' });

test.describe('pages', () => {
  test('the pager moves between pages and Back returns', async ({ page }) => {
    await gotoLibrary(page);
    await pager(page).getByRole('link', { name: 'Next' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(pager(page)).toContainText('Page 2 of 3');
    await page.goBack();
    await expect(page).not.toHaveURL(/page=/);
    await expect(pager(page)).toContainText('Page 1 of 3');
  });

  test('an out-of-range page lands on the last page with every param kept', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?page=99&groupBy=series&sortDir=desc&book=38');
    await expect(page).toHaveURL(/page=3/);
    for (const param of ['groupBy=series', 'sortDir=desc', 'book=38']) {
      await expect(page).toHaveURL(new RegExp(param));
    }
    await expect(pager(page)).toContainText('Page 3 of 3');
  });

  test('junk params are ignored', async ({ page }) => {
    await gotoLibrary(page, '/?page=abc&author=abc&groupBy=nope');
    await expect(pager(page)).toContainText('Page 1 of 3');
    await expect(options(page)).toHaveCount(30);
  });

  test('?book= survives a page change with the pane open', async ({ page }) => {
    await gotoLibrary(page, '/?book=38');
    await pager(page).getByRole('link', { name: 'Next' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page).toHaveURL(/book=38/);
    await expect(pane(page).locator('[data-book-detail="38"]')).toBeVisible();
  });

  test('the pager hides on a single page', async ({ page }) => {
    await gotoLibrary(page, '/?series=4');
    await expect(options(page)).toHaveCount(6);
    await expect(pager(page)).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm nx test personal-calibre -- src/lib/platforms.test.ts`
Expected: FAIL: module not found.
Run: `pnpm nx e2e personal-calibre-e2e -- --grep "shelf|pages"`
Expected: FAIL: no `Shelf view` region, no listbox. Clear port 3333.

- [ ] **Step 3: Implement the helpers and the pieces of a tile**

Create `apps/personal-calibre/src/lib/platforms.ts`:

```ts
import type { DeliveryPlatform } from '@/types/delivery';

const ABBREVIATIONS: Record<string, string> = {
  kobo: 'KB',
  notebooklm: 'NLM',
  'readwise-reader': 'RW',
};

export function platformAbbr(key: string): string {
  return ABBREVIATIONS[key] ?? key.slice(0, 3).toUpperCase();
}

export function platformName(
  platforms: readonly DeliveryPlatform[],
  key: string,
): string {
  return platforms.find((p) => p.key === key)?.name ?? key;
}
```

Create `apps/personal-calibre/src/components/views/SelectMark.tsx`:

```tsx
'use client';

import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

export function SelectMark({
  checked,
  visible,
  onToggle,
  className,
}: {
  checked: boolean;
  visible: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      data-select-mark
      data-checked={checked || undefined}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={cn(
        'border-input bg-background/90 flex size-5 cursor-pointer items-center justify-center rounded border transition-opacity',
        checked && 'border-primary bg-primary text-primary-foreground',
        visible || checked
          ? 'opacity-100'
          : 'opacity-0 group-hover/tile:opacity-100 group-focus-visible/tile:opacity-100',
        className,
      )}
    >
      {checked && <Check className="size-3.5" />}
    </span>
  );
}
```

Create `apps/personal-calibre/src/components/views/DeliveryMarks.tsx`:

```tsx
import { Check } from 'lucide-react';

import { platformAbbr, platformName } from '@/lib/platforms';
import { cn } from '@/lib/utils';
import type { DeliveryPlatform } from '@/types/delivery';

export function DeliveryMarks({
  keys,
  platforms,
  className,
}: {
  keys: readonly string[];
  platforms: readonly DeliveryPlatform[];
  className?: string;
}) {
  const unique = [...new Set(keys)];
  if (unique.length === 0) return null;
  return (
    <span className={cn('flex flex-col items-end gap-1', className)}>
      {unique.map((key) => {
        const label = `On ${platformName(platforms, key)}`;
        return (
          <span
            key={key}
            role="img"
            aria-label={label}
            title={label}
            className="bg-background/90 text-foreground inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold uppercase leading-none"
          >
            <Check className="text-success size-3" aria-hidden />
            {platformAbbr(key)}
          </span>
        );
      })}
    </span>
  );
}
```

Create `apps/personal-calibre/src/components/views/BookTile.tsx`:

```tsx
'use client';

import { seriesLine } from '@/lib/format';
import { spineClass } from '@/lib/spine';
import { cn } from '@/lib/utils';
import type { LibraryBook } from '@/types/calibre';
import type { DeliveryPlatform } from '@/types/delivery';

import { DeliveryMarks } from './DeliveryMarks';
import { SelectMark } from './SelectMark';

interface Props {
  book: LibraryBook;
  navKey: string;
  row?: string;
  selected: boolean;
  open: boolean;
  marksVisible: boolean;
  platforms: readonly DeliveryPlatform[];
  tabIndex: 0 | -1;
  onFocus?: () => void;
  onActivate: () => void;
  onToggle: () => void;
  className?: string;
}

export function BookTile({
  book,
  navKey,
  row,
  selected,
  open,
  marksVisible,
  platforms,
  tabIndex,
  onFocus,
  onActivate,
  onToggle,
  className,
}: Props) {
  return (
    <div
      role="option"
      aria-selected={selected}
      aria-label={`${book.title}, ${book.authors.join(', ')}`}
      tabIndex={tabIndex}
      data-nav-key={navKey}
      data-nav-row={row}
      data-book-id={book.id}
      onFocus={onFocus}
      onClick={onActivate}
      className={cn(
        'group/tile flex cursor-pointer flex-col gap-2 outline-none',
        className,
      )}
    >
      <div
        data-tile-cover
        className={cn(
          'relative aspect-[2/3] overflow-hidden rounded-md',
          'group-focus-visible/tile:outline-foreground group-focus-visible/tile:outline-[2.5px] group-focus-visible/tile:outline-offset-4',
          selected
            ? 'ring-primary ring-2'
            : open && 'ring-accent-foreground/40 ring-2 ring-inset',
        )}
      >
        {book.hasCover ? (
          <img
            src={`/api/books/${book.id}/cover`}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div
            className={cn('flex size-full items-end p-2', spineClass(book.id))}
          >
            <span className="bg-background/85 line-clamp-4 rounded px-1 text-xs font-medium">
              {book.title}
            </span>
          </div>
        )}
        <DeliveryMarks
          keys={book.deliveredTo}
          platforms={platforms}
          className="absolute right-1.5 top-1.5"
        />
        <SelectMark
          checked={selected}
          visible={marksVisible}
          onToggle={onToggle}
          className="absolute left-1.5 top-1.5"
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="line-clamp-2 text-sm font-medium leading-snug group-focus-visible/tile:underline">
          {book.title}
        </p>
        {book.authors.length > 0 && (
          <p className="text-muted-foreground line-clamp-1 text-xs">
            {book.authors.join(', ')}
          </p>
        )}
        {book.series && (
          <p className="text-muted-foreground line-clamp-1 text-xs">
            {seriesLine(book.series, book.seriesIndex)}
          </p>
        )}
        {book.formats.length > 0 && (
          <p className="text-muted-foreground font-mono text-[11px]">
            {book.formats.join(' · ')}
          </p>
        )}
      </div>
    </div>
  );
}
```

Create `apps/personal-calibre/src/components/views/GroupHeading.tsx`:

```tsx
'use client';

import { Button } from '@rainforest-dev/rainforest-react';

import { useLibrary } from '@/components/library/LibraryProvider';
import { booksLabel, type EntryGroup, groupTitle } from '@/lib/group-entries';
import type { ParamPatch } from '@/lib/library-params';
import { cn } from '@/lib/utils';

export function GroupHeading({
  group,
  shown,
}: {
  group: EntryGroup;
  shown: number;
}) {
  const { replaceParams } = useLibrary();
  const filter = group.filter;
  return (
    <div className="flex items-baseline gap-3">
      <h2
        className={cn(
          'text-heading font-semibold',
          group.continued && 'text-muted-foreground',
        )}
      >
        {groupTitle(group)}
      </h2>
      <span className="text-muted-foreground text-sm">
        {booksLabel(group.total)}
      </span>
      {filter && group.total > shown && (
        <Button
          variant="link"
          size="xs"
          className="ml-auto"
          onClick={() => {
            const patch: ParamPatch = { groupBy: null };
            patch[filter.param] = filter.id;
            replaceParams(patch);
          }}
        >
          See all {group.total}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Implement the Shelf, the region, the empty state and the pager**

Create `apps/personal-calibre/src/components/views/ShelfView.tsx`:

```tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import { useLibrary } from '@/components/library/LibraryProvider';
import {
  booksLabel,
  contentKey,
  groupEntries,
  groupTitle,
  navKey,
} from '@/lib/group-entries';
import { type GroupBy, parseLibraryParams } from '@/lib/library-params';
import type { LibraryEntry } from '@/types/calibre';
import type { DeliveryPlatform } from '@/types/delivery';

import { BookTile } from './BookTile';
import { GroupHeading } from './GroupHeading';

interface Props {
  entries: LibraryEntry[];
  groupBy: GroupBy | null;
  platforms: DeliveryPlatform[];
  page: number;
}

export function ShelfView({ entries, groupBy, platforms }: Props) {
  const key = contentKey(entries);
  const groups = useMemo(
    () => (groupBy ? groupEntries(entries, groupBy) : null),
    [key, groupBy],
  );
  const openId = parseLibraryParams(useSearchParams()).book;
  const { selected, selectMode, toggle, openBook } = useLibrary();
  const marksVisible = selectMode || selected.size > 0;

  const tile = (entry: LibraryEntry, row?: string) => (
    <BookTile
      key={navKey(entry)}
      book={entry.book}
      navKey={navKey(entry)}
      row={row}
      selected={selected.has(entry.book.id)}
      open={openId === entry.book.id}
      marksVisible={marksVisible}
      platforms={platforms}
      tabIndex={0}
      onActivate={() =>
        selectMode ? toggle(entry.book.id) : openBook(entry.book.id)
      }
      onToggle={() => toggle(entry.book.id)}
      className={row ? 'w-32 shrink-0 lg:w-[148px]' : undefined}
    />
  );

  if (!groups) {
    return (
      <div
        role="listbox"
        aria-label="Books"
        aria-multiselectable="true"
        className="grid grid-cols-2 gap-x-5 gap-y-7 lg:grid-cols-[repeat(auto-fill,minmax(148px,1fr))]"
      >
        {entries.map((entry) => tile(entry))}
      </div>
    );
  }

  return (
    <div
      role="listbox"
      aria-label="Books"
      aria-multiselectable="true"
      className="flex flex-col gap-8"
    >
      {groups.map((group) => (
        <div
          key={group.key}
          role="group"
          aria-label={`${groupTitle(group)}, ${booksLabel(group.total)}`}
          className="flex flex-col gap-3"
        >
          <GroupHeading group={group} shown={group.entries.length} />
          <div className="-mx-1 flex gap-5 overflow-x-auto px-1 pb-2">
            {group.entries.map((entry) => tile(entry, group.key))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

`page` is unused until Task 6; keep it in the props so the region's call does not change.

Create `apps/personal-calibre/src/components/library/EmptyResult.tsx`:

```tsx
'use client';

import { Button } from '@rainforest-dev/rainforest-react';
import { SearchX } from 'lucide-react';

import { useLibrary } from './LibraryProvider';

export function EmptyResult({ filtered }: { filtered: boolean }) {
  const { clearFilters } = useLibrary();
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      {filtered ? (
        <>
          <SearchX className="text-muted-foreground size-10" aria-hidden />
          <p>No books match these filters.</p>
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        </>
      ) : (
        <p>No books in this library yet.</p>
      )}
    </div>
  );
}
```

Create `apps/personal-calibre/src/components/library/ViewRegion.tsx`:

```tsx
'use client';

import { useEffect } from 'react';

import { ShelfView } from '@/components/views/ShelfView';
import type { GroupBy } from '@/lib/library-params';
import { VIEW_LABELS } from '@/lib/prefs';
import { cn } from '@/lib/utils';
import type { LibraryResult } from '@/types/calibre';
import type { DeliveryPlatform } from '@/types/delivery';

import { EmptyResult } from './EmptyResult';
import { useLibrary } from './LibraryProvider';

interface Props {
  library: LibraryResult;
  groupBy: GroupBy | null;
  platforms: DeliveryPlatform[];
  filtered: boolean;
}

export function ViewRegion({ library, groupBy, platforms, filtered }: Props) {
  const { view, isPending, setPageInfo } = useLibrary();
  const { page, pageCount, entries } = library;
  useEffect(
    () => setPageInfo({ page, pageCount }),
    [page, pageCount, setPageInfo],
  );

  return (
    <section
      aria-label={`${VIEW_LABELS[view]} view`}
      aria-busy={isPending}
      data-view-region={view}
      className={cn('transition-opacity', isPending && 'opacity-60')}
    >
      {entries.length === 0 ? (
        <EmptyResult filtered={filtered} />
      ) : (
        <ShelfView
          entries={entries}
          groupBy={groupBy}
          platforms={platforms}
          page={page}
        />
      )}
    </section>
  );
}
```

Replace `apps/personal-calibre/src/components/Pagination.tsx`:

```tsx
'use client';

import { Button, buttonVariants } from '@rainforest-dev/rainforest-react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { MouseEvent, ReactNode } from 'react';

import { useLibrary } from '@/components/library/LibraryProvider';
import { buildLibraryHref } from '@/lib/library-params';

export function Pagination({
  page,
  pageCount,
}: {
  page: number;
  pageCount: number;
}) {
  const searchParams = useSearchParams();
  const { goToPage } = useLibrary();
  if (pageCount <= 1) return null;

  const step = (target: number, label: ReactNode, enabled: boolean) => {
    if (!enabled) {
      return (
        <Button variant="outline" size="sm" disabled>
          {label}
        </Button>
      );
    }
    return (
      <Link
        href={buildLibraryHref(searchParams, { page: target })}
        scroll={false}
        className={buttonVariants({ variant: 'outline', size: 'sm' })}
        onClick={(event: MouseEvent<HTMLAnchorElement>) => {
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey
          )
            return;
          event.preventDefault();
          goToPage(target);
        }}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-center gap-3 py-4 text-sm"
    >
      {step(
        page - 1,
        <>
          <ArrowLeft aria-hidden />
          Prev
        </>,
        page > 1,
      )}
      <span className="text-muted-foreground tabular-nums">
        Page {page} of {pageCount}
      </span>
      {step(
        page + 1,
        <>
          Next
          <ArrowRight aria-hidden />
        </>,
        page < pageCount,
      )}
    </nav>
  );
}
```

Replace `apps/personal-calibre/src/app/(library)/page.tsx`. `FilterBar` stays as the interim
toolbar until Task 7; it reads and writes the URL on its own:

```tsx
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { FilterBar } from '@/components/FilterBar';
import { ViewRegion } from '@/components/library/ViewRegion';
import { Pagination } from '@/components/Pagination';
import { listDeliveryPlatforms } from '@/lib/delivery';
import {
  buildLibraryHref,
  hasFilters,
  PAGE_SIZE,
  parseLibraryParams,
  type RawSearchParams,
  toLibraryQuery,
} from '@/lib/library-params';
import { getFilterOptions, getLibrary } from '@/lib/queries';

interface Props {
  searchParams: Promise<RawSearchParams>;
}

export default function LibraryPage({ searchParams }: Props) {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          aria-busy="true"
          aria-label="Loading books"
          className="min-h-[60vh]"
        />
      }
    >
      <LibraryContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LibraryContent({ searchParams }: Props) {
  const raw = await searchParams;
  const params = parseLibraryParams(raw);
  const [library, filters, platforms] = await Promise.all([
    getLibrary(toLibraryQuery(params, PAGE_SIZE)),
    getFilterOptions(),
    listDeliveryPlatforms(),
  ]);
  if (params.page > library.pageCount) {
    redirect(buildLibraryHref(raw, { page: library.pageCount }));
  }

  return (
    <div className="flex flex-col gap-6 py-4">
      <FilterBar filters={filters} platforms={platforms} />
      <ViewRegion
        library={library}
        groupBy={params.groupBy}
        platforms={platforms}
        filtered={hasFilters(params)}
      />
      <Pagination page={library.page} pageCount={library.pageCount} />
    </div>
  );
}
```

Delete the replaced components:

```bash
git rm apps/personal-calibre/src/components/BookGrid.tsx \
  apps/personal-calibre/src/components/BookCard.tsx \
  apps/personal-calibre/src/components/BulkSelectionWrapper.tsx
```

`BulkActionBar.tsx` is now unused and goes in Task 8, which replaces it; bulk actions are absent
between Tasks 5 and 8.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm nx test personal-calibre -- src/lib/platforms.test.ts`
Expected: PASS.
Run: `pnpm nx e2e personal-calibre-e2e -- --grep "shelf|pages|detail pane"`
Expected: PASS. Clear port 3333.

- [ ] **Step 6: Dev server check, lint, types and comment audit**

Dev-server check: load `/`, `/?groupBy=series`, `/?groupBy=series&page=2`, `/?page=99` (lands on
page 3), `/?q=zzzz`, and `/` at 390px (two columns). No console error, no hydration warning.

Run: `pnpm nx run-many -t lint -p personal-calibre personal-calibre-e2e`
Run: `pnpm nx typecheck personal-calibre` and `pnpm nx typecheck personal-calibre-e2e`
Run: `git diff -U0 HEAD | grep -E '^\+\s*(//|/\*|\*|#|\{/\*)'`
Expected: PASS; no comment hits.

- [ ] **Step 7: Commit**

```bash
git checkout -- apps/personal-calibre/next-env.d.ts
git add apps/personal-calibre/src/lib/platforms.ts apps/personal-calibre/src/lib/platforms.test.ts \
  apps/personal-calibre/src/components/library/ViewRegion.tsx \
  apps/personal-calibre/src/components/library/EmptyResult.tsx \
  apps/personal-calibre/src/components/views \
  apps/personal-calibre/src/components/Pagination.tsx \
  apps/personal-calibre/src/components/BookGrid.tsx \
  apps/personal-calibre/src/components/BookCard.tsx \
  apps/personal-calibre/src/components/BulkSelectionWrapper.tsx \
  'apps/personal-calibre/src/app/(library)/page.tsx' \
  apps/personal-calibre-e2e/src/shelf.spec.ts apps/personal-calibre-e2e/src/pages.spec.ts
git commit -m "$(cat <<'EOF'
feat(personal-calibre): Shelf view over getLibrary with a paged grouped mode

Tiles open the pane, show delivery marks and a select mark. Grouped
pages show each group as a row with See all and repeat a split group's
heading with (continued). An out-of-range page now redirects to the
last page and keeps every param.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm
EOF
)"
```

---

### Task 6: Roving focus in the views

**Files:**

- Create: `apps/personal-calibre/src/lib/roving.ts`
- Create: `apps/personal-calibre/src/lib/roving.test.ts`
- Create: `apps/personal-calibre/src/hooks/useRovingNav.ts`
- Modify: `apps/personal-calibre/src/components/views/ShelfView.tsx` (whole file)
- Create: `apps/personal-calibre-e2e/src/keyboard.spec.ts`

**Interfaces:**

- Consumes: `useLibrary()` (`focusId`, `setFocusId`, `pendingFocus`, `requestFocus`, `toggle`,
  `openBook`); `bookIdOfNavKey`, `navKey`, `contentKey`.
- Produces:
  - `src/lib/roving.ts`: `NAV_KEYS`, `type NavKey`, `type NavMode = 'grid' | 'list'`,
    `interface NavRect`, `interface NavItem { key: string; row: string; order: number;
rect: NavRect }`, `isNavKey(key)`, `assignRowsByTop(items)`,
    `pickTarget(items, current, key, mods: { ctrl: boolean }, mode = 'grid'): string | null`.
  - `useRovingNav<T extends HTMLElement>({ navKeys, mode, page, contentKey })` returning
    `{ containerRef: RefObject<T | null>; stopKey: string | null; onItemFocus(key): void;
onKeyDown(event): void }`. It applies `pendingFocus` (`first` on the matching page, `book`
    on mount or change) and handles arrows, `Home`/`End` (with `Ctrl`/`⌘`), `Enter`, `x`, `Space`.

- [ ] **Step 1: Write the failing tests**

Create `apps/personal-calibre/src/lib/roving.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { assignRowsByTop, isNavKey, type NavItem, pickTarget } from './roving';

const grid = (cols: number, count: number): NavItem[] =>
  assignRowsByTop(
    Array.from({ length: count }, (_, i) => ({
      key: `all:${i + 1}`,
      row: '',
      order: i,
      rect: {
        x: (i % cols) * 170,
        y: Math.floor(i / cols) * 300,
        width: 148,
        height: 272,
      },
    })),
  );

const noCtrl = { ctrl: false };

describe('isNavKey', () => {
  it('accepts arrows, Home and End only', () => {
    expect(isNavKey('ArrowUp')).toBe(true);
    expect(isNavKey('End')).toBe(true);
    expect(isNavKey('PageDown')).toBe(false);
    expect(isNavKey('x')).toBe(false);
  });
});

describe('pickTarget in a grid', () => {
  const items = grid(3, 7);

  it('derives rows from the item tops', () => {
    expect(items.map((i) => i.row)).toEqual([
      '0',
      '0',
      '0',
      '300',
      '300',
      '300',
      '600',
    ]);
  });

  it('moves left and right in reading order across rows', () => {
    expect(pickTarget(items, 'all:3', 'ArrowRight', noCtrl)).toBe('all:4');
    expect(pickTarget(items, 'all:4', 'ArrowLeft', noCtrl)).toBe('all:3');
  });

  it('stops at the page edges', () => {
    expect(pickTarget(items, 'all:1', 'ArrowLeft', noCtrl)).toBeNull();
    expect(pickTarget(items, 'all:7', 'ArrowRight', noCtrl)).toBeNull();
    expect(pickTarget(items, 'all:2', 'ArrowUp', noCtrl)).toBeNull();
    expect(pickTarget(items, 'all:7', 'ArrowDown', noCtrl)).toBeNull();
  });

  it('moves up and down to the nearest item by rect', () => {
    expect(pickTarget(items, 'all:2', 'ArrowDown', noCtrl)).toBe('all:5');
    expect(pickTarget(items, 'all:5', 'ArrowUp', noCtrl)).toBe('all:2');
    expect(pickTarget(items, 'all:6', 'ArrowDown', noCtrl)).toBe('all:7');
  });

  it('prefers the next row over a closer column two rows down', () => {
    const items2: NavItem[] = [
      {
        key: 'a',
        row: 'r0',
        order: 0,
        rect: { x: 0, y: 0, width: 148, height: 272 },
      },
      {
        key: 'b',
        row: 'r1',
        order: 1,
        rect: { x: 340, y: 300, width: 148, height: 272 },
      },
      {
        key: 'c',
        row: 'r2',
        order: 2,
        rect: { x: 0, y: 600, width: 148, height: 272 },
      },
    ];
    expect(pickTarget(items2, 'a', 'ArrowDown', noCtrl)).toBe('b');
  });

  it('goes to the ends of the current row with Home and End', () => {
    expect(pickTarget(items, 'all:5', 'Home', noCtrl)).toBe('all:4');
    expect(pickTarget(items, 'all:5', 'End', noCtrl)).toBe('all:6');
  });

  it('goes to the ends of the page with Ctrl+Home and Ctrl+End', () => {
    expect(pickTarget(items, 'all:5', 'Home', { ctrl: true })).toBe('all:1');
    expect(pickTarget(items, 'all:5', 'End', { ctrl: true })).toBe('all:7');
  });

  it('starts from the first item when the current key is gone', () => {
    expect(pickTarget(items, 'all:99', 'ArrowRight', noCtrl)).toBe('all:1');
  });
});

describe('pickTarget over group rows', () => {
  const rows: NavItem[] = [
    {
      key: 'series:1:2',
      row: 'series:1',
      order: 0,
      rect: { x: 0, y: 0, width: 148, height: 272 },
    },
    {
      key: 'series:1:3',
      row: 'series:1',
      order: 1,
      rect: { x: 170, y: 0, width: 148, height: 272 },
    },
    {
      key: 'series:1:4',
      row: 'series:1',
      order: 2,
      rect: { x: 340, y: 0, width: 148, height: 272 },
    },
    {
      key: 'series:2:9',
      row: 'series:2',
      order: 3,
      rect: { x: 0, y: 360, width: 148, height: 272 },
    },
    {
      key: 'series:2:8',
      row: 'series:2',
      order: 4,
      rect: { x: 170, y: 360, width: 148, height: 272 },
    },
  ];

  it('crosses groups in reading order', () => {
    expect(pickTarget(rows, 'series:1:4', 'ArrowRight', noCtrl)).toBe(
      'series:2:9',
    );
  });

  it('moves down to the nearest book of the next group row', () => {
    expect(pickTarget(rows, 'series:1:4', 'ArrowDown', noCtrl)).toBe(
      'series:2:8',
    );
  });

  it('keeps Home and End inside the group row', () => {
    expect(pickTarget(rows, 'series:2:8', 'Home', noCtrl)).toBe('series:2:9');
    expect(pickTarget(rows, 'series:1:2', 'End', noCtrl)).toBe('series:1:4');
  });

  it('uses the rows the caller gives, as Study will from its layout', () => {
    const overlapping = rows.map((item) => ({
      ...item,
      rect: { ...item.rect, y: 0 },
    }));
    expect(pickTarget(overlapping, 'series:2:8', 'Home', noCtrl)).toBe(
      'series:2:9',
    );
  });
});

describe('pickTarget with one book in two tags', () => {
  const dupes: NavItem[] = [
    {
      key: 'tag:8:39',
      row: 'tag:8',
      order: 0,
      rect: { x: 0, y: 0, width: 148, height: 272 },
    },
    {
      key: 'tag:3:39',
      row: 'tag:3',
      order: 1,
      rect: { x: 0, y: 360, width: 148, height: 272 },
    },
    {
      key: 'tag:3:42',
      row: 'tag:3',
      order: 2,
      rect: { x: 170, y: 360, width: 148, height: 272 },
    },
  ];

  it('treats each copy as its own item', () => {
    expect(pickTarget(dupes, 'tag:8:39', 'ArrowRight', noCtrl)).toBe(
      'tag:3:39',
    );
    expect(pickTarget(dupes, 'tag:3:39', 'ArrowLeft', noCtrl)).toBe('tag:8:39');
    expect(pickTarget(dupes, 'tag:3:39', 'ArrowRight', noCtrl)).toBe(
      'tag:3:42',
    );
  });
});

describe('pickTarget in a list', () => {
  const list: NavItem[] = [
    {
      key: 'series:1:2',
      row: 'series:1',
      order: 0,
      rect: { x: 0, y: 0, width: 800, height: 48 },
    },
    {
      key: 'series:1:3',
      row: 'series:1',
      order: 1,
      rect: { x: 0, y: 48, width: 800, height: 48 },
    },
    {
      key: 'series:2:9',
      row: 'series:2',
      order: 2,
      rect: { x: 0, y: 140, width: 800, height: 48 },
    },
  ];

  it('moves one row with ArrowUp and ArrowDown and ignores left and right', () => {
    expect(pickTarget(list, 'series:1:3', 'ArrowDown', noCtrl, 'list')).toBe(
      'series:2:9',
    );
    expect(pickTarget(list, 'series:1:3', 'ArrowUp', noCtrl, 'list')).toBe(
      'series:1:2',
    );
    expect(
      pickTarget(list, 'series:1:3', 'ArrowRight', noCtrl, 'list'),
    ).toBeNull();
    expect(
      pickTarget(list, 'series:2:9', 'ArrowDown', noCtrl, 'list'),
    ).toBeNull();
  });

  it('keeps Home and End in the current group and Ctrl reaches the page ends', () => {
    expect(pickTarget(list, 'series:1:3', 'Home', noCtrl, 'list')).toBe(
      'series:1:2',
    );
    expect(pickTarget(list, 'series:1:2', 'End', noCtrl, 'list')).toBe(
      'series:1:3',
    );
    expect(pickTarget(list, 'series:1:2', 'End', { ctrl: true }, 'list')).toBe(
      'series:2:9',
    );
  });
});
```

Create `apps/personal-calibre-e2e/src/keyboard.spec.ts`:

```ts
import { expect, type Page, test } from '@playwright/test';

import { gotoLibrary, options, tokenColor } from './support/library';

async function columns(page: Page): Promise<number> {
  return page.evaluate(() => {
    const tiles = Array.from(document.querySelectorAll('[role="option"]'));
    const top = tiles[0]?.getBoundingClientRect().top;
    return tiles.filter((t) => t.getBoundingClientRect().top === top).length;
  });
}

test.describe('shelf keyboard', () => {
  test('has one tab stop, reached by Tab from the toolbar', async ({
    page,
  }) => {
    await gotoLibrary(page);
    await expect(page.locator('[role="option"][tabindex="0"]')).toHaveCount(1);
    await page.getByRole('button', { name: /Sort direction/ }).focus();
    await page.keyboard.press('Tab');
    await expect(options(page).first()).toBeFocused();
  });

  test('arrows move in reading order and stop at the ends', async ({
    page,
  }) => {
    await gotoLibrary(page);
    await options(page).first().focus();
    await page.keyboard.press('ArrowLeft');
    await expect(options(page).first()).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(options(page).nth(1)).toBeFocused();
    await expect(page.locator('[role="option"][tabindex="0"]')).toHaveCount(1);
    await options(page).last().focus();
    await page.keyboard.press('ArrowRight');
    await expect(options(page).last()).toBeFocused();
  });

  test('ArrowDown and ArrowUp move between rows', async ({ page }) => {
    await gotoLibrary(page);
    const cols = await columns(page);
    await options(page).first().focus();
    await page.keyboard.press('ArrowDown');
    await expect(options(page).nth(cols)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(options(page).first()).toBeFocused();
  });

  test('Home and End stay in the row; Ctrl+Home and Ctrl+End reach the page ends', async ({
    page,
  }) => {
    await gotoLibrary(page);
    const cols = await columns(page);
    await options(page).nth(1).focus();
    await page.keyboard.press('End');
    await expect(options(page).nth(cols - 1)).toBeFocused();
    await page.keyboard.press('Home');
    await expect(options(page).first()).toBeFocused();
    await page.keyboard.press('Control+End');
    await expect(options(page).last()).toBeFocused();
    await page.keyboard.press('Control+Home');
    await expect(options(page).first()).toBeFocused();
  });

  test('x and Space toggle the selection and Enter opens the pane', async ({
    page,
  }) => {
    await gotoLibrary(page);
    const first = options(page).first();
    await first.focus();
    await page.keyboard.press('x');
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Space');
    await expect(first).toHaveAttribute('aria-selected', 'false');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(
      new RegExp(`book=${await first.getAttribute('data-book-id')}`),
    );
    await expect(first).toBeFocused();
  });

  test('focus is foreground and selection is primary', async ({ page }) => {
    await gotoLibrary(page);
    const first = options(page).first();
    await first.focus();
    await page.keyboard.press('x');
    const foreground = await tokenColor(page, '--foreground');
    const primary = await tokenColor(page, '--primary');
    await expect
      .poll(() =>
        first
          .locator('[data-tile-cover]')
          .evaluate((el) => getComputedStyle(el).outlineColor),
      )
      .toBe(foreground);
    await expect
      .poll(() =>
        first
          .locator('[data-select-mark]')
          .evaluate((el) => getComputedStyle(el).backgroundColor),
      )
      .toBe(primary);
  });

  test('with tag grouping, x selects every copy and arrows reach the other copy', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?groupBy=tag&series=4');
    const copies = page.locator('[role="option"][data-book-id="39"]');
    await expect(copies).toHaveCount(2);
    await copies.first().focus();
    await page.keyboard.press('x');
    await expect(copies.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(copies.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(copies.first()).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(copies.nth(1)).toBeFocused();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm nx test personal-calibre -- src/lib/roving.test.ts`
Expected: FAIL: module not found.
Run: `pnpm nx e2e personal-calibre-e2e -- --grep "shelf keyboard"`
Expected: FAIL: every tile has `tabindex="0"`, arrows do nothing. Clear port 3333.

- [ ] **Step 3: Implement `roving.ts`**

Create `apps/personal-calibre/src/lib/roving.ts`:

```ts
export const NAV_KEYS = [
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
] as const;
export type NavKey = (typeof NAV_KEYS)[number];
export type NavMode = 'grid' | 'list';

export interface NavRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NavItem {
  key: string;
  row: string;
  order: number;
  rect: NavRect;
}

const VERTICAL_WEIGHT = 4;

export function isNavKey(key: string): key is NavKey {
  return NAV_KEYS.some((k) => k === key);
}

export function assignRowsByTop(items: readonly NavItem[]): NavItem[] {
  return items.map((item) => ({
    ...item,
    row: String(Math.round(item.rect.y)),
  }));
}

const centerX = (rect: NavRect) => rect.x + rect.width / 2;

function nearestVertical(
  items: readonly NavItem[],
  current: NavItem,
  down: boolean,
): NavItem | null {
  let best: NavItem | null = null;
  let bestScore = Infinity;
  for (const item of items) {
    if (item.row === current.row) continue;
    const gap = down
      ? item.rect.y - (current.rect.y + current.rect.height)
      : current.rect.y - (item.rect.y + item.rect.height);
    if (gap < -1) continue;
    const score =
      Math.abs(centerX(item.rect) - centerX(current.rect)) +
      VERTICAL_WEIGHT * Math.max(0, gap);
    if (score < bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return best;
}

export function pickTarget(
  items: readonly NavItem[],
  current: string,
  key: NavKey,
  mods: { ctrl: boolean },
  mode: NavMode = 'grid',
): string | null {
  const ordered = [...items].sort((a, b) => a.order - b.order);
  const index = ordered.findIndex((item) => item.key === current);
  const item = ordered[index];
  if (!item) return ordered[0]?.key ?? null;

  if (key === 'Home' || key === 'End') {
    const scope = mods.ctrl
      ? ordered
      : ordered.filter((i) => i.row === item.row);
    return (key === 'Home' ? scope[0] : scope.at(-1))?.key ?? null;
  }

  const step = (delta: number) => ordered[index + delta]?.key ?? null;
  if (mode === 'list') {
    if (key === 'ArrowUp') return step(-1);
    if (key === 'ArrowDown') return step(1);
    return null;
  }
  if (key === 'ArrowLeft') return step(-1);
  if (key === 'ArrowRight') return step(1);
  return nearestVertical(ordered, item, key === 'ArrowDown')?.key ?? null;
}
```

Run: `pnpm nx test personal-calibre -- src/lib/roving.test.ts`
Expected: PASS.

- [ ] **Step 4: Implement `useRovingNav` and use it in the Shelf**

Create `apps/personal-calibre/src/hooks/useRovingNav.ts`:

```ts
'use client';

import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useLibrary } from '@/components/library/LibraryProvider';
import { bookIdOfNavKey } from '@/lib/group-entries';
import {
  assignRowsByTop,
  isNavKey,
  type NavItem,
  type NavMode,
  pickTarget,
} from '@/lib/roving';

interface Options {
  navKeys: readonly string[];
  mode: NavMode;
  page: number;
  contentKey: string;
}

function collectItems(container: HTMLElement, mode: NavMode): NavItem[] {
  const items = Array.from(
    container.querySelectorAll<HTMLElement>('[data-nav-key]'),
  )
    .filter((el) => el.getClientRects().length > 0)
    .map((el, order) => {
      const r = el.getBoundingClientRect();
      return {
        key: el.dataset['navKey'] ?? '',
        row: el.dataset['navRow'] ?? '',
        order,
        rect: { x: r.x, y: r.y, width: r.width, height: r.height },
      };
    });
  return mode === 'grid' && items.some((i) => i.row === '')
    ? assignRowsByTop(items)
    : items;
}

export function useRovingNav<T extends HTMLElement>({
  navKeys,
  mode,
  page,
  contentKey,
}: Options) {
  const containerRef = useRef<T>(null);
  const { focusId, setFocusId, pendingFocus, requestFocus, toggle, openBook } =
    useLibrary();
  const [active, setActive] = useState<string | null>(null);

  const stopKey =
    (active !== null && navKeys.includes(active) ? active : undefined) ??
    (focusId !== null
      ? navKeys.find((k) => bookIdOfNavKey(k) === focusId)
      : undefined) ??
    navKeys[0] ??
    null;

  const focusElement = useCallback((el: HTMLElement | null | undefined) => {
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!pendingFocus || !container) return;
    if (pendingFocus.kind === 'first') {
      if (pendingFocus.page !== page) return;
      requestFocus(null);
      focusElement(container.querySelector<HTMLElement>('[data-nav-key]'));
      return;
    }
    requestFocus(null);
    focusElement(
      container.querySelector<HTMLElement>(
        `[data-book-id="${pendingFocus.id}"]`,
      ),
    );
  }, [pendingFocus, page, contentKey, requestFocus, focusElement]);

  const onItemFocus = useCallback(
    (key: string) => {
      setActive(key);
      setFocusId(bookIdOfNavKey(key));
    },
    [setFocusId],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const item = event.target instanceof HTMLElement ? event.target : null;
      const key = item?.dataset['navKey'];
      if (!key || event.altKey) return;
      if (isNavKey(event.key)) {
        event.preventDefault();
        const container = containerRef.current;
        if (!container) return;
        const target = pickTarget(
          collectItems(container, mode),
          key,
          event.key,
          { ctrl: event.ctrlKey || event.metaKey },
          mode,
        );
        if (target) {
          focusElement(
            container.querySelector<HTMLElement>(
              `[data-nav-key="${CSS.escape(target)}"]`,
            ),
          );
        }
        return;
      }
      if (event.ctrlKey || event.metaKey) return;
      const bookId = bookIdOfNavKey(key);
      if (event.key === 'Enter') {
        event.preventDefault();
        openBook(bookId);
      } else if (event.key === 'x' || event.key === ' ') {
        event.preventDefault();
        toggle(bookId);
      }
    },
    [focusElement, mode, openBook, toggle],
  );

  return { containerRef, stopKey, onItemFocus, onKeyDown };
}
```

Replace `apps/personal-calibre/src/components/views/ShelfView.tsx`:

```tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import { useLibrary } from '@/components/library/LibraryProvider';
import { useRovingNav } from '@/hooks/useRovingNav';
import {
  booksLabel,
  contentKey,
  groupEntries,
  groupTitle,
  navKey,
} from '@/lib/group-entries';
import { type GroupBy, parseLibraryParams } from '@/lib/library-params';
import type { LibraryEntry } from '@/types/calibre';
import type { DeliveryPlatform } from '@/types/delivery';

import { BookTile } from './BookTile';
import { GroupHeading } from './GroupHeading';

interface Props {
  entries: LibraryEntry[];
  groupBy: GroupBy | null;
  platforms: DeliveryPlatform[];
  page: number;
}

export function ShelfView({ entries, groupBy, platforms, page }: Props) {
  const key = contentKey(entries);
  const groups = useMemo(
    () => (groupBy ? groupEntries(entries, groupBy) : null),
    [key, groupBy],
  );
  const navKeys = useMemo(() => entries.map(navKey), [key]);
  const { containerRef, stopKey, onItemFocus, onKeyDown } =
    useRovingNav<HTMLDivElement>({
      navKeys,
      mode: 'grid',
      page,
      contentKey: key,
    });
  const openId = parseLibraryParams(useSearchParams()).book;
  const { selected, selectMode, toggle, openBook } = useLibrary();
  const marksVisible = selectMode || selected.size > 0;

  const tile = (entry: LibraryEntry, row?: string) => {
    const k = navKey(entry);
    return (
      <BookTile
        key={k}
        book={entry.book}
        navKey={k}
        row={row}
        selected={selected.has(entry.book.id)}
        open={openId === entry.book.id}
        marksVisible={marksVisible}
        platforms={platforms}
        tabIndex={k === stopKey ? 0 : -1}
        onFocus={() => onItemFocus(k)}
        onActivate={() =>
          selectMode ? toggle(entry.book.id) : openBook(entry.book.id)
        }
        onToggle={() => toggle(entry.book.id)}
        className={row ? 'w-32 shrink-0 lg:w-[148px]' : undefined}
      />
    );
  };

  const listboxProps = {
    ref: containerRef,
    role: 'listbox',
    'aria-label': 'Books',
    'aria-multiselectable': true,
    onKeyDown,
  } as const;

  if (!groups) {
    return (
      <div
        {...listboxProps}
        className="grid grid-cols-2 gap-x-5 gap-y-7 lg:grid-cols-[repeat(auto-fill,minmax(148px,1fr))]"
      >
        {entries.map((entry) => tile(entry))}
      </div>
    );
  }

  return (
    <div {...listboxProps} className="flex flex-col gap-8">
      {groups.map((group) => (
        <div
          key={group.key}
          role="group"
          aria-label={`${groupTitle(group)}, ${booksLabel(group.total)}`}
          className="flex flex-col gap-3"
        >
          <GroupHeading group={group} shown={group.entries.length} />
          <div className="-mx-1 flex gap-5 overflow-x-auto px-1 pb-2">
            {group.entries.map((entry) => tile(entry, group.key))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm nx e2e personal-calibre-e2e -- --grep "shelf keyboard|shelf|pages"`
Expected: PASS. If `focus is foreground` reads the ring colour instead, the cover's
`outline-foreground` lost to the base layer's `outline-ring/50`: the `group-focus-visible/tile:`
utilities must be on `[data-tile-cover]`, not on the option. Clear port 3333.

- [ ] **Step 6: Lint, types and comment audit**

Run: `pnpm nx run-many -t lint -p personal-calibre personal-calibre-e2e`
Run: `pnpm nx typecheck personal-calibre` and `pnpm nx typecheck personal-calibre-e2e`
Run: `pnpm nx test personal-calibre`
Run: `git diff -U0 HEAD | grep -E '^\+\s*(//|/\*|\*|#|\{/\*)'`
Expected: PASS; no comment hits.

- [ ] **Step 7: Commit**

```bash
git add apps/personal-calibre/src/lib/roving.ts apps/personal-calibre/src/lib/roving.test.ts \
  apps/personal-calibre/src/hooks/useRovingNav.ts \
  apps/personal-calibre/src/components/views/ShelfView.tsx \
  apps/personal-calibre-e2e/src/keyboard.spec.ts
git commit -m "$(cat <<'EOF'
feat(personal-calibre): roving focus and view keys in the Shelf

One tab stop per view; arrows walk the page by reading order and by
rect, Home and End stay in the row, Ctrl or Cmd with them reach the
page ends, and Enter, x and Space open and select.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm
EOF
)"
```

---

### Task 7: Search, filter panel and toolbar

**Files:**

- Create: `apps/personal-calibre/src/components/library/SearchField.tsx`
- Create: `apps/personal-calibre/src/components/library/FilterPanel.tsx`
- Create: `apps/personal-calibre/src/components/library/Facet.tsx`
- Create: `apps/personal-calibre/src/components/library/DeliveredToggle.tsx`
- Create: `apps/personal-calibre/src/components/library/SortControls.tsx`
- Create: `apps/personal-calibre/src/components/library/FilterChips.tsx`
- Create: `apps/personal-calibre/src/components/library/LibraryToolbar.tsx`
- Modify: `apps/personal-calibre/src/components/library/LibraryHeader.tsx` (whole file)
- Create: `apps/personal-calibre/src/app/(library)/@filters/page.tsx`
- Modify: `apps/personal-calibre/src/app/(library)/page.tsx` (return block and imports)
- Delete: `apps/personal-calibre/src/components/FilterBar.tsx`
- Create: `apps/personal-calibre-e2e/src/search.spec.ts`
- Create: `apps/personal-calibre-e2e/src/filters.spec.ts`

**Interfaces:**

- Consumes: `useLibrary()` (`replaceParams`, `clearFilters`, `togglePanel`, `openBook`,
  `setFiltersOpen`, `selectMode`, `setSelectMode`, `clear`, `panelOpen`); `parseLibraryParams`,
  `filterCount`, `activeFilters`, `scopeTitle`, `FilterLabels`, `GroupBy`, `SortBy`;
  `booksLabel`; `/api/books/search` (`{ results: Array<{ id; title; author; series }> }`).
- Produces:
  - `<SearchField initialQuery />`: root `[data-library-search]`, input placeholder
    `Search books`; Enter or `Search for "…"` sets `q`; a suggestion opens the pane (P11).
  - `<FilterPanel options platforms />` with `<Facet />` and `<DeliveredToggle />`.
  - `<GroupSelect className? />` and `<SortControls />` from `SortControls.tsx`.
  - `<FilterChips labels />`.
  - `<LibraryToolbar labels matchingBooks libraryTotal />`: phone row (`Filters`, `Select` /
    `Done`), scope `h1`, count, Group, Sort, chips.

- [ ] **Step 1: Write the failing tests**

Create `apps/personal-calibre-e2e/src/search.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

import { gotoLibrary, pane } from './support/library';

test.describe('search', () => {
  test('typing shows a search item and suggestions', async ({ page }) => {
    await gotoLibrary(page);
    await page.getByPlaceholder('Search books').fill('Salt Archive');
    await expect(
      page.getByRole('option', { name: 'Search for "Salt Archive"' }),
    ).toBeVisible();
    await expect(
      page.getByRole('option', { name: /The Salt Archive/ }),
    ).toBeVisible();
  });

  test('Enter commits the search to the URL', async ({ page }) => {
    await gotoLibrary(page);
    await page.getByPlaceholder('Search books').fill('Halvik');
    await page.getByPlaceholder('Search books').press('Enter');
    await expect(page).toHaveURL(/q=Halvik/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Results for "Halvik"',
    );
    await expect(page.getByText('20 of 70 books')).toBeVisible();
  });

  test('picking a suggestion opens the pane', async ({ page }) => {
    await gotoLibrary(page);
    const input = page.getByPlaceholder('Search books');
    await input.fill('Salt Archive');
    await expect(
      page.getByRole('option', { name: /The Salt Archive/ }),
    ).toBeVisible();
    await input.press('ArrowDown');
    await input.press('Enter');
    await expect(page).toHaveURL(/book=1/);
    await expect(page).not.toHaveURL(/q=/);
    await expect(pane(page).locator('[data-book-detail="1"]')).toBeVisible();
  });

  test('the clear button removes the search', async ({ page }) => {
    await gotoLibrary(page, '/?q=Salt');
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(page).not.toHaveURL(/q=/);
  });
});
```

Create `apps/personal-calibre-e2e/src/filters.spec.ts`:

```ts
import { expect, type Page, test } from '@playwright/test';

import { gotoLibrary } from './support/library';

const panel = (page: Page) => page.locator('#library-filters');

test.describe('filters', () => {
  test('a facet filters the list, titles the scope and adds a chip', async ({
    page,
  }) => {
    await gotoLibrary(page);
    await panel(page)
      .getByRole('button', { name: 'Northbound', exact: true })
      .click();
    await expect(page).toHaveURL(/series=3/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Northbound',
    );
    await expect(page.getByText('20 of 70 books')).toBeVisible();
    await expect(
      panel(page).getByRole('heading', { name: 'Filters · 1' }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Remove filter Series: Northbound' })
      .click();
    await expect(page).not.toHaveURL(/series=/);
  });

  test('Show all swaps in a filter list', async ({ page }) => {
    await gotoLibrary(page);
    await panel(page)
      .getByRole('region', { name: 'Authors' })
      .getByRole('button', { name: 'Show all 10' })
      .click();
    await panel(page).getByPlaceholder('Filter authors').fill('Ilv');
    await panel(page).getByRole('option', { name: 'Soren Ilves' }).click();
    await expect(page).toHaveURL(/author=10/);
  });

  test('the delivery facet filters On and Not on a platform', async ({
    page,
  }) => {
    await gotoLibrary(page);
    await panel(page)
      .getByRole('button', { name: 'Kobo', exact: true })
      .click();
    await expect(page).toHaveURL(/platform=kobo/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('On Kobo');
    await expect(
      page.locator('[role="option"][data-book-id="1"]'),
    ).toBeVisible();
    await panel(page).getByRole('button', { name: 'Not on' }).click();
    await expect(page).toHaveURL(/delivered=false/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Not on Kobo',
    );
    await expect(page.locator('[role="option"][data-book-id="1"]')).toHaveCount(
      0,
    );
  });

  test('Clear all keeps book, view and group', async ({ page }) => {
    await gotoLibrary(page, '/?author=4&tag=6&book=38&groupBy=series');
    await panel(page).getByRole('button', { name: 'Clear all' }).click();
    await expect(page).toHaveURL(/\/\?book=38&groupBy=series$/);
  });

  test('sort, direction and group change the URL and drop page', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?page=2');
    await page
      .getByRole('button', { name: 'Sort direction: ascending' })
      .click();
    await expect(page).toHaveURL(/sortDir=desc/);
    await expect(page).not.toHaveURL(/page=/);
    await page.getByRole('combobox', { name: 'Sort' }).click();
    await page.getByRole('option', { name: 'Date added' }).click();
    await expect(page).toHaveURL(/sortBy=added/);
    await page.getByRole('combobox', { name: 'Group' }).click();
    await page.getByRole('option', { name: 'Series', exact: true }).click();
    await expect(page).toHaveURL(/groupBy=series/);
  });

  test('a new tag appears in the filter panel', async ({ page }) => {
    await page.request.post('/api/books/46/tags', {
      data: { name: 'to-read' },
    });
    await gotoLibrary(page);
    await panel(page)
      .getByRole('region', { name: 'Tags' })
      .getByRole('button', { name: /^Show all \d+$/ })
      .click();
    await panel(page).getByPlaceholder('Filter tags').fill('to-r');
    await expect(
      panel(page).getByRole('option', { name: 'to-read' }),
    ).toBeVisible();
  });
});
```

Each facet is a `section` labelled by its heading, so it is a named region the tests can scope to.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm nx e2e personal-calibre-e2e -- --grep "search|filters"`
Expected: FAIL: no `Search books` placeholder, empty filter panel. Clear port 3333.

- [ ] **Step 3: Implement the panel pieces**

Create `apps/personal-calibre/src/components/library/Facet.tsx`:

```tsx
'use client';

import {
  Button,
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from '@rainforest-dev/rainforest-react';
import { type ReactNode, useId, useState } from 'react';

import { cn } from '@/lib/utils';

const VISIBLE_OPTIONS = 8;

export interface FacetOption {
  value: string;
  label: string;
}

interface Props {
  title: string;
  allLabel: string;
  options: FacetOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  children?: ReactNode;
}

export function Facet({
  title,
  allLabel,
  options,
  value,
  onChange,
  children,
}: Props) {
  const headingId = useId();
  const [expanded, setExpanded] = useState(false);
  const selected = options.find((o) => o.value === value);
  const visible = options.slice(0, VISIBLE_OPTIONS);
  const shown =
    selected && !visible.includes(selected) ? [...visible, selected] : visible;
  const filterLabel = `Filter ${title.toLowerCase()}`;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1">
      <h3
        id={headingId}
        className="text-muted-foreground px-2 text-xs font-medium uppercase tracking-wide"
      >
        {title}
      </h3>
      {expanded ? (
        <Command label={title} className="h-auto rounded-md border p-0">
          <CommandInput placeholder={filterLabel} aria-label={filterLabel} />
          <CommandList>
            <CommandItem
              value="__all__"
              data-checked={value === null}
              onSelect={() => onChange(null)}
            >
              {allLabel}
            </CommandItem>
            {options.map((o) => (
              <CommandItem
                key={o.value}
                value={`${o.label} ${o.value}`}
                data-checked={o.value === value}
                onSelect={() => onChange(o.value)}
              >
                {o.label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      ) : (
        <ul className="flex flex-col">
          <li>
            <FacetButton
              label={allLabel}
              pressed={value === null}
              onClick={() => onChange(null)}
            />
          </li>
          {shown.map((o) => (
            <li key={o.value}>
              <FacetButton
                label={o.label}
                pressed={o.value === value}
                onClick={() => onChange(o.value === value ? null : o.value)}
              />
              {o.value === value && children}
            </li>
          ))}
        </ul>
      )}
      {options.length > VISIBLE_OPTIONS && (
        <Button
          variant="link"
          size="xs"
          className="self-start"
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? 'Show fewer' : `Show all ${options.length}`}
        </Button>
      )}
    </section>
  );
}

function FacetButton({
  label,
  pressed,
  onClick,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'hover:bg-sidebar-accent w-full truncate rounded-md px-2 py-1 text-left text-sm',
        pressed &&
          'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
      )}
    >
      {label}
    </button>
  );
}
```

Create `apps/personal-calibre/src/components/library/DeliveredToggle.tsx`:

```tsx
'use client';

import { ToggleGroup, ToggleGroupItem } from '@rainforest-dev/rainforest-react';

export function DeliveredToggle({
  delivered,
  onChange,
}: {
  delivered: boolean;
  onChange: (delivered: boolean) => void;
}) {
  return (
    <ToggleGroup
      aria-label="Delivery status"
      variant="outline"
      size="sm"
      className="my-1 ml-2"
      value={[delivered ? 'on' : 'not-on']}
      onValueChange={(values) => {
        if (values[0] === 'on') onChange(true);
        if (values[0] === 'not-on') onChange(false);
      }}
    >
      <ToggleGroupItem value="on">On</ToggleGroupItem>
      <ToggleGroupItem value="not-on">Not on</ToggleGroupItem>
    </ToggleGroup>
  );
}
```

Create `apps/personal-calibre/src/components/library/SortControls.tsx`:

```tsx
'use client';

import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@rainforest-dev/rainforest-react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import {
  GROUP_BYS,
  parseLibraryParams,
  SORT_BYS,
  type SortBy,
} from '@/lib/library-params';

import { useLibrary } from './LibraryProvider';

const GROUP_ITEMS = [
  { value: 'none', label: 'None' },
  { value: 'series', label: 'Series' },
  { value: 'tag', label: 'Tag' },
  { value: 'author', label: 'Author' },
];

const SORT_ITEMS: Array<{ value: SortBy; label: string }> = [
  { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
  { value: 'added', label: 'Date added' },
  { value: 'pubdate', label: 'Published' },
  { value: 'rating', label: 'Rating' },
];

export function GroupSelect({ className }: { className?: string }) {
  const params = parseLibraryParams(useSearchParams());
  const { replaceParams } = useLibrary();
  return (
    <Select
      items={GROUP_ITEMS}
      value={params.groupBy ?? 'none'}
      onValueChange={(value) => {
        const next = GROUP_BYS.find((g) => g === value) ?? null;
        replaceParams({ groupBy: next });
      }}
    >
      <SelectTrigger size="sm" aria-label="Group" className={className}>
        <span className="text-muted-foreground text-xs">Group</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {GROUP_ITEMS.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SortControls() {
  const params = parseLibraryParams(useSearchParams());
  const { replaceParams } = useLibrary();
  const descending = params.sortDir === 'desc';
  return (
    <div className="flex items-center gap-1">
      <Select
        items={SORT_ITEMS}
        value={params.sortBy}
        onValueChange={(value) => {
          const next = SORT_BYS.find((s) => s === value);
          if (next) replaceParams({ sortBy: next });
        }}
      >
        <SelectTrigger size="sm" aria-label="Sort">
          <span className="text-muted-foreground text-xs">Sort</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label={`Sort direction: ${descending ? 'descending' : 'ascending'}`}
        onClick={() => replaceParams({ sortDir: descending ? 'asc' : 'desc' })}
      >
        {descending ? <ArrowDown aria-hidden /> : <ArrowUp aria-hidden />}
      </Button>
    </div>
  );
}
```

Create `apps/personal-calibre/src/components/library/FilterPanel.tsx`:

```tsx
'use client';

import { Button } from '@rainforest-dev/rainforest-react';
import { PanelLeftClose } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import { filterCount, parseLibraryParams } from '@/lib/library-params';
import { cn } from '@/lib/utils';
import type { FilterOptions } from '@/types/calibre';
import type { DeliveryPlatform } from '@/types/delivery';

import { DeliveredToggle } from './DeliveredToggle';
import { Facet, type FacetOption } from './Facet';
import { useLibrary } from './LibraryProvider';
import { GroupSelect } from './SortControls';

const toOptions = (
  rows: ReadonlyArray<{
    id: number;
    name: string | null;
    sort?: string | null;
  }>,
): FacetOption[] =>
  rows.map((r) => ({
    value: String(r.id),
    label: r.name ?? r.sort ?? `#${r.id}`,
  }));

const toId = (value: string | null) => (value === null ? null : Number(value));

export function FilterPanel({
  options,
  platforms,
}: {
  options: FilterOptions;
  platforms: DeliveryPlatform[];
}) {
  const params = parseLibraryParams(useSearchParams());
  const { replaceParams, clearFilters, togglePanel } = useLibrary();
  const count = filterCount(params);

  return (
    <div className="flex flex-col gap-5 px-2 py-4">
      <div className="flex items-center gap-2 px-2">
        <h2 className="text-sm font-semibold">
          {count > 0 ? `Filters · ${count}` : 'Filters'}
        </h2>
        {count > 0 && (
          <Button
            variant="link"
            size="xs"
            className="ml-auto"
            onClick={clearFilters}
          >
            Clear all
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Collapse filters"
          onClick={togglePanel}
          className={cn('hidden lg:inline-flex', count === 0 && 'ml-auto')}
        >
          <PanelLeftClose aria-hidden />
        </Button>
      </div>
      <GroupSelect className="mx-2 lg:hidden" />
      <Facet
        title="Delivery"
        allLabel="Any platform"
        options={platforms.map((p) => ({ value: p.key, label: p.name }))}
        value={params.platform}
        onChange={(platform) => replaceParams({ platform })}
      >
        <DeliveredToggle
          delivered={params.delivered !== false}
          onChange={(delivered) => replaceParams({ delivered })}
        />
      </Facet>
      <Facet
        title="Tags"
        allLabel="All tags"
        options={toOptions(options.tags)}
        value={params.tag === null ? null : String(params.tag)}
        onChange={(v) => replaceParams({ tag: toId(v) })}
      />
      <Facet
        title="Series"
        allLabel="All series"
        options={toOptions(options.series)}
        value={params.series === null ? null : String(params.series)}
        onChange={(v) => replaceParams({ series: toId(v) })}
      />
      <Facet
        title="Authors"
        allLabel="All authors"
        options={toOptions(options.authors)}
        value={params.author === null ? null : String(params.author)}
        onChange={(v) => replaceParams({ author: toId(v) })}
      />
    </div>
  );
}
```

Create `apps/personal-calibre/src/app/(library)/@filters/page.tsx`:

```tsx
import { Suspense } from 'react';

import { FilterPanel } from '@/components/library/FilterPanel';
import { listDeliveryPlatforms } from '@/lib/delivery';
import { getFilterOptions } from '@/lib/queries';

export default function FiltersSlot() {
  return (
    <Suspense fallback={null}>
      <FiltersContent />
    </Suspense>
  );
}

async function FiltersContent() {
  const [options, platforms] = await Promise.all([
    getFilterOptions(),
    listDeliveryPlatforms(),
  ]);
  return <FilterPanel options={options} platforms={platforms} />;
}
```

- [ ] **Step 4: Implement search, chips, toolbar and the header**

Create `apps/personal-calibre/src/components/library/SearchField.tsx`:

```tsx
'use client';

import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from '@rainforest-dev/rainforest-react';
import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useLibrary } from './LibraryProvider';

interface Suggestion {
  id: number;
  title: string;
  author: string;
  series: string | null;
}

export function SearchField({ initialQuery }: { initialQuery: string }) {
  const { replaceParams, openBook } = useLibrary();
  const [text, setText] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const trimmed = text.trim();

  useEffect(() => {
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/books/search?q=${encodeURIComponent(trimmed)}`,
          {
            signal: controller.signal,
          },
        );
        const body = (await res.json()) as { results?: Suggestion[] };
        setSuggestions(body.results?.slice(0, 8) ?? []);
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  const commit = () => {
    setOpen(false);
    replaceParams({ q: trimmed || null });
  };

  return (
    <Command
      data-library-search
      shouldFilter={false}
      label="Search books"
      className="relative size-auto w-full overflow-visible bg-transparent p-0"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      <CommandInput
        placeholder="Search books"
        aria-label="Search books"
        value={text}
        onValueChange={(value) => {
          setText(value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      {text && (
        <button
          type="button"
          aria-label="Clear search"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setText('');
            replaceParams({ q: null });
          }}
          className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
      <CommandList
        hidden={!(open && trimmed.length > 0)}
        onMouseDown={(event) => event.preventDefault()}
        className="bg-popover text-popover-foreground ring-foreground/10 absolute inset-x-0 top-full z-50 mt-1 rounded-lg p-1 shadow-md ring-1"
      >
        <CommandItem value="__search__" onSelect={commit}>
          <Search aria-hidden />
          Search for &quot;{trimmed}&quot;
        </CommandItem>
        {suggestions.map((s) => (
          <CommandItem
            key={s.id}
            value={`book-${s.id}`}
            onSelect={() => {
              setOpen(false);
              openBook(s.id);
            }}
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{s.title}</span>
              <span className="text-muted-foreground truncate text-xs">
                {s.author}
                {s.series ? ` · ${s.series}` : ''}
              </span>
            </span>
          </CommandItem>
        ))}
      </CommandList>
    </Command>
  );
}
```

`openBook` pushes `?book=` and leaves `q` alone; the test `picking a suggestion` expects no `q`
because none was committed, so do not add one.

Create `apps/personal-calibre/src/components/library/FilterChips.tsx`:

```tsx
'use client';

import { Button } from '@rainforest-dev/rainforest-react';
import { X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import {
  activeFilters,
  type FilterLabels,
  parseLibraryParams,
} from '@/lib/library-params';

import { useLibrary } from './LibraryProvider';

export function FilterChips({ labels }: { labels: FilterLabels }) {
  const params = parseLibraryParams(useSearchParams());
  const { replaceParams, clearFilters } = useLibrary();
  const chips = activeFilters(params, labels);
  if (chips.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:flex-wrap lg:pb-0">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="bg-muted inline-flex shrink-0 items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-xs"
        >
          {chip.label}
          <button
            type="button"
            aria-label={`Remove filter ${chip.label}`}
            onClick={() => replaceParams(chip.patch)}
            className="hover:bg-foreground/10 rounded-full p-0.5"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <Button
        variant="link"
        size="xs"
        className="shrink-0"
        onClick={clearFilters}
      >
        Clear all
      </Button>
    </div>
  );
}
```

Create `apps/personal-calibre/src/components/library/LibraryToolbar.tsx`:

```tsx
'use client';

import { Badge, Button } from '@rainforest-dev/rainforest-react';
import { SlidersHorizontal } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import { booksLabel } from '@/lib/group-entries';
import {
  type FilterLabels,
  filterCount,
  parseLibraryParams,
  scopeTitle,
} from '@/lib/library-params';

import { FilterChips } from './FilterChips';
import { useLibrary } from './LibraryProvider';
import { GroupSelect, SortControls } from './SortControls';

interface Props {
  labels: FilterLabels;
  matchingBooks: number;
  libraryTotal: number;
}

export function LibraryToolbar({ labels, matchingBooks, libraryTotal }: Props) {
  const params = parseLibraryParams(useSearchParams());
  const { selectMode, setSelectMode, setFiltersOpen, clear } = useLibrary();
  const count = filterCount(params);
  const total =
    matchingBooks === libraryTotal
      ? booksLabel(libraryTotal)
      : `${matchingBooks} of ${booksLabel(libraryTotal)}`;

  return (
    <div className="bg-background z-20 flex flex-col gap-2 border-b py-3 lg:sticky lg:top-14">
      <div className="flex items-center gap-2 lg:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal aria-hidden />
          Filters
          {count > 0 && <Badge variant="secondary">{count}</Badge>}
        </Button>
        <Button
          variant={selectMode ? 'default' : 'outline'}
          size="sm"
          className="ml-auto"
          onClick={() => {
            if (selectMode) clear();
            setSelectMode(!selectMode);
          }}
        >
          {selectMode ? 'Done' : 'Select'}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-heading font-semibold">
          {scopeTitle(params, labels)}
        </h1>
        <p className="text-muted-foreground text-sm">{total}</p>
        <div className="ml-auto flex items-center gap-2">
          <GroupSelect className="hidden lg:flex" />
          <SortControls />
        </div>
      </div>
      <FilterChips labels={labels} />
    </div>
  );
}
```

Replace `apps/personal-calibre/src/components/library/LibraryHeader.tsx`:

```tsx
'use client';

import { Badge, Button } from '@rainforest-dev/rainforest-react';
import { LibraryBig, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { filterCount, parseLibraryParams } from '@/lib/library-params';

import { useLibrary } from './LibraryProvider';
import { SearchField } from './SearchField';
import { ViewSwitch } from './ViewSwitch';

export function LibraryHeader({ isList }: { isList: boolean }) {
  const { panelOpen, togglePanel } = useLibrary();
  const params = parseLibraryParams(useSearchParams());
  const count = filterCount(params);
  return (
    <header className="bg-background sticky top-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2 lg:h-14 lg:flex-nowrap lg:px-4 lg:py-0">
      {isList && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="hidden lg:inline-flex"
          aria-label={panelOpen ? 'Hide filters' : 'Show filters'}
          aria-expanded={panelOpen}
          aria-controls="library-filters"
          onClick={togglePanel}
        >
          {panelOpen ? (
            <PanelLeftClose aria-hidden />
          ) : (
            <PanelLeftOpen aria-hidden />
          )}
        </Button>
      )}
      <Link
        href="/"
        className="flex items-center gap-2 font-semibold tracking-tight"
      >
        <LibraryBig className="size-5" aria-hidden />
        Library
      </Link>
      {isList && <ViewSwitch className="ml-auto lg:ml-2" />}
      {isList && (
        <div className="order-last w-full lg:order-none lg:mx-auto lg:w-auto lg:max-w-[420px] lg:flex-1">
          <SearchField key={params.q ?? ''} initialQuery={params.q ?? ''} />
        </div>
      )}
      {isList && !panelOpen && count > 0 && (
        <Badge variant="secondary" className="hidden lg:inline-flex">
          {count} filter{count === 1 ? '' : 's'}
        </Badge>
      )}
    </header>
  );
}
```

In `apps/personal-calibre/src/app/(library)/page.tsx`, replace the `FilterBar` import with
`import { LibraryToolbar } from '@/components/library/LibraryToolbar';`, add `type FilterLabels`
to the `@/lib/library-params` import, and replace the returned JSX with:

```tsx
const labels: FilterLabels = { ...filters, platforms };
return (
  <div className="flex flex-col gap-4">
    <LibraryToolbar
      labels={labels}
      matchingBooks={library.matchingIds.length}
      libraryTotal={library.libraryTotal}
    />
    <ViewRegion
      library={library}
      groupBy={params.groupBy}
      platforms={platforms}
      filtered={hasFilters(params)}
    />
    <Pagination page={library.page} pageCount={library.pageCount} />
  </div>
);
```

Delete `apps/personal-calibre/src/components/FilterBar.tsx` (`git rm`).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm nx e2e personal-calibre-e2e -- --grep "search|filters|shelf|shell|keyboard"`
Expected: PASS. If `Search for "…"` never becomes the active cmdk item, check that
`CommandList` stays mounted while hidden: cmdk only selects items it has registered.
Clear port 3333.

- [ ] **Step 6: Dev server check, lint, types and comment audit**

Dev-server check: load `/`, type in search (suggestions list under the input, `↓` moves into
it), pick a tag, collapse the panel (the header badge shows `1 filter`), and at 390px open
`Filters` (left Sheet with Group at the top). No console error.

Run: `pnpm nx run-many -t lint -p personal-calibre personal-calibre-e2e`
Run: `pnpm nx typecheck personal-calibre` and `pnpm nx typecheck personal-calibre-e2e`
Run: `git diff -U0 HEAD | grep -E '^\+\s*(//|/\*|\*|#|\{/\*)'`
Expected: PASS; no comment hits.

- [ ] **Step 7: Commit**

```bash
git checkout -- apps/personal-calibre/next-env.d.ts
git add apps/personal-calibre/src/components/library/SearchField.tsx \
  apps/personal-calibre/src/components/library/FilterPanel.tsx \
  apps/personal-calibre/src/components/library/Facet.tsx \
  apps/personal-calibre/src/components/library/DeliveredToggle.tsx \
  apps/personal-calibre/src/components/library/SortControls.tsx \
  apps/personal-calibre/src/components/library/FilterChips.tsx \
  apps/personal-calibre/src/components/library/LibraryToolbar.tsx \
  apps/personal-calibre/src/components/library/LibraryHeader.tsx \
  'apps/personal-calibre/src/app/(library)/@filters/page.tsx' \
  'apps/personal-calibre/src/app/(library)/page.tsx' \
  apps/personal-calibre/src/components/FilterBar.tsx \
  apps/personal-calibre-e2e/src/search.spec.ts apps/personal-calibre-e2e/src/filters.spec.ts
git commit -m "$(cat <<'EOF'
feat(personal-calibre): search field, filter panel and library toolbar

Search suggestions open the pane; Enter searches. Facets are single
select with Show all, and the delivery facet has On and Not on. The
toolbar carries the scope title, counts, Group, Sort and filter chips.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm
EOF
)"
```

---

### Task 8: Selection across pages and the bulk toolbar

**Files:**

- Create: `apps/personal-calibre/src/components/library/BulkToolbar.tsx`
- Modify: `apps/personal-calibre/src/components/library/LibraryToolbar.tsx` (whole file)
- Modify: `apps/personal-calibre/src/app/(library)/page.tsx` (`LibraryToolbar` props)
- Delete: `apps/personal-calibre/src/components/BulkActionBar.tsx`
- Create: `apps/personal-calibre-e2e/src/bulk.spec.ts`

**Interfaces:**

- Consumes: `useLibrary()` (`selected`, `clear`, `addMany`, `bulkPlatform`, `setBulkPlatform`,
  `zipFormat`, `setZipFormat`, `setSelectMode`); `platformName`; the unchanged
  `/api/books/deliveries/bulk` and `/api/books/download/bulk` routes.
- Produces:
  - `<BulkToolbar platforms matchingIds />`: `role="toolbar"` named `Bulk actions`, static in the
    desktop toolbar, floating at the bottom below `lg`.
  - `LibraryToolbar` props become `{ labels; matchingBooks; libraryTotal; matchingIds: number[] }`
    (platforms come from `labels.platforms`).

- [ ] **Step 1: Write the failing tests**

Create `apps/personal-calibre-e2e/src/bulk.spec.ts`:

```ts
import { expect, type Page, test } from '@playwright/test';

import { gotoLibrary, options } from './support/library';

const toolbar = (page: Page) =>
  page.getByRole('toolbar', { name: 'Bulk actions' });

async function selectOption(page: Page, index: number): Promise<number> {
  const option = options(page).nth(index);
  await option.focus();
  await page.keyboard.press('x');
  await expect(option).toHaveAttribute('aria-selected', 'true');
  return Number(await option.getAttribute('data-book-id'));
}

async function markDeliveredToReadwise(page: Page, count: number) {
  await toolbar(page).getByRole('combobox', { name: 'Add to' }).click();
  await page.getByRole('option', { name: 'Readwise Reader' }).click();
  await toolbar(page).getByRole('button', { name: 'Mark delivered' }).click();
  await expect(
    page.getByText(
      `${count} book${count === 1 ? '' : 's'} marked as delivered to Readwise Reader`,
    ),
  ).toBeVisible();
  await expect(toolbar(page)).toHaveCount(0);
}

async function expectLogged(page: Page, ids: number[]) {
  for (const id of ids) {
    const res = await page.request.get(`/api/books/${id}/deliveries`);
    const body = (await res.json()) as {
      events: Array<{ platformKey: string }>;
    };
    expect(body.events.map((e) => e.platformKey)).toContain('readwise-reader');
  }
}

test.describe('bulk', () => {
  test('Mark delivered from the Shelf logs every selected book', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?series=2');
    const ids = [await selectOption(page, 0), await selectOption(page, 1)];
    await expect(toolbar(page)).toContainText('2 selected');
    await markDeliveredToReadwise(page, 2);
    for (const id of ids) {
      await expect(
        page.locator(
          `[role="option"][data-book-id="${id}"] [title="On Readwise Reader"]`,
        ),
      ).toBeVisible();
    }
  });

  test('a selection made on page 1 counts on page 2 and bulk acts on both', async ({
    page,
  }) => {
    await gotoLibrary(page);
    const first = await selectOption(page, 0);
    await page
      .getByRole('navigation', { name: 'Pagination' })
      .getByRole('link', { name: 'Next' })
      .click();
    await expect(page).toHaveURL(/page=2/);
    const second = await selectOption(page, 0);
    await expect(toolbar(page)).toContainText('2 selected');
    await markDeliveredToReadwise(page, 2);
    await expectLogged(page, [first, second]);
  });

  test('Select all N covers every page', async ({ page }) => {
    await gotoLibrary(page);
    await selectOption(page, 0);
    await toolbar(page).getByRole('button', { name: 'Select all 70' }).click();
    await expect(toolbar(page)).toContainText('70 selected');
    await toolbar(page)
      .getByRole('button', { name: 'Clear selection (Esc)' })
      .click();
    await expect(toolbar(page)).toHaveCount(0);
  });

  test('selected books hidden by a filter still count and get logged', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?series=2');
    const hidden = await selectOption(page, 2);
    await page
      .locator('#library-filters')
      .getByRole('button', { name: 'Tidewater Cycle', exact: true })
      .click();
    await expect(page).toHaveURL(/series=4/);
    await expect(toolbar(page)).toContainText('1 selected');
    const visible = await selectOption(page, 2);
    await expect(toolbar(page)).toContainText('2 selected');
    await markDeliveredToReadwise(page, 2);
    await expectLogged(page, [hidden, visible]);
  });

  test('ZIP downloads the selected books', async ({ page }) => {
    await gotoLibrary(page, '/?series=4');
    await selectOption(page, 0);
    const download = page.waitForEvent('download');
    await toolbar(page).getByRole('button', { name: 'ZIP' }).click();
    expect((await download).suggestedFilename()).toBe('books.zip');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm nx e2e personal-calibre-e2e -- --grep "bulk"`
Expected: FAIL: no `Bulk actions` toolbar. Clear port 3333.

- [ ] **Step 3: Implement the bulk toolbar**

Create `apps/personal-calibre/src/components/library/BulkToolbar.tsx`:

```tsx
'use client';

import {
  Button,
  Kbd,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@rainforest-dev/rainforest-react';
import { Download, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { platformName } from '@/lib/platforms';
import type { DeliveryPlatform } from '@/types/delivery';

import { useLibrary } from './LibraryProvider';

const ZIP_FORMATS = ['EPUB', 'PDF', 'MOBI', 'AZW3'];

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : 'Unexpected error';

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    return ((await res.json()) as { error?: string }).error ?? fallback;
  } catch {
    return fallback;
  }
}

export function BulkToolbar({
  platforms,
  matchingIds,
}: {
  platforms: DeliveryPlatform[];
  matchingIds: number[];
}) {
  const router = useRouter();
  const {
    selected,
    clear,
    addMany,
    bulkPlatform,
    setBulkPlatform,
    zipFormat,
    setZipFormat,
    setSelectMode,
  } = useLibrary();
  const [busy, setBusy] = useState(false);
  const platformKey = bulkPlatform || platforms[0]?.key || '';
  const count = selected.size;
  const everyMatchSelected =
    matchingIds.length > 0 && matchingIds.every((id) => selected.has(id));

  async function markDelivered() {
    if (!platformKey) return;
    setBusy(true);
    try {
      const res = await fetch('/api/books/deliveries/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bookIds: [...selected], platformKey }),
      });
      if (!res.ok)
        throw new Error(await readError(res, 'Failed to add deliveries'));
      toast.success(
        `${count} book${count === 1 ? '' : 's'} marked as delivered to ${platformName(platforms, platformKey)}`,
      );
      clear();
      setSelectMode(false);
      router.refresh();
    } catch (error) {
      toast.error(`Delivery failed — ${messageOf(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function downloadZip() {
    setBusy(true);
    try {
      const res = await fetch('/api/books/download/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bookIds: [...selected], format: zipFormat }),
      });
      if (!res.ok) throw new Error(await readError(res, 'Failed to build ZIP'));
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'books.zip';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(`Download failed — ${messageOf(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="bg-card fixed inset-x-2 bottom-2 z-40 flex flex-wrap items-center gap-2 rounded-xl border p-2 shadow-lg lg:static lg:z-auto lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none"
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Clear selection (Esc)"
        onClick={clear}
      >
        <X aria-hidden />
      </Button>
      <span className="text-sm font-medium tabular-nums">{count} selected</span>
      {!everyMatchSelected && (
        <Button variant="link" size="xs" onClick={() => addMany(matchingIds)}>
          Select all {matchingIds.length}
        </Button>
      )}
      <div className="flex items-center gap-1.5 lg:ml-auto">
        <Select
          items={platforms.map((p) => ({ value: p.key, label: p.name }))}
          value={platformKey}
          onValueChange={(value) => {
            if (typeof value === 'string') setBulkPlatform(value);
          }}
        >
          <SelectTrigger size="sm" aria-label="Add to">
            <span className="text-muted-foreground text-xs">Add to</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {platforms.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={busy || !platformKey}
          onClick={() => void markDelivered()}
        >
          Mark delivered
        </Button>
      </div>
      <div className="flex items-center gap-1.5">
        <Select
          items={ZIP_FORMATS.map((f) => ({ value: f, label: f }))}
          value={zipFormat}
          onValueChange={(value) => {
            if (typeof value === 'string') setZipFormat(value);
          }}
        >
          <SelectTrigger size="sm" aria-label="Download format">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ZIP_FORMATS.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void downloadZip()}
        >
          <Download aria-hidden />
          ZIP
        </Button>
      </div>
      <span className="text-muted-foreground hidden items-center gap-1 text-xs lg:inline-flex">
        <Kbd>Esc</Kbd> clear
      </span>
    </div>
  );
}
```

Replace `apps/personal-calibre/src/components/library/LibraryToolbar.tsx` (Task 7's file plus
the bulk branch; on desktop the bulk toolbar takes the scope row's place):

```tsx
'use client';

import { Badge, Button } from '@rainforest-dev/rainforest-react';
import { SlidersHorizontal } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import { booksLabel } from '@/lib/group-entries';
import {
  type FilterLabels,
  filterCount,
  parseLibraryParams,
  scopeTitle,
} from '@/lib/library-params';
import { cn } from '@/lib/utils';

import { BulkToolbar } from './BulkToolbar';
import { FilterChips } from './FilterChips';
import { useLibrary } from './LibraryProvider';
import { GroupSelect, SortControls } from './SortControls';

interface Props {
  labels: FilterLabels;
  matchingBooks: number;
  libraryTotal: number;
  matchingIds: number[];
}

export function LibraryToolbar({
  labels,
  matchingBooks,
  libraryTotal,
  matchingIds,
}: Props) {
  const params = parseLibraryParams(useSearchParams());
  const { selected, selectMode, setSelectMode, setFiltersOpen, clear } =
    useLibrary();
  const count = filterCount(params);
  const bulk = selected.size > 0;
  const scope = scopeTitle(params, labels);
  const total =
    matchingBooks === libraryTotal
      ? booksLabel(libraryTotal)
      : `${matchingBooks} of ${booksLabel(libraryTotal)}`;

  return (
    <div className="bg-background z-20 flex flex-col gap-2 border-b py-3 lg:sticky lg:top-14">
      <div className="flex items-center gap-2 lg:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal aria-hidden />
          Filters
          {count > 0 && <Badge variant="secondary">{count}</Badge>}
        </Button>
        <Button
          variant={selectMode ? 'default' : 'outline'}
          size="sm"
          className="ml-auto"
          onClick={() => {
            if (selectMode) clear();
            setSelectMode(!selectMode);
          }}
        >
          {selectMode ? 'Done' : 'Select'}
        </Button>
      </div>
      {bulk && (
        <BulkToolbar platforms={labels.platforms} matchingIds={matchingIds} />
      )}
      {bulk && <h1 className="sr-only max-lg:hidden">{scope}</h1>}
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-3 gap-y-2',
          bulk && 'lg:hidden',
        )}
      >
        <h1 className="text-heading font-semibold">{scope}</h1>
        <p className="text-muted-foreground text-sm">{total}</p>
        <div className="ml-auto flex items-center gap-2">
          <GroupSelect className="hidden lg:flex" />
          <SortControls />
        </div>
      </div>
      <FilterChips labels={labels} />
    </div>
  );
}
```

On desktop the scope row hides while the bulk toolbar shows, and a visually hidden `h1` keeps
the page heading (axe `page-has-heading-one` ignores `display: none` headings). Below `lg` the
scope row stays and the extra `h1` is not rendered visibly or to assistive tech.

In `apps/personal-calibre/src/app/(library)/page.tsx`, pass
`matchingIds={library.matchingIds}` to `LibraryToolbar`.

Delete `apps/personal-calibre/src/components/BulkActionBar.tsx` (`git rm`).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm nx e2e personal-calibre-e2e -- --grep "bulk|keyboard|filters"`
Expected: PASS. Clear port 3333.

- [ ] **Step 5: Lint, types and comment audit**

Run: `pnpm nx run-many -t lint -p personal-calibre personal-calibre-e2e`
Run: `pnpm nx typecheck personal-calibre` and `pnpm nx typecheck personal-calibre-e2e`
Run: `git diff -U0 HEAD | grep -E '^\+\s*(//|/\*|\*|#|\{/\*)'`
Expected: PASS; no comment hits.

- [ ] **Step 6: Commit**

```bash
git add apps/personal-calibre/src/components/library/BulkToolbar.tsx \
  apps/personal-calibre/src/components/library/LibraryToolbar.tsx \
  'apps/personal-calibre/src/app/(library)/page.tsx' \
  apps/personal-calibre/src/components/BulkActionBar.tsx \
  apps/personal-calibre-e2e/src/bulk.spec.ts
git commit -m "$(cat <<'EOF'
feat(personal-calibre): bulk toolbar that acts on every selected book

Selection lives in the layout, so it survives page, view and filter
changes. The bulk toolbar counts books on other pages and books the
filters hide, offers Select all N across pages, Mark delivered and ZIP.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm
EOF
)"
```

---

### Task 9: Catalogue view

**Files:**

- Create: `apps/personal-calibre/src/components/views/CatalogueView.tsx`
- Create: `apps/personal-calibre/src/components/views/CatalogueRow.tsx`
- Create: `apps/personal-calibre/src/components/views/DeliveryPills.tsx`
- Modify: `apps/personal-calibre/src/components/library/ViewRegion.tsx` (render switch)
- Create: `apps/personal-calibre-e2e/src/catalogue.spec.ts`

**Interfaces:**

- Consumes: `useRovingNav` (mode `list`), `useIsDesktop`, `useLibrary()`, `groupEntries`,
  `navKey`, `contentKey`, `pageCheckState`, `GroupHeading`, `seriesLine`, `yearOf`,
  `spineClass`, `platformName`.
- Produces: `CatalogueView` with the same props as `ShelfView`; a `table[role=grid]` named
  `Books`; rows `tr[data-nav-key][data-book-id][aria-selected]`; header checkbox
  `Select all on this page`; row checkboxes `Select {title}`.

- [ ] **Step 1: Write the failing tests**

Create `apps/personal-calibre-e2e/src/catalogue.spec.ts`:

```ts
import { expect, type Page, test } from '@playwright/test';

import { gotoLibrary, tokenColor } from './support/library';
import { bookById } from './support/seed';

const grid = (page: Page) => page.getByRole('grid', { name: 'Books' });
const rows = (page: Page) => grid(page).locator('tr[data-nav-key]');
const toolbar = (page: Page) =>
  page.getByRole('toolbar', { name: 'Bulk actions' });

test.describe('catalogue', () => {
  test('shows the page as a table', async ({ page }) => {
    await gotoLibrary(page, '/?view=catalogue');
    await expect(
      page.getByRole('region', { name: 'Catalogue view' }),
    ).toBeVisible();
    await expect(rows(page)).toHaveCount(30);
    for (const name of ['Title', 'Author', 'Formats', 'Delivered', 'Year']) {
      await expect(
        grid(page).getByRole('columnheader', { name, exact: true }),
      ).toBeVisible();
    }
  });

  test('hides Formats and Year while the pane is open', async ({ page }) => {
    await gotoLibrary(page, '/?view=catalogue&book=38');
    await expect(
      grid(page).getByRole('columnheader', { name: 'Formats' }),
    ).toHaveCount(0);
    await expect(
      grid(page).getByRole('columnheader', { name: 'Year' }),
    ).toHaveCount(0);
  });

  test('shows delivery pills, or a dash named Not delivered', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?view=catalogue&author=1');
    const one = grid(page).locator('tr[data-book-id="1"]');
    await expect(one).toContainText('Kobo');
    await expect(one).toContainText('NotebookLM');
    const plain = grid(page).locator('tr[data-book-id="39"]');
    await expect(
      plain.getByRole('img', { name: 'Not delivered' }),
    ).toBeVisible();
  });

  test('groups rows under group headings', async ({ page }) => {
    await gotoLibrary(page, '/?view=catalogue&groupBy=series');
    await expect(
      grid(page).getByRole('heading', { name: 'Amber Road' }),
    ).toBeVisible();
    await expect(
      grid(page).getByRole('button', { name: 'See all 20' }),
    ).toBeVisible();
  });

  test('one tab stop; arrows, Home/End in the group and Ctrl+End to the page end', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?view=catalogue&groupBy=series');
    await expect(grid(page).locator('tr[tabindex="0"]')).toHaveCount(1);
    await rows(page).first().focus();
    await page.keyboard.press('ArrowDown');
    await expect(rows(page).nth(1)).toBeFocused();
    await page.keyboard.press('End');
    await expect(rows(page).nth(7)).toBeFocused();
    await page.keyboard.press('Control+End');
    await expect(rows(page).last()).toBeFocused();
    await page.keyboard.press('Control+Home');
    await expect(rows(page).first()).toBeFocused();
    await page.keyboard.press('Space');
    await expect(rows(page).first()).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(
      new RegExp(
        `book=${await rows(page).first().getAttribute('data-book-id')}`,
      ),
    );
  });

  test('focus is foreground and selection is primary', async ({ page }) => {
    await gotoLibrary(page, '/?view=catalogue');
    const row = rows(page).first();
    await row.focus();
    await page.keyboard.press('x');
    const title = bookById(
      Number(await row.getAttribute('data-book-id')),
    ).title;
    await expect
      .poll(() => row.evaluate((el) => getComputedStyle(el).outlineColor))
      .toBe(await tokenColor(page, '--foreground'));
    await expect
      .poll(() =>
        row
          .getByRole('checkbox', { name: `Select ${title}` })
          .evaluate((el) => getComputedStyle(el).backgroundColor),
      )
      .toBe(await tokenColor(page, '--primary'));
  });

  test('the header checkbox selects or clears the current page only', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?view=catalogue');
    const header = grid(page).getByRole('checkbox', {
      name: 'Select all on this page',
    });
    await header.click();
    await expect(toolbar(page)).toContainText('30 selected');
    await page
      .getByRole('navigation', { name: 'Pagination' })
      .getByRole('link', { name: 'Next' })
      .click();
    await expect(page).toHaveURL(/page=2/);
    await expect(header).toHaveAttribute('aria-checked', 'false');
    await header.click();
    await expect(toolbar(page)).toContainText('60 selected');
    await header.click();
    await expect(toolbar(page)).toContainText('30 selected');
  });

  test('bulk Mark delivered works from the Catalogue', async ({ page }) => {
    await gotoLibrary(page, '/?view=catalogue&series=1');
    await rows(page).nth(0).focus();
    await page.keyboard.press('x');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('x');
    await toolbar(page).getByRole('combobox', { name: 'Add to' }).click();
    await page.getByRole('option', { name: 'Readwise Reader' }).click();
    await toolbar(page).getByRole('button', { name: 'Mark delivered' }).click();
    await expect(
      page.getByText('2 books marked as delivered to Readwise Reader'),
    ).toBeVisible();
    await expect(rows(page).nth(0)).toContainText('Readwise Reader');
  });
});
```

Add to `apps/personal-calibre-e2e/src/keyboard.spec.ts`, inside the file after the Shelf
`describe`:

```ts
test.describe('view switch focus', () => {
  test('the Catalogue opens on the book focused in the Shelf', async ({
    page,
  }) => {
    await gotoLibrary(page);
    const third = options(page).nth(2);
    await third.focus();
    const id = await third.getAttribute('data-book-id');
    await page.getByRole('button', { name: 'Catalogue view' }).click();
    await expect(page.locator(`tr[data-book-id="${id}"]`)).toHaveAttribute(
      'tabindex',
      '0',
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm nx e2e personal-calibre-e2e -- --grep "catalogue|view switch focus"`
Expected: FAIL: the Catalogue view renders the Shelf. Clear port 3333.

- [ ] **Step 3: Implement the Catalogue**

Create `apps/personal-calibre/src/components/views/DeliveryPills.tsx`:

```tsx
import { Badge } from '@rainforest-dev/rainforest-react';

import { platformName } from '@/lib/platforms';
import type { DeliveryPlatform } from '@/types/delivery';

export function DeliveryPills({
  keys,
  platforms,
}: {
  keys: readonly string[];
  platforms: readonly DeliveryPlatform[];
}) {
  const unique = [...new Set(keys)];
  if (unique.length === 0) {
    return (
      <span
        role="img"
        aria-label="Not delivered"
        className="text-muted-foreground"
      >
        —
      </span>
    );
  }
  return (
    <span className="flex flex-wrap gap-1">
      {unique.map((key) => (
        <Badge key={key} variant="success">
          {platformName(platforms, key)}
        </Badge>
      ))}
    </span>
  );
}
```

Create `apps/personal-calibre/src/components/views/CatalogueRow.tsx`:

```tsx
'use client';

import {
  Checkbox,
  TableCell,
  TableRow,
} from '@rainforest-dev/rainforest-react';

import { seriesLine, yearOf } from '@/lib/format';
import { spineClass } from '@/lib/spine';
import { cn } from '@/lib/utils';
import type { LibraryBook } from '@/types/calibre';
import type { DeliveryPlatform } from '@/types/delivery';

import { DeliveryPills } from './DeliveryPills';

interface Props {
  book: LibraryBook;
  navKey: string;
  row: string;
  tabIndex: 0 | -1;
  selected: boolean;
  open: boolean;
  compact: boolean;
  wide: boolean;
  platforms: readonly DeliveryPlatform[];
  onFocus: () => void;
  onActivate: () => void;
  onToggle: () => void;
}

function Cover({ book, className }: { book: LibraryBook; className: string }) {
  return book.hasCover ? (
    <img
      src={`/api/books/${book.id}/cover`}
      alt=""
      loading="lazy"
      className={cn('shrink-0 rounded-sm object-cover', className)}
    />
  ) : (
    <span
      aria-hidden
      className={cn('shrink-0 rounded-sm', spineClass(book.id), className)}
    />
  );
}

export function CatalogueRow({
  book,
  navKey,
  row,
  tabIndex,
  selected,
  open,
  compact,
  wide,
  platforms,
  onFocus,
  onActivate,
  onToggle,
}: Props) {
  const series = book.series ? seriesLine(book.series, book.seriesIndex) : null;
  return (
    <TableRow
      aria-selected={selected}
      tabIndex={tabIndex}
      data-nav-key={navKey}
      data-nav-row={row}
      data-book-id={book.id}
      onFocus={onFocus}
      onClick={onActivate}
      className={cn(
        'hover:bg-muted/55 cursor-pointer outline-none',
        'focus-visible:outline-foreground focus-visible:outline-[2.5px] focus-visible:-outline-offset-[2.5px]',
        selected && 'bg-primary/12 hover:bg-primary/12',
        open && !selected && 'bg-accent',
        open && 'shadow-[inset_3px_0_0_var(--color-primary)]',
      )}
    >
      <TableCell className="w-10">
        <Checkbox
          tabIndex={-1}
          aria-label={`Select ${book.title}`}
          checked={selected}
          onCheckedChange={onToggle}
          onClick={(event) => event.stopPropagation()}
        />
      </TableCell>
      {compact ? (
        <TableCell className="whitespace-normal">
          <div className="flex gap-3">
            <Cover book={book} className="h-[60px] w-10" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="line-clamp-2 font-medium">{book.title}</p>
              <p className="text-muted-foreground truncate text-xs">
                {[book.authors.join(', '), series].filter(Boolean).join(' · ')}
              </p>
              <p className="text-muted-foreground font-mono text-[11px]">
                {book.formats.join(' · ')}
              </p>
              <DeliveryPills keys={book.deliveredTo} platforms={platforms} />
            </div>
          </div>
        </TableCell>
      ) : (
        <>
          <TableCell className="whitespace-normal">
            <div className="flex items-center gap-3">
              <Cover book={book} className="h-[42px] w-7" />
              <div className="min-w-0">
                <p className="line-clamp-2 font-medium">{book.title}</p>
                {series && (
                  <p className="text-muted-foreground truncate text-xs">
                    {series}
                  </p>
                )}
              </div>
            </div>
          </TableCell>
          <TableCell className="text-muted-foreground whitespace-normal">
            {book.authors.join(', ')}
          </TableCell>
          {wide && (
            <TableCell className="font-mono text-xs">
              {book.formats.join(' · ')}
            </TableCell>
          )}
          <TableCell>
            <DeliveryPills keys={book.deliveredTo} platforms={platforms} />
          </TableCell>
          {wide && (
            <TableCell className="tabular-nums">
              {yearOf(book.pubdate) ?? '—'}
            </TableCell>
          )}
        </>
      )}
    </TableRow>
  );
}
```

Create `apps/personal-calibre/src/components/views/CatalogueView.tsx`:

```tsx
'use client';

import {
  Checkbox,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@rainforest-dev/rainforest-react';
import { useSearchParams } from 'next/navigation';
import { Fragment, useMemo } from 'react';

import { useLibrary } from '@/components/library/LibraryProvider';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useRovingNav } from '@/hooks/useRovingNav';
import {
  contentKey,
  type EntryGroup,
  groupEntries,
  navKey,
} from '@/lib/group-entries';
import { type GroupBy, parseLibraryParams } from '@/lib/library-params';
import { pageCheckState } from '@/lib/selection';
import type { LibraryEntry } from '@/types/calibre';
import type { DeliveryPlatform } from '@/types/delivery';

import { CatalogueRow } from './CatalogueRow';
import { GroupHeading } from './GroupHeading';

interface Props {
  entries: LibraryEntry[];
  groupBy: GroupBy | null;
  platforms: DeliveryPlatform[];
  page: number;
}

export function CatalogueView({ entries, groupBy, platforms, page }: Props) {
  const key = contentKey(entries);
  const groups = useMemo<EntryGroup[]>(
    () =>
      groupBy
        ? groupEntries(entries, groupBy)
        : [
            {
              key: 'all',
              label: '',
              total: entries.length,
              continued: false,
              filter: null,
              entries,
            },
          ],
    [key, groupBy],
  );
  const navKeys = useMemo(() => entries.map(navKey), [key]);
  const pageIds = useMemo(
    () => [...new Set(entries.map((e) => e.book.id))],
    [key],
  );
  const { containerRef, stopKey, onItemFocus, onKeyDown } =
    useRovingNav<HTMLTableElement>({
      navKeys,
      mode: 'list',
      page,
      contentKey: key,
    });
  const openId = parseLibraryParams(useSearchParams()).book;
  const isDesktop = useIsDesktop();
  const { selected, selectMode, toggle, openBook, addMany, removeMany } =
    useLibrary();
  const compact = !isDesktop;
  const wide = isDesktop && openId === null;
  const columns = compact ? 2 : wide ? 6 : 4;
  const headerState = pageCheckState(selected, pageIds);

  return (
    <Table
      ref={containerRef}
      role="grid"
      aria-label="Books"
      aria-multiselectable="true"
      onKeyDown={onKeyDown}
    >
      {!compact && (
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                aria-label="Select all on this page"
                checked={headerState === 'all'}
                indeterminate={headerState === 'some'}
                onCheckedChange={() =>
                  headerState === 'all' ? removeMany(pageIds) : addMany(pageIds)
                }
              />
            </TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Author</TableHead>
            {wide && <TableHead>Formats</TableHead>}
            <TableHead>Delivered</TableHead>
            {wide && <TableHead>Year</TableHead>}
          </TableRow>
        </TableHeader>
      )}
      <TableBody>
        {groups.map((group) => (
          <Fragment key={group.key}>
            {groupBy && (
              <TableRow className="hover:bg-transparent">
                <TableHead
                  colSpan={columns}
                  scope="colgroup"
                  className="bg-muted/40 h-auto py-2"
                >
                  <GroupHeading group={group} shown={group.entries.length} />
                </TableHead>
              </TableRow>
            )}
            {group.entries.map((entry) => {
              const k = navKey(entry);
              return (
                <CatalogueRow
                  key={k}
                  book={entry.book}
                  navKey={k}
                  row={group.key}
                  tabIndex={k === stopKey ? 0 : -1}
                  selected={selected.has(entry.book.id)}
                  open={openId === entry.book.id}
                  compact={compact}
                  wide={wide}
                  platforms={platforms}
                  onFocus={() => onItemFocus(k)}
                  onActivate={() =>
                    selectMode ? toggle(entry.book.id) : openBook(entry.book.id)
                  }
                  onToggle={() => toggle(entry.book.id)}
                />
              );
            })}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}
```

In `apps/personal-calibre/src/components/library/ViewRegion.tsx`, import
`CatalogueView` from `@/components/views/CatalogueView` and replace the `ShelfView` branch:

```tsx
{
  entries.length === 0 ? (
    <EmptyResult filtered={filtered} />
  ) : view === 'catalogue' ? (
    <CatalogueView
      entries={entries}
      groupBy={groupBy}
      platforms={platforms}
      page={page}
    />
  ) : (
    <ShelfView
      entries={entries}
      groupBy={groupBy}
      platforms={platforms}
      page={page}
    />
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm nx e2e personal-calibre-e2e -- --grep "catalogue|keyboard|bulk"`
Expected: PASS. If the header checkbox click also toggles a row, check `onClick` on the row
checkboxes stops propagation. Clear port 3333.

- [ ] **Step 5: Dev server check, lint, types and comment audit**

Dev-server check: load `/?view=catalogue`, `/?view=catalogue&groupBy=tag`,
`/?view=catalogue&book=38`, and `/?view=catalogue` at 390px (the compact list). No console
error, no hydration warning.

Run: `pnpm nx run-many -t lint -p personal-calibre personal-calibre-e2e`
Run: `pnpm nx typecheck personal-calibre` and `pnpm nx typecheck personal-calibre-e2e`
Run: `git diff -U0 HEAD | grep -E '^\+\s*(//|/\*|\*|#|\{/\*)'`
Expected: PASS; no comment hits.

- [ ] **Step 6: Commit**

```bash
git checkout -- apps/personal-calibre/next-env.d.ts
git add apps/personal-calibre/src/components/views/CatalogueView.tsx \
  apps/personal-calibre/src/components/views/CatalogueRow.tsx \
  apps/personal-calibre/src/components/views/DeliveryPills.tsx \
  apps/personal-calibre/src/components/library/ViewRegion.tsx \
  apps/personal-calibre-e2e/src/catalogue.spec.ts apps/personal-calibre-e2e/src/keyboard.spec.ts
git commit -m "$(cat <<'EOF'
feat(personal-calibre): Catalogue view as a keyboard grid

The Catalogue shows the same server page as a table with group rows,
delivery pills and a page-only header checkbox. Formats and Year hide
while the pane is open; below lg it becomes a compact list.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm
EOF
)"
```

---

### Task 10: Global shortcuts and key hints

**Files:**

- Create: `apps/personal-calibre/src/lib/keyboard.ts`
- Create: `apps/personal-calibre/src/lib/keyboard.test.ts`
- Create: `apps/personal-calibre/src/hooks/useLibraryShortcuts.ts`
- Create: `apps/personal-calibre/src/components/library/KeyHints.tsx`
- Modify: `apps/personal-calibre/src/components/library/LibraryShell.tsx` (mount the hook)
- Modify: `apps/personal-calibre/src/app/(library)/page.tsx` (render `KeyHints`)
- Create: `apps/personal-calibre-e2e/src/shortcuts.spec.ts`

**Interfaces:**

- Consumes: `useLibrary()` (`view`, `setView`, `closeBook`, `clear`, `selected`, `pageInfo`,
  `goToPage`, `focusId`, `requestFocus`); `nextView`, `View`; `parseLibraryParams`.
- Produces:
  - `src/lib/keyboard.ts`: `interface KeyInput { key; altKey; ctrlKey; metaKey; typing;
inOverlay; paneOpen; hasSelection; page; pageCount }`, `type Shortcut`,
    `resolveShortcut(input): Shortcut | null`, `interface KeyHint { keys; label; paged? }`,
    `KEY_HINTS: Record<View, readonly KeyHint[]>`, `hintsFor(view, paged)`.
  - `useLibraryShortcuts(enabled: boolean)`; `<KeyHints />` (`[data-key-hints]`, hidden below
    `lg`).

- [ ] **Step 1: Write the failing unit tests**

Create `apps/personal-calibre/src/lib/keyboard.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { hintsFor, type KeyInput, resolveShortcut } from './keyboard';

const base: KeyInput = {
  key: '',
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  typing: false,
  inOverlay: false,
  paneOpen: false,
  hasSelection: false,
  page: 2,
  pageCount: 3,
};
const press = (key: string, extra: Partial<KeyInput> = {}) =>
  resolveShortcut({ ...base, key, ...extra });

describe('resolveShortcut', () => {
  it('maps the global keys', () => {
    expect(press('/')).toEqual({ type: 'focus-search' });
    expect(press('v')).toEqual({ type: 'next-view' });
    expect(press('[')).toEqual({ type: 'go-to-page', page: 1 });
    expect(press(']')).toEqual({ type: 'go-to-page', page: 3 });
  });

  it('does nothing on the first and last page', () => {
    expect(press('[', { page: 1 })).toBeNull();
    expect(press(']', { page: 3 })).toBeNull();
    expect(press(']', { page: 1, pageCount: 1 })).toBeNull();
  });

  it('closes the pane, else clears the selection, else nothing', () => {
    expect(press('Escape', { paneOpen: true, hasSelection: true })).toEqual({
      type: 'close-pane',
    });
    expect(press('Escape', { hasSelection: true })).toEqual({
      type: 'clear-selection',
    });
    expect(press('Escape')).toBeNull();
  });

  it('ignores keys while typing, inside a dialog or menu, and with modifiers', () => {
    expect(press('/', { typing: true })).toBeNull();
    expect(press('Escape', { typing: true, paneOpen: true })).toBeNull();
    expect(press('v', { inOverlay: true })).toBeNull();
    expect(press(']', { altKey: true })).toBeNull();
    expect(press(']', { ctrlKey: true })).toBeNull();
    expect(press('v', { metaKey: true })).toBeNull();
  });

  it('leaves other keys, PageUp and PageDown included, to the browser', () => {
    expect(press('PageDown')).toBeNull();
    expect(press('PageUp')).toBeNull();
    expect(press('V')).toBeNull();
  });
});

describe('hintsFor', () => {
  const labels = (view: Parameters<typeof hintsFor>[0], paged: boolean) =>
    hintsFor(view, paged).map((h) => h.label);

  it('lists the Shelf hints, with Page only when there is more than one page', () => {
    expect(labels('shelf', true)).toEqual([
      'Search',
      'Switch view',
      'Move',
      'Row ends',
      'Page',
      'Open',
      'Select',
      'Close, then clear',
    ]);
    expect(labels('shelf', false)).not.toContain('Page');
  });

  it('lists the Catalogue hints with Space to select', () => {
    expect(labels('catalogue', true)).toEqual([
      'Search',
      'Switch view',
      'Move',
      'Page',
      'Select',
      'Open',
      'Close, then clear',
    ]);
    expect(
      hintsFor('catalogue', true).find((h) => h.label === 'Select')?.keys,
    ).toEqual(['Space']);
  });

  it('keeps the Study hints ready for phase 2', () => {
    expect(labels('study', true)).toEqual([
      'Search',
      'Switch view',
      'Along shelf',
      'Between shelves',
      'Shelf ends',
      'Page',
      'Open',
      'Select',
      'Close, then clear',
    ]);
  });
});
```

Create `apps/personal-calibre-e2e/src/shortcuts.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

import { gotoLibrary, options, pane } from './support/library';
import { BOOKS } from './support/seed';

test.describe('shortcuts', () => {
  test('/ focuses search', async ({ page }) => {
    await gotoLibrary(page);
    await page.keyboard.press('/');
    await expect(page.getByPlaceholder('Search books')).toBeFocused();
  });

  test('v cycles the views and keeps focus on the same book', async ({
    page,
  }) => {
    await gotoLibrary(page);
    const third = options(page).nth(2);
    const id = await third.getAttribute('data-book-id');
    await third.focus();
    await page.keyboard.press('v');
    await expect(
      page.getByRole('region', { name: 'Catalogue view' }),
    ).toBeVisible();
    await expect(page.locator(`tr[data-book-id="${id}"]`)).toBeFocused();
    await page.keyboard.press('v');
    await expect(
      page.getByRole('region', { name: 'Shelf view' }),
    ).toBeVisible();
    await expect(
      page.locator(`[role="option"][data-book-id="${id}"]`),
    ).toBeFocused();
  });

  test('Esc closes the pane and returns focus, then clears the selection', async ({
    page,
  }) => {
    await gotoLibrary(page);
    const first = options(page).first();
    await first.focus();
    await page.keyboard.press('x');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/book=/);
    await expect(pane(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page).not.toHaveURL(/book=/);
    await expect(first).toBeFocused();
    await expect(
      page.getByRole('toolbar', { name: 'Bulk actions' }),
    ).toContainText('1 selected');
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('toolbar', { name: 'Bulk actions' }),
    ).toHaveCount(0);
    await expect(first).toHaveAttribute('aria-selected', 'false');
  });

  test('] and [ change page and focus its first item, and do nothing at the ends', async ({
    page,
  }) => {
    await gotoLibrary(page);
    await options(page).first().focus();
    await page.keyboard.press(']');
    await expect(page).toHaveURL(/page=2/);
    await expect(options(page).first()).toBeFocused();
    await page.keyboard.press('[');
    await expect(page).not.toHaveURL(/page=/);
    await expect(options(page).first()).toBeFocused();
    await page.keyboard.press('[');
    await page.waitForTimeout(400);
    await expect(page).not.toHaveURL(/page=/);
    await gotoLibrary(page, '/?page=3');
    await options(page).first().focus();
    await page.keyboard.press(']');
    await page.waitForTimeout(400);
    await expect(page).toHaveURL(/page=3/);
  });

  test('page keys keep the pane open', async ({ page }) => {
    await gotoLibrary(page, '/?book=38');
    await page.keyboard.press(']');
    await expect(page).toHaveURL(/page=2/);
    await expect(page).toHaveURL(/book=38/);
    await expect(pane(page).locator('[data-book-detail="38"]')).toBeVisible();
  });

  test('Esc closes a pane whose book is on another page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await gotoLibrary(page);
    const onPage = new Set(
      await options(page).evaluateAll((els) =>
        els.map((el) => Number(el.getAttribute('data-book-id'))),
      ),
    );
    const elsewhere = BOOKS.find((b) => !onPage.has(b.id));
    expect(elsewhere).toBeDefined();
    await gotoLibrary(page, `/?book=${elsewhere?.id}`);
    await page.keyboard.press('Escape');
    await expect(page).not.toHaveURL(/book=/);
    await options(page).first().focus();
    await page.keyboard.press(']');
    await expect(page).toHaveURL(/page=2/);
    await expect(options(page).first()).toBeFocused();
    expect(errors).toEqual([]);
  });

  test('key hints show the page entry only with more than one page', async ({
    page,
  }) => {
    await gotoLibrary(page);
    await expect(page.locator('[data-key-hints]')).toContainText('Page');
    await gotoLibrary(page, '/?series=4');
    await expect(page.locator('[data-key-hints]')).not.toContainText('Page');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm nx test personal-calibre -- src/lib/keyboard.test.ts`
Expected: FAIL: module not found.
Run: `pnpm nx e2e personal-calibre-e2e -- --grep "shortcuts"`
Expected: FAIL: `/`, `v`, `[`, `]` and `Esc` do nothing. Clear port 3333.

- [ ] **Step 3: Implement `keyboard.ts`**

Create `apps/personal-calibre/src/lib/keyboard.ts`:

```ts
import type { View } from '@/lib/prefs';

export interface KeyInput {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  typing: boolean;
  inOverlay: boolean;
  paneOpen: boolean;
  hasSelection: boolean;
  page: number;
  pageCount: number;
}

export type Shortcut =
  | { type: 'focus-search' }
  | { type: 'next-view' }
  | { type: 'close-pane' }
  | { type: 'clear-selection' }
  | { type: 'go-to-page'; page: number };

export function resolveShortcut(input: KeyInput): Shortcut | null {
  if (
    input.typing ||
    input.inOverlay ||
    input.altKey ||
    input.ctrlKey ||
    input.metaKey
  )
    return null;
  switch (input.key) {
    case '/':
      return { type: 'focus-search' };
    case 'v':
      return { type: 'next-view' };
    case 'Escape':
      if (input.paneOpen) return { type: 'close-pane' };
      return input.hasSelection ? { type: 'clear-selection' } : null;
    case '[':
      return input.page > 1
        ? { type: 'go-to-page', page: input.page - 1 }
        : null;
    case ']':
      return input.page < input.pageCount
        ? { type: 'go-to-page', page: input.page + 1 }
        : null;
    default:
      return null;
  }
}

export interface KeyHint {
  keys: readonly string[];
  label: string;
  paged?: true;
}

const SEARCH: KeyHint = { keys: ['/'], label: 'Search' };
const SWITCH: KeyHint = { keys: ['v'], label: 'Switch view' };
const PAGE: KeyHint = { keys: ['[', ']'], label: 'Page', paged: true };
const OPEN: KeyHint = { keys: ['Enter'], label: 'Open' };
const SELECT_X: KeyHint = { keys: ['x'], label: 'Select' };
const CLOSE: KeyHint = { keys: ['Esc'], label: 'Close, then clear' };

export const KEY_HINTS: Record<View, readonly KeyHint[]> = {
  shelf: [
    SEARCH,
    SWITCH,
    { keys: ['←↑↓→'], label: 'Move' },
    { keys: ['Home', 'End'], label: 'Row ends' },
    PAGE,
    OPEN,
    SELECT_X,
    CLOSE,
  ],
  catalogue: [
    SEARCH,
    SWITCH,
    { keys: ['↑↓'], label: 'Move' },
    PAGE,
    { keys: ['Space'], label: 'Select' },
    OPEN,
    CLOSE,
  ],
  study: [
    SEARCH,
    SWITCH,
    { keys: ['←→'], label: 'Along shelf' },
    { keys: ['↑↓'], label: 'Between shelves' },
    { keys: ['Home', 'End'], label: 'Shelf ends' },
    PAGE,
    OPEN,
    SELECT_X,
    CLOSE,
  ],
};

export function hintsFor(view: View, paged: boolean): readonly KeyHint[] {
  return KEY_HINTS[view].filter((hint) => paged || !hint.paged);
}
```

Run: `pnpm nx test personal-calibre -- src/lib/keyboard.test.ts`
Expected: PASS.

- [ ] **Step 4: Implement the hook and the hint row**

Create `apps/personal-calibre/src/hooks/useLibraryShortcuts.ts`:

```ts
'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { useLibrary } from '@/components/library/LibraryProvider';
import { resolveShortcut } from '@/lib/keyboard';
import { parseLibraryParams } from '@/lib/library-params';
import { nextView } from '@/lib/prefs';

const TYPING =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
const OVERLAY =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [data-slot="select-content"], [data-slot="popover-content"]';

export function useLibraryShortcuts(enabled: boolean) {
  const {
    view,
    setView,
    closeBook,
    clear,
    selected,
    pageInfo,
    goToPage,
    focusId,
    requestFocus,
  } = useLibrary();
  const paneOpen = parseLibraryParams(useSearchParams()).book !== null;

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      const shortcut = resolveShortcut({
        key: event.key,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        typing: target?.closest(TYPING) != null,
        inOverlay: target?.closest(OVERLAY) != null,
        paneOpen,
        hasSelection: selected.size > 0,
        page: pageInfo.page,
        pageCount: pageInfo.pageCount,
      });
      if (!shortcut) return;
      event.preventDefault();
      switch (shortcut.type) {
        case 'focus-search':
          document
            .querySelector<HTMLInputElement>('[data-library-search] input')
            ?.focus();
          break;
        case 'next-view':
          if (
            focusId !== null &&
            document.activeElement?.closest('[data-view-region]')
          ) {
            requestFocus({ kind: 'book', id: focusId });
          }
          setView(nextView(view));
          break;
        case 'close-pane':
          closeBook();
          break;
        case 'clear-selection':
          clear();
          break;
        case 'go-to-page':
          goToPage(shortcut.page);
          break;
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [
    enabled,
    view,
    setView,
    closeBook,
    clear,
    selected,
    pageInfo,
    goToPage,
    focusId,
    requestFocus,
    paneOpen,
  ]);
}
```

The views' `onKeyDown` runs first (React listens at the root, below `document`) and calls
`preventDefault` on the keys it handles, which is why the hook skips `defaultPrevented` events.

Create `apps/personal-calibre/src/components/library/KeyHints.tsx`:

```tsx
'use client';

import { Kbd } from '@rainforest-dev/rainforest-react';

import { hintsFor } from '@/lib/keyboard';

import { useLibrary } from './LibraryProvider';

export function KeyHints() {
  const { view, pageInfo } = useLibrary();
  return (
    <div
      data-key-hints
      className="bg-background text-muted-foreground sticky bottom-0 z-10 hidden flex-wrap items-center gap-x-4 gap-y-1 border-t py-2 text-xs lg:flex"
    >
      {hintsFor(view, pageInfo.pageCount > 1).map((hint) => (
        <span key={hint.label} className="inline-flex items-center gap-1">
          {hint.keys.map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
          {hint.label}
        </span>
      ))}
    </div>
  );
}
```

In `apps/personal-calibre/src/components/library/LibraryShell.tsx`, import
`useLibraryShortcuts` from `@/hooks/useLibraryShortcuts` and call it right after `isList` is
computed:

```tsx
const isList = pathname === '/';
useLibraryShortcuts(isList);
```

In `apps/personal-calibre/src/app/(library)/page.tsx`, import `KeyHints` from
`@/components/library/KeyHints` and render `<KeyHints />` after `<Pagination … />`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm nx e2e personal-calibre-e2e -- --grep "shortcuts|keyboard|catalogue"`
Expected: PASS. If `v` loses focus, check that the pending `book` focus is requested before
`setView` in the same handler. Clear port 3333.

- [ ] **Step 6: Lint, types and comment audit**

Run: `pnpm nx run-many -t lint -p personal-calibre personal-calibre-e2e`
Run: `pnpm nx typecheck personal-calibre` and `pnpm nx typecheck personal-calibre-e2e`
Run: `pnpm nx test personal-calibre`
Run: `git diff -U0 HEAD | grep -E '^\+\s*(//|/\*|\*|#|\{/\*)'`
Expected: PASS; no comment hits.

- [ ] **Step 7: Commit**

```bash
git add apps/personal-calibre/src/lib/keyboard.ts apps/personal-calibre/src/lib/keyboard.test.ts \
  apps/personal-calibre/src/hooks/useLibraryShortcuts.ts \
  apps/personal-calibre/src/components/library/KeyHints.tsx \
  apps/personal-calibre/src/components/library/LibraryShell.tsx \
  'apps/personal-calibre/src/app/(library)/page.tsx' \
  apps/personal-calibre-e2e/src/shortcuts.spec.ts
git commit -m "$(cat <<'EOF'
feat(personal-calibre): global shortcuts, [ and ] paging and key hints

/ focuses search, v cycles views keeping focus on the book, Esc closes
the pane then clears the selection, and [ and ] turn the page and focus
its first item. A key-hint row shows on desktop.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm
EOF
)"
```

---

### Task 11: Loading and error states, test hooks

**Files:**

- Create: `apps/personal-calibre/src/lib/test-hooks.ts`
- Create: `apps/personal-calibre/src/lib/test-hooks.test.ts`
- Modify: `apps/personal-calibre/env.d.ts`
- Create: `apps/personal-calibre/src/components/library/ViewSkeleton.tsx`
- Create: `apps/personal-calibre/src/components/library/LoadError.tsx`
- Create: `apps/personal-calibre/src/app/(library)/error.tsx`
- Create: `apps/personal-calibre/src/app/(library)/@pane/error.tsx`
- Modify: `apps/personal-calibre/src/app/(library)/page.tsx` (whole file)
- Modify: `apps/personal-calibre/src/app/(library)/@pane/page.tsx` (hooks)
- Create: `apps/personal-calibre-e2e/src/states.spec.ts`

**Interfaces:**

- Consumes: `useLibrary().view`; `cookies()`; Next.js 16.2 `error.js` props
  `{ error: Error & { digest?: string }; unstable_retry: () => void }` (verified in
  `node_modules/next/dist/client/components/error-boundary.d.ts`).
- Produces:
  - `src/lib/test-hooks.ts`: `FAULT_COOKIE = 'calibre-e2e-fault'`, `type FaultScope`,
    `interface TestHooks { fault; delayMs; pageSize }`, `NO_HOOKS`,
    `readTestHooks(params, faultCookie, enabled = process.env.CALIBRE_E2E === '1')`,
    `applyTestHooks(hooks, scope): Promise<void>`.
  - `<ViewSkeleton />` (`role="status"`, `aria-busy`, `Loading books`, `[data-skeleton=<view>]`),
    `<LoadError variant="page" | "compact" digest? onRetry />`.

- [ ] **Step 1: Write the failing tests**

Create `apps/personal-calibre/src/lib/test-hooks.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { applyTestHooks, NO_HOOKS, readTestHooks } from './test-hooks';

describe('readTestHooks', () => {
  it('reads nothing unless CALIBRE_E2E is on', () => {
    expect(
      readTestHooks(
        { __fault: 'list', __delay: '500', __pageSize: '250' },
        'pane',
        false,
      ),
    ).toEqual(NO_HOOKS);
  });

  it('reads the fault, delay and page size', () => {
    expect(
      readTestHooks(
        { __fault: 'list', __delay: '500', __pageSize: '100' },
        undefined,
        true,
      ),
    ).toEqual({
      fault: 'list',
      delayMs: 500,
      pageSize: 100,
    });
  });

  it('reads a fault from the cookie when the URL has none', () => {
    expect(readTestHooks({}, 'pane', true).fault).toBe('pane');
  });

  it('clamps and ignores bad values', () => {
    expect(
      readTestHooks({ __delay: '999999', __pageSize: '999' }, undefined, true),
    ).toMatchObject({
      delayMs: 10_000,
      pageSize: 250,
    });
    expect(
      readTestHooks(
        { __fault: 'disk', __delay: 'abc', __pageSize: '0' },
        'nope',
        true,
      ),
    ).toEqual(NO_HOOKS);
  });
});

describe('applyTestHooks', () => {
  it('throws only for the matching scope', async () => {
    await expect(
      applyTestHooks({ ...NO_HOOKS, fault: 'list' }, 'list'),
    ).rejects.toThrow('Injected list fault');
    await expect(
      applyTestHooks({ ...NO_HOOKS, fault: 'list' }, 'pane'),
    ).resolves.toBeUndefined();
  });
});
```

Create `apps/personal-calibre-e2e/src/states.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

import {
  BASE_URL,
  FAULT_COOKIE,
  gotoLibrary,
  options,
  pane,
  setPrefs,
} from './support/library';

test.describe('states', () => {
  test('the Skeleton follows the view in the cookie', async ({
    page,
    context,
  }) => {
    await setPrefs(context, { view: 'catalogue' });
    await page.goto('/?__delay=2500', { waitUntil: 'commit' });
    await expect(page.locator('[data-skeleton="catalogue"]')).toBeVisible();
    await expect(page.getByRole('grid', { name: 'Books' })).toBeVisible({
      timeout: 15_000,
    });
    await setPrefs(context, { view: 'shelf' });
    await page.goto('/?__delay=2500', { waitUntil: 'commit' });
    await expect(page.locator('[data-skeleton="shelf"]')).toBeVisible();
  });

  test('a list fault shows the Alert with Retry', async ({ page }) => {
    await gotoLibrary(page, '/?__fault=list');
    const alert = page
      .getByRole('alert')
      .filter({ hasText: "Couldn't load the library" });
    await expect(alert).toContainText(
      'The book list request failed. Your filters and selection are kept, so a retry picks up where you were.',
    );
    await expect(alert.getByRole('button', { name: 'Retry' })).toBeVisible();
  });

  test('Retry recovers and keeps the selection', async ({ page, context }) => {
    await gotoLibrary(page);
    await options(page).first().focus();
    await page.keyboard.press('x');
    await expect(
      page.getByRole('toolbar', { name: 'Bulk actions' }),
    ).toContainText('1 selected');
    await context.addCookies([
      { name: FAULT_COOKIE, value: 'list', url: BASE_URL },
    ]);
    await page
      .getByRole('navigation', { name: 'Pagination' })
      .getByRole('link', { name: 'Next' })
      .click();
    const alert = page
      .getByRole('alert')
      .filter({ hasText: "Couldn't load the library" });
    await expect(alert).toBeVisible();
    await context.clearCookies({ name: FAULT_COOKIE });
    await alert.getByRole('button', { name: 'Retry' }).click();
    await expect(options(page)).toHaveCount(30);
    await expect(
      page.getByRole('toolbar', { name: 'Bulk actions' }),
    ).toContainText('1 selected');
  });

  test('a pane fault shows the compact pane error', async ({ page }) => {
    await gotoLibrary(page, '/?book=38&__fault=pane');
    await expect(pane(page).getByRole('alert')).toContainText(
      "Couldn't load this book",
    );
    await expect(
      pane(page).getByRole('button', { name: 'Retry' }),
    ).toBeVisible();
    await expect(options(page)).toHaveCount(30);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm nx test personal-calibre -- src/lib/test-hooks.test.ts`
Expected: FAIL: module not found.
Run: `pnpm nx e2e personal-calibre-e2e -- --grep "states"`
Expected: FAIL: no Skeleton marker, and the fault params are ignored. Clear port 3333.

- [ ] **Step 3: Implement the hooks**

Create `apps/personal-calibre/src/lib/test-hooks.ts`:

```ts
import type { RawSearchParams } from '@/lib/library-params';

export const FAULT_COOKIE = 'calibre-e2e-fault';

export type FaultScope = 'list' | 'pane';

export interface TestHooks {
  fault: FaultScope | null;
  delayMs: number;
  pageSize: number | null;
}

export const NO_HOOKS: TestHooks = { fault: null, delayMs: 0, pageSize: null };

const MAX_DELAY_MS = 10_000;
const MAX_PAGE_SIZE = 250;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

function boundedInt(raw: string | undefined, max: number): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 ? Math.min(n, max) : null;
}

function asFault(raw: string | undefined): FaultScope | null {
  return raw === 'list' || raw === 'pane' ? raw : null;
}

export function readTestHooks(
  params: RawSearchParams,
  faultCookie: string | undefined,
  enabled = process.env.CALIBRE_E2E === '1',
): TestHooks {
  if (!enabled) return NO_HOOKS;
  return {
    fault: asFault(first(params['__fault'])) ?? asFault(faultCookie),
    delayMs: boundedInt(first(params['__delay']), MAX_DELAY_MS) ?? 0,
    pageSize: boundedInt(first(params['__pageSize']), MAX_PAGE_SIZE),
  };
}

export async function applyTestHooks(
  hooks: TestHooks,
  scope: FaultScope,
): Promise<void> {
  if (scope === 'list' && hooks.delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, hooks.delayMs));
  }
  if (hooks.fault === scope) throw new Error(`Injected ${scope} fault`);
}
```

Replace `apps/personal-calibre/env.d.ts`:

```ts
declare namespace NodeJS {
  interface ProcessEnv {
    CALIBRE_LIBRARY_PATH: string;
    CALIBRE_E2E?: string;
  }
}
```

Run: `pnpm nx test personal-calibre -- src/lib/test-hooks.test.ts`
Expected: PASS.

- [ ] **Step 4: Implement the Skeleton, the error boundaries and wire the hooks**

Create `apps/personal-calibre/src/components/library/ViewSkeleton.tsx`:

```tsx
'use client';

import { Skeleton } from '@rainforest-dev/rainforest-react';

import { cn } from '@/lib/utils';

import { useLibrary } from './LibraryProvider';

export function ViewSkeleton() {
  const { view } = useLibrary();
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading books"
      data-skeleton={view}
      className="py-4"
    >
      {view === 'catalogue' ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton
              key={i}
              className={cn('h-12 w-full', i >= 7 && 'hidden lg:block')}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-5 gap-y-7 lg:grid-cols-[repeat(auto-fill,minmax(148px,1fr))]">
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              className={cn('flex flex-col gap-2', i >= 6 && 'hidden lg:flex')}
            >
              <Skeleton className="aspect-[2/3] w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

Create `apps/personal-calibre/src/components/library/LoadError.tsx`:

```tsx
'use client';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
} from '@rainforest-dev/rainforest-react';
import { RotateCw, TriangleAlert } from 'lucide-react';

import { cn } from '@/lib/utils';

export function LoadError({
  variant,
  digest,
  onRetry,
}: {
  variant: 'page' | 'compact';
  digest?: string;
  onRetry: () => void;
}) {
  const compact = variant === 'compact';
  return (
    <Alert
      variant="destructive"
      className={cn(compact ? 'm-4 w-auto' : 'my-6')}
    >
      <TriangleAlert aria-hidden />
      <AlertTitle>
        {compact ? "Couldn't load this book" : "Couldn't load the library"}
      </AlertTitle>
      {!compact && (
        <AlertDescription>
          <p>
            The book list request failed. Your filters and selection are kept,
            so a retry picks up where you were.
          </p>
          {digest && <p className="font-mono text-xs">{digest}</p>}
        </AlertDescription>
      )}
      <div className="col-start-2 mt-2">
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw aria-hidden />
          Retry
        </Button>
      </div>
    </Alert>
  );
}
```

Create `apps/personal-calibre/src/app/(library)/error.tsx`:

```tsx
'use client';

import { LoadError } from '@/components/library/LoadError';

export default function LibraryError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <LoadError variant="page" digest={error.digest} onRetry={unstable_retry} />
  );
}
```

Create `apps/personal-calibre/src/app/(library)/@pane/error.tsx`:

```tsx
'use client';

import { LoadError } from '@/components/library/LoadError';

export default function PaneError({
  unstable_retry,
}: {
  unstable_retry: () => void;
}) {
  return <LoadError variant="compact" onRetry={unstable_retry} />;
}
```

Replace `apps/personal-calibre/src/app/(library)/page.tsx` (Tasks 5, 7, 8 and 10 plus the
Skeleton fallback and the hooks):

```tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { KeyHints } from '@/components/library/KeyHints';
import { LibraryToolbar } from '@/components/library/LibraryToolbar';
import { ViewRegion } from '@/components/library/ViewRegion';
import { ViewSkeleton } from '@/components/library/ViewSkeleton';
import { Pagination } from '@/components/Pagination';
import { listDeliveryPlatforms } from '@/lib/delivery';
import {
  buildLibraryHref,
  type FilterLabels,
  hasFilters,
  PAGE_SIZE,
  parseLibraryParams,
  type RawSearchParams,
  toLibraryQuery,
} from '@/lib/library-params';
import { getFilterOptions, getLibrary } from '@/lib/queries';
import { applyTestHooks, FAULT_COOKIE, readTestHooks } from '@/lib/test-hooks';

interface Props {
  searchParams: Promise<RawSearchParams>;
}

export default function LibraryPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<ViewSkeleton />}>
      <LibraryContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LibraryContent({ searchParams }: Props) {
  const raw = await searchParams;
  const hooks = readTestHooks(raw, (await cookies()).get(FAULT_COOKIE)?.value);
  await applyTestHooks(hooks, 'list');
  const params = parseLibraryParams(raw);
  const [library, filters, platforms] = await Promise.all([
    getLibrary(toLibraryQuery(params, hooks.pageSize ?? PAGE_SIZE)),
    getFilterOptions(),
    listDeliveryPlatforms(),
  ]);
  if (params.page > library.pageCount) {
    redirect(buildLibraryHref(raw, { page: library.pageCount }));
  }
  const labels: FilterLabels = { ...filters, platforms };

  return (
    <div className="flex flex-col gap-4">
      <LibraryToolbar
        labels={labels}
        matchingBooks={library.matchingIds.length}
        libraryTotal={library.libraryTotal}
        matchingIds={library.matchingIds}
      />
      <ViewRegion
        library={library}
        groupBy={params.groupBy}
        platforms={platforms}
        filtered={hasFilters(params)}
      />
      <Pagination page={library.page} pageCount={library.pageCount} />
      <KeyHints />
    </div>
  );
}
```

In `apps/personal-calibre/src/app/(library)/@pane/page.tsx`, add the imports
`import { cookies } from 'next/headers';` and
`import { applyTestHooks, FAULT_COOKIE, readTestHooks } from '@/lib/test-hooks';`, and insert
after the `if (id === null) return null;` line:

```tsx
await applyTestHooks(
  readTestHooks(raw, (await cookies()).get(FAULT_COOKIE)?.value),
  'pane',
);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm nx e2e personal-calibre-e2e -- --grep "states|pages|shelf"`
Expected: PASS. In dev, Next.js also reports the injected error in its issues badge; if its
overlay covers the Alert and intercepts the Retry click, close the overlay in the test with
`page.locator('nextjs-portal').getByRole('button', { name: /close/i })` before clicking. Clear
port 3333.

- [ ] **Step 6: Dev server check, lint, types and comment audit**

Dev-server check: load `/?__delay=2000` with the cookie set to each view (Skeleton shape),
`/?__fault=list`, and `/?book=38&__fault=pane`. Confirm the page keeps the header and panel
around the Alert. Without `CALIBRE_E2E=1` (restart the server without it), `/?__fault=list`
loads normally.

Run: `pnpm nx run-many -t lint -p personal-calibre personal-calibre-e2e`
Run: `pnpm nx typecheck personal-calibre` and `pnpm nx typecheck personal-calibre-e2e`
Run: `pnpm nx test personal-calibre`
Run: `git diff -U0 HEAD | grep -E '^\+\s*(//|/\*|\*|#|\{/\*)'`
Expected: PASS; no comment hits.

- [ ] **Step 7: Commit**

```bash
git checkout -- apps/personal-calibre/next-env.d.ts
git add apps/personal-calibre/src/lib/test-hooks.ts apps/personal-calibre/src/lib/test-hooks.test.ts \
  apps/personal-calibre/env.d.ts \
  apps/personal-calibre/src/components/library/ViewSkeleton.tsx \
  apps/personal-calibre/src/components/library/LoadError.tsx \
  'apps/personal-calibre/src/app/(library)/error.tsx' \
  'apps/personal-calibre/src/app/(library)/@pane/error.tsx' \
  'apps/personal-calibre/src/app/(library)/page.tsx' \
  'apps/personal-calibre/src/app/(library)/@pane/page.tsx' \
  apps/personal-calibre-e2e/src/states.spec.ts
git commit -m "$(cat <<'EOF'
feat(personal-calibre): view-shaped skeletons and retryable load errors

The page fallback is a Skeleton in the shape of the current view, and
list and pane errors show a destructive Alert with Retry. CALIBRE_E2E
test hooks inject faults, delay and page size for the e2e suite.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm
EOF
)"
```

---

### Task 12: Accessibility, phone, budgets and verification

**Files:**

- Modify: `apps/personal-calibre-e2e/package.json` (`@axe-core/playwright` devDependency) and
  `pnpm-lock.yaml`
- Create: `apps/personal-calibre-e2e/src/support/axe.ts`
- Create: `apps/personal-calibre-e2e/src/a11y.spec.ts`
- Create: `apps/personal-calibre-e2e/src/a11y.phone.spec.ts`
- Create: `apps/personal-calibre-e2e/src/library.phone.spec.ts`
- Create: `apps/personal-calibre-e2e/src/budgets.spec.ts`
- Modify: only files an axe, phone or budget finding points at, each already created by
  Tasks 3-11.

**Interfaces:**

- Consumes: everything above; `visual.spec.ts` and the `before-*.png` captures (Task 1).
- Produces: `expectNoViolations(page)` from `src/support/axe.ts`; a verified branch.

- [ ] **Step 1: Check the coverage of the deleted specs**

Each behaviour the Task 1 deletions covered now has a test:

- `book-detail.spec.ts` → `pane.spec.ts` (title, author, tags, permalink; the `from` back link is
  kept by `books/[id]/page.tsx` and its `Library` link is asserted in `pane.spec.ts`).
- `book-list.spec.ts`, `example.spec.ts` → `shelf.spec.ts` (grid, count, heading via
  `filters.spec.ts` `h1`).
- `bulk-delivery.spec.ts` → `bulk.spec.ts`, `catalogue.spec.ts` (bulk, marks after delivery,
  `Not on` filter in `filters.spec.ts`).
- `filter.spec.ts` → `filters.spec.ts` (facets, platform, sort direction, Clear all, Back is
  covered by `pages.spec.ts` and `pane.spec.ts`).
- `group-by.spec.ts` → `shelf.spec.ts` (series groups, `No series` fallback via `(continued)`,
  See all) and `catalogue.spec.ts` (group rows); tag and author grouping in `keyboard.spec.ts`
  and Task 2's `library-query.test.ts`.
- `search.spec.ts` → `search.spec.ts`.
- `tag-editing.spec.ts` → `tags.spec.ts`, and the new-tag-in-filters case in `filters.spec.ts`.

If any line above has no matching test, add it to the named spec before continuing.

- [ ] **Step 2: Add axe and write the accessibility and phone specs**

Run: `pnpm --filter personal-calibre-e2e add -D @axe-core/playwright`
Expected: `apps/personal-calibre-e2e/package.json` and `pnpm-lock.yaml` change.

Create `apps/personal-calibre-e2e/src/support/axe.ts`:

```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'];

export async function expectNoViolations(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  const { violations } = await new AxeBuilder({ page })
    .withTags(TAGS)
    .analyze();
  expect(
    violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
    ),
  ).toEqual([]);
}
```

Create `apps/personal-calibre-e2e/src/a11y.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

import { expectNoViolations } from './support/axe';
import { gotoLibrary, options } from './support/library';

const PAGES = [
  ['shelf', '/'],
  ['grouped shelf', '/?groupBy=series'],
  ['catalogue', '/?view=catalogue'],
  ['grouped catalogue', '/?view=catalogue&groupBy=tag'],
  ['shelf with the pane', '/?book=38'],
  ['catalogue with the pane', '/?view=catalogue&book=38'],
  ['permalink', '/books/38'],
  ['empty result', '/?q=zzzz-no-such-book'],
] as const;

test.describe('accessibility', () => {
  for (const [name, url] of PAGES) {
    test(`${name} has no axe violations`, async ({ page }) => {
      await gotoLibrary(page, url);
      await expectNoViolations(page);
    });
  }

  test('the bulk toolbar has no axe violations', async ({ page }) => {
    await gotoLibrary(page);
    await options(page).first().focus();
    await page.keyboard.press('x');
    await expect(
      page.getByRole('toolbar', { name: 'Bulk actions' }),
    ).toBeVisible();
    await expectNoViolations(page);
  });
});
```

Create `apps/personal-calibre-e2e/src/a11y.phone.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

import { expectNoViolations } from './support/axe';
import { gotoLibrary } from './support/library';

test.describe('accessibility on phone', () => {
  test('the shelf has no axe violations', async ({ page }) => {
    await gotoLibrary(page);
    await expectNoViolations(page);
  });

  test('the compact catalogue has no axe violations', async ({ page }) => {
    await gotoLibrary(page, '/?view=catalogue');
    await expectNoViolations(page);
  });

  test('the filter Sheet has no axe violations', async ({ page }) => {
    await gotoLibrary(page);
    await page.getByRole('button', { name: /^Filters/ }).click();
    await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible();
    await expectNoViolations(page);
  });

  test('the detail Sheet has no axe violations', async ({ page }) => {
    await gotoLibrary(page, '/?book=38');
    await expect(
      page.getByRole('dialog', { name: 'Book details' }),
    ).toBeVisible();
    await expectNoViolations(page);
  });
});
```

Create `apps/personal-calibre-e2e/src/library.phone.spec.ts`:

```ts
import { expect, type Page, test } from '@playwright/test';

import { gotoLibrary, options } from './support/library';

async function expectNoSideScroll(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test.describe('library on phone', () => {
  test('filters open in a left Sheet with Group at the top', async ({
    page,
  }) => {
    await gotoLibrary(page);
    await page.getByRole('button', { name: /^Filters/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Filters' });
    await expect(sheet.getByRole('combobox', { name: 'Group' })).toBeVisible();
    await sheet
      .getByRole('region', { name: 'Tags' })
      .getByRole('button', { name: 'winter' })
      .click();
    await expect(page).toHaveURL(/tag=6/);
  });

  test('tapping a tile opens the detail Sheet', async ({ page }) => {
    await gotoLibrary(page);
    await options(page).first().click();
    const sheet = page.getByRole('dialog', { name: 'Book details' });
    await expect(sheet.getByRole('heading', { level: 2 })).toBeVisible();
    await sheet.getByRole('button', { name: 'Close details' }).click();
    await expect(page).not.toHaveURL(/book=/);
  });

  test('Select mode marks tiles and floats the bulk bar', async ({ page }) => {
    await gotoLibrary(page);
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await options(page).nth(0).click();
    await options(page).nth(1).click();
    await expect(options(page).nth(1)).toHaveAttribute('aria-selected', 'true');
    const bar = page.getByRole('toolbar', { name: 'Bulk actions' });
    await expect(bar).toContainText('2 selected');
    const box = await bar.boundingBox();
    expect(box && box.y + box.height).toBeGreaterThan(844 - 24);
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(bar).toHaveCount(0);
  });

  test('the pager works', async ({ page }) => {
    await gotoLibrary(page);
    await page
      .getByRole('navigation', { name: 'Pagination' })
      .getByRole('link', { name: 'Next' })
      .click();
    await expect(page).toHaveURL(/page=2/);
  });

  test('no key hints and no horizontal page scroll', async ({ page }) => {
    for (const url of [
      '/',
      '/?view=catalogue',
      '/?groupBy=series',
      '/?book=38',
    ]) {
      await gotoLibrary(page, url);
      await expect(page.locator('[data-key-hints]')).toBeHidden();
      await expectNoSideScroll(page);
    }
  });
});
```

Run: `pnpm nx e2e personal-calibre-e2e -- --grep "accessibility|library on phone"`
Expected: first run may FAIL with axe findings. Fix each in the file that owns the markup, then
rerun until PASS with 0 violations. Likely findings and their fix:

- `color-contrast` on `Badge variant="success"` pills or marks → use `text-foreground` with the
  `success` check icon, keeping `bg-success/15`.
- `nested-interactive` or `aria-required-children` in the Shelf → a focusable element inside an
  option, or a non-group child of the listbox; move it out (D14) or wrap it in the group.
- `aria-allowed-attr` → an `aria-*` on an element whose role does not take it; use the role the
  spec names or drop the attribute.
- `page-has-heading-one` with the bulk toolbar → Task 8's visually hidden `h1` is missing.
- `landmark-unique` / `region` → each `aside` needs its own label; content outside landmarks
  goes inside `main`.

Clear port 3333.

- [ ] **Step 3: Measure the phase 1 budgets**

Create `apps/personal-calibre-e2e/src/budgets.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

import { gotoLibrary, options } from './support/library';

test.skip(
  process.env['CALIBRE_BUDGETS'] !== '1',
  'budgets run with CALIBRE_BUDGETS=1 against next start',
);

const p95 = (xs: number[]) =>
  [...xs].sort((a, b) => a - b)[Math.ceil(xs.length * 0.95) - 1] ?? Infinity;
const now = (page: import('@playwright/test').Page) =>
  page.evaluate(() => performance.now());

test.describe('budgets', () => {
  test('the RSC payload of / is at most 60 KB', async ({ request }) => {
    const res = await request.get('/', { headers: { RSC: '1' } });
    const bytes = (await res.body()).byteLength;
    console.log(`[budget] RSC payload ${(bytes / 1024).toFixed(1)} KB`);
    expect(bytes).toBeLessThanOrEqual(60 * 1024);
  });

  test('opening a book shows the pane within 200 ms p95', async ({ page }) => {
    await gotoLibrary(page);
    const times: number[] = [];
    for (let i = 0; i < 20; i++) {
      const option = options(page).nth(i);
      const id = await option.getAttribute('data-book-id');
      await option.focus();
      const start = await now(page);
      await page.keyboard.press('Enter');
      await page.locator(`[data-book-detail="${id}"]`).waitFor();
      times.push((await now(page)) - start);
    }
    console.log(`[budget] pane open p95 ${p95(times).toFixed(0)} ms`);
    expect(p95(times)).toBeLessThanOrEqual(200);
  });

  test('a page change focuses the first item within 300 ms p95', async ({
    page,
  }) => {
    await gotoLibrary(page);
    await options(page).first().focus();
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const key = i % 2 === 0 ? ']' : '[';
      const target = i % 2 === 0 ? 'page=2' : '';
      const start = await now(page);
      await page.keyboard.press(key);
      await page.waitForFunction(
        (want) =>
          (want
            ? location.search.includes(want)
            : !location.search.includes('page=')) &&
          document.activeElement?.getAttribute('role') === 'option',
        target,
      );
      times.push((await now(page)) - start);
    }
    console.log(`[budget] page change p95 ${p95(times).toFixed(0)} ms`);
    expect(p95(times)).toBeLessThanOrEqual(300);
  });

  test('a view switch paints within 100 ms and makes no request', async ({
    page,
  }) => {
    await gotoLibrary(page);
    await options(page).first().focus();
    const requests: string[] = [];
    page.on('request', (r) => {
      if (['document', 'fetch', 'xhr'].includes(r.resourceType()))
        requests.push(r.url());
    });
    const start = await now(page);
    await page.keyboard.press('v');
    await page.getByRole('region', { name: 'Catalogue view' }).waitFor();
    const elapsed = (await now(page)) - start;
    console.log(`[budget] view switch ${elapsed.toFixed(0)} ms`);
    expect(elapsed).toBeLessThanOrEqual(100);
    expect(requests).toEqual([]);
  });
});
```

Build and start the production server on the fixture (the fixture exists after any e2e run):

```bash
pnpm nx build personal-calibre
STANDALONE=apps/personal-calibre/.next/standalone
cp -R apps/personal-calibre/.next/static "$STANDALONE/apps/personal-calibre/.next/static"
cp -R apps/personal-calibre/public "$STANDALONE/apps/personal-calibre/public"
FIX="$PWD/apps/personal-calibre-e2e/test-output/fixtures"
pids=$(lsof -tiTCP:3334 -sTCP:LISTEN); [ -n "$pids" ] && kill $pids
CALIBRE_LIBRARY_PATH="$FIX" CALIBRE_APP_DB_PATH="$FIX/app.db" CALIBRE_E2E=1 PORT=3334 \
  HOSTNAME=127.0.0.1 node "$STANDALONE/apps/personal-calibre/server.js" &
until curl -sf http://127.0.0.1:3334/favicon.ico >/dev/null; do sleep 0.5; done
CALIBRE_BUDGETS=1 CALIBRE_SKIP_SEED=1 BASE_URL=http://127.0.0.1:3334 \
  pnpm nx e2e personal-calibre-e2e -- --grep "budgets" --project=chromium
pids=$(lsof -tiTCP:3334 -sTCP:LISTEN); [ -n "$pids" ] && kill $pids
```

Expected: 4 PASS, each printing a `[budget]` line; keep the numbers for the PR body. They are
headless numbers on this machine. A miss is a finding: report it with the number rather than
raising the budget. The `.next/standalone` copies are build output, never committed.

- [ ] **Step 4: Full verification**

Run: `pnpm nx run-many -t lint test typecheck -p personal-calibre personal-calibre-e2e`
Run: `pnpm nx e2e personal-calibre-e2e` (both projects; `visual` and `budgets` skip)
Run: `pnpm nx build personal-calibre`
Expected: PASS. The build is where `cacheComponents` reports request data read outside
Suspense; fix any such error in the file it names. Clear port 3333.

Check that the replaced components are gone:

```bash
ls apps/personal-calibre/src/components/{BookGrid,BookCard,FilterBar,BulkSelectionWrapper,BulkActionBar,DeliveryTracker}.tsx 2>&1 | grep -c 'No such file'
```

Expected: `6`.

- [ ] **Step 5: Dev server check**

Dev-server check: load `/`, `/?groupBy=series&page=2`, `/?view=catalogue&book=38`,
`/books/38`, `/read/1` (the reader opens; its content is the made-up text file, so a parse
error inside the reader is expected and out of scope), and `/` at 390px with the filter Sheet
and the detail Sheet. Walk the keyboard map once by hand: `/`, `v`, arrows, `Home`/`End`,
`Ctrl+End`, `x`, `Enter`, `Esc` twice, `]`, `[`. No console error apart from the reader's.

- [ ] **Step 6: After-captures and comparison**

Run: `CALIBRE_VISUAL=after pnpm nx e2e personal-calibre-e2e -- --grep "visual"`
Expected: PASS; `after-*.png` for every surface (after-only surfaces included) in
`apps/personal-calibre-e2e/test-output/visual/`. Read each `after-*.png` next to its
`before-*.png` in light and dark at 1440 and 390: the three-column layout, the pager, grouped
rows with `(continued)`, the pane and the Catalogue. Check token use in dark (no light-only
colours), text contrast on spine placeholders, and that nothing overflows at 390. Fix defects in
the owning file and rerun the capture. Captures are never committed.

- [ ] **Step 7: Token and comment audit over the branch**

```bash
git diff origin/main...HEAD -U0 -- apps/personal-calibre apps/personal-calibre-e2e \
  | grep -E '^\+\s*(//|/\*|\*|#|\{/\*)'
git diff origin/main...HEAD -U0 -- apps/personal-calibre/src \
  | grep -E '^\+.*(#[0-9a-fA-F]{3,8}\b|\b(text|bg|border|ring|fill)-(gray|slate|zinc|red|green|blue|violet|amber)-[0-9]|\bdark:)'
```

Expected: no hits from the second command; each hit of the first is on the allow-list
(`files.ts`' existing EAGAIN line is not in the diff).

- [ ] **Step 8: Commit**

```bash
git checkout -- apps/personal-calibre/next-env.d.ts
git add apps/personal-calibre-e2e/package.json pnpm-lock.yaml \
  apps/personal-calibre-e2e/src/support/axe.ts \
  apps/personal-calibre-e2e/src/a11y.spec.ts apps/personal-calibre-e2e/src/a11y.phone.spec.ts \
  apps/personal-calibre-e2e/src/library.phone.spec.ts apps/personal-calibre-e2e/src/budgets.spec.ts
git add $(git diff --name-only -- apps/personal-calibre/src)
git commit -m "$(cat <<'EOF'
test(personal-calibre): axe, phone and budget checks for the redesign

Every view, the pane and both Sheets pass axe with wcag2a/aa, wcag21aa
and best-practice. Phone specs cover the Sheets, Select mode, the pager
and horizontal overflow; an opt-in spec measures the phase 1 budgets.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm
EOF
)"
```

- [ ] **Step 9: Hand back**

Report to the controller: the budget numbers from step 3, any axe rule that needed a design
change, and the capture folder. The pull request is opened only when the user asks, with the
`rainforest-core:create-pr` skill and the before/after captures attached through
`rainforest-core:attach-pr-media` (the pane, Catalogue and selection surfaces are after-only;
label them so).

## Self-review

- Spec coverage. Problems: 1 → Tasks 5, 9; 2 → Task 4 (pane, `?book=`, permalink); 3 → Tasks 3
  (provider), 5 (select mark), 8 (bulk across pages); 4 → Task 4 (per-platform rows, local
  `YYYY-MM-DD HH:mm`); 5 → Tasks 6, 10; 6 → Task 4 (Read); 7 → Task 11; 8 → Task 2 (grouped
  paging) and Task 5; 9 → Task 5 (redirect keeps params); 10 → Task 1. Decisions 1, 2 → Tasks 3,
  7; 3, 11 → out of scope (seams D19); 4 → phase 2; 5 → Tasks 6, 10 (hints, focus versus
  selection colours); 6 → Task 11; 7 → Task 4 (delivery stays a manual log); 8 → Task 4; 9 →
  Task 1; 10 → Tasks 2, 5, 8, 10. P1 → Tasks 3, 4 (D13 for soft navigation); P2 → Tasks 2, 5;
  P3 → Tasks 2, 3; P4 → Tasks 3, 8, 9; P5 → Tasks 5, 9; P6, P7 → Tasks 2, 5, 9; P8 → phase 2;
  P9 → Tasks 2, 6; P10, P10a → Tasks 6, 10; P11 → Task 7; P12 → Task 7; P13 → Tasks 3, 7, 9;
  P14 → Tasks 2, 5 (`contentKey`); P15 → Task 4 (`spineClass`); P16 → phase 2 (the CJK and
  curly-apostrophe fixture titles are in place); P17 → Task 4; P18 → Task 4; P19 → Task 3;
  P20 → D19 seam; P21 → Task 2; P22 → Task 11; P23 → phase 2. Loading, error, empty → Tasks 4,
  5, 11. Copy → each task. Fixtures → Task 1. Testing: every Vitest item is in Tasks 1-4, 6, 10,
  11; every phase 1 Playwright item is in Tasks 3-12; axe in Task 12. Budgets → Task 12.
- Placeholders: none. Task 12 step 8 stages the axe fixes with
  `git diff --name-only -- apps/personal-calibre/src`, since the file list depends on the findings.
- Types: `LibraryEntry`/`EntryGroupRef`/`LibraryResult` (Task 2) are used unchanged in Tasks 5, 9;
  `LibraryQuery` and `toLibraryQuery` (Task 2) in Tasks 5, 11; `useLibrary()` members (Task 3)
  match every later call (`replaceParams`, `clearFilters`, `goToPage`, `openBook`, `closeBook`,
  `requestFocus`, `pageInfo`, `setPageInfo`, `addMany`, `removeMany`); `PendingFocus` kinds
  `first`/`book` in Tasks 3, 6, 10; `useRovingNav` options (Task 6) in Task 9; `BookTile` props
  (Task 5) in Task 6; `LibraryToolbar` props grow in Task 8 and page.tsx passes them in Tasks 8
  and 11; `FAULT_COOKIE` matches in `test-hooks.ts` and `support/library.ts`; `PREFS_COOKIE` in
  `prefs.ts` and `support/library.ts`.
- Review Focus: line 1 → Task 2 step 1 and Task 5 step 1; line 2 → Task 4 step 1, Task 5 step 1,
  Task 8 step 1; line 3 → Task 2 step 1, Task 6 step 1; line 4 → Task 10 step 1; line 5 → Task 8
  step 1.
