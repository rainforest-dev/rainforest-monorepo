# Calibre redesign: three views, shared chrome, 3D study

Date: 2026-09-29. Status: design approved by the owner from the Claude Design prototype v2, with
the binding decisions listed under Decisions. This spec maps the prototype onto
`apps/personal-calibre`.

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
| 1     | Data layer, shared chrome, Shelf, Catalogue, detail pane, keyboard, states, fixtures, tests | ~10 tasks |
| 2     | Study: shared model and DOM layer, `css` renderer, `three-glsl` renderer, renderer switch   | ~10 tasks |
| 3     | Study `three-tsl` renderer                                                                  | ~4 tasks  |

This spec covers phase 1 in full: a plan can be cut from it directly. Phases 2 and 3 are designed
here to the level of contracts, decisions and budgets, and each gets its own plan before it
starts. Until phase 2 lands, the view switcher shows two items and `v` cycles between them.

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
8. **Grouped view is capped.** `getGroupedBookList` returns six books per group, which cannot feed
   a shelf of every book.
9. **Public-repo fixtures use real books and authors** (`global-setup.ts` seeds real titles).

## Goals

- One design, three views over the same result set: 書架 Shelf (cover grid), 目錄 Catalogue
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
   - `css`: CSS 3D, per the prototype.
   - `three-glsl`: `WebGLRenderer` + a GLSL `ShaderMaterial`. The default three.js renderer.
   - `three-tsl`: `WebGPURenderer` with TSL (the spike's `tsl-webgpu`, which falls back to its
     WebGL2 backend by itself). `studyMaterial.ts` is its only shader source.
   - The `WebGLNodesHandler` route is not shipped.
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
- **P2. No pagination.** Shelf and Catalogue render every matching book. Study must show every
  book on its shelves, `Ctrl+Home`/`Ctrl+End` must reach the true ends, and `Select all N` should
  mean all matches. The library is about 250 books. Covers stay `loading="lazy"`; Shelf and
  Catalogue groups use `content-visibility: auto` with `contain-intrinsic-size`. `Pagination.tsx`
  and the `page` param go away (an old `?page=` is ignored). Designed for up to 1,000 books;
  virtualisation above that is out of scope.
- **P3. Preferences live in a cookie, not localStorage.** `calibre-prefs` holds
  `{ view, panel, renderer }` as JSON (path `/`, one year, `SameSite=Lax`), written from the
  client on change. The server reads it with `cookies()` so the first paint already has the right
  view, panel state and Skeleton; localStorage would flash the default view before hydration. The
  page reads `searchParams` already, so it is dynamic anyway. `?view=` and `?renderer=` override
  the cookie for one load (tests, captures, sharing) and do not write it.
- **P4. Selection and focus are client state** in a `LibraryProvider` mounted in the library
  layout, so they survive view switches, filter changes and opening the pane. Neither goes in the
  URL or storage. Selection is kept across filter changes; when some selected books are not in the
  current result, the bulk bar says `N selected (M hidden by filters)`. Successful Mark delivered
  clears the selection, as today.
- **P5. The view is client state over one server result.** The server returns every matching book
  once; the view choice, grouping per view and navigation run on the client. Switching views is
  instant and makes no request.
- **P6. Grouping moves to the client.** A pure `groupBooks(books, by)` builds groups from the new
  `LibraryBook` fields (series, authors, tags with ids). Series groups order books by series
  index; other groups keep the list's sort order. Groups sort by label, with `No series`,
  `No author` and `Untagged` last. `getGroupedBookList` stays unchanged for the MCP tool.
- **P7. Group rows per view.** Shelf shows each group as one horizontal row of its first 8 books
  plus `See all N` (sets the matching filter and clears Group). Catalogue shows every book under a
  group header row. Study shows every book.
