# Calibre redesign: three views, shared chrome, 3D study

Date: 2026-09-29. Status: design approved by the owner from the Claude Design prototype v2, with
the binding decisions listed under Decisions. This spec maps the prototype onto
`apps/personal-calibre`.

Phase 2 shipped on 2026-10-05 with `three-tsl` as the default Study renderer and `css` as the
alternative and fallback. Measured on the large fixture at `?__pageSize=250`, `next start`, headed
Chromium on an Apple M4 Pro, median of three sweeps:

- Texture memory: 48.2 MiB desktop (1440×900 @2) and 29.7 MiB phone, at 96 px per unit. At
  1440×1000 the cover cache drops to 23 covers and reports 49.7 MiB.
- Programs: 18 desktop, 34 phone, flat through the sweep and a walk of every row.
- `init()`: 5.4 ms on WebGPU and 8.0 ms on WebGL2. First render call: 29.6 ms and 73.1 ms.
- Mount to first frame: 565 ms on WebGPU and 621 ms on WebGL2 (medians; single runs ranged from
  442 to 621 ms), over the 300 ms and 600 ms budgets.
- Render CPU max after prewarm, phone emulation: 32.8 ms, over the 25 ms budget.

The timing misses are tracked in a separate ticket; phase 3 adds a mount-to-first-frame breakdown
to the sweep and does not change the TSL path (owner decision, PR #507).

- rAF: median 16.7 ms on every run.
- Lazy Study JS: 435.6 KB gzip.

Sources, in order of authority:

1. The owner decisions recorded below.
2. The prototype, Claude Design project `4c25a390-c3db-43c1-af89-b0504a180625`, folder
   `explorations/calibre-redesign/`: `review.md` (v2 and v1 sections), `Calibre Redesign v2.html`,
   `v2-app.jsx`, `v2-chrome.jsx`, `v2-views.jsx`, `v2-detail.jsx`, `data.js`. It is React 18 with
   inline styles and fixture data. The app keeps its semantic tokens, Tailwind utilities and
   `@rainforest-dev/rainforest-react`.
3. The three.js spike on branch `spike/calibre-3d` (local only; route `/spike/study`), three
   rounds of results measured 2026-09-28/29 on Chromium, Apple M4 Pro.
4. The current app on `origin/main`.

## Phases

The whole redesign is too big for one PR. It ships in three:

| Phase | Scope                                                                                       | PR size   |
| ----- | ------------------------------------------------------------------------------------------- | --------- |
| 1     | Data layer, shared chrome, Shelf, Catalogue, detail pane, keyboard, states, fixtures, tests | ~11 tasks |
| 2     | Study: shared model and DOM layer, `three-tsl` renderer (default), `css`, renderer switch   | ~10 tasks |
| 3     | Study `three-glsl` renderer as an alternative                                               | ~4 tasks  |

This spec covers phase 1 in full: a plan can be cut from it directly. Phases 2 and 3 are designed
here to the level of contracts, decisions and budgets, and each gets its own plan before it
starts. Until phase 2 lands, the view switcher shows two items and `v` cycles between them.
Phase 2 ships the default renderer (`three-tsl`) with `css` as the alternative and fallback;
phase 3 adds `three-glsl` as a second alternative.

## Problems

Measured against the current app:

1. **One view only.** A cover grid with a `Books` heading. There is no table for scanning
   delivery status, and no way to see books as a shelf.
2. **Detail is a separate page.** Every book opens `/books/[id]`, so working through several
   books means Back, re-find, open. Filters survive only through the `from` param.
3. **Selection is a mode.** `Select` has to be switched on before any checkbox appears, it lives
   only in the grid (`BulkSelectionWrapper`), and the bulk bar uses native `<select>` and
   hand-rolled button classes.
4. **Delivery tracking is a form.** A platform `<select>`, two inputs and `Mark as added`, then a
   flat event list. The current state per platform is not visible at a glance. Times use
   `toLocaleString()` and change with the browser locale.
5. **No keyboard model.** No roving focus, no shortcuts, and focus is lost after most actions.
6. **The reader is unreachable.** `/read/[id]` exists, and nothing links to it.
7. **No loading or error states.** The page's Suspense fallback is an empty `div`; a failing
   query shows the Next.js error page.
8. **Grouped view is capped and unpaged.** `getGroupedBookList` returns six books per group and
   the grouped page has no pager, so most books in a large group are only reachable through
   `See all`.
9. **The out-of-range page redirect drops filters.** `page.tsx` redirects to page 1 keeping only
   `q`, `author`, `tag` and `series`.
10. **Public-repo fixtures use real books and authors** (`global-setup.ts` seeds real titles).

## Goals

- One design, three views over the same page of results: 書架 Shelf (cover grid), 目錄 Catalogue
  (table), 書房 Study (3D shelves).
- Search, filters, selection, bulk actions and the detail pane shared by all three views.
- Detail in a side pane (bottom sheet on phone) with a stable URL.
- Keyboard first: every action reachable without a pointer, with a visible hint row on desktop.
- Loading, error and empty states for every view.
- Study as switchable renderers, so the CSS and three.js builds can be compared in the real app.

## Decisions (owner, binding)

1. **Three views, one switcher.** The header switcher reads Shelf / Catalogue / Study; `v` cycles
   them in that order. The choice is remembered (see decision P3 for where).
2. **Shared chrome.** Search, the collapsible filter panel, bulk selection and the right-hand
   detail pane are shared by every view. The detail pane uses B's compact header (cover, series
   link, title, author links, rating) and A's per-platform delivery rows.
