# Memories — design brief for Claude Design

Paste this whole file into Claude Design. The engineering design is in
[2026-09-23-memories-redesign-design.md](2026-09-23-memories-redesign-design.md); this brief
covers only what the screens need.

## The product

A private album for one person. It merges LINE chats, Slack DMs and the Photos library into one
timeline and lets the owner write down what each day brings back. It is for reading and
writing, not for managing data. UI copy is Traditional Chinese (zh-TW).

The feel should be **a quiet diary**: plenty of whitespace, calm typography. It should not look
like a chat app or a photo manager. The side panel where the owner writes matters as much as
the timeline, and the timeline should not pull attention away from it.

## Content realities (design for the extremes)

- ~18 months, 400+ days. A typical day has ~12 events; the busiest have **several hundred**.
- Over half are LINE text messages between two people, often short and in rapid bursts, sometimes
  long paragraphs. Chinese and English mixed.
- Over a third are photos, often several shot within a minute of each other.
- Some days have no photos; some have only photos.

## Screens

Design each at **1440 × 900** and **390 × 844**, in **light and dark**.

1. **Year — heatmap (home).** Every day of the whole range, sized so it fits one screen on
   desktop. Colour intensity = number of events. Days that already have a written memory carry a
   distinct marker. Month and year labels. Tap a day → day view; tap a month label → month view.
2. **Month — calendar.** One cell per day: a cover photo when the day has one; otherwise the first
   line of the day's memory, otherwise a short message excerpt. Event count. Days without events
   are quiet, not hidden.
3. **Day — stream + notes panel.** The core screen.
   - Stream: days flow continuously while scrolling; each day has a sticky date heading
     (`2025-11-01（週六）`). Messages are set as **quotes, not bubbles**; the two speakers are told
     apart by alignment or a subtle indent, and the author name appears only when the speaker
     changes. Time is small and secondary. Consecutive photos collapse into a compact grid. Source
     (LINE / Slack / 照片) is visible but low-key.
   - Hovering a message (desktop) or long-pressing it (phone) reveals a small 「眉批」 action.
     A message that already has an annotation shows a quiet marker.
   - Notes panel (desktop: right column, ~360–420px; phone: bottom sheet with a peek state and a
     full state): the day's memory as a plain Markdown textarea at the top, then the annotations
     list. Each annotation shows time · source · author, the quoted excerpt, and the owner's
     text. Selecting an annotation highlights its message in the stream, and vice versa.
   - A thin month scrubber along the edge for jumping, plus a way to zoom out to the month or year.
4. **Lightbox.** Full photo, previous/next, and a 「設為封面」 action.

## States to show

- Day with no memory yet (an inviting empty textarea, not an empty-state illustration).
- Save status: 已儲存 / 儲存中 / 未儲存 — present but unobtrusive.
- Conflict: the file was edited in Obsidian meanwhile. Show both versions and let the owner keep
  one. This must be clear and calm, not alarming.
- Unattached annotation: its message can no longer be found. It sits at the top of the list with
  its excerpt and a way to re-attach it.
- Notes read-only (storage not configured): a quiet notice in the panel; the stream is unchanged.
- The busiest day (several hundred events), to prove the stream stays readable.
- A highlighted message (arrived via a link to that message).

## Hard constraints

- **Colour comes only from these semantic tokens**, which all derive from a single seed colour
  and switch between light and dark automatically. No hex values, no raw palette colours:
  `background` `foreground` `card` `card-foreground` `popover` `popover-foreground` `primary`
  `primary-foreground` `secondary` `secondary-foreground` `muted` `muted-foreground` `accent`
  `accent-foreground` `destructive` `border` `input` `ring` `success` `warning` `info` (each
  with `-foreground`), `chart-1` … `chart-5`, `sidebar-*`. Opacity modifiers are fine
  (`bg-success/15`). The heatmap scale should be built from one token at varying opacity.
- **Type:** Inter for all UI. No serif.
- **Radius:** a single base radius (0.625rem) and its derivatives.
- **Stack:** Tailwind v4 utilities on server-rendered HTML. Motion should be achievable with CSS
  and view transitions (zooming between year → month → day morphs the selected day). Avoid
  designs that need a heavy client-side component library.
- **Accessibility:** keyboard reachable (shortcuts: `j`/`k` previous/next day, `n` write, `/` jump to
  date), visible focus rings using `ring`, WCAG AA contrast in both schemes.

## What to hand back

The screens above as HTML/Tailwind using the token class names (`bg-muted`,
`text-muted-foreground`, …), with short notes on spacing scale, type scale and interaction
details that the static screens can't show.
