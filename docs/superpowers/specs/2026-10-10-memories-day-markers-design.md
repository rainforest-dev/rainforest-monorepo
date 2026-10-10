# Memories day markers: leave and WFH

Date: 2026-10-10. Status: proposed. From the owner's note 「也可以看一下 where are you slack
channel，有時請病假或 WFH 會在那，尤其 3–5 月深度對談比較多的時候，隔天也有可能會說不舒服請假或
WFH」, with the owner's decisions of the same day. Builds on the auto-import and MCP work
(`2026-10-04-memories-auto-import-and-mcp-design.md`, done).

## Problem

A work Slack channel holds the owner's and the other person's attendance notes: leave, sick
leave and work-from-home. The owner wants to see those days next to the chats, to notice when
a night of long conversation is followed by a day off or at home. The channel export is a
one-off spreadsheet of about 110 messages; the other person has left the workspace, so the
history is static.

Two things block this today. The messages are not in the album at all. And a message is often
posted on one day about another: a 3/3 evening message says 「3/7 請假一天」, a message says
「明天 14 點要回診，回診完 WFH」, a message names a range such as 「6/2-6/5 休假」. Placing the raw message on
the day it was posted does not show which days were affected.

## Owner decisions (2026-10-10, final)

1. Markers are derived data on top of the existing Slack source, not a new timeline source.
2. The markers are prepared once, by an agent reading every message, and stored as a private
   file. There is no rule-based parser and no runtime model. The data is one-time.
3. Two kinds only: `wfh` and `leave`. Sick leave is `leave`; the reason stays in the source
   message. Arriving late, leaving early and short errands are not marked.
4. Replies by other people in the channel are left out.
5. Fixtures use the fictional people already in `src/cli/fixture.ts`. No real name or message
   enters the repository.

## Decisions

1. **The raw messages enter through the existing Slack ingest.** A throwaway script, kept
   outside the repository, converts the spreadsheet into the export layout
   `slack/<channel>/<YYYY-MM-DD>.json` plus `users.json`. `parseSlackExport` reads it unchanged.
   Join messages and other people's replies are dropped.
2. **Markers live in `$MEMORIES_DATA_DIR/markers.json`, not in `timeline.json`.** Ingest
   rewrites the timeline on every run; markers are human-checked judgement and must survive
   it, as notes do.
3. **A marker points at its source message by event id.** Event ids are
   `sha256(source, at, author, text)`, so they are stable across ingests, and every
   "back to the message" link in the app already uses them.
4. **A day with a marker and no messages is a real day.** It links from the heatmap and month
   view, and its day page shows the markers.
5. **Markers ignore the source filter.** They are not a source; hiding Slack does not hide them.

## Data

```json
{
  "markers": [
    {
      "date": "2025-03-07",
      "person": "bob",
      "kind": "leave",
      "part": "full",
      "event": "3f9c0a1b2c3d4e5f"
    }
  ]
}
```

- `date`: `YYYY-MM-DD`, the day the marker applies to, in Asia/Taipei.
- `person`: an id in `people.json`. Display names come from there.
- `kind`: `"wfh"` or `"leave"`.
- `part`: `"full"`, `"am"` or `"pm"`. A timed absence (「14:30–16:30 請病假」) rounds to the
  nearer half day.
- `event`: the id of the Slack event the marker was read from. One message may yield several
  markers; a range expands to one marker per working day, skipping weekends.
- The pair `(date, person)` is unique.

Judgement rules for preparing the file:

- An explicit date in the message wins. Otherwise relative words count from the posting date.
- A message posted between 00:00 and 05:00 that uses a relative day goes on the ambiguous
  list with a proposed reading. Late-night usage is mixed: 「今天（11/20）」 at 00:04 means
  the posting date, while 「明早」 at 01:37 means the morning of the posting date.
- A plan that the thread itself retracts or moves (struck-through text, 「移到明天」) is marked
  where it actually happened.
- Ambiguous readings are listed for the owner to confirm before the file goes into the data
  directory.

### Loading

`src/lib/server/markers-store.ts` follows `people-store.ts`: `cachedFile` with an mtime check,
parsed by a zod schema. A missing file means no markers. A file that fails validation is
rejected whole and logged; markers are never half-loaded. An unknown `person` or a duplicate
`(date, person)` is a validation error.

## Display

Colour tokens: `wfh` uses `info`, `leave` uses `warning`, both from the shared shadcn plugin, so
they follow the seed and the colour scheme.

- **Year heatmap.** A 3 px bar along the bottom of the 24 px cell: full width for `full`, the
  left half for `am`, the right half for `pm`. The noted dot stays in the centre. Two people on
  one day stack two bars, the owner's on top. The tooltip and hover preview add a line per
  marker, such as 「<name> 請假・下午」. On phones, where a cell is 8 px wide, a single dot in the
  marker colour sits under the bar, without the part.
- **Month view.** A small badge under the date, such as 「WFH・下午」, with the person's initial;
  the full name is in its title.
- **Day view.** A row at the top of the day section per marker: 「<name> 請假（全天）→ 原訊息」.
  The link scrolls to the source event, on its own day page when the message was posted
  earlier.
- **Days without messages.** The heatmap cell becomes a link, and the day page renders the
  marker row instead of the empty state.

The message-count levels of the heatmap do not change: the background shows volume, the bar
shows attendance.

## MCP

- `get_day` gains `markers: [{ person, kind, part, eventId, postedOn }]`, where `postedOn` is
  the date of the source message. A day with markers and no messages returns its markers.
- New `list_markers({ from?, to?, person?, kind? })` returns the same shape with `date`, sorted
  by date, so an agent can fetch every leave day in a range in one call and compare it with
  `search_memories` results.

## Testing

- Unit: the store's schema (unknown person, bad date, duplicate pair, missing file, reload on
  mtime) and the pure functions that merge markers into day and month data, including a day
  with markers only.
- MCP: `tools.test.ts` covers `get_day.markers` and the `list_markers` filters;
  `personal-memories-e2e/src/mcp.spec.ts` covers one call end to end.
- E2E: `fixture.ts` writes a `markers.json` with one marker on a day that has no messages.
  `timeline.spec.ts` checks the heatmap bar, that the empty day opens, and that the day row
  links back to the posting day. Visual baselines are updated.

## Delivery

One pull request, in this order:

1. `markers-store`, schema and unit tests.
2. The day row, and days with markers only.
3. Month badge, heatmap bar and tooltip.
4. MCP: `get_day.markers` and `list_markers`.
5. E2E fixture and specs.

Outside the repository, after the PR: convert the spreadsheet, prepare `markers.json` with
placeholder person ids and the list of ambiguous readings, and let the owner check it, set the
ids and run `ingest`.

## Out of scope

- Any parser or model that derives markers automatically.
- Kinds other than `wfh` and `leave`.
- A Slack permalink on events.
