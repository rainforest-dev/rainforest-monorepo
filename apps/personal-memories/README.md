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
  line/*.txt           LINE chat exports
  slack/               Slack export root (users.json, <channel>/<YYYY-MM-DD>.json)
  photos/index.json    osxphotos metadata
  timeline.json        written by the CLI
```

When a source directory is missing, the CLI prints a notice and moves on to the next source.

```bash
MEMORIES_DATA_DIR="$HOME/.local/share/memories" pnpm nx run personal-memories:ingest
```

## Exporting the sources

**LINE.** In the chat's settings, choose 匯出聊天記錄 (Export chat history) and save the `.txt`
into `line/`. The parser reads the English-locale format (`[LINE] Chat history with
…`, date headers like `Sat, 11/01/2025`, and `9:30AM<TAB>author<TAB>text` lines). The real
export uses that format; the zh-TW one is not supported. Stickers, photos and other media appear only
as placeholders such as `[Photo]`.

**Slack.** A workspace export (Workspace settings → Import/Export data) produces the
`users.json` + `<channel>/<date>.json` layout. Exporting DMs requires a workspace admin or a paid
plan. So in practice the source may be a manual copy arranged into that same layout. File bytes
are usually missing from an export. A message that shares a file keeps its text, and media is
attached only when the named file exists under the export root.

**Photos.** Photos are read in place from the Mac's Photos library. Nothing is copied. Export
the metadata with
`uvx osxphotos query --json --library "$HOME/Pictures/Photos Library.photoslibrary" --from-date <date> > photos/index.json`.
The `--library` flag is required: without it, osxphotos tries to read a Photos preferences file
that the terminal is not permitted to open. The index points at originals, edits, or (with
Optimize Mac Storage, where originals are cloud-only) local derivatives. The CLI never triggers
a download. No API can list Google Photos since 2025. Photos from someone else's phone therefore arrive only
through the shared iCloud/Photos album.

## Browsing

```bash
MEMORIES_DATA_DIR="$HOME/.local/share/memories" pnpm nx dev personal-memories
```

- `/` is a heatmap of every day (Asia/Taipei) that has events, one cell per day, darker for more
  events; a ring marks days with a note.
- `/day/<YYYY-MM-DD>` shows that day's events in reading order, with photos inline, a LINE /
  Slack / 照片 filter remembered in `localStorage`, and infinite scroll to neighbouring days. The
  note panel sits alongside it on desktop and as a bottom sheet on phone.
- `/week/<YYYY-Www>` 301-redirects to `/day/<first day in that week with events>`, for links from
  before the heatmap replaced the weekly view.
- `/media/<event id>` streams an event's file. The path comes only from `timeline.json`; photos
  are read in place from the Photos library and Slack files from the export.
- `/thumb/<event id>?n=<index>&w=<240|480|960>` serves a cached WebP thumbnail from `MEMORIES_CACHE_DIR` (default: `memories-thumbs` under the OS temp dir).

Set `MEMORIES_OWNER` to a comma-separated list of author names (as they appear in the LINE or
Slack export) to indent that person's own messages in the day stream, the way a chat app sets
your own bubbles apart from the other side's.

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

## Deployment

The homelab runs `ghcr.io/rainforest-dev/personal-memories:latest`, published by
`.github/workflows/release-personal-memories.yml` on every push to `main` that touches this app.
The Terraform module lives in
[rainforest-dev/rainforest-homelab](https://github.com/rainforest-dev/rainforest-homelab)
(`modules/personal-memories`), and the hostname is gated by Cloudflare Access like the other
tools.

Three host paths are bind-mounted at the same absolute path they have on the host:

- the data directory (`MEMORIES_DATA_DIR`) — `timeline.json` plus the Slack export — **read-only**
- whatever holds the photos, usually the Photos library — **read-only**
- the notes directory (`MEMORIES_NOTES_DIR`) — **read-write**, so the note panel can save back
  into the vault

The same-path requirement is not cosmetic: `ingest` records photo paths exactly as osxphotos
reports them, and `/media/<id>` opens that path verbatim. A photo mounted somewhere else is a 404. Running the container needs Docker file sharing for those paths, and the Photos library
also needs Full Disk Access for Docker.

Re-run `ingest` on the host whenever you add sources; the server picks up the new
`timeline.json` on the next request, without a restart.
