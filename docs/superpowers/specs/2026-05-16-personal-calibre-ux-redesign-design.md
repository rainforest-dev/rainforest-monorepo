# Personal Calibre UX Redesign

**Date:** 2026-05-16  
**Approach:** Unified system redesign (Approach B)  
**Scope:** Filter/grid system, tag system, platform delivery visibility, bulk action feedback, e2e project

---

## Context

`apps/personal-calibre` is a personal Next.js 15 (App Router) web frontend for a Calibre SQLite library hosted on Synology NAS. It reads from Calibre's own SQLite DB and an app SQLite DB (`schema-app.ts`) that tracks book deliveries to external platforms (Readwise Reader, NotebookLM, etc.).

**Current pain points being addressed:**
- Search sometimes returns wrong/missing results (FTS5 reliability)
- Filter state is lost on back navigation (local `useState` not synced to URL)
- Bulk delivery actions give no confirmation and leave stale UI
- Filter dropdowns load all authors/tags/series at once (UX scalability)
- No platform delivery visibility on book cards
- No in-app tag editing (must use Calibre desktop)
- No series/tag/author grouped view
- No e2e test coverage

**Library size:** Small (~100–500 books). Performance is not a constraint; UX correctness is.

---

## Architecture Overview

```
URL params  →  FilterBar (client)  →  page.tsx (server)  →  queries.ts  →  SQLite (Calibre + App DB)
                    ↕                                              ↕
              BookGrid (client)                           MCP route.ts
```

**URL shape is the single source of truth for all UI state:**

```
/?q=...&author=1&tag=2&series=3&platform=readwise-reader&delivered=false&groupBy=series&sortBy=title&sortDir=asc&page=1
```

All params are optional and compose freely. `groupBy` switches the grid between flat-paginated mode and grouped-browse mode. Back navigation, link sharing, and page refresh work correctly because all filter state lives in the URL — no `useState` for filter values.

---

## Section 1: Data Layer

### `BookListParams` extensions

```typescript
export interface BookListParams {
  // existing
  page?: number;
  limit?: number;
  q?: string;
  authorId?: number;
  tagId?: number;
  seriesId?: number;
  // new
  platformKey?: string;          // filter by delivery platform
  delivered?: boolean;           // true = delivered, false = not yet
  groupBy?: 'series' | 'tag' | 'author';
  sortBy?: 'title' | 'author' | 'pubdate' | 'added' | 'rating';
  sortDir?: 'asc' | 'desc';
  // Note: series_index is used internally as the default sort within series groups,
  // not exposed as a user-facing sortBy option.
}
```

### Return shape

- **Flat mode** (no `groupBy`): `{ books: BookSummary[], total: number }` — unchanged, paginated
- **Grouped mode** (`groupBy` set): `{ groups: BookGroup[] }` — no pagination

```typescript
interface BookGroup {
  key: string;     // e.g. tag ID or series ID as string
  label: string;   // display name
  total: number;   // total books in this group (for "See all N →")
  books: BookSummary[];  // first 6 books only
}
```

### Platform delivery badges in `BookSummary`

Always included — one extra `WHERE id IN (...)` query against `book_deliveries` for the current page's book IDs. Not N+1.

```typescript
interface BookSummary {
  // existing fields...
  deliveredTo: string[];  // platform keys, e.g. ['readwise-reader', 'notebooklm']
}
```

### Tag write API routes

New routes writing to Calibre's SQLite (not the app DB — tags must round-trip to Calibre desktop):

```
POST   /api/books/[id]/tags           { name: string }   → get-or-create tag, link to book
DELETE /api/books/[id]/tags/[tagId]                      → unlink tag from book
```

Both routes call `revalidateTag('books')` and `revalidateTag(`book-${id}`)` after write.

**Write sequence for `POST`:**
1. `SELECT id FROM tags WHERE name = ?` — find existing tag
2. If not found: `INSERT INTO tags (name) VALUES (?)` — create it
3. `INSERT OR IGNORE INTO books_tags_link (book, tag) VALUES (?, ?)` — link (idempotent)

---

## Section 2: Filter & Sort System

### `FilterBar` replaces `FilterPanel`