- **P8. Study groups by series or author only.** A physical book cannot stand on two shelves, so
  Study offers Series and Author and no None or Tag (the prototype allowed Tag). With `groupBy`
  unset or `tag`, Study uses Series; the URL param is left alone, so switching back restores it.
- **P9. Focus identity.** With tag grouping one book appears in several groups. The DOM nav key is
  `groupKey:bookId`; `focusId` in the provider is the book id. After a view switch, focus goes to
  the first element for that book.
- **P10. Home/End semantics.** "Row" means the visual row the focused item sits in:
  - Shelf, ungrouped: the grid row, found from item rects. Grouped: the group's horizontal row.
  - Study: the physical shelf board the book stands on (in `css` each group is one board, so it
    is the group).
  - Catalogue: the current group's rows, or the whole table when ungrouped.
  - `Ctrl+Home`/`Ctrl+End` (`⌘` on macOS as well) go to the first/last item of the whole view.
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
  spike. Spine colour is `chart-(id % 5 + 1)` mixed with `muted`. The Study cover face shows the
  real cover (`/api/books/[id]/cover`) when there is one, else the spine colour with the title.
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
- **P20. Default Study renderer: `css`.** It is the approved prototype, adds no JS, is fully DOM
  accessible and is the only renderer tested on Safari and Firefox. The three.js renderers are
  chosen from a `Renderer` select in the Study toolbar (stored in the cookie) or `?renderer=`.
  If WebGL2 context creation fails, the three.js renderers fall back to `css` with a toast.
- **P21. `LibraryBook` is a new type.** The UI query returns `BookSummary` plus `seriesId`,
  `authorIds`, `tags: {id, name}[]` and `pubdate`. `BookSummary`, `getBookList` and the MCP and
  OPDS outputs stay byte-identical.
- **P22. Test hooks.** With `CALIBRE_E2E=1` (set only by the Playwright web server), the list
  query honours `?__fault=list|pane` (throws) and `?__delay=<ms>`. Production builds never read
  them.

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

Removed: `BookGrid.tsx`, `BookCard.tsx`, `FilterBar.tsx`, `Pagination.tsx`,
`BulkSelectionWrapper.tsx`, `BulkActionBar.tsx`, `DeliveryTracker.tsx`.

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
  `{ books: LibraryBook[], total: number }`. `total` is the unfiltered library size (for
  `N of M books`). It reuses `buildBookConditions` and the sort logic from `getBookList`, with no
  limit, and hydrates the extra fields in the same batched queries as `hydrateBooks`.
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
| `book`                  | id                                   | opens the pane                              |
| `view`                  | `shelf` \| `catalogue` \| `study`    | one-load override of the cookie             |
| `renderer`              | `css` \| `three-glsl` \| `three-tsl` | phase 2+, one-load override                 |

Filter, sort and group changes use `router.replace` inside `startTransition`; the view keeps its
current content with `aria-busy="true"` and `opacity-60` until the new payload arrives. Opening a
book uses `router.push(…, { scroll: false })` so Back closes the pane; closing uses
`router.replace`. `Clear all` removes the filter params and keeps `book`, `view` and `groupBy`.

### Cookie

`calibre-prefs`: `{ view: 'shelf' | 'catalogue' | 'study', panel: boolean, renderer: 'css' |
'three-glsl' | 'three-tsl' }`, validated with zod on read, falling back to
`{ view: 'shelf', panel: true, renderer: 'css' }`.

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
`See all N`) over one horizontal scrolling row of up to 8 tiles, 148px wide (128px on phone).

### Catalogue

`Table` with a select-all checkbox header (indeterminate when partly selected), then Title (28×42
cover, title, series line), Author, Formats, Delivered (success pills or `—` named
`Not delivered`), Year. With the pane open, Formats and Year hide. Grouped: a full-width group row
with the same `GroupHeading`, then every book of the group. Row states: hover `bg-muted/55`,
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

Shelf and Study (one tab stop per view, roving `tabindex`, `role="listbox"`,
`aria-multiselectable="true"`, groups as `role="group"` named `{label}, {N} books`):

