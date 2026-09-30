# Memories v2c: direction C on the live app

Date: 2026-09-26. Status: approved by the owner as direction C; this spec maps it onto v2b.

v2c is a presentation change. The owner compared three directions in the Claude Design prototype
(project `4c25a390-c3db-43c1-af89-b0504a180625`, folder `explorations/memories-redesign/`, entry
`Memories Redesign.html`, `review.md` section "C · the combination to build (v2c)") and chose C. C
takes B's transcript for the day stream and A for everything else. The prototype is React 18 with
inline styles and fixture data; the app keeps its semantic tokens, Tailwind utilities and the
`@rainforest-dev/rainforest-react` components it already uses.

Sources, in order: `review.md` section C, then the prototype files (`app.jsx` `part()`: `stream`
is B, `notes`, `year`, `month` and the bar are A), then the live v2b code and
[the v2b plan](../plans/2026-09-25-memories-v2b.md).

## The six decisions (from review.md, section C)

1. Day stream is B's transcript: a time column, an author column, and one continuous 3px
   `chart-*` rule per speaker run. The notes panel is A's diary page: `card` surface, a big
   `text-title` date, ruled memory lines, 眉批 as quoted margin notes. Year and month keep A:
   month rows with totals, and a calendar with full-bleed covers.
2. Author colour is fixed per person. The owner gets `chart-2`, the first other person `chart-4`,
   and later people `chart-1`, `chart-3`, `chart-5` in order of first appearance. Every run still
   shows the initial chip and the name, so colour is never the only cue.
3. No owner indent. The author column and the rule carry authorship.
4. 眉批 show inline under their message in the stream (first two lines and the author) and in
   full in the notes panel as margin notes. The brief's small cards are dropped.
5. New copy. C uses 鍵盤快速鍵, the group names 全部畫面 / 年 / 日 / 照片, 縮小一層 and 寫回憶.
   v2c adopts them (see Copy).
6. The invited viewer sees the same view as the owner. Read-only gating stays out of scope.

Also from `review.md`: the 眉批 button sits inside the row's 72px right gutter; the date-jump
input has `inputMode="numeric"`, `autoComplete="off"`, `spellCheck={false}`; message rows need an
accessible name; follow-on times show on hover and on focus or tap; the day preview keeps CSS
anchor positioning; empty, loading and error states follow v2b.

## Surface mapping

| C surface (prototype)                               | App component                                                                                         |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `mmAccent`, `PEOPLE[].accent` (`ui.jsx`, `data.js`) | `authorAccents(events, owners)` in `src/lib/stream.ts`; classes in `src/components/accent-classes.ts` |
| `Avatar`                                            | the initial chip in `DaySection.astro` (`bg-chart-N/20`, inset `chart-N` ring)                        |
| `AuthorKey` in the day header                       | a key of that day's authors in the `DaySection.astro` sticky header                                   |
| `TextRunB` (`day.jsx`)                              | text runs in `DaySection.astro`                                                                       |
| `PhotoRun` dir B, hero grid                         | photo runs in `DaySection.astro`, tile layout from `burstLayout(count)` in `src/lib/stream.ts`        |
| inline 眉批 under a row (`TextRunB` `note`)         | `[data-note]` in each row, server-rendered, repainted by `useStreamBridge.ts` via `paintNotes`        |
| `AnnotateButton` in the right gutter                | the existing `[data-annotate]` pill, moved to `right-1 top-1` inside `sm:pr-18`                       |
| `HourStrip`                                         | unchanged                                                                                             |
| `NotesPanel` dir A, `DiaryHeadA`, `MarginNotesA`    | `NotesSurface.tsx`, new `DiaryDate.tsx`, `AnnotationItem.tsx`                                         |
| `NotesSheet` dir A                                  | the `Sheet` branch of `NotesSurface.tsx`                                                              |
| `.mm-ruled`                                         | `[data-ruled]` in `global.css`                                                                        |
| `YearRowsA`, `YearRowsPhone`                        | `Heatmap.astro`, with `MonthRow.total` from `monthRows`                                               |
| `MonthGridA`                                        | `MonthCalendar.astro` and `MonthCellBody.astro`                                                       |
| `DayPreview` (JS positioned)                        | stays `year/DayPreview.astro` with anchor positioning                                                 |
| `DateJump` input props                              | `chrome/DateJump.tsx` `CommandInput`                                                                  |

Details that follow from the mapping:

- Rows: grid `40px 1fr` on phone, `48px 84px 1fr` from `sm`. The author column shows on the first
  row of a run only; on phone the chip, name and source sit inline above the first message. The
  source label shows under the name on desktop only for Slack, as in the prototype. The rule is
  `border-l-3` on a cell that stretches to the row height, so it stays unbroken through a run.
