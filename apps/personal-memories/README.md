# personal-memories

A local-only album that merges LINE chats, Slack DMs and the Photos library into one timeline.
It runs on localhost (port 3004) and is never deployed. This slice is the data layer: three
parsers, one `TimelineEvent` shape (`src/lib/timeline.ts`) and one CLI.

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
a download. No API can list Google Photos since 2025. Ting's photos therefore arrive only
through the shared iCloud/Photos album.