| Key                   | Action                                                          |
| --------------------- | --------------------------------------------------------------- |
| `←` `→`               | Previous / next item in reading order (crosses rows and groups) |
| `↑` `↓`               | Nearest item in the row above / below (Study: the shelf above)  |
| `Home` `End`          | First / last item of the current row (P10)                      |
| `Ctrl`+`Home` / `End` | First / last item of the whole view                             |
| `Enter`               | Open in the pane                                                |
| `x`                   | Toggle selection (`Space` also works)                           |

Catalogue (rows are the roving items):

| Key                   | Action                                      |
| --------------------- | ------------------------------------------- |
| `↑` `↓`               | Previous / next row                         |
| `Home` `End`          | First / last row of the current group (P10) |
| `Ctrl`+`Home` / `End` | First / last row of the table               |
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

Key-hint row copy per view (from `V2_HINTS`, with the new Home/End entry):

- Shelf: `/` Search · `v` Switch view · `←↑↓→` Move · `Home` `End` Row ends · `Enter` Open ·
  `x` Select · `Esc` Close, then clear
- Catalogue: `/` Search · `v` Switch view · `↑↓` Move · `Space` Select · `Enter` Open ·
  `Esc` Close, then clear
- Study: `/` Search · `v` Switch view · `←→` Along shelf · `↑↓` Between shelves · `Home` `End`
  Shelf ends · `Enter` Open · `x` Select · `Esc` Close, then clear

## Study (phases 2 and 3)

### Shared model and DOM accessibility layer

Every renderer consumes one `StudyModel`, built by pure code in `views/study/model.ts`:

- `shelves`: groups from `groupBooks(books, series|author)`, each `{ key, label, count, books }`.
- `layoutShelves(shelves, widthUnits)`: the spike's layout (books placed along rows, groups
  separated by a divider, a new row when a group's first three books do not fit), returning
  `{ books: Placed[], boards, rows, width }` with `row`, `order`, `x` per book.
- `spineDims(id)` (P15), `isCjk(title)` (P16).

The DOM layer is the same listbox for every renderer: `role="listbox"` named `Bookshelves`, a
`role="group"` per shelf named `{label}, {count} books` with a visible or visually hidden `h2`,
and a `role="option"` per book named `{title}, {authors}` with `aria-selected`. Keyboard handling
is `useRovingNav` with `pickTarget` fed from the layout (`row`, `x`), so `↑`/`↓`/`Home`/`End`
behave the same in every renderer.

- `css`: the options are the visible spines.
- `three-*`: the options are visually hidden (`sr-only`) `div`s over the canvas; the canvas is
  `aria-hidden="true"`. A pointer pick focuses the matching option, so there is one focus path.

### Renderer selection

`renderer = searchParams.renderer ?? prefs.renderer ?? 'css'` (P20). The Study toolbar gets a
`Renderer` Select (`CSS`, `three.js · GLSL`, `three.js · TSL`), shown only in Study. `StudyView`
renders `CssStudy` directly, or `ThreeStudy`, a `next/dynamic(() => import('./three/ThreeStudy'),
{ ssr: false, loading: StudySkeleton })`. Inside it the variant kit is a second dynamic import:
`kitGlsl` (GLSL material, 0.8 KB) or `kitTsl` (`three/webgpu`, `studyMaterial.ts`), so the GLSL
path never loads `three/webgpu`.

### `css` renderer (phase 2)

As the prototype: a grid of bays (`auto-fill, minmax(300px, 1fr)`, one per shelf, `align-items:
end`), each a `muted` gradient back panel, a horizontally scrolling row of spines, and a board
(`foreground` 16% into `muted`). Each spine slot has `perspective: 900px`; on hover or focus the
book lifts 14px, moves `translateZ(40px)` and turns `rotateY(-52deg)` to show the cover, which is
hinged on the spine's right edge at `rotateY(90deg)`. Changes from the prototype, from review.md:

- Bays use `content-visibility: auto` with `contain-intrinsic-size: auto 300px`.
- `will-change: transform` only on the hovered or focused slot.
- The cover face mounts only on hover or focus.
- Rows get `padding-inline-end` of one cover width, so the last book's cover is not clipped.
- Phone: one bay per row, spines at 0.82 scale, horizontal scroll.
- Reduced motion: no transform; the spine brightens and the focus ring and bar stay.

### three.js renderers (phase 2: `three-glsl`, phase 3: `three-tsl`)

Carried over from the spike: `@react-three/fiber` `Canvas` with `frameloop="demand"`,
`dpr={[1, 2]}`, `fov` 30; one `InstancedMesh` per shelf row for spines; instanced boards; the
back panel; the pulled-out book as its own mesh; token colours read from computed styles and
re-read on scheme change; covers 256×384 in an LRU of 24 drawn for the pulled book ±4 in idle
callbacks. Dropped from the spike: `@react-three/drei` (only `useCursor` was used; set the
cursor directly).

Fixes for the spike's open items (decision 4):

1. **Focus ring overlay.** `Scene` reports the focused book's projected screen rect after every
   camera or pull change (`onFocusRect`). `FocusOverlay` draws a DOM `outline-[2.5px]
outline-foreground` box there, plus the 4px bar, only while an option has `:focus-visible`.
   The selection check badges are drawn in the shader (see 10), so the two cues never share a
   colour.
2. **Camera clamp.** Camera y follows the focused row and is clamped so the frustum never leaves
   `[case bottom − margin, case top + margin]`; x stays centred because the layout width is the
   canvas width. Wheel and touch pan the same clamped value; at either clamp the wheel event is
   not prevented, so the page scrolls on.
3. **Shelf headings.** DOM labels (`{label}` and `{count} books`, `text-sm`), `aria-hidden`
   (the DOM layer has the real headings), positioned by projecting each group's first book's top
   left corner on camera change. A group that wraps onto a new row repeats its label there in
   `text-muted-foreground`.
4. **Per-shelf atlas.** One CanvasTexture per row (row width × `ROW_H`, 160 px per unit), bound
   to that row's `InstancedMesh`. Rows inside the frustum are drawn first, synchronously before
   the first frame; the rest in `requestIdleCallback` batches, nearest row first. A row without
   its atlas yet draws spines in their side colour.
5. **Cover prewarm.** After the first frame: fetch and decode (`createImageBitmap`, 256×384)
   covers for the focused book ±4 and the first row, upload each with `renderer.initTexture`,
   and compile the pulled-book material once (`renderer.compile`, `compileAsync` on
   WebGPURenderer), so the first pull does not pay the 30 to 50 ms upload and first-use spikes
   the spike measured.
6. **Reduced motion.** No pull-out and no camera tween (the camera jumps). The focused spine
   gets a strong cue: a `foreground` tint at 45% (`aHi`), the DOM focus ring, and the bar. The
   spike's `primary` tint is replaced, since `primary` means selection.
7. **Tone mapping.** `NoToneMapping` on the renderer for every variant (`flat` on the Canvas for
   WebGLRenderer; set on the WebGPURenderer in the `gl` factory). Per-material `toneMapped` is
   not relied on. `shadows={false}`.
8. **Uniforms in TSL.** Every value that changes after creation (highlight colour, pulled book
   side and pages colours, cover and spine textures) is a `uniform()` or a texture node whose
   `.value` is set. No per-book constants, so the program count stays flat through a sweep.
9. **One pulled-book material.** A single material picks cover, spine, pages or side by
   `normalLocal` (TSL) or `vNormal` (GLSL), replacing the six-material array: one draw call and
   no geometry groups, in both variants. It is created once and re-pointed at each pulled book.