All filter state removed from `useState`. Every control reads directly from `useSearchParams()` and writes via `router.replace()`. URL is the only state — back navigation works for free.

**Row 1 — Search + active chips** (existing behavior, bug-fixed):
- FTS search input with clear button
- Active filter chips derived from URL params
- Debounced autocomplete suggestions (300ms, existing)

**Row 2 — Filter controls:**

```
[Author ▾] [Tag ▾] [Series ▾] [Platform ▾] [Delivered ▾]  |  [Group by ▾] [Sort ▾] [↑↓]
```

- `Author`, `Tag`, `Series`: replaced from `<Select>` to **combobox** (shadcn `Command` + `Popover`). User types to filter the list, clicks to select. Stores ID in URL param, unchanged from today.
- `Platform`: select from `deliveryPlatforms` list (existing `listDeliveryPlatforms()`)
- `Delivered`: `All / Delivered / Not delivered` — disabled and hidden unless a platform is selected in the Platform control. Selecting a platform auto-shows this control; clearing the platform also clears the delivered param.
- `Group by`: `None / Series / Tag / Author` — switches grid mode
- `Sort by` + direction toggle: `Title / Author / Date added / Published / Rating`

---

## Section 3: Grid & Group-by

### Flat mode (default)

Paginated grid of `BookCard` components. Additions to each card:

- **Platform badge row**: small icon chips below format badges. Shows abbreviated platform key (e.g. `RW`, `NLM`) for each platform the book has been delivered to. Absent = not delivered (not shown to avoid noise).
- Delivery filter works in conjunction: `platform=readwise-reader&delivered=false` shows only un-delivered books.

### Grouped mode (`groupBy=series|tag|author`)

Renders groups as browse sections with a limited preview and "See all" link:

```
── Fantasy ─────────────────────────────── (12 books)
[card] [card] [card] [card] [card] [card]     See all 12 →

── Science Fiction ──────────────────────── (8 books)
[card] [card] [card] [card] [card] [card]     See all 8 →
```

- Server fetches first 6 books per group (`LIMIT 6` per group query)
- **"See all N →"** is shown only when `total > 6`. Navigates to the flat list page with the corresponding filter pre-applied:
  - `groupBy=tag` → `See all` links to `/?tag=<id>`
  - `groupBy=series` → `/?series=<id>`
  - `groupBy=author` → `/?author=<id>`
- Books with no group value collected into `── Ungrouped ──` section at the bottom
- Sort within groups: defaults to `series_index` when `groupBy=series`, otherwise `title`
- No pagination in grouped mode — all matching groups returned

### Composability examples

- `tag=nonfiction&groupBy=author` → nonfiction books grouped by author
- `platform=readwise-reader&delivered=false&groupBy=series` → undelivered books grouped by series ("what series should I send to Readwise next?")
- `groupBy=tag&sortBy=rating&sortDir=desc` → all books grouped by tag, best-rated first within each group

---

## Section 4: Tag System

### In-app tag editing (book detail page)

Tag editor section on `books/[id]/page.tsx`:

```
Tags:  [Fantasy ×]  [Nonfiction ×]  [+ Add tag...]
```

- Clicking `×` calls `DELETE /api/books/[id]/tags/[tagId]`
- Combobox searches existing tags from `getFilterOptions()` (no new query)
- "Create new tag" option when no existing tag matches
- On success: `router.refresh()` re-renders the server component with updated tags

### MCP tools

Added to `/api/mcp/route.ts`:

```
add_tag(bookId: number, tagName: string)
  → idempotent get-or-create + link
  → revalidates cache

remove_tag(bookId: number, tagId: number)
  → removes books_tags_link entry
  → revalidates cache

list_tags()
  → returns all { id, name } tags
  → useful for agents to resolve name → id before remove_tag
```

### Extended `list_books` MCP tool

```typescript
list_books({
  // existing
  query, authorId, tagId, seriesId, page, limit,
  // new
  platformKey,   // delivery platform filter
  delivered,     // boolean
  groupBy,       // "series" | "tag" | "author"
  sortBy,        // "title" | "author" | "pubdate" | "added" | "rating"
  sortDir,       // "asc" | "desc"
})
```

