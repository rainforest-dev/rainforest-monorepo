# RSS manager redesign: Registry desk

Date: 2026-10-03. Branch `docs/rss-manager-registry-desk`, from `main` at 6150066b. This spec maps
direction A of the Claude Design exploration onto `apps/rss-manager`.

Sources, in order of authority:

1. The owner decisions below.
2. The prototype, Claude Design project `4c25a390-c3db-43c1-af89-b0504a180625`, folder
   `explorations/rss-manager-redesign/`: `review.md` (read in full), `RSS Redesign A.html`,
   `a-app.jsx`, `a-views.jsx`, `a-detail.jsx`, `ui.jsx`, `data.js`, `rss.css`. It is React 18 with
   inline styles, stand-ins for shadcn parts the library lacked at the time, and fixture data (40
   sources, 12 topics, 20 queue items). Its actions are fake: about 0.85 s of delay, then local
   state and a toast.
3. The current app on `origin/main`, cited by path below.
4. The precedents: `2026-09-29-calibre-redesign-design.md` (three-pane library, filters,
   selection, detail pane, keyboard, URL state), `2026-09-30-shadcn-first-library-design.md`,
   `2026-10-01-shared-interaction-core-design.md`.

Where calibre's decisions transfer, this spec reuses them and says so ("as calibre P4"). Where they
do not, it says why.

## Goal

Turn the Sources tab into a work desk for the weekly registry pass: find the proposed and stale
sources, decide on many at once, and look at one source closely without leaving the list. Topics
and Queue move onto the same table vocabulary. The Validate tab becomes a header popover.

## Owner decisions

- 2026-10-03: direction A, Registry desk, is chosen over B, Triage inbox. Review.md's suggested
  combination (B as the home page, A as the registry) is not adopted.
- Everything else here that changes behaviour is marked "proposed, owner to confirm". The open
  questions at the end list the ones that most need an answer before a plan is cut.

## Versions

From `apps/rss-manager/package.json`, `pnpm-workspace.yaml` and `pnpm-lock.yaml`: Astro 7.3.3
(`output: 'server'`, `@astrojs/node` 11.1.6 standalone), `@astrojs/react` 6.0.6, React 19.2.3,
Tailwind 4.2.2 with `@tailwindcss/vite`, TypeScript 6.0.3, `lucide-react` 1.46.0, `@base-ui/react`
1.8.0 (through `@rainforest-dev/rainforest-react`). The app's own Vitest is 3.2.7 (`^3.2.4`) while
the workspace root runs 4.1.4; the new tests use only APIs common to both, and aligning the app's
version is out of scope. Playwright 1.63.0 and `@axe-core/playwright` 4.13.0 resolve for the
existing e2e projects. No dependency is added or upgraded by the app work; the library PR in phase
step 2 may add `Progress` from the shadcn registry (see Components).

## Current app (what the code does today)

Layout. `src/pages/index.astro` reads `?tab=` (`sources | topics | validate | queue`, default
`sources`), renders four `<a href="?tab=…">` links (a full page load per tab), and mounts one island
per tab with `client:load`: `SourceTable`, `TopicList`, `FeedValidator`, `ReadingQueue`. Each
island fetches its data in `useEffect` and shows a text line while loading.

Data model (`src/lib/registry.types.ts`):

- `Source`: `name`, `url` (the feed), `siteUrl` (derived, may be `''`), `tags`, `status`
  (`active | proposed | no-rss | retired`), `category`, optional `proposedDate`, optional `stale`.
- `Topic`: `name`, `tags`, `description`, `status` (`active | proposed | declined`), optional
  `proposedDate`, optional `stale`.
- `Stale`: `{ type: 'feed-dead' | 'delivery-gap' | 'low-value' | 'unspecified', note }`, parsed
  from `<!-- stale: <type> | <note> -->` at the end of the item line; an untyped comment becomes
  `unspecified` with the whole body as the note (`src/server/registry.ts`, `extractStale`).
- Neither type has an id. The server finds an entry by the regex `- [ ] **<name>**` and takes the
  first match (`spliceEntry`, `activateSource`), so the name is the identity.
- The prototype's `addedDate`, `lastItem` and `perWeek` do not exist in the registry. Category is
  the nearest `###` heading and resets at each `##` section, so sources outside Active Sources are
  usually uncategorised (`parseSources`). Status comes from the `##` section: `Active Sources`
  (checked → active, unchecked → proposed), `Needs Verification` and `Proposed Sources` → proposed,
  `No RSS Found` → no-rss, `Retired` → retired.

Reads. `GET /api/sources` and `GET /api/topics` return the parsed list plus `writable`, from
`accessSync(W_OK)` on the file (`isWritable`). `GET /api/reading-queue` returns the parsed
`reading-queue.json` or `{ generated: null }` when the file is absent (`readReadingQueue`). Files
live under `VAULT_PATH` (default `/vault`): `RSS-Source-Registry.md`, `RSS-Topic-Registry.md`,
`reading-queue.json`.

Writes, one item per request:

| Action          | Request                                                         | Server                                                                      | UI offers it when                           |
| --------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------- |
| Activate source | `PATCH /api/sources {name, action:'activate'}`                  | `activateSource`: check the box, move to `## Active Sources`                | `status === 'proposed'`                     |
| Retire source   | `PATCH /api/sources {name, action:'retire'}`                    | `retireSource`: uncheck, move to `## Retired` (created)                     | `status === 'active'`, stale type retirable |
| Activate topic  | `PATCH /api/topics {name, action:'activate'}`                   | `activateTopic`: check, move to `## Active`                                 | `status === 'proposed'`                     |
| Decline topic   | `PATCH /api/topics {name, action:'decline'}`                    | `declineTopic`: uncheck, move to `## Declined` (created)                    | `status === 'proposed'`                     |
| Re-subscribe    | none: an `<a target="_blank">` to Readwise's subscriptions page | none; `onClick` copies the feed URL to the clipboard                        | active and `stale.type === 'delivery-gap'`  |
| Validate        | `POST /api/validate {url}`                                      | `checkFeedUrl`: fetch (10 s timeout), detect RSS/Atom, title and item count | always (separate tab)                       |