10. **Side colour and selection in attributes.** `aCol` (vec3) carries the side colour;
    `aSel` (float) mixes `primary` at 22% for selected books. `instanceColor` is not used,
    because `NodeMaterial` multiplies it into `colorNode`.

The `three-tsl` variant also sets `outputBufferType: UnsignedByteType` and records its reported
texture memory against the spike's 90.5 MB; keep it only if the frame and parity checks hold.

Dependencies (phase 2), pinned as in the spike: `three` 0.186.1, `@react-three/fiber` 9.8.1,
`@types/three` 0.186.0 (dev). fiber 9.8.1 requires `react >=19 <19.4`; the catalog resolves 19.2.3.
The console's `THREE.Clock` deprecation warning comes from fiber and is accepted.

## Performance budgets

From the spike (headed Chromium on an Apple M4 Pro; headless throttles rAF to ~12 fps, so it is
not used for timing). "Sweep" is the spike's 40-step keyboard sweep at 150 ms per step over 250
fixture books.

| Measure                                           | `css`          | `three-glsl` (spike)         | `three-tsl` (spike)          |
| ------------------------------------------------- | -------------- | ---------------------------- | ---------------------------- |
| Extra JS, gzip, lazy                              | 0              | ≤ 260 KB (253.4)             | ≤ 450 KB (443.2)             |
| In first load of `/`, `/books/[id]`, `/read/[id]` | n/a            | none                         | none                         |
| rAF median / p95, sweep                           | 16.7 / ≤ 20 ms | 16.7 / ≤ 20 ms (16.7 / 18.6) | 16.7 / ≤ 20 ms (16.6 / 18.7) |
| Dropped frames per sweep                          | ≤ 10           | ≤ 10 (3)                     | ≤ 10 (2)                     |
| Long tasks during sweep                           | 0              | 0                            | 0                            |
| Mount → first frame, desktop                      | n/a            | ≤ 200 ms (300)               | ≤ 450 ms (513)               |
| Render CPU max after prewarm                      | n/a            | ≤ 25 ms (23.8)               | ≤ 25 ms (15.1)               |
| Draw calls                                        | n/a            | ≤ rows + 6                   | ≤ rows + 6                   |
| Texture memory                                    | n/a            | ≤ 40 MB est. (~35)           | recorded (90.5 reported)     |

The first-frame targets are below the spike's numbers because the spike spent 300 to 500 ms
drawing the whole 250-spine atlas before its first frame, and the per-shelf atlas draws only the
visible rows first.

Phase 1 budgets, on the fixture library at 250 books (the Study perf fixture reused):

- RSC payload of `/` at 250 books: ≤ 150 KB uncompressed.
- Opening a book (`?book=` push) to pane content: ≤ 200 ms p95 on `next start`.
- View switch (`v`) to the new view painted: ≤ 100 ms, no network request.

## Loading, error and empty states

- **Loading.** The page wraps its data in `Suspense` whose fallback is the client
  `ViewSkeleton`. It reads the view from `LibraryProvider`, which the layout seeds from the cookie
  (the layout reads `cookies()` inside its own Suspense boundary, as `cacheComponents` requires).
  It carries `aria-busy="true"` and `aria-label="Loading books"`: Shelf, 12 cover cards (6 on phone); Catalogue,
  10 rows (7 on phone); Study, three bays of 7 spines with varied heights. `@pane/loading.tsx`
  renders the pane Skeleton (cover, three lines, two buttons, three delivery rows). Client
  navigations keep the old content dimmed instead (see URL).
- **Error.** `(library)/error.tsx` renders a destructive `Alert`: `Couldn't load the library`,
  `The book list request failed. Your filters and selection are kept, so a retry picks up where
you were.`, and the error digest in mono. `Retry` calls the boundary's `unstable_retry()` (Next.js 16.2
  `error.js` API; it re-fetches and re-renders the segment). Selection survives because the provider lives in the layout, above the boundary.
  `@pane/error.tsx` shows a compact version: `Couldn't load this book` and `Retry`.
  `ThreeStudy` gets its own boundary: `Couldn't start the 3D renderer` with `Use CSS study`.
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
  `Sort direction: ascending|descending`, `See all {N}`.