When `groupBy` is set, response is `{ groups: BookGroup[] }`.

**Agent workflows enabled:**
- `list_books({ platformKey: "readwise-reader", delivered: false, groupBy: "series" })` → which series still need to go to Readwise?
- `add_tag(bookId, "to-read")` + `list_books({ tagId: X, sortBy: "rating", sortDir: "desc" })` → classify then browse
- Full read → classify → delivery loop via MCP without touching the UI

---

## Section 5: Bulk Action Feedback

### Toast confirmation

After `bulk_add_delivery` succeeds: `"12 books marked as delivered to Readwise"`. On error: `"Delivery failed — please try again"` with error detail. Use shadcn Sonner toast.

### Optimistic UI + cache revalidation

`BulkActionBar` updated flow:
1. On submit: clear selection, show "Saving…" state, disable submit button (prevent double-submit)
2. On success: show toast, call `router.refresh()`
3. `router.refresh()` re-runs RSC fetches for current URL — server has already revalidated `cacheTag('books')`, so `getBookList` returns fresh delivery data
4. Platform badges on book cards update in place without full page reload

`router.refresh()` re-runs server components without unmounting client components or resetting scroll position — correct App Router mutation pattern.

---

## Section 6: E2e Project

### New project: `apps/personal-calibre-e2e`

Mirrors `apps/personal-liff-e2e` structure. Playwright project with `implicitDependencies: ['personal-calibre']` in Nx config.

**Nx targets:**
```bash
pnpm nx e2e personal-calibre-e2e          # run all
pnpm nx e2e personal-calibre-e2e --ui     # Playwright UI mode
```

**Test environment:**
- Runs against `http://localhost:3333`
- Calibre SQLite fixture: small seeded DB with known books/tags/series/ratings
- App DB (deliveries) reset before each suite via setup script
- Real SQLite — no mocks (catches FTS5, cache revalidation, and Drizzle query bugs)

**Spec files:**

| File | Covers |
|---|---|
| `search.spec.ts` | FTS search returns results; autocomplete navigates to book detail |
| `filter.spec.ts` | Author/tag/series/platform combobox filters; back nav restores filter state |
| `group-by.spec.ts` | Group by series/tag/author; "See all" navigates with correct filter param |
| `tag-editing.spec.ts` | Add tag via UI; tag appears in filter combobox; remove tag |
| `bulk-delivery.spec.ts` | Select books; mark delivered; toast shown; platform badges updated |
| `book-detail.spec.ts` | Detail page shows metadata, delivery history, tag editor |

**CI:** Added to `pnpm nx affected -t e2e` — runs when `personal-calibre` is affected.

---

## Bug Fixes (Baseline)

These are fixed as part of the unified redesign, not as a separate pass:

1. **Search reliability**: audit FTS5 trigram index population — ensure index is rebuilt on DB mount and that the n-gram fallback path handles edge cases correctly.
2. **Filter state on back navigation**: remove all `useState` for filter values from `FilterBar`; read exclusively from `useSearchParams()`. URL is the only state.
3. **Bulk action stale UI**: `router.refresh()` after mutation + server-side `revalidateTag` ensures badges update.

---

## Implementation Order

1. E2e project scaffold — create `apps/personal-calibre-e2e`, wire into Nx, create fixture DB (no specs yet)
2. Data layer — extend `BookListParams`, `BookSummary`, tag write routes, `getBookList` grouped mode
3. `FilterBar` — replace `FilterPanel`, fix nav bug, add comboboxes, delivery + group/sort controls; add `filter.spec.ts` + `search.spec.ts`
4. `BookCard` — add platform badge row
5. Grouped grid mode — `BookGrid` branching, group headers, "See all" links; add `group-by.spec.ts`
6. Tag editor UI — detail page tag chips + combobox; add `tag-editing.spec.ts`
7. MCP extensions — `add_tag`, `remove_tag`, `list_tags`, extend `list_books`
8. Bulk action feedback — toast, optimistic UI, `router.refresh()`; add `bulk-delivery.spec.ts` + `book-detail.spec.ts`