Sources: `src/components/SourceTable.tsx`, `src/pages/api/sources.ts`. Topics:
`src/components/TopicList.tsx`, `src/pages/api/topics.ts`. Validate: `src/components/FeedValidator.tsx`,
`src/pages/api/validate.ts`, `src/server/feedCheck.ts`.

- The server does not check status: `activateSource` on any section moves the entry to Active, and
  `retireSource` / `declineTopic` move whatever they find. The status rules live only in the UI.
- Each write is `readFileSync` → edit the line array → `writeFileSync` of the whole file, with no
  `await` in between, so two requests in the one Node process cannot interleave inside a write.
- `writeFileSync` truncates and rewrites in place; it is not an atomic replace.
- The stale comment sits on the item line, so it travels with the entry: a retired source keeps its
  `<!-- stale: … -->`. Nothing in the app ever writes or clears a stale comment.
- `patchRegistry` (`src/lib/patchRegistry.ts`) reads success from the JSON body, not the status, so
  an auth proxy's HTML 200 is reported as an expired session. Errors are classified from the
  write's own errno (`writeErrorResponse` in `src/server/registryApi.ts`): `EROFS`/`EACCES`/`EPERM`
  → 409 `{ writable: false }`, `ENOENT` → 404, else 500.
- The UI updates its list only after the server answers `ok` (the "Optimistic update" comment in
  `SourceTable.tsx` notwithstanding). Failures show a destructive `Alert` above the list.
- Deployment: the homelab mounts the vault's `_system` folder, an iCloud Drive path, as a writable
  directory at `/vault` (`rainforest-homelab/modules/rss-manager/main.tf`, `variables.tf`). The
  same files are written by the rss-discover skill and synced by iCloud.

Read-only mode today. Activate and Retire (sources) and Activate and Decline (topics) are disabled
with `READ_ONLY_NOTE` as the title, and a warning `Alert` says so (`SourceTable.tsx` 180-185,
303-304, 335-336; `TopicList.tsx` 99-104, 157-169). Re-subscribe stays enabled (it is a link, no
`disabled`). Validate has no notion of read-only. A 409 from a write flips the island into
read-only without a second error message.