- Bulk: `Bulk actions`, `Clear selection (Esc)`, `{N} selected`, `({M} hidden by filters)`,
  `Select all {N}`, `Add to`, `Mark delivered`, `ZIP`, `Select`, `Done`; toasts
  `{N} book(s) marked as delivered to {platform}` (as today), `Delivery failed — {msg}`,
  `Download failed — {msg}`.
- Detail: `Details`, `Esc close`, `Close details`, `Open full page`, `{series} · Book {n}`, `Read`,
  `Download`, `Tags`, `Publisher`, `Published`, `Language`, `Formats`, `Deliveries`,
  `Not added`, `Mark added`, `Log again`, `Mark as added to {platform}`,
  `Logs today's date. Both fields are optional.`, `Reference URL`, `Note`, `Save`,
  `History ({N})`, `Remove {platform} event`, `Description`, `Logged {platform}` (toast).
- Marks: `On {platform}` (title and accessible name), `Not delivered`.
- States: as in the section above.
- Study (phase 2): `Bookshelves`, `{label}, {N} books`, `Renderer`, `CSS`, `three.js · GLSL`,
  `three.js · TSL`, `Couldn't start the 3D renderer`, `Use CSS study`,
  `3D isn't available here, showing the CSS study` (toast).

## Fixtures

The repo is public. `apps/personal-calibre-e2e/src/support/global-setup.ts` is rewritten to seed
made-up books and authors only, in the style of the prototype's `data.js` (for example
`The Salt Archive` by Mara Ostrand, `Tidewater Cycle`), about 40 books across 4 series, 8 tags and
3 delivery platforms, with two made-up CJK titles for the vertical-title check and one book
without an EPUB (no Read button). A second seed mode (`CALIBRE_FIXTURE=large`) generates 250
books with the spike's generator for budgets and Study captures. Captures and PR evidence use
these fixtures only. `resetAppDb` stays.

## Testing

Vitest (new `apps/personal-calibre/vitest.config.ts`, `environment: 'node'`,
`include: ['src/**/*.test.ts']`, picked up by the `@nx/vitest` plugin as `test`):

- `pickTarget`: arrows in a grid and in grouped rows; `↑`/`↓` nearest by rect; `Home`/`End` row
  ends; `Ctrl+Home`/`End`; duplicate book ids under tag grouping (P9); Study rows from layout.
- `groupBooks`: series order by index, fallback groups last, tag duplication, author by first
  author.
- `library-params`: parse and build hrefs; `Clear all` keeps `book`, `view`, `groupBy`; `page` is
  dropped; `activeFilters` labels.
- `prefs`: cookie parse with bad JSON, unknown view and renderer; `?view=` override.
- `resolveShortcut`: the global and per-view key tables, typing-target and modifier guards, `Esc`
  order.
- `formatDeliveryTime`; `latestByPlatform(events)`.
- Phase 2: `layoutShelves`, `spineDims`, `isCjk`, the atlas build order (visible rows first,
  then nearest), the focus-rect projection helper.

Playwright (`apps/personal-calibre-e2e`, fixture DB, Desktop Chrome plus a 390×844 project for
phone specs; add `@axe-core/playwright`):

- Views: the switcher and `v` cycle; the cookie restores the view after reload; `?view=` overrides
  without writing it; the Skeleton shape follows the cookie (`?__delay=`).
- Keyboard, per view: exactly one `tabindex="0"` item; Tab from the toolbar lands on it; arrows,
  `Home`/`End` stay in the row; `Ctrl+Home`/`End` reach the ends; `x` and `Space` toggle
  `aria-selected`; `Enter` opens the pane; `Esc` closes it and focus returns to the same book; a
  second `Esc` clears the selection; `v` keeps focus on the same book; `/` focuses search.