3. **Study renderers are experiments:**
   - `three-tsl`, **the default**: `WebGPURenderer` with TSL (the spike's `tsl-webgpu`). It falls
     back to its WebGL2 backend by itself when `navigator.gpu` is missing. `studyMaterial.ts` is
     its only shader source.
   - `css`: CSS 3D, per the prototype. A switchable alternative.
   - `three-glsl`: `WebGLRenderer` + a GLSL `ShaderMaterial`. A switchable alternative.
   - `WebGLNodesHandler` is not used.
   - three.js code is loaded with `next/dynamic` (`ssr: false`) only while Study is shown.
4. **The three.js build fixes the spike's open items:** a visible focus ring overlay; the camera
   clamped to the bookcase; shelf headings (series or author, with a count); a per-shelf atlas
   built visible shelves first; cover prewarm; reduced motion with a strong focus cue; tone
   mapping off at renderer level; uniforms, not constants, for changing values in TSL; one
   material for the pulled book; the side colour in `aCol`, not `instanceColor`.
5. **Keyboard is first-class** (full map below). A key-hint row shows in each view on desktop and
   is hidden on phone. Focus ring (`foreground`) and selection (`primary`) stay visually distinct.
6. **Loading** uses a Skeleton shaped like the current view; **error** is a destructive Alert with
   Retry.
7. **No send-to-device.** Delivery tracking (Kobo, NotebookLM, Readwise Reader) stays as it is:
   a manual log of where a book has been added.
8. **A Read button** links to the existing `/read/[id]` reader.
9. **Fixture data only** in tests and captures, with made-up books and authors.
10. **Pagination stays.** Selection persists across pages and the bulk bar acts on everything
    selected, on this page or not. Keyboard navigation works within the current page, and keys
    move between pages. Study shows the current page grouped into shelves, with the pager.
11. **The TSL lessons from the spike are requirements** for `three-tsl`: renderer-level
    `NoToneMapping`; uniforms, not constants, for anything that changes; one material for the
    pulled book; side colour in `aCol`, not `instanceColor`; no reliance on `TextureNode`
    offset/repeat; an explicit output buffer type with a stated memory budget.

## Decisions (where the prototype is silent or disagrees with the app)

- **P1. Detail pane routing: a `@pane` parallel route driven by `?book=<id>`.** The library layout
  gains two parallel slots, `@filters` and `@pane`, next to `children`. `@pane/page.tsx` reads
  `searchParams.book` and renders the detail for that id, inside its own `loading.tsx` (pane
  Skeleton) and `error.tsx`. `/books/[id]` stays as the full-page permalink and renders the same
  `BookDetail` component.
  - Against an intercepting route (`@pane/(.)books/[id]`): interception moves the pathname to
    `/books/12`, so a reload drops the list and its filters, and every filter or sort change has
    to navigate away from the intercepted URL, which closes the pane. With `?book=` the list
    state and the pane live in one URL: reload, Back and Forward all restore both, and filters
    change with the pane open.
  - Against client-only state: it loses the deep link and history, and needs a JSON detail API
    that duplicates `getBook`, description sanitising and delivery events.
  - Cost: opening a book re-renders the list segment's RSC payload. The list queries are already
    `'use cache'` (tag `books`), and the budget below caps the cost. Client views must not rebuild
    derived state on a new but equal `books` array (see P14).
- **P2. Pagination keeps today's URL shape.** `?page=N`, 1-based, omitted on page 1; 30 items per
  page (`PAGE_SIZE`, today's `limit`); any filter, sort or group change drops `page`, as
  `updateParam` does today. Page changes keep every other param, `book` included, as
  `buildPageUrl` already does. Changes from today:
  - The page size is the same in every view, so page N holds the same books whichever view is
    showing, and a view switch stays instant (P5).
  - Grouped mode is paged too. The server orders by group, then by the sort within the group
    (series groups by series index), and pages over (group, book) entries. With tag grouping a
    book in two tags is two entries. A group split across pages repeats its heading with
    `(continued)` on the next page. `getGroupedBookList` and its six-book cap stay for the MCP
    tool only.
  - An out-of-range `page` redirects to the last page and keeps every param (today it goes to
    page 1 and drops `platform`, `delivered`, `groupBy` and the sort).
  - `Pagination.tsx` is kept and restyled to the prototype's pager (`Button` outline, `Prev` /
    `Next` with arrows, `Page N of M`). It shows whenever there is more than one page, grouped or
    not, in every view.
- **P3. Preferences live in a cookie, not localStorage.** `calibre-prefs` holds
  `{ view, panel, renderer }` as JSON (path `/`, one year, `SameSite=Lax`), written from the
  client on change. The server reads it with `cookies()` so the first paint already has the right
  view, panel state and Skeleton; localStorage would flash the default view before hydration. The
  page reads `searchParams` already, so it is dynamic anyway. `?view=` and `?renderer=` override
  the cookie for one load (tests, captures, sharing) and do not write it.
- **P4. Selection and focus are client state** in a `LibraryProvider` mounted in the library
  layout, so they survive page changes, view switches, filter changes and opening the pane.
  Neither goes in the URL or storage. The bulk bar reads `N selected`, counting books on other
  pages and books the current filters hide, and every bulk action applies to all of them.
  `Select all N` selects every match across all pages, using the `matchingIds` the server
  returns (see Server). The Catalogue header checkbox selects or clears the current page only.
  Successful Mark delivered clears the selection, as today.
- **P5. The view is client state over one server page.** The server returns the current page
  once; the view choice, the Study shelf grouping and navigation run on the client. Switching
  views is instant and makes no request, except for P8's one case.
- **P6. Grouping order is on the server, shelf building on the client.** The server orders and
  pages the entries (P2) and returns each entry's `groupKey` and `groupLabel`. A pure
  `groupEntries(entries)` turns consecutive entries into groups for the page. Groups sort by
  label, with `No series`, `No author` and `Untagged` last.
- **P7. Group rows per view.** Shelf shows each group on the page as one horizontal row, with
  `See all N` (sets the matching filter and clears Group) when the group has more books than this
  page shows. Catalogue shows the page's entries under group header rows. Study shows the page's
  books as shelves.
- **P8. Study groups by series or author only.** A physical book cannot stand on two shelves, so
  Study offers Series and Author and no None or Tag (the prototype allowed Tag). Entering Study
  with `groupBy` unset or `tag` replaces it with `groupBy=series` and drops `page`, a URL change
  and one server round trip, so the page is ordered by series and a series is not scattered over
  shelves on several pages. Focus stays on `focusId` if that book is on the new page, else the
  first book. Leaving Study keeps `groupBy=series`.
- **P9. Focus identity.** With tag grouping one book appears in several groups. The DOM nav key is
  `groupKey:bookId`; `focusId` in the provider is the book id. After a view switch, focus goes to
  the first element for that book.
- **P10. Home/End semantics.** "Row" means the visual row the focused item sits in:
  - Shelf, ungrouped: the grid row, found from item rects. Grouped: the group's horizontal row.
  - Study: the physical shelf board the book stands on (in `css` each group is one board, so it
    is the group).
  - Catalogue: the current group's rows, or the whole page when ungrouped.
  - `Ctrl+Home`/`Ctrl+End` (`⌘` on macOS as well) go to the first/last item of the current page.
  - Arrows stop at the page's first and last item; they do not turn the page.
- **P10a. Page keys: `[` and `]`.** Previous and next page, from anywhere outside a text field.
  `PageUp`/`PageDown` are left to the browser, since they already scroll the main column and the
  pane. After the new page loads, focus moves to its first item (`[` included), and the item is
  scrolled into view. At the first or last page the key does nothing.
- **P11. Suggestions open the pane.** Picking a search suggestion sets `?book=` instead of
  navigating to `/books/[id]`. The suggestion list becomes a `Popover` + `Command` anchored to the
  input; `↓` from the input moves into it.
- **P12. Facets.** Single-select, as the URL params are today (`author`, `tag`, `series` ids).
  Each facet shows 8 options and `Show all N`, which swaps in a `Command` with a filter input. No
  counts (review.md suggestion, out of scope).
- **P13. Breakpoint.** Below `lg` (1024px) is the phone layout: filters in a left `Sheet`, detail
  in a bottom `Sheet`, the `Select` button, a floating bulk bar, and no key hints. From `lg` up:
  three columns (`248px`, `1fr`, `420px` when the pane is open).
- **P14. Stable derived state.** Views derive layout from a content key (ids, titles, series,
  delivered platforms, joined), not from array identity, so an RSC refresh that returns equal
  data never rebuilds a Study atlas or loses scroll position.
- **P15. Spines.** Spine thickness and height come from the book id, as in the prototype and the
  spike. Spine colour is `chart-(id % 5 + 1)` mixed with `muted`. The Study card shows the real
  cover (`/api/books/[id]/cover`) when there is one, else the spine colour.
- **P16. Vertical titles.** Latin titles get `text-orientation: sideways` so curly quotes and
  apostrophes rotate with the rest of the line (review.md risk). Titles matching the spike's CJK
  test keep `upright`.
- **P17. Delivery times** show as `YYYY-MM-DD HH:mm` in local time (review.md suggestion), in the
  pane and in History. The Badge on a delivery row shows the date only.
- **P18. Reader.** Read shows only when the book has an EPUB (the reader 404s otherwise) and opens
  `/read/[id]` in the same tab. The reader itself is unchanged.
- **P19. Switcher labels.** Visible labels are English (`Shelf`, `Catalogue`, `Study`) with a
  lucide icon; the tooltip reads `書架 Shelf`, `目錄 Catalogue`, `書房 Study`. On phone only the
  icons show, named by `aria-label`.
- **P20. Renderer selection.** `renderer = ?renderer ?? prefs.renderer ?? 'three-tsl'` (owner
  decision). The alternatives are chosen from a `Renderer` select in the Study toolbar (stored in
  the cookie) or `?renderer=`. Fallbacks: `three-tsl` uses WebGPU, else its own WebGL2 backend;
  if WebGL2 is unavailable too (or the renderer throws while starting), Study switches to `css`
  for the session with a toast and does not write the cookie. `three-glsl` needs WebGL2; without
  it, or when it throws while starting, Study goes straight to `css` the same way and never tries
  `three-tsl` (owner decision, PR #507). The `three-tsl` WebGL2 fallback stays as it is in phase
  3; whether it should hand over to `three-glsl` is decided on the phase 3 sweep numbers.
- **P21. `LibraryBook` is a new type.** The UI query returns `BookSummary` plus `seriesId`,
  `authorIds`, `tags: {id, name}[]` and `pubdate`. `BookSummary`, `getBookList` and the MCP and
  OPDS outputs stay byte-identical.
- **P22. Test hooks.** With `CALIBRE_E2E=1` (set only by the Playwright web server and the perf
  script), the list query honours `?__fault=list|pane` (throws), `?__delay=<ms>` and
  `?__pageSize=<n>` (up to 250, for the perf sweep). Production builds never read them.
- **P23. Backend badge.** With `?debug` in the URL, the Study toolbar shows a mono Badge with the
  renderer and the active backend: `three-tsl · WebGPU`, `three-tsl · WebGL2 fallback`,
  `three-glsl · WebGL2`, `css`. Without `?debug` nothing shows. The canvas wrapper always carries
  `data-renderer` and `data-backend` for tests.

## Surface mapping

| Prototype surface                             | App component or route                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `App` three-column grid (`v2-app.jsx`)        | `(library)/layout.tsx` + client `LibraryShell` with `children`, `@filters`, `@pane` slots  |
| `v2Initial` state, `lib` object               | `LibraryProvider` (selection, focus, select mode, bulk platform, ZIP format)               |
| `V2_URL`, filter state                        | `useLibraryParams()` over `useSearchParams`, `buildLibraryHref(params, patch)`             |
| `cl-v2-prefs` localStorage                    | `calibre-prefs` cookie, `readPrefs()` server / `writePrefs()` client                       |
| `V2Header`                                    | `LibraryHeader.tsx`: panel toggle, Library link, `ViewSwitch`, `SearchField`, filter badge |
| `V2ViewSwitch`                                | `ViewSwitch.tsx` (`ToggleGroup`, `Kbd` v)                                                  |
| `SearchField` (v1 `ui.jsx`)                   | `SearchField.tsx` (`InputGroup`, `Popover` + `Command`, `/api/books/search`)               |
| `V2FilterPanel`, `V2Facets`, `V2Facet`        | `@filters/page.tsx` → `FilterPanel.tsx`, `Facet.tsx`                                       |
| `DeliveredToggle`                             | `DeliveredToggle.tsx` (`ToggleGroup`: On / Not on)                                         |
| `V2FilterSheet`                               | `LibraryShell` phone branch: `Sheet side="left"` around the `@filters` node + Group        |
| `V2Toolbar`, `V2Scope`, `V2Sort`, `V2Group`   | `LibraryToolbar.tsx`, `ScopeTitle.tsx`, `SortControls.tsx`                                 |
| `ChipRow`, `activeChips`                      | `FilterChips.tsx`, `activeFilters(params, options)` in `src/lib/library-params.ts`         |
| `V2Bulk`                                      | `BulkToolbar.tsx` (replaces `BulkActionBar.tsx`, `BulkSelectionWrapper.tsx`)               |
| `V2Shelf`, `V2Tile`, `V2Marks`, `V2GroupHead` | `views/ShelfView.tsx`, `BookTile.tsx`, `DeliveryMarks.tsx`, `GroupHeading.tsx`             |
| `V2Catalogue`, `V2Row`, `V2Pills`             | `views/CatalogueView.tsx`, `CatalogueRow.tsx`, `DeliveryPills.tsx`                         |
| `V2Study`, `V2Spine` (CSS 3D)                 | phase 2: `views/study/StudyView.tsx`, `css/CssStudy.tsx`, `css/Spine.tsx`                  |
| three.js spike `StudySpike.tsx`, `Scene.tsx`  | phase 2/3: `views/study/three/*` (see Study)                                               |
| `V2Keys`, `V2_HINTS`                          | `KeyHints.tsx`, `KEY_HINTS` in `src/lib/keyboard.ts`                                       |
| `onItemKey`, `v2Geo`, global `keydown`        | `useRovingNav()`, `pickTarget()` in `src/lib/roving.ts`, `useLibraryShortcuts()`           |
| `V2DetailContent`                             | `BookDetail.tsx` (`variant: 'pane' \| 'sheet' \| 'page'`)                                  |
| `V2Deliveries`, `V2DeliveryRow`               | `DeliveryRows.tsx`, `DeliveryRow.tsx` (replace `DeliveryTracker.tsx`)                      |
| `TagEditor` (`ui.jsx`)                        | existing `TagEditor.tsx`, restyled to the prototype's chips                                |
| `V2DetailSheet`                               | `LibraryShell` phone branch: `Sheet side="bottom"` around the `@pane` node                 |
| `V2Loading`                                   | `ViewSkeleton.tsx` (page Suspense fallback), `@pane/loading.tsx`                           |
| `V2Error`                                     | `(library)/error.tsx`, `@pane/error.tsx` → `LoadError.tsx`                                 |
| `V2Empty`                                     | `EmptyResult.tsx`                                                                          |
| pager in `App` (`Page N of 9`)                | existing `Pagination.tsx`, restyled; `buildPageUrl` folded into `buildLibraryHref`         |

Removed: `BookGrid.tsx`, `BookCard.tsx`, `FilterBar.tsx`, `BulkSelectionWrapper.tsx`,
`BulkActionBar.tsx`, `DeliveryTracker.tsx`.

Routes after phase 1:

```
src/app/(library)/
  layout.tsx            LibraryProvider + LibraryShell(children, filters, pane)
  page.tsx              toolbar + current view, in Suspense with the client ViewSkeleton
  error.tsx             LoadError with Retry
  @filters/page.tsx     FilterPanel (getFilterOptions, listDeliveryPlatforms)
  @filters/default.tsx  null
  @pane/page.tsx        BookDetail variant pane, or null without ?book
  @pane/loading.tsx     pane Skeleton
  @pane/error.tsx       LoadError, compact
  @pane/default.tsx     null
  books/[id]/page.tsx   BookDetail variant page (permalink)
```

`/books/[id]` hard-loads with `@filters` and `@pane` at `default.tsx`, so it renders full width
with a `← Library` link, as today.

## Data and state model

### Server

- `getLibrary(params)` in `src/lib/queries.ts`: `'use cache'`, `cacheTag('books')`, returns
  `{ entries: { groupKey, groupLabel, groupTotal, book: LibraryBook }[], page, pageCount,
matching, libraryTotal, matchingIds: number[] }`.
  - Ungrouped: entries are the page's books with no group fields, ordered and paged exactly as
    `getBookList` does today (`buildBookConditions`, `buildOrderExpr`, `limit` 30, `offset`).
  - Grouped: one SQL query over the join table orders by group sort, then the in-group sort, and
    applies `LIMIT`/`OFFSET` to the (group, book) rows; `groupTotal` comes from
    `COUNT(*) OVER (PARTITION BY group)`. Books with no group form the trailing fallback group.
  - `matching` is the entry count behind `Page N of M` and `N of M books`; `libraryTotal` is the
    unfiltered size; `matchingIds` (distinct book ids, about 2 KB at 250 books) backs
    `Select all N`.
  - The extra `LibraryBook` fields are hydrated in the same batched queries as `hydrateBooks`.
- `getBook`, `listBookDeliveryEvents`, `listDeliveryPlatforms`, `getFilterOptions` are unchanged.
- Existing mutations (`/api/books/[id]/tags`, `/deliveries`, `/deliveries/bulk`,
  `/download/bulk`) are unchanged. After each, the client calls `router.refresh()`.

### URL (source of truth for what is shown)

| Param                   | Values                               | Notes                                       |
| ----------------------- | ------------------------------------ | ------------------------------------------- |
| `q`                     | text                                 | set on Enter or suggestion `Search for "…"` |
| `author` `tag` `series` | id                                   | single-select facets                        |
| `platform`              | platform key                         |                                             |
| `delivered`             | `true` \| `false`                    | only with `platform`; absent means `true`   |
| `groupBy`               | `series` \| `tag` \| `author`        | absent = None                               |
| `sortBy` `sortDir`      | as today                             |                                             |
| `page`                  | 2, 3, …                              | as today; absent on page 1                  |
| `book`                  | id                                   | opens the pane; kept across page changes    |
| `view`                  | `shelf` \| `catalogue` \| `study`    | one-load override of the cookie             |
| `renderer`              | `css` \| `three-glsl` \| `three-tsl` | phase 2+, one-load override                 |

Filter, sort and group changes use `router.replace` inside `startTransition`; the view keeps its
current content with `aria-busy="true"` and `opacity-60` until the new payload arrives. Opening a
book uses `router.push(…, { scroll: false })` so Back closes the pane; closing uses
`router.replace`. Page changes (pager links, `[`, `]`) use `router.push` so Back returns to the
previous page, and keep `book`: the pane stays open on the same book even when that book is not
on the new page. `Clear all` removes the filter params and `page`, and keeps `book`, `view` and
`groupBy`.

### Cookie

`calibre-prefs`: `{ view: 'shelf' | 'catalogue' | 'study', panel: boolean, renderer: 'css' |
'three-glsl' | 'three-tsl' }`, validated with zod on read, falling back to
`{ view: 'shelf', panel: true, renderer: 'three-tsl' }`.

### Client (`LibraryProvider`)

- `selected: Set<number>`, `toggle(id)`, `setMany(ids)`, `clear()`.
- `focusId: number | null`, updated on item focus.
- `selectMode: boolean` (phone only), `bulkPlatform`, `zipFormat`.
- `view`, `setView(v)` (writes the cookie), `panelOpen`, `togglePanel()`.

## Layout and views

### Chrome (desktop, `lg` and up)

- Header, 56px: panel toggle (`Hide filters` / `Show filters`), `Library` link with the
  `LibraryBig` icon, `ViewSwitch` with a `v` Kbd, `SearchField` centred (max 420px), a
  `N filters` Badge when the panel is closed and filters are active.
- Filter panel, 248px, `bg-sidebar`: `Filters · N`, `Clear all`, collapse button, then the facets
  Delivery (with the On / Not on toggle under a chosen platform), Tags, Series, Authors.
- Main: sticky toolbar with the scope title (`All books`, a facet label, `On Kobo` /
  `Not on Kobo`, `Results for "…"`), `N books` or `N of M books`, Group, Sort, direction, and the
  chip row. When anything is selected the toolbar becomes the bulk toolbar: clear, `N selected`,
  `Select all N`, `Add to` platform select, `Mark delivered`, format select, `ZIP`, `Esc clear`.
- The pager under the view, when there is more than one page.
- Key-hint row, sticky at the bottom of main.
- Detail pane, 420px, `bg-card`, when `?book` is set.

The scheme toggle in the prototype header is not built: the app follows the OS scheme through the
shared theme, and nothing else in the app forces `data-scheme`.

### Chrome (phone, below `lg`)

Header 52px with the title, icon-only `ViewSwitch`. Under it: search, then `Filters` (with a
count Badge) and `Select` / `Done`, then the scope title and Sort. Chips scroll horizontally. The
bulk bar floats at the bottom (8px inset) while anything is selected. Filters open in a left
Sheet (with Group at the top); detail opens in a bottom Sheet at 92% height.

### Shelf

Cover grid, `repeat(auto-fill, minmax(148px, 1fr))`, gap `28px 20px`; two columns on phone.
Each tile: the cover (2:3, lazy), delivery marks top right (`bg-background/90` chip with a
`success` check and the platform abbreviation, `title` `On Kobo`), a checkbox top left that shows
on hover, focus, or while anything is selected, then title (two lines), authors, series line, and
formats in mono (`EPUB · PDF`). Grouped: each group is a heading (`text-heading`, `N books`,
`See all N`) over one horizontal scrolling row of the group's tiles on this page, 148px wide
(128px on phone).

### Catalogue

`Table` with a select-all checkbox header (indeterminate when partly selected), then Title (28×42
cover, title, series line), Author, Formats, Delivered (success pills or `—` named
`Not delivered`), Year. With the pane open, Formats and Year hide. Grouped: a full-width group row
with the same `GroupHeading`, then the group's rows on this page. Row states: hover `bg-muted/55`,
selected `bg-primary/12`, open `bg-accent` with an inset 3px `primary` left rule. Phone: a compact
list (40×60 cover, title, author and series, formats, pills).

### Detail pane (`BookDetail`)

Top row (pane only): `Details`, `Esc close`, an `Open full page` icon link to `/books/[id]`, close.
Then:

1. Header: cover 108px (92px on phone); series link `Tidewater Cycle · Book 2` (sets the series
   filter); title; author links (set the author filter); rating stars in `chart-4`.
2. Actions: `Read` (EPUB only) and a `Download` DropdownMenu listing each format with its size.
3. Tags: `TagEditor`.
4. Metadata `dl`: Publisher, Published, Language, Formats.
5. Deliveries: one row per platform, with the name, a Badge (`success` with a check and the date
   of the latest event, or `muted` `Not added`), and a `Mark added` / `Log again` Popover
   (`Mark as added to {platform}`, `Logs today's date. Both fields are optional.`, Reference URL,
   Note, Save; Enter in Note saves). Under the rows, `History (N)` in a `<details>` lists every
   event with the time, note, reference link and a remove button.
6. Description (sanitised HTML, as today).

## Keyboard

Global (ignored while typing in an input, textarea, select or contenteditable, and inside a
dialog or menu; ignored with `Alt`, and with `Ctrl`/`⌘` except where listed):

| Key   | Action                                                                             |
| ----- | ---------------------------------------------------------------------------------- |
| `/`   | Focus search                                                                       |
| `v`   | Next view (Shelf → Catalogue → Study → Shelf); focus stays on the same book        |
| `Esc` | Close the pane, focus returns to that book; else clear the selection; else nothing |
| `[`   | Previous page; focus moves to the first item of that page (P10a)                   |
| `]`   | Next page; focus moves to the first item of that page (P10a)                       |

Shelf and Study (one tab stop per view, roving `tabindex`, `role="listbox"`,
`aria-multiselectable="true"`, groups as `role="group"` named `{label}, {N} books`):

| Key                   | Action                                                          |
| --------------------- | --------------------------------------------------------------- |
| `←` `→`               | Previous / next item in reading order (crosses rows and groups) |
| `↑` `↓`               | Nearest item in the row above / below (Study: the shelf above)  |
| `Home` `End`          | First / last item of the current row (P10)                      |
| `Ctrl`+`Home` / `End` | First / last item of the current page                           |
| `Enter`               | Open in the pane                                                |
| `x`                   | Toggle selection (`Space` also works)                           |

Catalogue (rows are the roving items):

| Key                   | Action                                      |
| --------------------- | ------------------------------------------- |
| `↑` `↓`               | Previous / next row                         |
| `Home` `End`          | First / last row of the current group (P10) |
| `Ctrl`+`Home` / `End` | First / last row of the current page        |
| `Space`, `x`          | Toggle selection                            |
| `Enter`               | Open in the pane                            |

The initial tab stop is `focusId` if it is in the view, else the first item. `↑`/`↓` in Shelf use
the prototype's `v2Geo` rule (rect distance, vertical gap weighted ×4), moved into the pure
`pickTarget(items, current, key, mods)` over `{ key, row, order, rect }` records so it can be unit
tested. Study passes rows from its layout instead of DOM rects (phase 2).

Focus and selection:

- Focus: `outline-[2.5px] outline-foreground outline-offset-4` on the cover or row; the title
  underlines. In Study, also a 4px `foreground` bar under the spine.
- Selection: `primary` only. A checked Checkbox, `bg-primary/12` rows, a `primary` inset ring and
  a `primary` check badge on spines.
- Open: `accent` background (rows), a dimmed `accent-foreground` inner ring (tiles), a 3px
  `primary` bar under a spine.

Key-hint row copy per view (from `V2_HINTS`, with the new Home/End and page entries; the page
entry shows only when there is more than one page):

- Shelf: `/` Search · `v` Switch view · `←↑↓→` Move · `Home` `End` Row ends · `[` `]` Page ·
  `Enter` Open · `x` Select · `Esc` Close, then clear
- Catalogue: `/` Search · `v` Switch view · `↑↓` Move · `[` `]` Page · `Space` Select ·
  `Enter` Open · `Esc` Close, then clear
- Study: `/` Search · `v` Switch view · `←→` Along shelf · `↑↓` Between shelves · `Home` `End`
  Shelf ends · `[` `]` Page · `Enter` Open · `x` Select · `Esc` Close, then clear

## Study (phases 2 and 3)

### Shared model and DOM accessibility layer

Every renderer consumes one `StudyModel`, built by pure code in `views/study/model.ts` from the
current page:

- `shelves`: `groupEntries` over the page (P6, P8), each `{ key, label, count, books }`, where
  `count` is the group's total (`groupTotal`), not only the books on this page.
- `layoutShelves(shelves, widthUnits)`: the spike's layout (books placed along rows, groups
  separated by a divider, a new row when a group's first three books do not fit), returning
  `{ books: Placed[], boards, rows, width }` with `row`, `order`, `x` per book.
- `spineDims(id)` (P15), `isCjk(title)` (P16).

The DOM layer is the same listbox for every renderer: `role="listbox"` named `Bookshelves`, a
`role="group"` per shelf named `{label}, {count} books` with a visible or visually hidden `h2`,
and a `role="option"` per book named `{title}, {authors}` with `aria-selected`. Keyboard handling
is `useRovingNav` with `pickTarget` fed from the layout (`row`, `x`), so `↑`/`↓`/`Home`/`End`
behave the same in every renderer. The pager sits under the Study region as in the other views.

- `css`: the options are the visible spines.
- `three-*`: the options are visually hidden (`sr-only`) `div`s over the canvas; the canvas is
  `aria-hidden="true"`. A pointer pick goes through the matching option, so there is one focus path.

#### Pull and the Study card (revised 2026-10-06)

Tested on an iPhone, the first pull (the book turned to face out, enlarged, cover forward) covered
its neighbours and the shelf below, so they could not be tapped, and a tap never opened the pane.
The pull is now the same in every renderer:

- Pulling slides the book a little out of its slot toward the viewer (three: 0.5 units along the
  camera ray plus a 0.12 unit lift; css: 12px up). It does not turn or grow, and covers no other
  book and no heading.
- The pulled book is the focused book unless it was put back. Tapping a book pulls it; tapping
  another switches directly; tapping the pulled book opens the pane (in Select mode a tap toggles
  selection). Tapping empty space or `Esc` (when the pane is closed) puts it back.
- A card docked at the bottom of the Study area (`sticky`) shows the pulled book: cover
  thumbnail, title, authors, `Open details`, and `Previous book` / `Next book` buttons; a
  horizontal swipe on the card steps the same way, in reading order, moving the pull with it. The
  card is a region named `Pulled book`; a polite live region announces the title and authors when
  the pull changes.
- Scrub: on touch, holding a book for 400 ms starts scrubbing; while the finger stays down the
  book under it is pulled and the card follows (hit-tested against the books' screen rects, once
  per animation frame). Lifting keeps the last book; `touchcancel` ends the scrub. A swipe that
  moves before the hold still scrolls (css) or pans (three). While scrubbing the camera does not
  follow focus, and the card shows a `primary` ring as feedback, since iOS has no vibration API.
- Scrub cover-out (added 2026-10-06, owner: "I still want the book cover could be look on 3d").
  While the finger is down, the book under it turns its front cover to the viewer and floats
  above the shelf. Covering other books does not matter then, since nobody is tapping. The float
  sits above the touch point with a 28px gap (below it when there is no room above), clamped
  8px inside the canvas (three) or viewport (css), and its cover is 34% of that height, clamped
  to 150 to 240px (`floatCentre`, `floatHeightPx` in `scene-math.ts`).
  - three: the pulled-book mesh eases to a pose 1.6 units in front of the shelf, turned
    `-π/2 + 0.32` so a sliver of spine shows, scaled to the target height
    (`pxPerUnitAt`). Moving to another book swaps between two pulled-book carriers: the new
    one turns out, the previous one eases back into its slot and is not hit-testable on the
    way. Both carriers share one material graph, so the program count does not change. Shelf
    labels fade while a book floats, because they are DOM above the canvas.
    `data-floating-id` on the canvas wrapper and `floatingId` in the `?debug` probe name the
    floating book. The cover cache ensures the pulled book ±2 immediately during a scrub, on
    top of the idle ±4 prewarm.
  - css: a CSS 3D book (front, back, spine, fore edge, top and bottom faces) in a fixed,
    `pointer-events: none` layer, turned 24° so the spine shows, with a turn-out keyframe per
    book. The slotted spine keeps its 12px pull. `[data-floating-cover]` names the book.
  - Hit-testing still uses the slotted books' rects (three: projected slot bounds; css:
    `elementFromPoint`, which skips the `pointer-events: none` float), so a scrub never sticks
    on the enlarged book.
  - Lifting eases the book back to the small pull and the card stays. A plain tap and the
    keyboard never float.
  - Reduced motion: the float pose is shown at once with no turn (three) and no keyframe (css);
    after the scrub the reduced-motion highlight returns.
- 3D inspect (added 2026-10-06). The card's cover thumbnail is a button named
  `Inspect {title} in 3D`. It opens a modal `<dialog>` named `{title}, 3D view`.
  - The pulled book flies from its slot to the centre of the Study area. Its height is 62% of
    the area, or less if the cover would take more than 72% of the width (`inspectHeightPx`).
    Everything else dims to 45%.
  - Drag (finger or mouse) turns the book: 0.012 rad per px, with a gentle inertia on release.
    Pitch is clamped to ±0.6 rad, so it never ends upside down; yaw is free.
  - The turning surface is a `role="slider"`. Its value is the yaw in degrees, and its
    `aria-valuetext` names the face toward the viewer (`Front cover`, `Spine`, `Back cover`,
    `Page edges`). Arrow keys turn it by 15° (yaw) and 10° (pitch), and `Home` faces the front.
  - Tapping outside the book, the dialog's close button, or `Esc` flies it back to the small
    pull. The card, hidden while open, shows again and focus returns to the thumbnail.
  - Being a modal, the dialog makes the shelf inert. The scrub listener is also disabled while
    it is open.
  - three: the active pulled-book carrier eases to an `inspect` pose 3 units in front of the
    shelf, using the same material.
    - Faces: the front is the cached 256×384 cover (no larger fetch), the spine is the atlas
      crop, and the back is one shared 256×384 canvas with the title and authors on the
      book's tint. The back is reserved in the texture budget (`reservedBytes` in
      `pickAtlasPpu`).
    - Dimming is one shared `dim` uniform in the spine graph, plus scaling the panel and board
      colours. There is no transparent scrim mesh, so the program count stays where it was.
    - Outside the canvas, a DOM box-shadow scrim dims the page. `data-inspecting-id` and
      `inspectingId` in the probe name the book.
  - css (and so `no-webgl`): the same `CssBook` (front, back, spine, fore edge, top, bottom)
    over a DOM scrim. The fly-in and fly-back are a Web Animations FLIP from the slotted
    spine.
  - The drag cancels `touchmove` with a non-passive listener, as the scrub does, so iOS does
    not scroll the page.
  - Reduced motion: no fly-in and no inertia; the end pose is shown at once.
