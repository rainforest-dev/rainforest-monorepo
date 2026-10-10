# personal-memories

An album that merges LINE chats, Slack DMs and the Photos library into one timeline. The dev
server binds to 127.0.0.1 (port 3004); the homelab runs the published image behind the
Cloudflare Access gate (see [Deployment](#deployment)). Either way the data stays on the host:
nothing private is in this repository, and the container reads everything except the notes
folder, which is mounted read-write at the same path (see [Notes](#notes)).

## Data directory

The CLI reads its input from `MEMORIES_DATA_DIR`. There is no default, and the command exits
with status 2 if the variable is unset. **The data directory must live outside this
repository**, because the repository is public and the data is private conversation. The
expected layout:

```text
$MEMORIES_DATA_DIR/
  line/<chat>/<saved-on>-<hash8>.txt   LINE chat exports, every export of one chat in its folder
  line/manifest.json   archived exports by SHA-256: chat, header name, saved-on, date range
  slack/               Slack export root (users.json, <channel>/<YYYY-MM-DD>.json)
  photos/index.json    osxphotos metadata
  timeline.json        written by the CLI
  .ingest.lock         held while an ingest runs
  .ingest-state.json   fingerprint of the inputs at the last complete ingest
  auto-import/state.json   the last auto-import run (see Auto-import)
```

When a source directory is missing, the CLI prints a notice and moves on to the next source.

```bash
MEMORIES_DATA_DIR="$HOME/.local/share/memories" pnpm nx run personal-memories:ingest
# or, with flags:
MEMORIES_DATA_DIR=… node apps/personal-memories/src/cli/ingest.ts --add ~/Downloads/export.txt
```

- `--add <file>` archives a LINE export (repeatable), then ingests.
- `--dry-run` prints what would move, be archived or be rebuilt, and writes nothing.
- `--force` rebuilds even when no input changed.

Only one ingest runs at a time: it creates `.ingest.lock` holding its pid, and a second ingest exits
with status 75 and names the pid. A lock whose process has died is replaced. Ingest is skipped when
the path, size and mtime of every file under `line/` and `slack/`, plus `photos/index.json` and
`people.json`, match the last complete run. A run whose embeddings failed does not count as
complete, so the next one retries.

## Exporting the sources

**LINE.** In the chat's settings, choose 匯出聊天記錄 (Export chat history) and pass the `.txt`
to `ingest --add`. The parser reads the English-locale format (`[LINE] Chat history with
…`, date headers like `Sat, 11/01/2025`, and `9:30AM<TAB>author<TAB>text` lines). The real
export uses that format; the zh-TW one is not supported. Stickers, photos and other media appear only
as placeholders such as `[Photo]`.

`--add` rejects a file that is not `.txt`, lacks the English header or has no messages. A file
whose bytes are already archived is skipped. Otherwise the header name picks the chat: the one
archived chat with that name, or a new `chat-<hash8>` id when there is none. A name shared by
several chats is rejected as ambiguous. Within a chat, ingest orders exports by their `Saved on`
header (file mtime when it is missing). The newest export supplies every date from its first date
onward, and each older one only the dates before that, so an export cut short by a reinstall
cannot erase older history.

A `.txt` placed directly in `line/` still works, with its file name as the chat id. Each ingest
moves such a file into `line/<name>/` unless that folder exists, checks that every LINE event id
and chat is unchanged, and moves it back if not, so notes and annotations stay attached.

**Slack.** A workspace export (Workspace settings → Import/Export data) produces the
`users.json` + `<channel>/<date>.json` layout. Exporting DMs requires a workspace admin or a paid
plan. So in practice the source may be a manual copy arranged into that same layout. File bytes
are usually missing from an export. A message that shares a file keeps its text, and media is
attached only when the named file exists under the export root.

**Photos.** Photos are read in place from the Mac's Photos library. Nothing is copied. Export
the metadata with osxphotos 0.77.2 or later:

```bash
uvx osxphotos@0.77.2 query --json \
  --library "$HOME/Pictures/Photos Library.photoslibrary" \
  --from-date <the start date of the current export> \
  >| "$MEMORIES_DATA_DIR/photos/index.json.new" \
  && mv -f "$MEMORIES_DATA_DIR/photos/index.json.new" "$MEMORIES_DATA_DIR/photos/index.json"
```

The `--library` flag is required: without it, osxphotos tries to read a Photos preferences file
that the terminal is not permitted to open. Earlier osxphotos versions read the Photos search
index from `database/search/psi.sqlite`, which current Photos replaced with `leo.sqlite`, and
silently export empty labels; `ingest` warns when no photo has labels. The export goes to a new
file first and replaces `index.json` only when osxphotos succeeds, so a failed run keeps the
previous export. `>|` overwrites a leftover `.new` file even when the shell sets `noclobber`,
under which a plain `>` writes nothing. With Optimize Mac Storage an original
may live only in iCloud, so `ingest` never assumes it is on disk: it checks each candidate and
serves the largest local derivative (the JPEG Photos itself displays), falling back to a local
original or edit. A movie plays from its video only when the video is downloaded; otherwise it
shows as a still. Items with nothing local are skipped, and `ingest` prints how many came from
derivatives, from originals, and how many had nothing local. A file that disappears after
`ingest` (Photos can purge derivatives) shows as an empty tile instead of a broken image. The
CLI never triggers a download. No API can list Google Photos since 2025. Photos from someone else's phone therefore arrive only
through the shared iCloud/Photos album.

**Search index.** After writing `timeline.json`, `ingest` builds the content search index in
`search/`: `docs.json` lists each search document with a hash of its text, and
`vectors.text.bin` holds one `embeddinggemma` vector per document. Chats are cut into
conversations, and each photo becomes a document built from its Photos labels, text, venues,
place, people and albums. The embeddings come from Ollama at `MEMORIES_OLLAMA_URL`
(`http://localhost:11434` by default). Only new or changed documents are embedded again. When
Ollama cannot be reached, `ingest` keeps the previous index and says so; lexical search still
works without one.

## Auto-import

`src/cli/auto-import.ts` is the unattended version of the steps above. On the Mac mini a launchd
agent runs it nightly and whenever a file lands in the drop folder; the agent itself lives in
the homelab repo. One run holds `.ingest.lock` from start to finish and does this:

1. **LINE drop folder.** Every top-level file in `MEMORIES_DROP_DIR` is checked. An iCloud
   placeholder (a dataless file or a `.<name>.icloud` stub) gets `brctl download` and waits for
   the next run, and so does a file modified in the last 10 seconds. A file that is not `.txt`, or
   that `--add` would reject, moves to `rejected/` inside the drop folder with a
   `<name>.reason.txt` beside it. Everything else is archived as `--add` does it and then deleted
   from the drop folder. An export that is already archived is only deleted.
2. **Photos.** It runs the osxphotos command from [Exporting the sources](#exporting-the-sources)
   without a shell and streams it to `photos/index.json.new`. The new file replaces `index.json`
   only when osxphotos exits 0, the output is a JSON array, and it holds at least 90% as many
   items as the previous index. Otherwise the old index stays. While a full export takes at most
   15 minutes, every run exports from `MEMORIES_PHOTOS_FROM`. Once one takes longer, runs export
   the last 30 days instead and merge them into the index by uuid, until the last full export is
   7 days old and the next run does a full one again.
3. **Ingest**, exactly as `ingest` runs it, skipped when no input changed.
4. **State.** It writes `auto-import/state.json`, then posts one webhook per failure.

```bash
MEMORIES_DATA_DIR=… MEMORIES_PHOTOS_FROM=2019-01-01 \
  node apps/personal-memories/src/cli/auto-import.ts [--dry-run] [--only line|photos]
```

- `--dry-run` prints what would be archived, rejected, exported and rebuilt. It moves, writes and
  posts nothing, and takes no lock.
- `--only line` skips Photos; `--only photos` skips the drop folder. Ingest runs either way.

Environment:

- `MEMORIES_DATA_DIR`, required; the CLI exits 2 when it is unset.
- `MEMORIES_DROP_DIR`, by default `~/Library/Mobile Documents/com~apple~CloudDocs/Memories Inbox`.
- `MEMORIES_PHOTOS_LIBRARY`, by default `~/Pictures/Photos Library.photoslibrary`.
- `MEMORIES_PHOTOS_FROM`, the export's start date (`YYYY-MM-DD`). With it unset the Photos step
  fails.
- `MEMORIES_PHOTOS_CMD` replaces `uvx osxphotos@0.77.2` with one executable that takes the same
  arguments. Tests use it.
- `MEMORIES_IMPORT_WEBHOOK`. With it unset, failures are only logged.
- `MEMORIES_OLLAMA_URL`, by default `http://localhost:11434`.

The exit status is 0 when the run succeeded or another ingest held the lock (it logs `busy:` and
the next trigger retries), 1 when any step failed, and 2 for a usage error.

Each failure posts `{"event":"memories_import_failed","detail":"<step>: <reason>","ts":"<lastRunAt>"}`.
A detail carries counts, the first 8 hex digits of a file's SHA-256 and error class names. It
never carries a file name, chat name, message text or path. The log on stdout does name files.

`auto-import/state.json` is written through a temp file and a rename:

```json
{
  "lastRunAt": "2025-11-20T19:30:00.000Z",
  "lastSuccessAt": "2025-11-20T19:30:00.000Z",
  "ok": true,
  "fingerprint": "<sha256 of the ingest inputs after the run>",
  "photos": {
    "exportedAt": "2025-11-20T19:35:12.000Z",
    "count": 41234,
    "mode": "full",
    "fullExportedAt": "2025-11-20T19:35:12.000Z",
    "fullDurationMs": 312000
  },
  "line": { "archived": 1, "duplicates": 0, "rejected": 0, "pending": 0 },
  "failures": []
}
```

`lastSuccessAt` equals `lastRunAt` after a clean run and keeps its old value after a failed one.
The container reads this file for the MCP's `get_coverage`.

**launchd.** The agent runs `/opt/homebrew/bin/node
<runner>/apps/personal-memories/src/cli/auto-import.ts` with `EnvironmentVariables` for `PATH`
(including the directory of `uvx`, and `/usr/bin` for `stat` and `brctl`), `HOME`,
`MEMORIES_DATA_DIR`, `MEMORIES_DROP_DIR`, `MEMORIES_PHOTOS_LIBRARY`, `MEMORIES_PHOTOS_FROM`,
`MEMORIES_OLLAMA_URL` and `MEMORIES_IMPORT_WEBHOOK` (n8n's `/webhook/ha-events` URL). Node 24 or
later runs the file directly, so the runner checkout needs no `pnpm install`. Reading the Photos
library from launchd needs Full Disk Access for that `node` and for the uv-managed Python.

## Browsing

```bash
MEMORIES_DATA_DIR="$HOME/.local/share/memories" pnpm nx dev personal-memories
```

- `/` is a heatmap of every day (Asia/Taipei) that has events, one cell per day, darker for more
  events; a dot marks days with a note. Hovering or focusing a cell shows a preview — the cover
  photo where there is one, otherwise the note or an excerpt — anchored above the cell with CSS
  anchor positioning (`position-anchor`/`position-area`; Chrome/Edge 129+, Safari 26+, Firefox
  147+). Elsewhere it falls back to a fixed position, on a best-effort basis.
- `/month/<YYYY-MM>` is a calendar for that month, each day showing its cover photo where one
  exists. An out-of-range or unparsable month 404s to a page linking the nearest day with events.
- `/day/<YYYY-MM-DD>` shows that day's events in reading order, with photos inline, a LINE /
  Slack / 照片 filter remembered per browser in `localStorage`, and infinite scroll to neighbouring
  days. An unknown day 404s the same way, to a page linking the nearest day with events. The note
  panel sits alongside it on desktop and as a bottom sheet on phone, which peeks a preview and
  expands to full height by dragging or tapping.
- The app bar is sticky at every level, with 年/月/日 tabs, a date jump (`/` or the search icon),
  and, on `/day/<date>`, ‹ › buttons (`k`/`j`) to step to the neighbouring day.
- Zooming between year, month and day is a cross-document View Transition that morphs the clicked
  cell or tab into its destination; under `prefers-reduced-motion: reduce` it falls back to a
  plain cross-fade.
- A month scrubber runs down the day view on `lg` screens and wider, for jumping straight to a
  month.
- Clicking a photo opens the lightbox, where 設為封面 marks it as the day's cover — stored as the
  `cover:` key in that day's note (see [Notes](#notes)). Only photos qualify, not videos or Slack
  files. Without a manual pick, the app auto-selects a cover, favourites first and screenshots or
  burst also-rans last.
- `/week/<YYYY-Www>` 301-redirects to `/day/<first day in that week with events>`, for links from
  before the heatmap replaced the weekly view.
- `/media/<event id>` streams an event's file. The path comes only from `timeline.json`; photos
  are read in place from the Photos library and Slack files from the export.
- `/thumb/<event id>?n=<index>&w=<240|480|960>` serves a cached WebP thumbnail from
  `MEMORIES_CACHE_DIR`: a disk path; the default is under the OS temp dir inside the container,
  which lives on the container's writable layer; it grows with photos viewed and can be deleted
  any time.
- `/days.json` lists every day with events as `{ date, total }`; the date jump dialog reads it.
- `?` lists the keyboard shortcuts, which include stepping days, opening the date jump, and
  zooming out a level with `Escape`.
- Gestures: long-press a row for the 眉批 / 複製 menu, which also suppresses the row's native
  text-selection callout so the press doesn't fight the browser; pinching in zooms out one level
  (day → month → year) as long as the page itself isn't already browser-zoomed; the lightbox
  supports swiping between photos.
- A day whose content fails to load while scrolling shows an error placeholder and retries on the
  next scroll.

People are configured in `<MEMORIES_DATA_DIR>/people.json`. Each person has one display name,
the Cloudflare Access emails they sign in with, and the names they go by on each platform:

```json
{
  "owner": "bob",
  "people": [
    {
      "id": "bob",
      "name": "Bob",
      "emails": ["bob@example.com"],
      "aliases": { "line": ["Bobby"], "slack": ["bob.w"], "photo": ["Robert"] },
      "devices": ["iPhone 16 Pro"]
    },
    { "id": "alice", "name": "Alice", "emails": ["alice@example.com"] }
  ]
}
```

The day stream shows a configured person under their display name on every platform, with the
platform's own name in a tooltip, and every run names its platform (LINE, Slack); anyone not
listed keeps the name from the export. The `owner`
gets the owner's colour, `chart-2`. Everyone else gets a colour in order of their first message:
`chart-4` for the first, then `chart-1`, `chart-3` and `chart-5`, repeating those three. One
person keeps one colour across LINE and Slack. Each run also shows the author's initial and name,
so colour is never the only cue.

`devices` lists the EXIF camera models (osxphotos `exif_info.camera_model`, whitespace collapsed)
that belong to a person. A photo taken on one of them shows that person's initial on its tile and
their name in the lightbox, and MCP `get_day` returns it as `takenBy`. A photo with no EXIF, such
as one saved from LINE, or from an unlisted camera shows no photographer. A device claimed by two
people is an error. The camera model is read at ingest, so run `ingest --force` once after
upgrading.

The app re-reads the file when its mtime or size changes, checking at most every 5 seconds, so an
edit shows up without a restart. The file is validated on every read: an id, email or
same-platform alias claimed by two people, or an `owner` that is not in `people`, is an error.
An invalid edit is logged and ignored, and the app keeps the last valid copy until the file is
fixed; only an invalid file at startup fails the pages. Without the file, the app falls back
to the older variables: `MEMORIES_OWNER`, a comma-separated list of the owner's export names, and
`MEMORIES_AUTHORS` (see [Notes](#notes)).

Without a `timeline.json` the pages show how to run `ingest` instead of failing.

For a synthetic data directory built from the parser fixtures (used by
`pnpm nx e2e personal-memories-e2e`):

```bash
node apps/personal-memories/src/cli/fixture.ts /tmp/memories-fixture
```

## Notes

Set `MEMORIES_NOTES_DIR` to a writable directory to turn on the note panel on `/day/<date>`.
Without it, or if it isn't writable, the panel is read-only. Each day gets its own file:

```text
$MEMORIES_NOTES_DIR/
  YYYY/
    YYYY-MM-DD.md
```

The frontmatter and the body above `## 眉批` are yours to write in Obsidian; the app only touches
the `date`, `daily`, `tags` and `cover` frontmatter keys and the day-note body. Everything from
`## 眉批` down belongs to the app — one `### <time> · <source> · <author>` block per annotation,
with a quoted excerpt and an anchor comment linking it back to the source event — and may be
rewritten on the next save.

Saves are optimistic, keyed by a hash of the file's last-read content. If the file changed on
disk since the panel last read it — an edit made directly in Obsidian, say — the next save comes
back as a conflict: the panel shows both versions side by side and lets you keep either, so
nothing is overwritten silently.

Each annotation block can carry a `by:` field naming its author, one of the people in
`people.json`. Behind Cloudflare Access, the app trusts the `Cf-Access-Authenticated-User-Email`
header Access sets on every request and signs with the person whose `emails` contain it. With no
Access header, or an email nobody claims, the panel asks once which of the configured people is
writing and remembers the choice in that browser; the server rejects any other name. Without
`people.json`, the legacy `MEMORIES_AUTHORS` variable, a comma-separated `email=Name` list, plays
the same role:

```bash
MEMORIES_AUTHORS="alice@example.com=Alice,bob@example.com=Bob"
```

With neither configured, the panel falls back to a free-text name.

## Deployment

The homelab runs `ghcr.io/rainforest-dev/personal-memories:latest`, published by
`.github/workflows/release.yml` on every push to `main` that affects this app.
The Terraform module lives in
[rainforest-dev/rainforest-homelab](https://github.com/rainforest-dev/rainforest-homelab)
(`modules/personal-memories`), and the hostname is gated by Cloudflare Access like the other
tools. The Cloudflare Access application must be the only route to the container, which is why
the homelab binds the published port to 127.0.0.1: nothing else on the box can reach the
container directly to forge the identity header the app trusts (see [Notes](#notes)).

Three host paths are bind-mounted at the same absolute path they have on the host:

- the data directory (`MEMORIES_DATA_DIR`) — `timeline.json` plus the Slack export — **read-only**
- whatever holds the photos, usually the Photos library — **read-only**
- the notes directory (`MEMORIES_NOTES_DIR`) — **read-write**, so the note panel can save back
  into the vault

The same-path requirement is not cosmetic: `ingest` records photo paths exactly as osxphotos
reports them, and `/media/<id>` opens that path verbatim. A photo mounted somewhere else is a 404. Running the container needs Docker file sharing for those paths, and the Photos library
also needs Full Disk Access for Docker.

Re-run `ingest` on the host whenever you add sources. `ingest` replaces `timeline.json` through a
temp file and a rename, and the server notices the new mtime within 5 seconds, so the next page
load after that shows the new days without a restart. A `timeline.json` that fails to parse is
logged and ignored, and the server keeps serving the previous one. The search index follows the
timeline and `search/docs.json` the same way.