- Accessible row name: `{author}，{HH:MM}：{excerpt}`, from the existing `data-excerpt`.
- Bursts: five tiles shown; with three or more photos the first spans 2 × 2; with one or two each
  spans 2 × 2. The fifth tile carries `+N` (N = count − 4) when there are more than five.
- Inline 眉批: server-rendered from the note on disk for every day in the stream, so days loaded by
  scrolling show theirs; the panel repaints only its own day as the draft changes. An empty body
  shows 眉批; an unattached annotation shows nothing inline.
- Notes panel: a small 這一天的回憶 label and the status badge, then `{M} 月 {D} 日` in
  `text-title` with `週{W} · {YYYY}` beside it. The memory textarea has 28px ruled lines. Each 眉批
  is a quote block (time · source · author, then the excerpt) with a 3px rule in the message
  author's accent, `muted-foreground` for photos and unknown authors, dashed when unattached.
- Year: each month row ends in `{N} 則`; the phone row ends in the bare number and its link is
  named `{YYYY} 年 {M} 月，{N} 則`.
- Month: a cell with a cover shows it edge to edge, with the day number on a `bg-background/90`
  chip and the count badge on top; cells are 116px (`h-29`).

## What stays

Every v2b behaviour: the note draft, autosave, conflicts, 眉批 authors (`by:`), hydration
locking, the lightbox and 設為封面, zoom transitions, the scrubber, date jump, shortcuts, the hour
strip, long-press and pinch, windowing, the source filter, the anchored heat-cell preview, and the
DOM contract listed in the v2b plan. Sizes that stay: the day grid `56px 1fr 400px`, the 156px
sheet peek, the heatmap's `bg-primary/20 /40 /65 /90` steps. The panel keeps its `h2` 這一天的回憶
and the `aside` named 筆記; the sheet keeps its `SheetTitle`.

## Out of scope

- Read-only gating for the invited viewer.
- `toHaveScreenshot` baselines: e2e does not run in CI, and macOS captures would not match Linux.
  v2c keeps per-task captures for comparison with the prototype instead.
- B's year wall and month index, B's sidebar notebook, A's letter bubbles.
- Any change to the note file format, actions, the timeline data or the ingest CLI.

## Copy

v2c adopts C's copy (owner approved direction C, 2026-09-26):

- 全部畫面: title of the first shortcut group
- 看所有快速鍵: the `?` row (was 鍵盤快速鍵)
- 寫回憶: the `n` row (was 這一天的回憶)
- 已有眉批: accessible name of the inline 眉批 mark
- 還有 N 張照片: accessible name of the `+N` burst tile
- 作者: aria-label of the day header's author key

New formats built from existing words, used as screen-reader names or date layout:
`{author}，{HH:MM}：{excerpt}` (row name), `{YYYY} 年 {M} 月，{N} 則` (phone month row),
`{M} 月 {D} 日` and `週{W} · {YYYY}` (panel date).

## Acceptance criteria

1. With `MEMORIES_OWNER=Bob` on the e2e fixture, Bob's rows carry `data-accent="2"`, `Alice 🌷`'s
   `1` and plain `Alice`'s `4`, the same on every day.
2. Every row body in a run has a 3px left rule in its author's `chart-*` colour with no gap
   between rows; owner and other rows start at the same x.
3. The author column appears on a run's first row only at 1280; at 390 the author sits inline
   above the first message and no page scrolls sideways.
4. A follow-on time and the 眉批 button are transparent until the row is hovered or focused.
5. Every message row has an accessible name `{author}，{HH:MM}：{excerpt}`.
6. A seven-photo burst shows five tiles, the first 2 × 2, and `+3` on the fifth, which opens the
   lightbox at 5 / 7.
7. A 眉批 shows under its message with the author, clamped to two lines, on the panel's day and on
   days loaded by scrolling.
8. The panel shows the big date and ruled lines; each 眉批 quote's rule matches the stream rule of
   the message it annotates. Save, conflict, author and hydration tests from v2b pass unchanged
   apart from the panel date text.
9. Year rows end in the month total; a month cell's cover fills the cell.
10. The date-jump input has `inputmode="numeric"`, `autocomplete="off"`, `spellcheck="false"`.
11. Captures of the app at 1280 and 390, light and dark, match the prototype's C at the same
    view, apart from fixture data and differences listed in the PR.
12. `pnpm nx run-many -t lint test typecheck -p personal-memories personal-memories-e2e` and
    `pnpm nx e2e personal-memories-e2e` pass.