- Keyboard and listbox semantics are unchanged: arrows move the pull, `Enter` opens the pane.

### Renderer selection and loading

P20 picks the renderer; the default is `three-tsl`. The Study toolbar gets a `Renderer` Select
(`three.js · TSL`, `CSS`, and from phase 3 `three.js · GLSL`), shown only in Study. Items are named by
shader path; the trigger appends the live backend once it is known (`three.js · TSL · WebGPU`,
`three.js · TSL · WebGL2`, `three.js · GLSL · WebGL2`), so it never names a backend the page is
not using. Phase 2 shipped the item as `three.js · WebGPU`; phase 3 Task 4 renames it. `StudyView`
renders `CssStudy` directly, or `ThreeStudy`, a
`next/dynamic(() => import('./three/ThreeStudy'), { ssr: false, loading: StudySkeleton })`.
Inside it the variant kit is a second dynamic import: `kitTsl` (`three/webgpu`, `WebGPURenderer`,
`studyMaterial.ts`) or, in phase 3, `kitGlsl` (the GLSL material, 0.8 KB), so the GLSL path never
loads `three/webgpu`. Nothing from three.js is in the first load of any route.

Cost of the default (spike round 3, gzip, lazy): the TSL Study chunk is 443.2 KB, which is the
shared three.js/fiber base (252.6 KB) plus about 190 KB for `three/webgpu` and the TSL runtime.
It downloads only when Study is shown. fiber imports `WebGLRenderer` itself, so that code ships on
the TSL path too.

