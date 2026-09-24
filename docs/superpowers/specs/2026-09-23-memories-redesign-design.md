# personal-memories redesign — Design

**Date:** 2026-09-23
**Status:** draft, awaiting review
**Scope:** `apps/personal-memories` — a zoomable timeline, a continuous day stream, and notes
written beside it that live in the Obsidian vault. Ships in two releases; v1 is functional on
the current styling while the visual design is done in Claude Design in parallel
([brief](2026-09-23-memories-claude-design-brief.md)).

---

## Problem

The album can only be read. `/` lists ISO weeks and `/week/<YYYY-Www>` shows one week at a time.
There is nowhere to write down what a day or a message brings back, and a week page is the wrong
unit for both finding a day and reading across days.

The data shapes the design. The timeline holds on the order of 10⁴ events over ~18 months across
400+ days; the median day has about a dozen events, but the busiest days have several hundred.
Over half the events are LINE text and over a third are photos.

## Decisions

| Question            | Decision                                                                    |
| ------------------- | --------------------------------------------------------------------------- |
| Unit of a note      | A day note, plus annotations anchored to single events                      |
| Where notes live    | Obsidian vault, one file per day in a dedicated folder — not the daily note |
| Devices             | Desktop and phone both first-class: side panel / bottom sheet               |
| Navigation          | Semantic zoom: year (heatmap) → month (calendar) → day (stream)             |
| Annotations UI      | A list in the side panel, linked to messages both ways                      |
| Tone                | A quiet diary: quote-style messages, photo grids, focus on writing          |
| Rendering           | SSR stream + one React island (the note panel) + a small vanilla script     |
| Cover photo per day | Automatic from Photos metadata, overridable, override stored in the note    |

### Why a dedicated folder rather than the daily note

Daily notes mean "written that day" (a few hundred, sparse). Writing reflections into them would
backfill hundreds of retroactive daily notes and mix the two meanings. A daily note is also
hand-edited and passes through Templater and Linter, which makes patching a section fragile. A
separate file whose format the app owns is safe to round-trip; a `daily:` link in frontmatter
still surfaces the memory in the daily note's backlinks when one exists.

### Why SSR and not a client-rendered timeline

Only the note panel holds real state (autosave, conflicts, annotation edits). Everything else is
achievable with the platform: partial HTML for continuous scroll, anchors and `:target` for
message ↔ annotation linking, `<dialog>` with invoker commands for the lightbox, cross-document
view transitions for zoom. Keeping the stream as HTML also keeps Cmd+F, `#ev-…` deep links and
scroll restoration working, which item-level virtualisation would break.

## Architecture

```
/                     year heatmap            .astro, zero JS
/month/[YYYY-MM]      month calendar          .astro, zero JS                (v2)
/day/[YYYY-MM-DD]     day stream              .astro SSR
  ├─ day-stream.ts    partial loading, day windowing, URL sync, shortcuts  (vanilla)
  └─ <NotePanel client:load />                                              (React)
/day/[date]/partial   one day's stream HTML   `export const partial = true`
/week/[isoWeek]       301 → /day/<Monday of that week, or first day with events>

read:   src/live.config.ts → live collections `days`, `memoryNotes`
write:  src/actions/index.ts → Astro Actions → NotesStore
```

### Units

- **`store.ts` → `days` live loader.** Wraps the existing `getTimeline()`; `loadEntry({ date })`
  returns that day's events, `loadCollection()` returns per-day summaries (counts, has-note,
  cover) for the heatmap and calendar.
- **`NotesStore`** (`src/lib/notes/store.ts`). The only code that touches note files.
  `read(date) → { note, version } | undefined`, `write(date, note, version) → version | Conflict`.
  Pure `parseNote` / `serializeNote` live beside it and are unit-tested without the filesystem.
- **`memoryNotes` live loader.** `NotesStore.read` behind the live collection API.
- **Actions.** `saveNote({ date, body, annotations, cover, version })`, validated with `astro/zod`.
  Returns `{ ok: true, version }` or `{ ok: false, current }` with the file's content.
- **`day-stream.ts`.** Appends or prepends a day's partial when a sentinel intersects, keeps at
  most ~7 days either side of the viewport (farther days collapse to a placeholder of their
  measured height and are re-fetched on return), `history.replaceState` to the day in view, and
  keyboard shortcuts (`j`/`k` day, `n` focus note, `/` jump to date).
- **`NotePanel`.** Day note editor (plain Markdown `<textarea>`), annotation list, save status.
  Desktop: fixed right column. Phone: bottom sheet.

### Stream ↔ panel contract

Exactly two `CustomEvent`s on `document`:

- `memories:day` `{ date }` — `day-stream.ts` emits it when a different day becomes the one in
  view. The panel flushes any pending save, then loads that day.
- `memories:annotate` `{ eventId, at, source, author, excerpt }` — the 「眉批」 button on a message
  emits it. The panel adds an annotation and focuses it.

Linking back needs no events: an annotation renders `<a href="#ev-<id>">`, and `:target` styles
the message. A message with annotations renders a marker linking to `#note-ev-<id>`.

## Data model

### `TimelineEvent` (ingest output, always regenerable)

```ts
type TimelineEvent = {
  id: string;
  source: 'line' | 'slack' | 'photo';
  at: string;
  author: string;
  text?: string;
  media?: { path: string; width?: number; height?: number }[];
  photo?: {
    favorite: boolean;
    score?: number; // osxphotos score.overall
    people: number; // persons.length
    screenshot: boolean;
    movie: boolean;
    burstPick: boolean; // not a burst, or the burst's selected frame
  };
};
```