- Focus vs selection: on a focused and selected item, the computed outline colour is
  `foreground` and the selection mark is `primary`.
- Pane: `?book=` survives reload; Back closes it; filters change with it open; `Open full page`
  loads `/books/[id]`; `Read` links to `/read/[id]` and is absent without an EPUB.
- Deliveries: `Mark added` with URL and note; the row Badge shows the date; `History (N)` lists
  and removes; bulk `Mark delivered` and `ZIP` from Shelf and from Catalogue (rewrite of
  `bulk-delivery.spec.ts`).
- Filters, search, suggestions, group and sort: rewrites of the current `filter`, `search`,
  `group-by`, `book-list`, `book-detail` and `tag-editing` specs against the new UI.
- States: `?__fault=list` shows the Alert, Retry recovers and keeps the selection; `?__fault=pane`
  shows the pane error; empty result shows `Clear filters`.
- Phone: filters Sheet, detail Sheet, `Select` mode, floating bulk bar, no key hints, no
  horizontal page scroll at 390px.
- axe (wcag2a/aa, wcag21aa, best-practice): 0 violations for each view, with the pane open, and
  with the filter Sheet open.
- Phase 2 and 3: the same keyboard and axe specs run once per renderer (`?renderer=`); the
  focused option's id matches the pulled book (`data-pulled-id` on the canvas wrapper); the focus
  overlay is visible and inside the canvas bounds; reduced motion (`emulateMedia`) shows no pull
  and a visible ring; the renderer-bundle check reads the react-loadable manifest and fails if
  `three` appears in the first load of `/`, `/books/[id]` or `/read/[id]`.

Budgets are measured by a headed script (the spike's sweep, moved to
`apps/personal-calibre-e2e/perf/`), not in CI. Visual check before each PR in light and dark at
1440 and 390, with before/after captures on fixture data.

## Phase 1 task outline

1. Fixtures: made-up seed (small and large), vitest config.
2. Data: `LibraryBook`, `getLibrary`, `groupBooks`, `library-params`, prefs cookie; unit tests.
3. Shell: layout with `@filters` and `@pane` slots, `LibraryProvider`, header, `ViewSwitch`,
   phone Sheets.
4. Search field with suggestions (Popover + Command) and filter panel with facets.
5. Toolbar, chips, sort and group, bulk toolbar (replaces the two bulk components).
6. Shelf view with tiles, marks and grouped rows.
7. Catalogue view with the table, compact columns and phone list.
8. Detail: `BookDetail`, delivery rows and history, Read, Download menu; `/books/[id]` reuses it.
9. Keyboard: `pickTarget`, `useRovingNav`, global shortcuts, key hints; unit tests.
10. States: skeletons, error boundaries, empty; test hooks.
11. e2e rewrite, phone project, axe; remove the old components; captures.

## Out of scope

- Send-to-device of any kind (Kindle or otherwise).
- Facet counts, multi-select facets, facet-level search beyond `Show all`.
- Exposing note and reference URL in bulk delivery.
- A scheme toggle.
- Changes to `/read/[id]`, OPDS, the MCP tools, or `BookSummary`.
- Virtualised lists above 1,000 books.
- The `WebGLNodesHandler` renderer.
- `toHaveScreenshot` baselines (e2e does not run in CI).
- Safari, Firefox and real-device performance numbers for the three.js renderers: recorded if
  measured, not gating.

## Open questions

1. Default Study renderer. This spec picks `css` (P20). If the owner wants the 3D study to be what
   opens by default, `three-glsl` becomes the default with `css` as its fallback; nothing else
   changes.
2. Dropping pagination (P2) changes the ungrouped Shelf from 30 books per page to the whole
   library in one scroll. Confirm that is wanted before phase 1 ships.