Timings the spike measured for `tsl-webgpu` (headed, production build):

| Profile   | Backend               | `init()` | First render call | Mount → first frame | Draw calls |
| --------- | --------------------- | -------- | ----------------- | ------------------- | ---------- |
| desktop   | WebGPU                | 12.1 ms  | 42 ms             | 513 ms              | 5          |
| phone-emu | WebGPU                | 3.1 ms   | 20 ms             | 487 ms              | 5          |
| desktop   | WebGL2 (`forceWebGL`) | 7.4 ms   | 327 ms            | 842 ms              | 5          |
| phone-emu | WebGL2 (`forceWebGL`) | 7.8 ms   | 178 ms            | 654 ms              | 5          |

About 300 to 500 ms of each first frame was the 250-spine atlas, which the per-shelf atlas and the
30-book page remove. The WebGL2 backend pays node building and GLSL compilation synchronously on
the first render, which is why its first render call is slower.

### `three-tsl` renderer (phase 2, default)

`WebGPURenderer` from `three/webgpu`, created in fiber 9's async `gl` factory:
`new WebGPURenderer({ ...props, antialias: true, outputBufferType: UnsignedByteType })`, then
`renderer.toneMapping = NoToneMapping` and `await renderer.init()`. Without `navigator.gpu` it
runs on its WebGL2 backend (`renderer.backend.isWebGLBackend`); the spike confirmed rendering,
keyboard sync and timing on that path. `studyMaterial.ts` is the only shader source: the instanced
spine and side material (`MeshBasicNodeMaterial.colorNode`), the pulled book, the back panel and
boards (`MeshLambertNodeMaterial`). `WebGLNodesHandler` is not used: it saved no bundle and broke
multi-material meshes in the spike.

