# reading-room

The library's reading room on `library.rainforest.tools`, renamed from rss-manager. It owns two
mounts and no Astro `base`, so every page and API route sits under one of them, and its bundles
are built to `/rack/_astro`:

| Path            | What it is                                                                    |
| --------------- | ----------------------------------------------------------------------------- |
| `/rack`         | The rack: the reading queue as shelves of cards, one shelf per tier           |
| `/rack/sources` | The registry desk below, for the weekly pass over the RSS registry            |
| `/rack/api/*`   | The desk's API, and `hall-items`, the rack's shelf for the 3D hall            |
| `/kb`           | Reserved for the knowledge base; a placeholder until it opens                 |
| `/`             | Old hostname only: redirects to `/rack`, or to `/rack/sources` with its query |

Every page renders the library shell from `@rainforest-dev/library-shell`: the shared top bar
with the `view-transition-name` that holds it still across apps, `/_shell` fonts (synced into
`public/` by the `shell-assets` target), Speculation Rules and the tab's return point. The links
to the other collections render only on the library hostname, or with `LIBRARY_NAV=on`, because
the old `rss.rainforest.tools` serves this app alone.

It reads three files from `VAULT_PATH` (default `/vault`), the vault's `_system` folder:

- `RSS-Source-Registry.md` and `RSS-Topic-Registry.md`, which the desk can edit;
- `reading-queue.json`, written by the `reading-queue` skill and only read here.

The pages read the files on the server, so the first paint has real rows. A file that fails to
load shows an Alert with Retry on its own tab and leaves the other tabs working.

```bash
VAULT_PATH=/path/to/_system LIBRARY_NAV=on pnpm nx dev @rainforest-monorepo/reading-room  # port 3002
pnpm nx e2e reading-room-e2e  # against a generated fictional vault and a local feed server
```

## Hall items

`GET /rack/api/hall-items` answers `{ items: HallItem[] }` from `@rainforest-dev/library-contract`:
one `article` per queued document, coloured by tier, grouped by `tier:`, `decay:`, `site:` and
`tag:`, and linked to its card at `/rack#article-<id>`. Before the queue is generated it is empty.

## Registry desk

The desk at `/rack/sources` is for the weekly pass over the RSS registry: find the proposed and
stale sources, act on many at once, and look at one closely without leaving the list. The
sections below describe it.

### Tabs

The desk's row under the shell bar shows the tabs and the file behind the active one. `Validate URL` opens a popover
that fetches a feed and reports its format, title and item count; it writes nothing.

- Sources: a filter panel (status, stale type, category, tags; OR within a group, AND across
  groups), search over name, feed URL, category and tags, 30 rows a page, and a detail pane with
  the stale advice, the feed check and the actions.
- Topics: search and a status filter, no paging.
- Queue: the reading queue as a table sortable by every column, a tier filter, and the stale
  items grouped by reason. Read-only.

Below 1024px the desk switches to a phone layout: list rows, filters and details in bottom
Sheets, and a floating bulk bar.

### URL

The URL holds what is shown, so reload and Back restore it. Each tab writes only its own params.

| Param                        | Tab     | Values                                        |
| ---------------------------- | ------- | --------------------------------------------- |
| `tab`                        | all     | `topics`, `queue`; absent is Sources          |
| `q`                          | Sources | search text                                   |
| `status` `stale` `cat` `tag` | Sources | comma-separated values                        |
| `page`                       | Sources | 2, 3, …                                       |
| `source`                     | Sources | a source name; opens the detail pane          |
| `tq` `tstatus`               | Topics  | search text; `proposed`, `active`, `declined` |
| `tier` `sort` `dir`          | Queue   | `1` to `4`; a column key; `asc`, `desc`       |

`?tab=validate`, from before the popover, opens Sources with the popover open.

### Keys

Desktop only; the hints row at the bottom of each tab lists them.

- Anywhere: `/` search, `1` `2` `3` switch tab, `[` `]` previous and next page on Sources, `Esc` close
  the pane, then clear the selection, then leave select mode.
- On a row: `↑` `↓` `Home` `End` move, `Enter` open (the pane, or the item in Reader on Queue),
  `x` or `Space` select.
- Sources rows: `←` `→` page, `a` activate, `r` re-subscribe a delivery-gap source, else
  retire.
- Topics rows: `a` activate, `d` decline.

`a`, `r` and `d` write at once. There is no undo.

### Writes

`Select` turns on a checkbox column; the bulk toolbar counts only the selected entries each action
applies to. Every write, from a row, the pane or the toolbar, is one request:

```http
PATCH /rack/api/sources   {"names": ["…"], "action": "activate" | "retire"}
PATCH /rack/api/topics    {"names": ["…"], "action": "activate" | "decline"}
```

The server reads the file once, applies every move, and replaces the file through a temp file
and a rename. It is all or nothing: if any name is missing or the action does not apply to it,
the answer is 409 with `rejected: [{ name, reason }]` and the file is untouched. Success returns
the list re-parsed from what was written, which the desk shows as is. A request without a
non-empty `names` array, or with an unknown action, is a 400.

Re-subscribe writes nothing: it opens Readwise's feed subscriptions page and copies the feed URL.
The stale flag stays until rss-discover rewrites the comment.

### Read-only vault

When a registry file is not writable (the GET's `writable`, or a write failing with `EROFS`,
`EACCES` or `EPERM`, which the server answers with 409 `writable: false`), that tab shows a
`Read-only vault` banner and turns off Activate, Retire and Decline and their keys. Search,
filters, select mode, Validate and Re-subscribe keep working.