Queue (`src/components/ReadingQueue.tsx`, `src/lib/readingQueue.ts`): tier sections in default
order, four sort modes (`default`, `shortest`, `newest`, `thinnest` = fewest `wikiSources`), and a
read-only Stale panel grouped by reason. `decay` is `time-sensitive | evergreen | unknown` (the
prototype's `fast | slow | evergreen` does not exist); `sort.progress` is 0 to 1.

Tests: Vitest unit tests for the parsers, `siteUrlFromFeed`, `isWritable`, `patchRegistry`,
`writeErrorResponse`, `feedCheck` and the queue parser. There is no e2e project.

## Information architecture

One React island replaces the four. The page keeps a single route, `/`.

### Chrome (desktop, `lg` and up)

Header, 56px: the `Rss` icon and `RSS Manager`, then line `Tabs` with counts (`Sources 212`,
`Topics` with an `info` Badge of proposed topics when there are any, `Queue 20`), a spacer, the
registry file name in mono (`RSS-Source-Registry.md`, from `SOURCES_FILE`), and `Validate URL`.
No scheme toggle: the app follows the OS through the shared theme, as calibre decided.

Below the header, Sources is three columns: filter panel 248px, main, detail pane 400px when a
source is open. Topics and Queue are main only. The main column ends with a sticky `KeyHints` row.

Breakpoint: below `lg` (1024px) is the phone layout, as calibre P13. The prototype switches at
640px; three columns do not fit between 640 and 1024 with the pane open.

### Sources

- Filter panel (`aside`, `bg-sidebar`): `Filters · N` and `Clear all`, then four checkbox groups,
  each option with a count: Status (Active, Proposed, No RSS, Retired), Stale (Feed dead, Delivery
  gap, Low value, Unspecified), Category (from the data; `''` shows as `Uncategorised`), Tags
  (sorted by count, then name; 8 shown, `Show all N` / `Show fewer`).
  - Within a group options OR; groups AND. Tags match when the source has any chosen tag.
  - A count is the number of sources matching every other active filter and search, plus that
    option, as the prototype's `aMatch(src, f, except)`. Options with a zero count stay visible and
    enabled.
  - Facets are multi-select with counts. Calibre ruled both out (P12); the registry is small and
    the weekly pass needs "Proposed" and two stale types at once, so they come back here.
- Toolbar (sticky): `Sources` heading, `N sources` or `N of M sources`, search (`InputGroup`, `/`
  Kbd, clear button), `Select` / `Done`. Under it the chip row: one chip per search term and
  filter value (`Status: Proposed`, `Stale: Delivery gap`, `Category: Design`, `Tag: css`), each
  removable, then `Clear all`.
- Search matches name, feed URL, category and tags, case-insensitively. Today it matches name,
  tags and category (`SourceTable.tsx` 156-164); the URL is added.
- Table, 30 rows a page. Order (the prototype's comparator): status `proposed`, `active`, `no-rss`,
  `retired`; within a status, sources with a stale flag first; then name (`localeCompare`). No
  column sorting.
- Columns: checkbox (select mode only), Source (name, feed host in mono), Category, Tags (two
  Badges and `+N`), Status (status Badge and stale Badge), Proposed (`12d ago` for proposed
  sources, else empty), actions. With the pane open, Category, Tags and Proposed hide. The
  prototype's Activity column (last item, items per week) is dropped: the registry has no such
  data.
- Row actions: `Activate`, `Retire`, `Re-subscribe` per the rules under Writes, `Spinner` inside the
  button while pending.
- Pager under the table: `1–30 of 212`, `Prev`, `Page N of M`, `Next` (outline Buttons), as the
  prototype and calibre's restyled `Pagination`.
- Select mode: `Select` adds the checkbox column and a header checkbox for the current page
  (indeterminate when partial), as calibre P4. While anything is selected the toolbar becomes the
  bulk toolbar: clear (`Esc`), `N selected` (`aria-live="polite"`), `Select all 30 on this page`
  when not all are, then a `ButtonGroup` labelled `Apply to selected` with `Activate N` and
  `Retire N`, where N counts only the selected sources the action applies to. A button with N = 0
  is disabled with a title saying why. Re-subscribe is not a bulk action: it opens a tab per
  source.
- Selection survives page changes and filter changes, and `N selected` counts sources the current
  filters hide, as calibre P4. `Done` leaves select mode and clears the selection.
- Detail pane (`aside` named `Source details`, `bg-card`): `Source`, `Esc close`, close button;
  name; status and stale Badges and category; for a stale source a `warning` Alert with the stale
  label as title, the note (or the type's hint when the note is empty) and the type's fix line; a
  `dl` with Feed (mono, copy button), Site (external link, omitted when `siteUrl` is `''`), Tags,
  Proposed (date and age, proposed sources only); `Feed check` with `Validate feed` and the result
  inline; the actions at full width. A delivery-gap source shows Re-subscribe and no Retire, with
  one line saying why. A no-RSS source shows a Validate form prefilled with its URL instead of the
  feed check.

### Topics

Same table vocabulary, no filter panel, no pane, no paging (the registry has a dozen topics).
Toolbar: `Topics`, one line of help, search (name, description, tags), `Select`. Under it a
single-choice `ToggleGroup` `All | Proposed | Active | Declined` with counts, replaced by the bulk
toolbar (`Activate N`, `Decline N`) while anything is selected. Columns: Topic (name, description
on one line), Tags, Status (with stale Badge), Proposed (age), actions. Order: proposed, active,
declined, then name. Rows are not roving items in this phase; Tab moves through the row buttons.

### Queue

A `Table` sortable by column. Each sortable `TableHead` holds a button and carries `aria-sort`
(`ascending`, `descending` or `none`). Columns: `#` (rank, default), Tier, Item (title linking to
`readerUrl`, site and tags), Why (one line, full text in `title`), Decay, Min, Saved, Wiki
(`wikiSources`), Progress. Clicking the active column flips the direction; another column sorts
ascending; ties break by rank. Wiki is not in the prototype; it keeps today's `thinnest` sort.
Decay shows `time-sensitive` (`warning`), `evergreen` (`muted`) and nothing for `unknown`. Tier
filter: `ToggleGroup` `All | T1 … T4` over the tiers present, each item's tooltip the tier label
from `TIER_LABELS`. The summary line keeps today's counts (`queued · backlog · stale · scanned ·
generated`). The Stale panel stays under the table, restyled as an `ItemGroup` per reason, still
read-only.

### Validate URL popover

Replaces the Validate tab. `Popover` from the header button (icon-only on phone): title `Validate
a feed`, `Check a URL before proposing it as a source.`, then a `Field` with `Feed URL`, the input
(autofocus, `inputMode="url"`) and `Validate`. The result renders under it as today's `success` or
`destructive` Alert. `?tab=validate` from old links opens Sources with the popover open.

### Phone (below `lg`)

As the prototype and calibre P13:

- Header 52px: brand, `Validate URL` icon button; the tabs under it.
- Sources: search, then `Filters` (with a count Badge), `N sources`, `Select`. Chips scroll
  horizontally. Rows are an `ItemGroup` of `Item`s (name, host, Badges, chevron); tapping opens the
  detail, or toggles selection in select mode.
- Filters open in a bottom `Sheet` (85% max height, `bg-sidebar`) with the same facets, `Clear all`
  and `Show N sources`.
- Detail opens in a bottom `Sheet` at 88% height.
- The bulk toolbar floats at the bottom with an 8px inset while anything is selected.
- Topics: search, the status `ToggleGroup` (scrolls horizontally), `Select`; rows as `Item`s.
- Queue: tier `ToggleGroup` and a `Sort` `Select`; rows as `Item`s (tier, title, site, minutes,
  saved, progress, rank).
- No key hints.

## URL state

The URL holds what is shown; the island holds what is being done. Proposed, owner to confirm (the
same split as calibre's P1, P2 and P4).

| Param                        | Values                                     | Notes                                                  |
| ---------------------------- | ------------------------------------------ | ------------------------------------------------------ |
| `tab`                        | `topics` \| `queue`                        | absent = sources; `validate` maps to sources + popover |
| `q`                          | text                                       | sources search                                         |
| `status` `stale` `cat` `tag` | comma-separated values                     | sources facets; unknown values are dropped             |
| `page`                       | 2, 3, …                                    | absent on page 1; out of range clamps to the last      |
| `source`                     | source name, URL-encoded                   | opens the detail pane                                  |
| `tq` `tstatus`               | text; `proposed` \| `active` \| `declined` | topics search and status                               |
| `tier` `sort` `dir`          | `1` to `4`; column key; `asc` \| `desc`    | queue                                                  |

- `source` carries the name because the name is the identity everywhere else (the server's write
  regex, React keys). The parser reports duplicate names as a warning in the GET response, so a
  collision is visible rather than silently opening the first match.
- Client only, not in the URL or storage: select mode, the selection, the focused row, pending
  writes, validation results, the open state of the filter Sheet and the popover.
- History, with `pushState`/`replaceState` and a `popstate` listener that re-parses the URL:
  - search typing and facet changes: `replaceState` (search debounced 200 ms), and they drop
    `page`;
  - page changes and opening the pane: `pushState`, so Back returns to the previous page or closes
    the pane; closing the pane: `replaceState`;
  - tab changes: `pushState`;
  - `Clear all` removes the facet params, `q` and `page`, and keeps `tab` and `source`.
- Reload restores the tab, filters, page and open source. The Astro page parses
  `Astro.url.searchParams` with the same pure `parseDeskParams` and passes the result as a prop, so
  the server-rendered HTML already shows the right tab, page and pane and hydration does not flash.
- Proposed: the page also reads the three files in its frontmatter and passes them to the island
  (`{ ok, data } | { ok: false, error }` per file). The first paint then has real rows, and the
  loading Skeleton is only for a Retry. The three GET routes stay for Retry and for refreshing
  after a write.

## Writes

### Rules per action (proposed, owner to confirm)

| Action       | Applies to                                            | Change from today                                                                                       |
| ------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Activate     | proposed and retired sources                          | adds retired (re-activation), as the prototype                                                          |
| Retire       | proposed, active and no-RSS sources, not delivery-gap | adds proposed and no-RSS, as the prototype `canRetire`                                                  |
| Re-subscribe | active sources with a delivery-gap stale flag         | unchanged                                                                                               |
| Activate     | proposed and declined topics                          | adds declined                                                                                           |
| Decline      | proposed topics                                       | unchanged (the prototype's bulk Decline also counted active topics; this keeps row and bulk consistent) |

The rules live in one pure module (`canActivate`, `canRetire`, `canResubscribe`,
`canActivateTopic`, `canDeclineTopic`) used by the rows, the pane, the bulk counts and the keys. The
batch endpoint checks the same rules on the server, so a stale client cannot retire an already
retired source.

### Batch writes (recommended)

Bulk actions need several entries changed at once. The two options:

- Sequential single PATCHes from the client. No server change. But each call is a full
  read-modify-write of the file, so a bulk of N writes the file N times. The vault is an iCloud
  folder that rss-discover also writes: every write is a separate window for a lost update against
  that other writer, and a separate version for iCloud to sync, which raises the chance of a
  conflict copy. `writeFileSync` truncates before writing, so a sync client that reads mid-write
  can see a partial file. A failure at item k leaves k − 1 applied, and the client has to
  reconcile.
- One batch request that reads the file once, applies every move to the line array, and writes
  once. Recommended.

Design:

- `PATCH /api/sources` and `PATCH /api/topics` accept `{ names: string[], action }`. The single
  `name` form stays accepted (it becomes `names: [name]`) so the old islands keep working until
  they are removed.
- `src/server/registry.ts` splits into pure transforms over text
  (`applySourceAction(text, name, action) → text`, the same for topics; `spliceEntry` and
  `insertAtSectionEnd` unchanged) and one `editRegistryFile(file, edit)` that reads, applies and
  writes once. The current exported functions become one-name calls of it.
- All or nothing. Before writing, every name must exist and the action must apply to it; otherwise
  409 `{ error, rejected: [{ name, reason }] }` and the file is untouched.
- The write is atomic: write `.<file>.tmp` in the same directory, then `rename` over the original.
  A reader then sees the old file or the new one, never half. The vault is mounted as a directory,
  so the rename stays on one filesystem. (A future mount of the single file would make `rename`
  fail with `EBUSY`; `writeErrorResponse` reports that as a 500.)
- The response is `{ ok: true, applied: string[], sources | topics, writable }`: the list re-parsed
  from what was written. The client replaces its list with it, so the UI always shows what the file
  says.
- Unchanged: errno classification, the JSON-body success check in `patchRegistry`, the 400 for an
  unknown action before anything touches the vault.

### Pending, success and errors

- Not optimistic, as today. A write marks its rows pending: `data-pending` on the row (opacity),
  row buttons disabled, and the button that started it shows `Spinner` before its label and is
  disabled (the `conventions.md` rule; the prototype's `Activating 3…` label is not used). Other
  rows stay usable; a second write on a pending row is ignored.
- Success: the list comes from the response, the selection clears (select mode stays on), and a
  toast: `Activated Paper Cartography` or `Activated 3 sources`, description `Written to
RSS-Source-Registry.md`.
- Failure: a destructive toast with the server's message (`Couldn't retire 3 sources`, then the
  error). The selection is kept so a retry is one click. A 409 with `rejected` names them. The
  read-only case (409 with `writable: false`) switches to read-only mode with the banner and no
  toast, as today.
- The `Alert` above the list that shows write errors today (`actionError`) goes; load errors keep
  their `Alert`.

### Stale state after an action

The app never writes stale comments, and the comment moves with the entry.

- Retire: the comment stays in the file under `## Retired`. Stale Badges, the pane's stale Alert and
  the Stale facet count non-retired sources only, so a retired source stops showing as stale
  without a write. Proposed, owner to confirm.
- Activate (re-activation of a retired source): the old comment comes back into view. That is the
  vault's truth, and the pane shows it.
- Re-subscribe: no vault write, so the delivery-gap flag stays until rss-discover rewrites or
  removes the comment. The prototype clears it client-side; this would show a source as fixed when
  the file still says otherwise. Instead the row button reads `Copied` for 3 s (today's
  behaviour), and the pane shows `Re-subscribed in this session` under the actions until reload.
  Whether Re-subscribe should also annotate the comment is an open question.

### Re-subscribe and `window.open`

The button stays a link (`Button render={<a href={READER_FEEDS_URL} target="_blank"
rel="noopener noreferrer" />}`) whose `onClick` starts `navigator.clipboard.writeText(url)`.
Navigation is the browser's own, so a popup blocker cannot stop it. The `r` key has no link to
follow: its keydown handler calls `navigator.clipboard.writeText(url)` (not awaited) and then
`window.open(READER_FEEDS_URL, '_blank', 'noopener,noreferrer')` in the same tick. Keydown grants
transient activation, and an `await` before `window.open` would spend it. A clipboard failure is
reported after the fact with the URL to copy by hand, as today.

## Read-only mode

Detection is unchanged: `writable` from the GET responses, per file, and a 409 from a write.

| Action       | Today          | Prototype | Proposed                |
| ------------ | -------------- | --------- | ----------------------- |
| Activate     | disabled       | disabled  | disabled                |
| Retire       | disabled       | disabled  | disabled                |
| Decline      | disabled       | disabled  | disabled                |
| Re-subscribe | enabled (link) | disabled  | enabled: writes nothing |
| Validate     | enabled        | disabled  | enabled: writes nothing |

Proposed, owner to confirm. The banner is a `warning` Alert with the lock icon, title `Read-only
vault`, `READ_ONLY_NOTE`, and `Activate, Retire and Decline are turned off until it is mounted
read-write.` Disabled buttons keep `READ_ONLY_NOTE` as their title, and `a`/`r` (retire) do nothing.
Select mode still works, so a selection can be inspected.

## Keyboard

The interaction core provides the parts; the resolver and key table stay in the app, as the
interaction-core spec requires.

Rows (Sources table, list mode). `createRovingController` over the table body:
`items: 'tr[data-nav-key]'`, `keyOf` the name, `mode: 'list'`, `homeEnd: 'page'`. One row has
`tabIndex=0` (the focused source if it is on the page, else the first row); the rest have `-1`. The
table carries `role="grid"` and `aria-multiselectable` in select mode, rows carry `aria-selected`,
as calibre's `CatalogueView`.

| Key          | On a focused row                                                    |
| ------------ | ------------------------------------------------------------------- |
| `↑` `↓`      | previous / next row; stops at the page ends                         |
| `Home` `End` | first / last row of the page                                        |
| `←` `→`      | previous / next page; focus the first row of the new page           |
| `Enter`      | open the pane                                                       |
| `x`, `Space` | toggle selection; enters select mode if it is off                   |
| `a`          | activate, when it applies and the vault is writable                 |
| `r`          | re-subscribe for a delivery-gap source, else retire when it applies |

Global, through `listenForShortcuts` (capture phase on `window`), skipped when `isTypingTarget`,
`isInOverlay` or `hasModifier`:

| Key         | Action                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------- |
| `/`         | focus the search of the current tab                                                       |
| `1` `2` `3` | Sources, Topics, Queue                                                                    |
| `[` `]`     | previous / next page from anywhere on Sources (calibre P10a), the same handler as `←` `→` |
| `Esc`       | close the pane and focus its row; else clear the selection; else leave select mode        |

`←`/`→` follow the prototype; `[`/`]` are added so the page keys match calibre. `a` and `r` write at
once with no undo: an undo is not a clean inverse here (a retired proposal re-activated lands in
Active, not back in Proposed). This is a risk below.

Key hints, a sticky `KeyHints` row at the bottom of main on desktop, `hidden lg:flex`:

- Sources: `/` Search · `↑` `↓` Move · `←` `→` Page · `Enter` Details · `x` Select · `a` Activate ·
  `r` Retire · `Esc` Close, then clear. The page hint shows only with more than one page.
- Topics and Queue: `/` Search · `1` to `3` Switch tab.

### What to extract now (recommendation, not a decision)

rss-manager is the second React consumer of a roving table after calibre's `useRovingNav`. The
shadcn-first rule allows extraction once two named sites need the same thing. Recommendation: do
not extract a React hook in this work.

- The shared part, the geometry and the DOM tab stop, is already shared (`pickTarget`,
  `createRovingController`).
- What is left in calibre's hook is calibre: `useLibrary()` focus requests, `pendingFocus`, group
  keys (`groupKey:bookId`), and the provider's actions. rss-manager needs a 40-line
  `useRovingRows(containerRef, { onPage, onOpen, onToggle })` around the controller. The two hooks
  would share an effect and a ref.
- The point to revisit is when calibre moves onto `createRovingController` too. Then a
  `useRovingController` hook in `rainforest-react` (create on mount, destroy on unmount,
  `setStop` on data change) is the same code in both apps and earns its place.

Nothing else from this redesign is a library candidate yet: facet panel, chips, bulk toolbar,
pager, `LoadError` and the skeletons stay app compositions, as calibre's did.

## Components

Prototype part → `@rainforest-dev/rainforest-react` (all exported from the package root today):

| Prototype part                              | Components                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Header tabs with counts                     | `Tabs` (`TabsList variant="line"`), `Badge variant="info"`                                       |
| `AValidatePopover`, `ValidateForm`          | `Popover`, `Field`, `FieldLabel`, `FieldDescription`, `InputGroup`, `Button`, `Spinner`, `Alert` |
| `AFilterPanel`, `AFacet`                    | `aside` with `sidebar-*` tokens, `ScrollArea`, `Checkbox`, `Label`                               |
| `AChipRow`                                  | `Badge variant="muted"` with a remove `Button size="icon-xs"`                                    |
| `ASearch`                                   | `InputGroup`, `InputGroupInput`, `InputGroupButton`, `Kbd`                                       |
| `ASourcesTable`, Topics table, Queue table  | `Table` parts, `Checkbox`, `Badge`, `Tooltip`                                                    |
| `ABulk`                                     | `ButtonGroup`, `Button`, `Separator`, `Spinner`, `Kbd`                                           |
| `APager`                                    | `Button variant="outline" size="sm"` (composed, see gaps)                                        |
| `ADetailContent`                            | `Alert variant="warning"`, `Badge`, `Separator`, `Button`, `Tooltip`                             |
| `ADetailSheet`, `AFilterSheet`              | `Sheet side="bottom"`                                                                            |
| `ASourcesList`, phone Topics and Queue rows | `ItemGroup`, `Item`, `ItemContent`, `ItemTitle`, `ItemDescription`, `ItemActions`                |
| Topic status, Queue tier                    | `ToggleGroup`, `ToggleGroupItem`                                                                 |
| Queue phone sort                            | `Select`                                                                                         |
| `ATableSkeleton`                            | `Skeleton`                                                                                       |
| `ASourcesEmpty`, Topics/Queue empty         | `Empty`, `EmptyHeader`, `EmptyMedia`, `EmptyTitle`, `EmptyDescription`, `EmptyContent`           |
| `LoadError`, `ReadOnlyBanner`               | `Alert`, `Button`, `Spinner`                                                                     |
| `KeyHints`                                  | `KeyHints`                                                                                       |
| toasts                                      | `Toaster` (mounted once in the island), `toast`                                                  |
| `IconBtn`                                   | `Button size="icon*"` with `aria-label` inside `Tooltip`                                         |

The prototype's stand-ins in `ui.jsx` (Spinner, Empty, Item, Field, ButtonGroup) are all in the
library now and are not ported. `DropdownMenu` and `Card` are not needed by direction A.

Gaps, under the shadcn-first rule (a primitive enters the library only when a named site replaces
handmade markup with it):

- `Progress`. Named site: the Queue Progress column and the phone queue row, which would otherwise
  draw a handmade bar. shadcn has `progress` in the base-nova registry and Base UI has a Progress
  primitive. Recommendation: add it in its own library PR (step 2), with stories and a `Dark` twin,
  per the 2026-09-30 procedure. Fallback if the owner prefers no new primitive: today's `40% read`
  text.
- `Pagination`. Named sites: rss-manager's pager and calibre's `Pagination.tsx`. shadcn's
  Pagination is a numbered link list; both apps use `Prev` · `Page N of M` · `Next` buttons, which
  is not its structure. Recommendation: compose from `Button` in the app, as calibre does. Adding
  it would be justified only if both pagers moved to shadcn's numbered structure.
- `Sidebar`. shadcn's Sidebar brings a provider, collapse state and a cookie for a panel that here
  is a static `aside`. Recommendation: compose with `sidebar-*` tokens, as calibre. No named site
  needs the full component.

## Loading, empty and error states

- Loading. With server-rendered data (proposed above) there is no first-load spinner. A Retry or a
  refresh shows a `Skeleton` shaped like the tab, `aria-busy="true"`, `aria-label="Loading"`:
  Sources 12 table rows (7 list rows on phone), Topics 8, Queue 10. Without the frontmatter read,
  the same Skeleton is the first-load state.
- Error. Per file, a destructive `Alert`: `Couldn't read the source registry` (or `topic registry`,
  `reading queue`), `Nothing was changed. Retry after the vault finishes syncing.`, the error
  string in mono (`reading-queue.json: queue[3].tier — expected …`, `ENOENT …`), and `Retry`
  (Spinner while it runs). One file failing leaves the other tabs working.
- Empty:
  - no sources: `No sources yet`, `Sources show up here once rss-discover proposes them.`,
    `Validate a feed URL` (opens the popover);
  - no match: `No sources match`, `N filters applied. Remove one or clear them all.`,
    `Clear filters`;
  - topics: `No topics yet` / `No topics here` with `Show all topics`;
  - queue not generated: today's `No reading queue has been generated yet.` and the
    `reading-queue` skill line; a tier with no items: `No items in tier N`, `Show all tiers`.
- Validate: Spinner in the button and `Fetching the feed…` while pending; `success` Alert
  `Valid RSS feed`, title and item count; `destructive` Alert with the error.

## Prototype → app file mapping

All under `apps/rss-manager/src/`. Islands are imported by file, never through a barrel (CLAUDE.md
`### Imports`); everything else goes through `@/components/desk`, `@/lib` and `@/server`.

| Prototype                                            | App                                                                                                                   |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `RSS Redesign A.html`, `AApp`                        | `pages/index.astro` (parses params, reads the files, one island)                                                      |
| `AScreen`, `aInitial`, `lib` object                  | `components/RegistryDesk.tsx` (the island), `components/desk/DeskProvider.tsx`                                        |
| `RS_URL`, tab and filter state                       | `lib/desk/params.ts` (`parseDeskParams`, `buildDeskSearch`), `components/desk/useDeskParams.ts`                       |
| header in `AScreen`                                  | `components/desk/DeskHeader.tsx`                                                                                      |
| `AValidatePopover`, `ValidateForm`, `ValidateResult` | `components/desk/ValidatePopover.tsx`, `ValidateForm.tsx`, `ValidateResult.tsx` (replace `FeedValidator.tsx`)         |
| `AFilterPanel`, `AFacets`, `AFacet`                  | `components/desk/FilterPanel.tsx`, `Facet.tsx`                                                                        |
| `aMatch`, facet counts, `aChips`                     | `lib/desk/filters.ts` (`matchSource`, `facetOptions`, `activeChips`)                                                  |
| `AChipRow`                                           | `components/desk/FilterChips.tsx`                                                                                     |
| `ASearch`                                            | `components/desk/SearchField.tsx`                                                                                     |
| `ASourcesView`, `ASourcesTable`, `aRowProps`         | `components/desk/SourcesView.tsx`, `SourceRow.tsx` (replace `SourceTable.tsx`)                                        |
| sort comparator in `AScreen`                         | `lib/desk/sort.ts` (`compareSources`, `compareTopics`)                                                                |
| `ASourcesList`                                       | `components/desk/SourceList.tsx` (phone)                                                                              |
| `ABulk`                                              | `components/desk/BulkToolbar.tsx`                                                                                     |
| `canActivate`, `canRetire`, `canResub`               | `lib/desk/actions.ts`                                                                                                 |
| `SourceActions`                                      | `components/desk/SourceActions.tsx`                                                                                   |
| `APager`                                             | `components/desk/Pager.tsx`                                                                                           |
| `ADetailContent`, `ADetailSheet`                     | `components/desk/SourceDetail.tsx` (`variant: 'pane' \| 'sheet'`)                                                     |
| `AFilterSheet`                                       | `components/desk/FilterSheet.tsx`                                                                                     |
| `ATopicsView`                                        | `components/desk/TopicsView.tsx` (replaces `TopicList.tsx`)                                                           |
| `AQueueView`, `sortQueue`, `A_QCOLS`                 | `components/desk/QueueView.tsx` (replaces `ReadingQueue.tsx`); `sortQueue(items, key, dir)` in `lib/readingQueue.ts`  |
| `useRssStore` (actions, pending, validations)        | `components/desk/useRegistry.ts`; `lib/patchRegistry.ts` gains `names[]`                                              |
| `onRowKey`, global `keydown`                         | `components/desk/useRovingRows.ts`, `useDeskShortcuts.ts`; `lib/desk/keys.ts` (`resolveDeskKey`)                      |
| `KeyHints`, `A_HINTS`                                | `KeyHints` from the library; `DESK_HINTS` in `lib/desk/keys.ts`                                                       |
| `ATableSkeleton`, `LoadError`, `ASourcesEmpty`       | `components/desk/TabSkeleton.tsx`, `LoadError.tsx`, `EmptyState.tsx`                                                  |
| `ReadOnlyBanner`, `RO_REASON`                        | `components/desk/ReadOnlyBanner.tsx`, `READ_ONLY_NOTE` (exists)                                                       |
| `StatusBadge`, `StaleBadge`, `TopicStatusBadge`      | `components/desk/StatusBadges.tsx`; `STALE_UI` gains `hint`, `fix`, icon                                              |
| (server, no prototype)                               | `server/registryEdit.ts` (pure transforms, batch, atomic write); `pages/api/sources.ts`, `topics.ts` accept `names[]` |

Removed at the end: `SourceTable.tsx`, `TopicList.tsx`, `FeedValidator.tsx`, `ReadingQueue.tsx`.

## Testing

Unit (Vitest, `environment: 'node'`, `src/**/*.test.ts`; logic is kept pure so no jsdom is needed):

- `filters`: OR within a group, AND across groups, tags as any-of, search over name, URL, category
  and tags; facet counts exclude their own group; `Uncategorised`; stale counts skip retired.
- `sort`: the source order (status, stale first, name), topic order, `sortQueue` by every column,
  both directions, ties by rank.
- `actions`: every status × stale type for `canActivate`, `canRetire`, `canResubscribe`; topic
  rules; applicable counts for a mixed selection including sources on other pages.
- `params`: parse and build round trip; unknown values dropped; facet and search changes drop
  `page`; `Clear all` keeps `tab` and `source`; page clamp; `?tab=validate` mapping; names with
  spaces, `&` and non-ASCII in `source`.
- `keys`: the row and global tables, guards (typing, overlay, modifiers), the `Esc` order, `a`/`r`
  as no-ops when the action does not apply or the vault is read-only, `r` choosing re-subscribe for
  delivery-gap.
- `registryEdit`: each action as a text transform against the existing fixtures; a batch of N
  writes once (spy on `writeFileSync`/`renameSync`); all-or-nothing on an unknown name or an
  inapplicable action; the temp file is renamed and never left behind on success; `EROFS` still
  maps to 409 through `writeErrorResponse`; duplicate-name warning from the parser.
- `patchRegistry` with `names[]`, and its existing body-not-status cases.

E2E. rss-manager has no e2e project today. Create `apps/rss-manager-e2e`, following
`personal-memories-e2e` (Astro dev server, synthetic data) and `personal-calibre-e2e` (projects,
axe helper):

- `package.json`: `projectType: application`, `implicitDependencies: ['rss-manager']`, the
  `@nx/playwright:playwright` `e2e` target as calibre, dev deps `@playwright/test`,
  `@axe-core/playwright`, `@types/node`.
- `fixtures/vault/`: made-up `RSS-Source-Registry.md` (about 70 sources, so three pages, across all
  sections, every stale type including an untyped legacy comment, an empty note, a no-RSS entry, a
  `website:` entry, names with `&` and spaces), `RSS-Topic-Registry.md` (about 12 topics, three
  statuses), and `reading-queue.json` built from `src/lib/fixtures/reading-queue.sample.json`. All
  feed URLs point at `http://127.0.0.1:3033/…`.
- `src/support/feed-server.ts`: started in `globalSetup`, serves `fixtures/feeds/*.xml` (valid RSS,
  valid Atom, HTML, 404, slow), so Validate never reaches the internet.
- `src/support/vault.ts`: `resetVault()` copies the fixtures to `test-output/vault` before each test
  (the server reads per request, so no restart); `readVault(file)` for assertions on the written
  markdown; `makeReadOnly()` (`chmod a-w`, which `isWritable` and the write's `EACCES` both see);
  `removeFile(file)` for error states.
- `playwright.config.ts`: `astro dev --host 127.0.0.1 --port 3032 --ignore-lock` with `VAULT_PATH`
  set to the copy, `workers: 1` (tests write files), projects `chromium` and `phone` (390×844,
  `*.phone.spec.ts`), as calibre.

Specs:

- `shell.spec.ts`: tabs and counts, `?tab=` round trip, `1` to `3`, `?tab=validate` opens the popover.
- `filters.spec.ts`: facets, counts, chips, `Clear all`, search; reload and Back restore the state.
- `pages.spec.ts`: 30 rows a page, pager, `←`/`→` and `[`/`]`, page clamp, filters drop `page`.
- `detail.spec.ts`: click and `Enter` open the pane; `?source=` survives reload; Back closes it;
  `Esc` closes it and focus returns to the row; stale Alert copy per type; copy feed URL.
- `bulk.spec.ts`: select mode, header checkbox, selection across pages, applicable counts,
  `Activate N` and `Retire N` write the file once with every entry moved (asserted on the
  markdown), Spinner while pending (delayed route), selection cleared, toast; a rejected batch
  leaves the file untouched and keeps the selection.
- `keyboard.spec.ts`: one `tabindex="0"` row; arrows, `Home`/`End`; `x`/`Space`; `a`; `r` retires;
  `/`; `Esc` order.
- `resubscribe.spec.ts`: the button and `r` each open the Readwise page (`context.waitForEvent
('page')`) and put the feed URL on the clipboard (granted permission); the file is unchanged;
  `Re-subscribed in this session` shows.
- `validate.spec.ts`: popover and pane checks against the feed server: RSS, Atom, HTML, 404,
  invalid URL.
- `readonly.spec.ts`: banner; Activate, Retire, Decline disabled with the note; `a`/`r` do nothing;
  Re-subscribe and Validate work (per the proposal); a write that hits `EACCES` flips the UI.
- `topics.spec.ts`: status ToggleGroup, search, bulk Activate and Decline, file assertions.
- `queue.spec.ts`: every sortable column and `aria-sort`; tier filter; stale panel; missing
  `reading-queue.json` shows the empty state.
- `states.spec.ts`: a removed registry file shows the Alert; restoring it and Retry recovers; one
  failing file leaves the other tabs working.
- `desk.phone.spec.ts`: list rows, filter Sheet, detail Sheet, select mode and floating bulk bar, no
  key hints, no horizontal page scroll at 390px.
- `a11y.spec.ts` and `a11y.phone.spec.ts`: axe (wcag2a/aa, wcag21aa, best-practice), 0 violations
  per tab, with the pane open, in select mode, with the popover and with each Sheet open.

Visual evidence for every UI PR: before and after captures at 1440 and 390, light and dark, from
the e2e fixture vault only (the real vault is private), including the pane, select mode with a
pending write, read-only and an error state. Per the repo's create-pr flow, attached to the PR, not
committed.

## Risks

- Stale data quality (review.md). The desk's Stale facet, the pane's advice and `r`'s choice depend
  on `stale.type` and `stale.note`. Untyped legacy comments become `unspecified` with no fix line.
  Measure the share of `unspecified` and empty notes in the real vault before step 5; if it is
  high, the Stale facet is mostly one bucket.
- No undo for `a`/`r` and bulk writes. Mitigated by the pending state and a toast naming what
  changed; re-activating a mistakenly retired proposal puts it in Active, not Proposed.
- External writers. rss-discover and iCloud also write these files. The batch endpoint and atomic
  rename shrink the window but do not close it: a write still replaces whatever the file held at
  read time. A version check (send the file's mtime from GET, reject on mismatch) would close it;
  out of scope unless conflicts are seen.
- Name as identity. A rename in the vault breaks `?source=` links and a pending selection. Duplicate
  names make the server act on the first match; the parser warning makes that visible.
- Re-subscribe expectations (review.md). The flag stays until rss-discover runs again, which can
  read as "the button did nothing". The session note is the mitigation.
- Popup and clipboard. `window.open` after an `await` is blocked; the clipboard write can fail when
  the new tab takes focus first. The order in the Re-subscribe section avoids both, and e2e checks
  both.
- Phone. Filter Sheet over list, then detail Sheet, is many taps for the weekly pass (review.md).
  Accepted; the desk is a desktop tool first.
- Data the prototype assumed. Activity, Added and Volume, and the validator's last-post date, do not
  exist; the design drops them rather than inventing them.
- Vitest 3 in the app vs 4 at the root. Tests stick to common APIs; a later chore aligns them.

## Out of scope

- Direction B (Triage inbox, Health groups) and the B-as-home combination.
- Writing stale comments from the app, including on Re-subscribe (see open questions).
- Undo, delayed writes, and a file version check.
- New registry fields (added date, last item, items per week) and the rss-discover changes they
  would need.
- Editing a source (name, URL, tags, category) or adding one from the Validate popover.
- Column sorting on Sources; paging on Topics; roving rows on Topics and Queue.
- A scheme toggle.
- Extracting a React roving hook into the library (see Keyboard).
- Writing to Readwise, and the Queue's stale actions.

## Phased rollout

One PR per step, each green on CI before the next. Steps 1 to 3 change no visible UI.

1. Server: `registryEdit.ts` pure transforms, `PATCH` accepting `names[]` with all-or-nothing
   checks and the status rules, atomic temp-and-rename write, re-parsed list in the response,
   duplicate-name warning; `patchRegistry` with `names[]`; unit tests.
2. Library (separate PR, only if the owner accepts it): `Progress` in `rainforest-react` from the
   base-nova registry, stories with `Dark`, `.design-sync` skip, contract test.
3. E2E scaffold: `apps/rss-manager-e2e`, fixture vault, feed server, vault helpers, and specs for
   the batch API and read-only flip against the current UI.
4. Shell: `RegistryDesk` island, Astro page parsing params and reading the files, `params.ts` and
   history handling, header with tabs and counts, Validate popover (removes the Validate tab),
   `Toaster`, `LoadError`, Skeletons, read-only banner; unit tests for `params`.
5. Sources: filter panel, chips, search, table with the order and compact columns, pager, detail
   pane with stale Alert and feed check; `filters`, `sort` unit tests; e2e `filters`, `pages`,
   `detail`.
6. Selection and writes: select mode, bulk toolbar with applicable counts, row and pane actions on
   the batch endpoint, pending state, toasts, stale display rules, Re-subscribe link and session
   note; `actions` unit tests; e2e `bulk`, `resubscribe`, `readonly`.
7. Keyboard: `useRovingRows` on `createRovingController`, `useDeskShortcuts` on
   `listenForShortcuts`, `resolveDeskKey`, `KeyHints`; unit and e2e `keyboard`.
8. Topics: table, ToggleGroup, search, select mode and bulk; e2e `topics`.
9. Queue: sortable table with `aria-sort`, Wiki column, tier filter, Progress (or text), stale panel;
   `sortQueue(items, key, dir)` tests; e2e `queue`.
10. Phone: list rows, filter Sheet, detail Sheet, floating bulk bar, phone Topics and Queue; e2e
    phone project.
11. Cleanup: remove the four old islands and the single-`name` PATCH form, axe specs, `states` spec,
    captures in light and dark at 1440 and 390.

Steps 5 to 7 can merge as one PR if they land close together; each is still a reviewable commit.

## Open questions

1. Read-only: keep Re-subscribe and Validate enabled, since neither writes the vault (today's
   behaviour for both), rather than disabling all five as the prototype does?
2. Should Re-subscribe annotate the stale comment (for example
   `<!-- stale: delivery-gap | re-subscribed 2026-10-03 -->`) so the flag reflects it before
   rss-discover runs again? That makes Re-subscribe a vault write and read-only-gated.
3. Action rules: allow Activate on retired sources and declined topics, and Retire on proposed and
   no-RSS sources, as the prototype does? Today only proposed → Activate and active → Retire exist.
4. Add `Progress` to `rainforest-react` for the Queue's progress column, or keep today's `40% read`
   text?
5. Server-render the three files into the page (no first-load Skeleton) instead of fetching them
   after hydration?