Requirements from the spike's TSL findings (decision 11):

1. **Tone mapping at the renderer.** Node renderers ignore per-material `toneMapped`;
   `WebGPURenderer` tone-maps the whole frame in its output pass. Set `NoToneMapping` on the
   renderer. The spike's round-2 "match" with `toneMapped=false` was wrong (28% / 16% pixel
   mismatch on the book mesh until the renderer-level fix).
2. **Uniforms, not constants.** Anything that changes after creation (highlight colour, pulled
   book side and pages colours, selection tint) is a `uniform()` whose `.value` is set, and
   changing textures are texture nodes whose `.value` is set. A value baked in as a constant
   builds a new program: the spike saw 18 to 19 dropped frames and 115 to 125 ms render spikes
   per pulled book until it moved to uniforms. Acceptance: the program count does not grow during
   a sweep.
3. **One material for the pulled book.** A single `MeshLambertNodeMaterial` picks cover, spine,
   pages or side by `normalLocal`, replacing the six-material array: one draw call, no geometry
   groups. It is created once and re-pointed at each pulled book through uniforms and texture
   `.value`.
4. **Side colour in `aCol`.** `NodeMaterial` multiplies `instanceColor` into `colorNode`, so the
   side colour is a custom instanced `aCol` (vec3) attribute. Selection is `aSel` (float, mixes
   `primary` at 22%) and highlight is `aHi`.