Photo dimensions come from osxphotos `width`/`height`; Slack files from `original_w`/`original_h`
when present. Known dimensions let the stream reserve space, so windowing never shifts layout.

### Day note — `$MEMORIES_NOTES_DIR/YYYY/YYYY-MM-DD.md`

```md
---
date: 2025-11-01
daily: '[[daily-notes/2025-11-01]]'
cover: 6F1C2A…
tags: [memories]
---

Free Markdown body.

## 眉批

### 09:05 · LINE · Alice

> first 40 characters of the message…

%% ev:3fa9c1d2 at:2025-11-01T09:05:00+08:00 %%

The annotation, any number of paragraphs.
```

- Everything above `## 眉批` is the body, kept as an opaque string. Below it the app owns the
  structure: one `###` block per annotation, anchor data in an Obsidian comment. The comment
  must be separated from the excerpt by a blank line, or Markdown folds it into the quote.
- Frontmatter round-trips through the `yaml` package; keys the app does not know are preserved.
- A file is created on the first non-empty save and deleted only when body, annotations and
  `cover` are all empty.
- Other notes link to an annotation by heading (`[[2025-11-01#09:05 · LINE · Alice]]`).

### Re-attaching annotations

Event ids are hashes that include the message text and a `-2`/`-3` suffix for duplicates, so a
re-export can change them. On read, each annotation resolves in order:

1. an event with the same id on that day;
2. an event with the same `at`, source and author whose text starts with the excerpt — attached,
   and `ev` is rewritten on the next save;
3. otherwise **unattached**: listed first in the panel with its excerpt, re-attachable by clicking
   a message. Never deleted automatically.

### Cover photo

`scoreCover(photo)` ranks a day's photos: manual `cover` wins, then `favorite`, then the highest
`score` with a bonus for people and penalties for screenshots, movies and non-selected burst
frames. Computed at request time so weights can change without re-ingest. A day without photos
has no cover; the calendar cell shows the note's first line, else a message excerpt.

## Errors and edge cases

- **Conflict.** `version` is a content hash. A save against a stale version returns
  `CONFLICT` with the file's current content; the panel shows both and lets you keep either.
  Nothing is overwritten silently.
- **Notes dir not configured or not writable.** Reading works; the panel shows a read-only
  notice naming `MEMORIES_NOTES_DIR`. The stream is unaffected.
- **Save failure** (network, I/O). The panel keeps the text, shows 「未儲存」 and retries on the
  next edit or on `memories:day`; `beforeunload` warns while unsaved.
- **Missing `timeline.json`.** Unchanged: the existing `EmptyState`.
- **Unknown day or month.** 404 with a link to the nearest day that has events.

## Deployment

The container gains one read-write mount; the data directory and Photos library stay read-only.

- New env `MEMORIES_NOTES_DIR`, mounted read-write at the same path it has on the host.
- `rainforest-homelab` `modules/personal-memories`: a third `volumes` block with
  `read_only = false` and the env var. Separate PR in that repo.
- **Spike before building on it:** confirm a Docker Desktop container can create, rewrite and
  delete files under the iCloud-synced vault path, including when the folder's files are evicted
  by Optimize Mac Storage, and that Obsidian picks up the change. If it cannot, `NotesStore`
  switches to the Obsidian Local REST API; nothing above it changes.

The README's "the container only ever reads" becomes "reads everything except the notes folder".

## Browser support

Personal use only: current Safari (macOS, iOS) and Chrome. No polyfills. `<dialog closedby>` is
not in Safari, so the lightbox gets a few lines of light-dismiss fallback.

## Releases

**v1 — usable and deployed, current styling**

1. Ingest keeps photo dimensions and the `photo` signals.
2. `NotesStore`, `parseNote`/`serializeNote`, `saveNote` action, `memoryNotes` live collection.
3. `/day/[date]` SSR stream with continuous scroll, URL sync and the 「眉批」 button; `/week/*`
   redirects.
4. `NotePanel`: day note, annotations, autosave, conflict handling; side panel and bottom sheet.
5. `/` heatmap with has-note markers.
6. Spike, then the homelab mount and README update.

Known v1 limit: without windowing and thumbnails, scrolling across many photo-heavy days loads
full-size originals and grows the DOM. Jumping is by heatmap, so this is acceptable until v2.

**v2 — with the Claude Design visuals**

Thumbnails (WebP, HEIC converted, cached in a writable cache dir), day windowing, `/month`
calendar with covers, zoom view transitions and pinch/`-`/`=` gestures, lightbox with
「設為封面」, keyboard shortcuts, and the visual design applied across all three levels.

## Testing

- Unit (Vitest): `parseNote`/`serializeNote` round-trip incl. unknown frontmatter and
  hand-edited bodies; annotation re-attachment for each of the three outcomes; `scoreCover`;
  ingest of the new photo fields; conflict detection in `NotesStore` against a temp dir.
- E2E (`personal-memories-e2e`, fixture data dir + temp notes dir): write a day note and an
  annotation, reload, see both; edit the file on disk mid-session and get the conflict UI;
  continuous scroll updates the URL; `/week/…` redirects.
- Manual, per the repo rule for Astro: load pages from a running `pnpm nx dev personal-memories`,
  not only the build.
