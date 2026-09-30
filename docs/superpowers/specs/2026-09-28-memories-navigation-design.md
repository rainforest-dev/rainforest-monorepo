# Memories navigation: back, previews and keyboard

Date: 2026-09-28. Status: direction approved by the owner from the explainer artifact
("回憶的導覽設計"). The owner chose to keep the multi-page app (option A, no `ClientRouter`),
asked for long-press previews on touch, and left the remaining UX calls to the implementer. Those
calls are recorded under Decisions.

## Problems

Measured on the fixture data:

1. **Back loses the day you ended on.** Open 11/1 from the month, scroll the stream to 11/3, then
   press Back. The month opens at the top with no cell marked and no morph. The stream updates the
   entry URL with `replaceState`, and the month page picks its morph target on the server from
   `Referer`. A history traversal replays the original `Referer`, so the target is wrong or
   missing.
2. **Keyboard focus is lost after zooming out.** After `Esc` from a day, focus sits on nothing, so
   `←`/`→` do nothing until the user tabs past the toolbar. `↑`/`↓` are not handled anywhere, and
   the month grid has no arrow keys at all.
3. **The back link scrolls away.** 「← 全部日子」 on the day page lives in the page flow, not in
   the sticky app bar. It also always goes to the year page, not to the day's month.
4. **Only the year view has previews.** They are CSS `:hover`/`:focus-visible` spans clipped by
   stacking contexts in some layouts, and they never show on touch.

## Decisions

1. Stay multi-page. Cross-document View Transitions stay (`@view-transition { navigation: auto }`).
2. The morph target is chosen **on the client** in `pagereveal`, from
   `navigation.activation.from.url` and the current URL, using the existing `morphKey()`. This
   works the same for links, `Esc` and history traversal. The server-side `Referer` path
   (`morphFromRequest`) stays only as the fallback when `navigation.activation` is unavailable.
3. **Last viewed.** Arriving on a month or year page from a deeper level marks the matching day
   cell (or month row label on the year page when coming from a month) with `data-last-viewed`:
   - Style: an inset `ring-2 ring-primary`. The month cell also shows a small 「上次看到」 label in
     `text-primary`. Year cells are too small for text, so the ring is the only visual mark there.
     Both get `aria-description="上次看到"`.
   - The mark stays until the page is left. One soft background flash on arrival, skipped under
     `prefers-reduced-motion`.
   - The marked cell becomes the roving tab stop and receives focus (`preventScroll`, then
     `scrollIntoView({ block: 'nearest' })` only when it is off-screen).
4. **Roving tabindex on year and month cells.** Only one day cell per grid has `tabindex="0"`; the
   rest are `-1`. The initial stop is the last-viewed cell, else the latest day with data on the
   page.
5. **Arrow keys, on both year and month:**
   - `←`/`→`: previous/next day with data (today's behaviour, extended to the month).
   - `↑`/`↓`: the visually adjacent row. On the month calendar that is ±7 days; on the year
     heatmap it is the same day-of-month in the previous/next month row. If that cell has no data,
     take the nearest data cell in that row (ties go to the earlier date); if the row has none,
     keep going in the same direction. On the phone month list (`sm:hidden`), `↑`/`↓` are ±1
     item.
   - `Enter` opens (native link).
   - `Home`/`End`: first/last data cell on the page.
6. **`Esc` order:** close an open preview first; then (as today) zoom out one level. The zoom-out
   lands through decision 3, so focus lands on the cell of the day you were on.
7. **Previews on year and month**, one shared behaviour:
   - Each data cell owns a `[data-preview]` element with `popover="hint"`. Browsers without
     `hint` treat the invalid value as `manual`, which behaves the same under our controller.
   - Position: CSS anchor positioning with the existing `position-try` fallbacks; where
     `position-area` is unsupported, a JS fallback sets fixed `top`/`left` from the cell's rect
     (above, else below, clamped 8px inside the viewport).
   - Triggers: mouse hover, after 300ms on first show and instantly while moving between cells;
     hides 80ms after leaving. Keyboard `:focus-visible` shows immediately. Touch long press
     (450ms, cancelled by more than 8px of movement) shows the preview and swallows the click
     that follows; lifting the finger leaves it open until the next tap anywhere.
   - Content: the month preview reuses `DayPreview` (date, count, then cover, memory or
     excerpt). The year preview is unchanged.
   - `aria-hidden="true"` stays on the preview, since the cell's `aria-label` already carries its
     content.
8. **The back control moves into the app bar.** Remove 「← 全部日子」. On day pages the app bar
   gets a leading ghost link 「← N 月」 (`aria-label="回到 N 月"`) before the level tabs, pointing
   at `hrefs.month`. It updates when the stream changes day (`memories:day`), like the other hrefs.
   It is the same action as `Esc`.
9. **Key hints.** The year page already has a hint row. The month page gets the same row:
   `←` `→` 前後一天 · `↑` `↓` 前後一週 · `Enter` 打開那一天. The year row gains `↑` `↓` 上下一個月.
   The day page gets none (the notes panel is there); its keys are in `?`. The `?` dialog lists
   the new keys.

## Copy

- 上次看到
- ← N 月, with the aria-label 回到 N 月
- 前後一週 (month hint), 上下一個月 (year hint)
- `?` dialog rows: `↑` `↓` 上下一行, `Home` `End` 第一天／最後一天

## Out of scope

- `ClientRouter` / SPA navigation.
- Restoring the day stream's loaded sections on Forward. The day page reloads at the day in the
  URL, as today.
- `interestfor` (Chrome only today).
- A phone-first date picker (the command palette stays).

## Testing

- Unit tests (Vitest) for the pure parts: the ↑/↓ target picker for month and year grids,
  the resolved shortcut table (`resolveShortcut` gains `ArrowUp`, `ArrowDown`, `Home`, `End` on
  month and year, and preview-first `Escape`), and the month label for the back link.
- e2e (Playwright, fixture data):
  - month → day → scroll to a later day → Back: the later day's cell has `data-last-viewed`, is
    focused, and `↑`/`↓`/`←`/`→` move from it;
  - the same via `Esc` and via the 「← N 月」 link;
  - the year page: arriving from a month marks that month row; arriving from a day marks the day;
  - roving tabindex: exactly one `tabindex="0"` cell per grid; Tab from the app bar lands on it;
  - preview: hover shows it after the delay, focus shows it at once, `Esc` closes it first and a
    second `Esc` zooms out; a touch long press (Playwright `hasTouch`) shows it and does not
    navigate;
  - the old 「← 全部日子」 link is gone.
- Visual check in light and dark at 1440 and 390 before the PR, with before/after evidence.