5. **No `TextureNode` offset/repeat.** `TextureNode` ignores `texture.offset`/`repeat` unless
   `updateMatrix` is set. Atlas lookups use explicit UV maths (`aRect.xy + uv() * aRect.zw`, as in
   the spike), and the pulled book's spine is a cropped canvas, not an atlas clone with
   offset/repeat.
6. **Output buffer.** By default `WebGPURenderer` renders into a HalfFloat output buffer with 4×
   MSAA before the canvas pass, which put the spike's reported texture memory at 90.5 MB (desktop
   @2x) and 45.1 MB (phone) against about 35 MB of actual atlas and covers. The renderer is
   created with `outputBufferType: UnsignedByteType`, which halves the colour targets and keeps
   4× MSAA. Budget: reported `info.memory.texturesSize` ≤ 50 MB on desktop @2x and ≤ 30 MB on
   phone, on a 30-book page. If UnsignedByteType fails the parity check (≤ 0.3% edge-only pixel
   diff against the spike's reference), drop to `samples: 0` with the HalfFloat buffer instead and
   restate the budget in the PR.

Console: `THREE.Clock` is deprecated (from fiber) and accepted. fiber's default shadow type warns
`PCFSoftShadowMap has been removed` on `WebGPURenderer`; `shadows={false}` on the Canvas removes
it.

### Shared three.js scene and fixes (phase 2, reused by phase 3)

Carried over from the spike: `@react-three/fiber` `Canvas` with `frameloop="demand"`,
`dpr={[1, 2]}`, `fov` 30; one `InstancedMesh` per shelf row for spines; instanced boards; the
back panel; the pulled-out book as its own mesh; token colours read from computed styles and
re-read on scheme change; covers 256×384 in an LRU of 24 drawn for the pulled book ±4 in idle
callbacks. Dropped from the spike: `@react-three/drei` (only `useCursor` was used; set the
cursor directly).

Fixes for the spike's open items (decision 4), for every three.js renderer:

1. **Focus ring overlay.** `Scene` reports the focused book's projected screen rect after every
   camera or pull change (`onFocusRect`). `FocusOverlay` draws a DOM box there with a 2.5px
   `foreground` outline, plus the 4px bar, only while an option has `:focus-visible`. Selection
   is drawn in the shader (`aSel`, `primary`), so the two cues never share a colour.
2. **Camera clamp.** Camera y follows the focused row and is clamped so the frustum never leaves
   the case (top and bottom board plus a margin); x stays centred because the layout width is the
   canvas width. Wheel and touch pan the same clamped value; at either clamp the wheel event is
   not prevented, so the page scrolls on to the pager.
3. **Shelf headings.** DOM labels (`{label}` and `{count} books`, `text-sm`), `aria-hidden` (the
   DOM layer has the real headings), positioned by projecting each group's first book's top left
   corner on camera change. A group that wraps onto a new row, or continues from the previous
   page, repeats its label in `text-muted-foreground` with `(continued)`. The layout reserves each
   heading's measured width, so the next group on the row starts after it (or wraps), and each
   label is capped to the room before the next one and ellipsizes its name: headings never
   overlap.
4. **Per-shelf atlas.** One CanvasTexture per row (row width × `ROW_H`, 160 px per unit), bound
   to that row's `InstancedMesh`. Rows inside the frustum are drawn first, synchronously before
   the first frame; the rest in `requestIdleCallback` batches, nearest row first. A row without
   its atlas yet draws spines in their side colour. Atlases are disposed on page change.
5. **Cover prewarm.** After the first frame: fetch and decode (`createImageBitmap`, 256×384)
   covers for the focused book ±4 and the first row, upload each with `renderer.initTexture`, and
   compile the pulled-book material once (`compileAsync` on `WebGPURenderer`, `compile` on
   `WebGLRenderer`), so the first pull does not pay the 30 to 50 ms upload and first-use spikes
   the spike measured. The pager's next page's covers are prefetched (not uploaded) on idle.
6. **Reduced motion.** No pull-out and no camera tween (the camera jumps). The focused spine gets
   a strong cue: a `foreground` tint at 45% (`aHi`), the DOM focus ring, and the bar. The spike's
   `primary` tint is replaced, since `primary` means selection.
7. **Tone mapping** off at renderer level for every variant (TSL requirement 1; `flat` on the
   Canvas for `WebGLRenderer`).

Dependencies (phase 2), pinned as in the spike: `three` 0.186.1, `@react-three/fiber` 9.8.1,
`@types/three` 0.186.0 (dev). fiber 9.8.1 requires `react >=19 <19.4`; the catalog resolves 19.2.3.

### `css` renderer (phase 2, alternative)

As the prototype: a grid of bays (`auto-fill, minmax(300px, 1fr)`, one per shelf,
`align-items: end`), each a `muted` gradient back panel, a horizontally scrolling row of spines,
and a board (`foreground` 16% into `muted`). The pulled spine (`data-pulled`) slides 12px up;
there is no cover face (see Pull and the Study card). Changes from the prototype, from review.md:

- Bays use `content-visibility: auto` with `contain-intrinsic-size: auto 300px`.
- Phone: one bay per row, spines at 0.82 scale, horizontal scroll.
- Reduced motion: no transform; the spine brightens and the focus ring and bar stay.

### `three-glsl` renderer (phase 3, alternative)

`WebGLRenderer` with the spike's GLSL `ShaderMaterial` (`glslBook.ts`), reworked to the same
contract as the TSL kit: `aCol`, `aSel`, `aHi` attributes, one pulled-book material that picks the
face by `vNormal`, `flat` tone mapping. It reuses the shared scene and every fix above. The
`Renderer` select gains `three.js · GLSL`.

It also matches what #505 and #506 added to the TSL kit:

- The pulled-book material has five faces: front cover (or the side colour without one), back
  (the shared 256×384 inspect canvas, or the side colour), spine crop, pages and side. It is a
  `MeshLambertMaterial` with `onBeforeCompile` and a constant `customProgramCacheKey`, so it uses
  three's Lambert lighting as `MeshLambertNodeMaterial` does.
- The two pulled-book carriers (scrub cover-out) each hold a material with the same source and
  cache key, so they share one program. `point()` only writes uniform values; it never sets
  `.map` or `needsUpdate`, so the program count does not grow on a carrier swap, a float or an
  inspect.
- Inspect dimming is one `{ value }` uniform object (`uDim`) placed in every spine material's
  uniforms, plus the panel and board colour scaling in the shared scene. There is no scrim mesh.
- `WebGLRenderer` reports no texture bytes (`info.memory` has no `texturesSize`), so the GLSL
  texture number is an estimate: the measured atlas bytes, the cover cache, the inspect back and
  the spine crop. It counts no render targets, since the canvas's default framebuffer is not a
  texture.

## Performance budgets

From the spike (headed Chromium on an Apple M4 Pro; headless throttles rAF to about 12 fps, so it
is not used for timing). "Sweep" is the spike's 40-step keyboard sweep at 150 ms per step. The
Study budgets are measured at `?__pageSize=250` on the large fixture (P22), the spike's load, so
a normal 30-book page has headroom.

| Measure                             | `three-tsl` WebGPU (spike) | `three-tsl` WebGL2 fallback (spike) | `css`          | `three-glsl` (spike)                       |
| ----------------------------------- | -------------------------- | ----------------------------------- | -------------- | ------------------------------------------ |
| Extra JS, gzip, lazy                | ≤ 450 KB (443.2)           | same chunk                          | 0              | re-measure in phase 3 Task 6 (spike 253.4) |
| three.js in first load of any route | none                       | none                                | none           | none                                       |
| rAF median / p95, sweep             | 16.7 / ≤ 20 ms (16.6/18.7) | 16.7 / ≤ 20 ms (16.7/18.7)          | 16.7 / ≤ 20 ms | 16.7 / ≤ 20 ms (16.7/18.6)                 |
| Dropped frames per sweep            | ≤ 10 (2)                   | ≤ 10 (3)                            | ≤ 10           | ≤ 10 (3)                                   |
| Long tasks during sweep             | 0                          | 0                                   | 0              | 0                                          |
| `init()`, desktop                   | ≤ 20 ms (12.1)             | ≤ 20 ms (7.4)                       | n/a            | n/a                                        |
| First render call, desktop          | ≤ 60 ms (42)               | ≤ 350 ms (327)                      | n/a            | ≤ 60 ms (35)                               |
| Mount → first frame, desktop        | ≤ 300 ms (513)             | ≤ 600 ms (842)                      | n/a            | ≤ 200 ms (300)                             |
| Render CPU max after prewarm        | ≤ 25 ms (4.8)              | ≤ 25 ms (19.1)                      | n/a            | ≤ 25 ms (23.8)                             |
| Program count growth during sweep   | 0                          | 0                                   | n/a            | 0                                          |
| Draw calls                          | ≤ rows + 6                 | ≤ rows + 6                          | n/a            | ≤ rows + 6                                 |
| Texture memory                      | ≤ 50 MB reported (90.5)    | ≤ 50 MB reported (90.5)             | n/a            | ≤ 50 MiB est. (~35)                        |

The first-frame targets are below the spike's numbers because the spike spent 300 to 500 ms
drawing the whole 250-spine atlas before its first frame, and the per-shelf atlas draws only the
visible rows first. The phone-emulation budgets are the same except texture memory (≤ 30 MB, an
estimate for `three-glsl` as for desktop). The `three-glsl` lazy JS budget dates from the spike,
before the shared scene, scrub, cover-out and inspect code grew the base chunk; phase 3 Task 6
measures it and writes the re-baselined number here.

Phase 1 budgets, on the large fixture at the normal page size:

- RSC payload of `/`: ≤ 60 KB uncompressed.
- Opening a book (`?book=` push) to pane content: ≤ 200 ms p95 on `next start`.
- Page change (`]`) to the first item focused: ≤ 300 ms p95 on `next start`.
- View switch (`v`) to the new view painted: ≤ 100 ms, no network request (P8's case excepted).

## Loading, error and empty states

- **Loading.** The page wraps its data in `Suspense` whose fallback is the client
  `ViewSkeleton`. It reads the view from `LibraryProvider`, which the layout seeds from the cookie
  (the layout reads `cookies()` inside its own Suspense boundary, as `cacheComponents` requires).
  It carries `aria-busy="true"` and `aria-label="Loading books"`: Shelf, 12 cover cards (6 on
  phone); Catalogue, 10 rows (7 on phone); Study, three bays of 7 spines with varied heights.
  `@pane/loading.tsx` renders the pane Skeleton (cover, three lines, two buttons, three delivery
  rows). Client navigations, page changes included, keep the old content dimmed instead (see
  URL).
- **Error.** `(library)/error.tsx` renders a destructive `Alert`: `Couldn't load the library`,
  `The book list request failed. Your filters and selection are kept, so a retry picks up where you were.`,
  and the error digest in mono. `Retry` calls the boundary's `unstable_retry()` (the Next.js 16.2
  `error.js` API; it re-fetches and re-renders the segment). Selection survives because the
  provider lives in the layout, above the boundary. `@pane/error.tsx` shows a compact version:
  `Couldn't load this book` and `Retry`. `ThreeStudy` gets its own boundary:
  `Couldn't start the 3D renderer` with `Use CSS study`.
- **Empty.** `No books match these filters.` with a `SearchX` icon and `Clear filters`. An empty
  library (no filters) reads `No books in this library yet.` with no button.

## Copy

New strings (English UI, as today):

- Views: `Shelf`, `Catalogue`, `Study`; tooltips `書架 Shelf`, `目錄 Catalogue`, `書房 Study`;
  `aria-label` `{View} view`; the view region is named `{View} view`.
- Header: `Show filters`, `Hide filters`, `{N} filter(s)`, search placeholder `Search books`
  (`aria-label` `Search books`).
- Filters: `Filters`, `Clear all`, `Collapse filters`, `Delivery`, `Any platform`, `On`, `Not on`,
  `Tags`, `All tags`, `Series`, `All series`, `Authors`, `All authors`, `Show all {N}`,
  `Show fewer`.
- Toolbar: `All books`, `Results for "{q}"`, `On {platform}`, `Not on {platform}`, `{N} books`,
  `{N} of {M} books`, `Group`, `None`, `Series`, `Tag`, `Author`, `Sort`,
  `Sort direction: ascending|descending`, `See all {N}`, `{group} (continued)`.
- Pager: `Pagination` (nav name), `Prev`, `Next`, `Page {N} of {M}`; key hint `Page`.
- Bulk: `Bulk actions`, `Clear selection (Esc)`, `{N} selected`, `Select all {N}`, `Add to`,
  `Mark delivered`, `ZIP`, `Select`, `Done`; toasts `{N} book(s) marked as delivered to {platform}`
  (as today), `Delivery failed — {msg}`, `Download failed — {msg}`.
- Detail: `Details`, `Esc close`, `Close details`, `Open full page`, `{series} · Book {n}`, `Read`,
  `Download`, `Tags`, `Publisher`, `Published`, `Language`, `Formats`, `Deliveries`,
  `Not added`, `Mark added`, `Log again`, `Mark as added to {platform}`,
  `Logs today's date. Both fields are optional.`, `Reference URL`, `Note`, `Save`,
  `History ({N})`, `Remove {platform} event`, `Description`, `Logged {platform}` (toast).
- Marks: `On {platform}` (title and accessible name), `Not delivered`.
- States: as in the section above.
- Study (phase 2): `Bookshelves`, `{label}, {N} books`, `Renderer`, `three.js · TSL` (shipped as
  `three.js · WebGPU`, renamed in phase 3), `CSS`,
  `Couldn't start the 3D renderer`, `Use CSS study`,
  `3D isn't available here, showing the CSS study` (toast); debug badge
  `three-tsl · WebGPU`, `three-tsl · WebGL2 fallback`, `css`. Phase 3 adds `three.js · GLSL`, the
  trigger texts `three.js · TSL · WebGPU`, `three.js · TSL · WebGL2` and
  `three.js · GLSL · WebGL2`, and the badge `three-glsl · WebGL2`.

## Fixtures

The repo is public. `apps/personal-calibre-e2e/src/support/global-setup.ts` is rewritten to seed
made-up books and authors only, in the style of the prototype's `data.js` (for example
`The Salt Archive` by Mara Ostrand, `Tidewater Cycle`): about 70 books, so the default page size
gives three pages, across 4 series (one of them straddling a page boundary when grouped), 8
tags and 3 delivery platforms, with two made-up CJK titles for the vertical-title check and one
book without an EPUB (no Read button). A second seed mode (`CALIBRE_FIXTURE=large`) generates 250
books with the spike's generator for budgets and Study captures. Captures and PR evidence use
these fixtures only. `resetAppDb` stays.

## Testing

Vitest (new `apps/personal-calibre/vitest.config.ts`, `environment: 'node'`,
`include: ['src/**/*.test.ts']`, picked up by the `@nx/vitest` plugin as `test`):

- `pickTarget`: arrows in a grid and in grouped rows; `↑`/`↓` nearest by rect; `Home`/`End` row
  ends; `Ctrl+Home`/`End` page ends; arrows stop at the page edges; duplicate book ids under tag
  grouping (P9); Study rows from layout.
- `groupEntries`: consecutive entries into groups, fallback groups last, tag duplication,
  `(continued)` for a group that started on an earlier page.
- `library-params`: parse and build hrefs; filter, sort and group changes drop `page`; page
  changes keep `book`; `Clear all` drops `page` and keeps `book`, `view`, `groupBy`;
  out-of-range page clamps to the last page with every param kept; `activeFilters` labels.
- `prefs`: cookie parse with bad JSON, unknown view and renderer; default renderer `three-tsl`;
  `?view=` and `?renderer=` overrides.
- `resolveShortcut`: the global and per-view key tables (`[`/`]` included, no-ops on the first
  and last page), typing-target and modifier guards, `Esc` order.
- Selection: `Select all N` uses `matchingIds`; selection survives a page change; the header
  checkbox acts on the current page only.
- `formatDeliveryTime`; `latestByPlatform(events)`.
- `getLibrary` against the fixture DB: grouped paging over entries, `groupTotal`, `matchingIds`,
  and the same ungrouped order as `getBookList`.
- Phase 2: `layoutShelves`, `spineDims`, `isCjk`, the atlas build order (visible rows first,
  then nearest), the focus-rect projection helper, `pickRenderer` (param, cookie, default,
  fallback).

Playwright (`apps/personal-calibre-e2e`, fixture DB, Desktop Chrome plus a 390×844 project for
phone specs; add `@axe-core/playwright`):

- Views: the switcher and `v` cycle; the cookie restores the view after reload; `?view=` overrides
  without writing it; the Skeleton shape follows the cookie (`?__delay=`).
- Keyboard, per view: exactly one `tabindex="0"` item; Tab from the toolbar lands on it; arrows,
  `Home`/`End` stay in the row; `Ctrl+Home`/`End` reach the page ends; `x` and `Space` toggle
  `aria-selected`; `Enter` opens the pane; `Esc` closes it and focus returns to the same book; a
  second `Esc` clears the selection; `v` keeps focus on the same book; `/` focuses search.
- Pages: `]` and `[` change `?page`, focus the first item of the new page and do nothing at the
  ends; the pager links do the same; Back returns to the previous page; a selection made on page
  1 still counts on page 2 (`N selected`) and bulk `Mark delivered` from page 2 logs every
  selected book; `Select all N` covers every page; `?book=` survives a page change with the pane
  open; `?page=99` lands on the last page with filters kept.
- Focus vs selection: on a focused and selected item, the computed outline colour is
  `foreground` and the selection mark is `primary`.
- Pane: `?book=` survives reload; Back closes it; filters change with it open; `Open full page`
  loads `/books/[id]`; `Read` links to `/read/[id]` and is absent without an EPUB.
- Deliveries: `Mark added` with URL and note; the row Badge shows the date; `History (N)` lists
  and removes; bulk `Mark delivered` and `ZIP` from Shelf and from Catalogue (rewrite of
  `bulk-delivery.spec.ts`).
- Filters, search, suggestions, group and sort: rewrites of the current `filter`, `search`,
  `group-by`, `book-list`, `book-detail` and `tag-editing` specs against the new UI, including a
  grouped page whose first group is `(continued)`.
- States: `?__fault=list` shows the Alert, Retry recovers and keeps the selection; `?__fault=pane`
  shows the pane error; empty result shows `Clear filters`.
- Phone: filters Sheet, detail Sheet, `Select` mode, floating bulk bar, pager, no key hints, no
  horizontal page scroll at 390px.
- axe (wcag2a/aa, wcag21aa, best-practice): 0 violations for each view, with the pane open, and
  with the filter Sheet open.
- Study (phase 2): entering Study with no Group sets `groupBy=series` (P8); the keyboard, page and
  axe specs run for each renderer and backend:
  - `three-tsl` on WebGPU (headed Chromium; the spec is skipped with a note when
    `navigator.gpu` is absent in the runner, and `data-backend` must read `webgpu` otherwise);
  - `three-tsl` on the WebGL2 fallback, forced by an init script that deletes `navigator.gpu`
    (`data-backend="webgl2"`), run headless as well;
  - `css`; and in phase 3, `three-glsl`.
  - For each three.js run: the focused option's id matches the pulled book (`data-pulled-id` on
    the canvas wrapper); the focus overlay is visible and inside the canvas bounds; reduced
    motion (`emulateMedia`) shows no pull and a visible ring; no console errors; `?debug` shows
    the backend badge and its absence hides it.
  - With WebGL disabled too (`--disable-webgl` project), Study falls back to `css` with the toast
    and the cookie is unchanged.
  - The renderer-bundle check reads the react-loadable manifest and fails if `three` appears in
    the first load of `/`, `/books/[id]` or `/read/[id]`, or `three/webgpu` appears in the
    `three-glsl` path.
  - Visual parity: `three-tsl` WebGPU vs WebGL2 fallback captures differ by ≤ 0.3% of pixels, on
    edges only (the spike measured 0.028% / 0.038%).
  - Phase 3 parity, light and dark, 1440×900 @2, reduced motion: `three-glsl` against `three-tsl`
    on WebGL2 (headless and headed) and against `three-tsl` on WebGPU (headed). Three poses: the
    shelf with the first book focused, a pulled book, and the inspect end pose facing front.
    Shelf and pulled: ≤ 0.3% of pixels, edges only. Inspect: ≤ 0.5%, edges only, since the
    enlarged lit book puts more edge on screen (owner decision, PR #507).

Budgets are measured by a headed script (the spike's sweep, moved to
`apps/personal-calibre-e2e/perf/`), not in CI, for every renderer and for both `three-tsl`
backends. Visual check before each PR in light and dark at 1440 and 390, with before/after
captures on fixture data.

## Phase 1 task outline

1. Fixtures: made-up seed (small, three pages; large), vitest config.
2. Data: `LibraryBook`, `getLibrary` with grouped paging and `matchingIds`, `groupEntries`,
   `library-params`, prefs cookie; unit tests.
3. Shell: layout with `@filters` and `@pane` slots, `LibraryProvider`, header, `ViewSwitch`,
   phone Sheets.
4. Search field with suggestions (Popover + Command) and filter panel with facets.
5. Toolbar, chips, sort and group, pager restyle and redirect fix, bulk toolbar across pages
   (replaces the two bulk components).
6. Shelf view with tiles, marks and grouped rows.
7. Catalogue view with the table, compact columns and phone list.
8. Detail: `BookDetail`, delivery rows and history, Read, Download menu; `/books/[id]` reuses it.
9. Keyboard: `pickTarget`, `useRovingNav`, global shortcuts including `[`/`]`, key hints; unit
   tests.
10. States: skeletons, error boundaries, empty; test hooks.
11. e2e rewrite, phone project, axe; remove the old components; captures.

Phase 2 outline, for its own plan: Study model and DOM layer; renderer selection, cookie and
`?debug` badge; `three-tsl` kit with the six TSL requirements; shared scene fixes (focus overlay,
camera clamp, headings, per-shelf atlas, prewarm, reduced motion); `css` renderer; fallbacks and
error boundary; e2e per renderer and backend; perf sweep and captures. Phase 3: the GLSL kit on
the same contract, the select entry, its e2e and perf runs.

## Out of scope

- Send-to-device of any kind (Kindle or otherwise).
- Facet counts, multi-select facets, facet-level search beyond `Show all`.
- Exposing note and reference URL in bulk delivery.
- A scheme toggle.
- Changes to `/read/[id]`, OPDS, the MCP tools, or `BookSummary`.
- A page-size setting (30 everywhere; `?__pageSize` is a test hook only).
- `WebGLNodesHandler`.
- `toHaveScreenshot` baselines (e2e does not run in CI).
- Safari, Firefox and real-device performance numbers for the three.js renderers: recorded if
  measured, not gating. Safari and Firefox users of `three-tsl` may land on the WebGL2 backend,
  which is covered by the forced-fallback runs.

## Open questions

1. P8 rewrites `groupBy` to `series` when Study opens with no Group or with Tag, and leaves it set
   after leaving Study, so Shelf comes back grouped. The alternative is to keep the URL alone and
   let Study group only the current page, which scatters a series over pages. Confirm the
   rewrite.
