# personal-memories v2b Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the rest of the zoomable album (the month calendar with covers, a lightbox with
設為封面, zoom view transitions, a month scrubber, date jump and keyboard shortcuts), fix the
problems the owner hit on the live v2a app, and move the React island onto
`@rainforest-dev/rainforest-react`.

**Architecture:** The core stays as v1/v2a built it: SSR Astro pages, a vanilla
`day-stream.ts`, one React island for the notes, live collections for reads and Actions for
writes. New code falls into three layers so the later Claude Design restyle only touches
presentation. Pure rules and data shaping go in `src/lib/**` and are unit-tested. State and DOM
glue go in `use*.ts` hooks and `src/scripts/*.ts`. Presentation goes in `src/components/**`, as
components that take plain props. A cover is the `cover:` frontmatter key of the day note, and it
travels through the same draft, autosave and conflict path as the body.

**Tech Stack:** Astro 7.3.3 (installed; the v2a plan still said 6.4.8), React 19,
`@rainforest-dev/rainforest-react` (Base UI 1.4, cmdk, lucide-react), Tailwind v4 with the shared
seed theme, cross-document View Transitions, CSS anchor positioning, Vitest 3.2 (the app's own
pin; the library's Vitest 4 does not apply here), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-23-memories-redesign-design.md` (Releases → v2b, data
model, errors). Also read `docs/superpowers/specs/2026-09-25-memories-v2b-claude-design-brief.md`
(screens, states, copy, component mapping, interaction and motion) and
`docs/superpowers/specs/2026-09-24-memories-v2-visual-spec.md` (sizes, tokens). Precedence: the
brief wins on components and copy, the design spec on behaviour and data, and the owner feedback
of 2026-09-25 (below) on anything it names.

## Owner decisions and feedback folded in

Decisions already made: the lightbox is the library's `Dialog`; the heatmap keeps its
`bg-primary/20 /40 /65 /90` steps; `Escape` zooms out one level when no overlay is open; the
invited viewer keeps the same view and write access as the owner (no role gating anywhere).

Feedback from using v2a on 2026-09-24, each tied to a task:

| #   | Feedback                                                                    | Task       |
| --- | --------------------------------------------------------------------------- | ---------- |
| 1   | Bug: the day view's timeline strip neither navigates nor follows the scroll | Task 1     |
| 2   | Level switching after scrolling must follow the day in view                 | Task 9, 11 |
| 3   | Year heatmap day preview on hover and focus, via CSS anchor positioning     | Task 13    |
| 4   | Bug: the `+N` overflow photos of a burst cannot be viewed                   | Task 6     |
| 5   | Hard to tell who sent each message                                          | Task 8     |
| 6   | 眉批 need an author name, since the invited viewer writes them too          | Task 7     |

## Plan decisions (where the sources are silent)

- D1 Cover storage. The spec settles where: the manual cover lives in the day note's
  frontmatter as `cover:` (`NotesStore`, `parseNote` and `saveNote` already carry it). The notes
  dir is a read-write bind mount, so the cover survives a container restart. Not settled by the
  spec: the value is the photo event id (the Photos uuid). Only `photo` events that are not movies
  can be covers. Slack images are excluded because their ids are content hashes that change on
  re-export. A stored id that is no longer on that day stays in the file and is ignored, so the
  automatic cover shows. The cover goes through the panel's draft rather than a separate write,
  because a second writer would race the panel's `version` and raise false conflicts.
- D2 `scoreCover` weights. `score` defaults to 0.5; +0.15 with people; −0.6 for a screenshot;
  −0.4 for a burst frame that is not the pick. Favourites form a tier above everything else.
  Movies are excluded rather than penalised, because the thumbnail route cannot decode video.
  Ties go to the earliest photo.
- D3 Week start. Calendar weeks start on Sunday (日 一 二 三 四 五 六), as Taiwanese
  calendars do.
- D4 Keys. `j` is the next (later) day and `k` the previous, following vim and the library's
  own Tooltip story (`前一天 K`). `j`/`k` and the 前一天/後一天 buttons load the neighbouring
  day as a page (a cross-fade under view transitions) rather than scrolling to it: a short day
  scrolled to the top cannot become the day in view under the stream's 40 % rule, so scrolling
  would leave the URL and panel on the wrong day. On the year level, `Escape` with a focused heat
  cell blurs it, which hides the preview.
- D5 Zoom morph. Only the pair of elements in a zoom step gets a `view-transition-name`,
  and it is `day-<date>` or `month-<YYYY-MM>`. The new page sets it during SSR from the `Referer`
  header; the old page sets it in `pageswap`. This avoids naming hundreds of heat cells, and it
  avoids the `pagereveal` timing problem of deferred module scripts. Under reduced motion no
  element is named and the root cross-fade shortens to 150 ms.
- D6 Year → month. Phone month rows and desktop month labels open `/month/<YYYY-MM>`; desktop
  heat cells still open the day.
- D7 Overlay state. Every open Dialog, expanded Sheet or menu holds a counter on `<html>`
  (`data-overlays`). The shortcut listener runs in the capture phase, so it sees the overlay as
  open before Base UI's own Escape handling closes it.
- D8 Date-jump data. The day list comes from `GET /days.json` on first open, not from page
  props on every page.
- D9 Heatmap preview (owner #3). CSS anchor positioning replaces the brief's `Tooltip` for
  heat cells, and the heatmap stays zero-JS. Support: Chrome/Edge 125+ and Safari 26+ on macOS and
  iOS. Elsewhere `@supports not (anchor-name: --a)` falls back to v2a's absolute position above
  the cell. No polyfill, per the spec's "No polyfills". Touch devices get no preview: a tap
  follows the link, and phones use the month rows anyway. Keyboard focus shows it
  (`:focus-visible`).
- D10 Timeline strip (owner #1). Read as the hour strip in the sticky day heading, the only
  horizontal strip on the day view. Each hour with events becomes a link to that hour's first
  message, and the hour in view is marked while scrolling. Moving between dates is the job of the
  month scrubber (Task 12) and `j`/`k`. Confirm with the owner that this is the strip meant.
- D11 Author distinction (owner #5). Every text-run author gets an accent from `chart-1..5`,
  assigned by message count across the whole timeline, so colours are stable between days and the
  top five authors never collide. The head row on a speaker change gets an initial chip in that
  accent and a semibold name. Every row gets a 2 px rule in the accent, so a mid-run row still
  shows who wrote it. Owner indentation (`MEMORIES_OWNER`) stays and becomes margin, so the rule
  moves with it.
- D12 Annotation author (owner #6). The anchor comment gains an optional last field:
  `%% ev:<id> at:<iso> src:<source> by:<name> %%`. Older notes without `by:` still parse. The
  server resolves the name from `Cf-Access-Authenticated-User-Email` through
  `MEMORIES_AUTHORS="email=Name,…"` (set in the homelab, never in the repo). Without a mapping, the
  panel asks once for a name and keeps it in `localStorage`. The server fills `by` on any
  annotation that arrives without one. The header is trusted only because the app is reachable
  solely behind Cloudflare Access; JWT verification is out of scope.
- D13 Pinch. Two fingers moving together (distance ratio ≤ 0.75) zoom out one level.
  Confirm with the owner, since "pinch-out" can also mean spreading the fingers.
- D14 Scrubber. Lists only months that have events; desktop (`lg`) only.
- D15 Long-press menu. `DropdownMenuContent` exposes no `anchor` prop, so the menu opens from
  an invisible fixed trigger placed at the touch point. The library does not change.

### New copy that needs the owner

From the brief's "proposed" list, used as written: 鍵盤快速鍵, 這個月沒有紀錄,
沒有這一天，已跳到最近的 {date}, 載入中…, 圖片載入失敗, 目前的封面, 按 ? 看所有快速鍵.
Introduced by this plan: 縮小一層 (Esc in the shortcuts list), 沒有這一天,
沒有這一天，按 Enter 跳到最近的 {date}, 載入失敗，請再開一次, 眉批署名, 你的名字, and the
screen-reader labels 這一天的時段, {HH} 點，{N} 則, 月份, 縮放.

## Global Constraints

- The v1/v2a constraints still hold: semantic tokens only (no hex, raw palette classes or
  `dark:`); zh-TW UI copy; sorted imports (`simple-import-sort`); single quotes; `z` from
  `astro/zod`; current Safari and Chrome with no polyfills; Asia/Taipei dates; never lose or
  misfile typed text.
- Comment allow-list: a one-line JSDoc on an exported public-API function or component; one line
  naming an external constraint (browser bug, API quirk, library trap); the reason on a lint
  suppression; `TODO(<ticket>)`. Nothing else. Last step of every task:
  `git diff -U0 | grep -E '^\+\s*(//|/\*|\*|#|<!--)'`, and justify each hit.
- Copy comes verbatim from the brief's Copy section. New strings are only those listed under
  "New copy that needs the owner".
- Components are imported by export name from the `@rainforest-dev/rainforest-react` root, and
  icons come from `lucide-react`. An Astro file renders a library component statically (no
  `client:` directive) when it needs no interaction. Otherwise it uses the recipes from
  `@rainforest-dev/rainforest-ui/recipes`.
- Token opacity steps are limited to `/10 /15 /20 /35 /40 /45 /50 /65 /80 /90`.
- Layer split: presentation components take plain props and never call `fetch`, actions,
  `localStorage` or `document.addEventListener`; hooks (`use*.ts`) and `src/scripts/*.ts` hold
  state and DOM glue; `src/lib/**` holds pure logic.
- DOM contract kept from v2a: `section[data-day][data-prev][data-next]`,
  `li#ev-<id>[data-event-id][data-source][data-at][data-author][data-excerpt]`,
  `[data-annotate]`, `[data-annotated]`, `[data-stream]`, `[data-load]`, and the `memories:day`,
  `memories:day-restored` and `memories:annotate` events. v2b adds `data-auto-cover`,
  `data-lightbox`, `data-width`, `data-height`, `data-video`, `data-hour-strip`, `data-hour`,
  `data-accent`, `data-morph`, `data-morph-target`, `data-heat-cell`, `data-preview`, and the
  events `memories:lightbox`, `memories:open-jump`, `memories:open-shortcuts`,
  `memories:focus-note` and `memories:longpress`.
- Motion: 300 ms `cubic-bezier(0.2, 0, 0, 1)`. Under `prefers-reduced-motion`: a 150 ms
  cross-fade, and the pulsing save dot stops.
- Privacy: the repo is public. Tests and fixtures use only the synthetic e2e data (authors Alice
  and Bob; identities `alice@example.com`, `bob@example.com`). Real names come only from env
  (`MEMORIES_OWNER`, `MEMORIES_AUTHORS`).
- Subagents do not commit; the controller commits per task. Touch only the files a task lists.
- Unit tests: `pnpm nx test personal-memories -- <file>`. E2E:
  `pnpm nx e2e personal-memories-e2e -- --grep "<title>"`. Full verification:
  `pnpm nx run-many -t lint test typecheck -p personal-memories personal-memories-e2e`, then
  `pnpm nx e2e personal-memories-e2e`.
- Repo rule: after changing a layout, `astro.config.mjs` or anything a layout imports, load a page
  from a running `pnpm nx dev personal-memories`. A green build does not show that dev works.

## Review Focus

1. Hour strip on a day reached by scrolling (owner #1). A day loaded as a partial, or
   restored from a windowing placeholder, must have a working strip, and its marker must follow
   that day, not the first one loaded. Test: Task 1 step 7 opens 2025-11-01, lets the busy day
   2025-10-31 load above it as a partial, scrolls into it and checks the marker there.
2. A burst larger than the grid (owner #4). The `+N` tile opens the lightbox at that photo.
   Arrow keys, swipe and the filmstrip reach the last photo, and the video items in a burst render
   as video. Test: Task 6 step 9 walks from `+4` to `7 / 7` by keyboard and filmstrip. The
   `stepIndex` unit test covers a 300-photo burst.
3. Switching level after scrolling (owner #2). 月, 日, `Escape` and pinch must target the day
   in view, not the day the page was opened on. Test: Task 9 step 12 (tabs) and Task 11 step 8
   (`Escape` lands on and focuses the in-view day's month cell).
4. `Escape` while typing or with an overlay open. It must never navigate away. The memory
   textarea may hold unsaved text, and a dialog's own `Escape` must win. Test: Task 10 step 7.
5. Stale or odd stored values. A `cover:` id no longer on its day, an annotation `by:` name
   with spaces, emoji or `%%`, and a request with no identity header must each fall back
   gracefully. Tests: Task 3 step 1 (dangling cover), Task 4 step 1 (month view), Task 7 steps 1
   and 8 (names, no header).

## Execution waves

Most tasks touch `timeline.spec.ts`, and many touch `DaySection.astro`, `day-stream.ts`,
`NotePanel.tsx`, `global.css` or the pages, so they run one at a time. The exceptions touch
disjoint files.

| Wave | Tasks                                                                   |
| ---- | ----------------------------------------------------------------------- |
| 1    | Task 1 and Task 3 in parallel (Task 3 only creates new `src/lib` files) |
| 2    | Task 2                                                                  |
| 3    | Task 4 and Task 5 in parallel (Task 5 touches no file Task 4 does)      |
| 4+   | Task 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15                        |
| any  | Task 16 once Task 7 has merged (other repo)                             |
| last | Task 17                                                                 |

## File map

```
src/lib/
  cover.ts            scoreCover, pickCover, toggleCover                        (T3)
  months.ts           MONTH_RE, monthOf, monthLabel, shiftMonth, calendarWeeks,
                      nearestDate, scrubberMonths                               (T3)
  month-view.ts       firstLine, dayCell, dayCells, monthView                   (T4, T13)
  lightbox.ts         LightboxItem, itemFromDataset, stepIndex, swipeDelta,
                      positionLabel, coverControl                               (T6)
  nav.ts              Place, placeOf, zoomOutHref, levelHrefs                   (T9)
  jump.ts             queryPrefixes, matchDates, groupByMonth, jumpTarget       (T9)
  shortcuts.ts        SHORTCUT_GROUPS (T9), resolveShortcut (T10)
  zoom.ts             morphKey, refererPath, morphFromRequest, morphStyle       (T11)
  sources.ts          SOURCES, parseHidden, visibleFrom, hiddenFrom             (T15)
  gestures.ts         long-press and pinch thresholds                           (T15)
  stream.ts           + firstEventPerHour (T1), authorAccents, initialOf (T8)
  weeks.ts            + taipeiHour (T1), WEEKDAYS_ZH export (T4)
  notes/draft.ts      Draft, toDraft, toAnnotation, saveInput, withCover        (T5)
  notes/authors.ts    cleanName, parseAuthors, viewerName, stampAuthors         (T7)
  client/overlays.ts  holdOverlay, isOverlayOpen                               (T6)
  client/events.ts    DocumentEventMap declarations                            (T6+)
  client/step-day.ts  stepDay                                                   (T9)
src/components/
  useOverlay.ts, useActiveDay.ts, useMediaQuery.ts                              (T6, T9, T14)
  month/  MonthCalendar.astro, MonthCellBody.astro, MonthNav.tsx                (T4)
  lightbox/ Lightbox.tsx, LightboxImage.tsx, useLightbox.ts                     (T6)
  chrome/ AppBar.tsx, TopBar.tsx, DateJump.tsx, ShortcutsDialog.tsx, useChrome.ts (T9)
  day/    MonthScrubber.tsx (T12), SourceFilter.tsx, useSourceFilter.ts,
          StreamMenu.tsx, useStreamMenu.ts, Sentinel.astro (T15)
  year/   DayPreview.astro                                                      (T13)
  notes/  NotesSurface.tsx, StatusBadge.tsx, ReadOnlyNotice.tsx, useAuthorName.ts (T7, T14)
src/pages/ month/[month].astro (T4), days.json.ts (T9)
src/scripts/ shortcuts.ts (T10), zoom.ts (T11)
```

---

### Task 1: The day view's hour strip navigates and follows the scroll (owner #1)

**Files:**

- Modify: `apps/personal-memories/src/lib/weeks.ts` (add `taipeiHour`)
- Modify: `apps/personal-memories/src/lib/stream.ts` (add `firstEventPerHour`; `hourCounts` uses `taipeiHour`)
- Test: `apps/personal-memories/src/lib/stream.test.ts`
- Modify: `apps/personal-memories/src/components/DaySection.astro` (hour strip block only)
- Modify: `apps/personal-memories/src/scripts/day-stream.ts` (`markHour`, called from `watchActiveDay`)
- Modify: `apps/personal-memories/src/styles/global.css` (current-hour style)
- Modify: `apps/personal-memories/src/cli/fixture.ts` (a synthetic busy day)
- Test: `apps/personal-memories-e2e/src/timeline.spec.ts`

**Interfaces:**

- Consumes: `taipeiTime(at)` from `weeks.ts`; `groupRuns`, `hourCounts` from `stream.ts`.
- Produces: `taipeiHour(at: string): number` (0–23, Asia/Taipei);
  `firstEventPerHour(events: readonly TimelineEvent[]): (string | undefined)[]` (length 24, the
  first event id of each hour); DOM `nav[data-hour-strip] a[data-hour]`, with the hour in view
  marked `aria-current="time"`. Fixture day `2025-10-31` (before the other fixture days, so the short days
  2025-11-01 to 11-03 keep their neighbours) has 120 LINE messages from 07:00 to 18:45, ten per
  hour, texts `Busy message 1` … `Busy message 120`.

- [ ] **Step 1: Write the failing tests** (append to `stream.test.ts`, extend its import with
      `firstEventPerHour`)

```ts
describe('firstEventPerHour', () => {
  it('maps each hour to its first event and leaves empty hours undefined', () => {
    const firsts = firstEventPerHour([
      ev('a', 'Alice', 'line', '2025-11-01T09:05:00+08:00'),
      ev('b', 'Bob', 'line', '2025-11-01T09:40:00+08:00'),
      ev('c', 'Alice', 'line', '2025-11-01T13:00:00+08:00'),
    ]);
    expect(firsts).toHaveLength(24);
    expect(firsts[9]).toBe('a');
    expect(firsts[13]).toBe('c');
    expect(firsts[10]).toBeUndefined();
  });

  it('buckets by the Taipei hour whatever offset the event carries', () => {
    expect(
      firstEventPerHour([ev('x', 'Bob', 'line', '2025-11-01T01:30:00Z')])[9],
    ).toBe('x');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm nx test personal-memories -- src/lib/stream.test.ts`
Expected: FAIL, `firstEventPerHour is not a function` (or not exported).

- [ ] **Step 3: Implement**

In `weeks.ts`, below `taipeiTime`:

```ts
/** Hour of the day (0–23) of the instant in Asia/Taipei. */
export function taipeiHour(at: string): number {
  return new Date(Date.parse(at) + TAIPEI_OFFSET_MS).getUTCHours();
}
```

In `stream.ts`, import `taipeiHour` in place of `taipeiTime`, and replace `hourCounts`:

```ts
export function hourCounts(events: readonly TimelineEvent[]): number[] {
  const counts = Array.from({ length: 24 }, () => 0);
  for (const event of events) counts[taipeiHour(event.at)] += 1;
  return counts;
}

export function firstEventPerHour(
  events: readonly TimelineEvent[],
): (string | undefined)[] {
  const firsts: (string | undefined)[] = Array.from(
    { length: 24 },
    () => undefined,
  );
  for (const event of events) firsts[taipeiHour(event.at)] ??= event.id;
  return firsts;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm nx test personal-memories -- src/lib/stream.test.ts`
Expected: PASS (the existing `hourCounts` tests still pass).

- [ ] **Step 5: Render the strip as links.** In `DaySection.astro` import `firstEventPerHour`,
      add `const firsts = hours ? firstEventPerHour(events) : undefined;` and
      `const pad2 = (n: number) => String(n).padStart(2, '0');`, then replace the
      `{hours && (…)}` block with:

```astro
{
  hours && firsts && (
    <nav aria-label="這一天的時段" data-hour-strip class="flex flex-col gap-1">
      <ol class="flex h-6 items-end gap-0.5">
        {hours.map((count, hour) => {
          const first = firsts[hour];
          const bar = [
            'block w-full rounded-[1px]',
            count === 0
              ? 'bg-border'
              : count === peak
                ? 'bg-primary'
                : 'bg-primary/35',
          ];
          const height = `height: ${Math.max(8, (count / peak) * 100)}%`;
          return (
            <li class="flex h-full flex-1 items-end">
              {first ? (
                <a
                  href={`#ev-${first}`}
                  data-hour={hour}
                  aria-label={`${pad2(hour)} 點，${count} 則`}
                  class="focus-visible:ring-ring flex h-full w-full items-end rounded-[1px] outline-none focus-visible:ring-2"
                >
                  <span data-bar class:list={bar} style={height} />
                </a>
              ) : (
                <span class:list={bar} style={height} />
              )}
            </li>
          );
        })}
      </ol>
      <div
        aria-hidden="true"
        class="text-muted-foreground flex justify-between text-xs tabular-nums"
      >
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
    </nav>
  )
}
```

In `global.css`:

```css
[data-hour-strip] [aria-current='time'] [data-bar] {
  @apply bg-primary ring-ring ring-offset-background ring-2 ring-offset-1;
}
```

- [ ] **Step 6: Track the hour in view.** In `day-stream.ts` add
      `import { taipeiHour } from '../lib/weeks.ts';` and:

```ts
function markHour(stream: HTMLElement, date: string) {
  const section = stream.querySelector<HTMLElement>(`[data-day="${date}"]`);
  const strip = section?.querySelector('[data-hour-strip]');
  if (!section || !strip) return;
  const threshold = window.innerHeight * 0.4;
  let at: string | undefined;
  for (const row of section.querySelectorAll<HTMLElement>('[data-event-id]')) {
    if (!row.checkVisibility()) continue;
    if (row.getBoundingClientRect().top > threshold) break;
    at = row.dataset['at'];
  }
  const hour = at === undefined ? undefined : taipeiHour(at);
  for (const link of strip.querySelectorAll<HTMLElement>('[data-hour]')) {
    if (Number(link.dataset['hour']) === hour)
      link.setAttribute('aria-current', 'time');
    else link.removeAttribute('aria-current');
  }
}
```

In `watchActiveDay`'s `apply`, call it on every frame, before the early return:

```ts
const date = activeDayOf(nodes);
if (date) {
  windowManager.manage(nodes, date);
  markHour(stream, date);
}
if (!date || date === active) return;
```

The hash links scroll by themselves: rows already carry `scroll-mt-32`, and
`[data-burst]:has(:target)` expands a collapsed burst when an hour's first event is an overflow
photo.

- [ ] **Step 7: Add a busy fixture day and the e2e tests.** In `fixture.ts`, add below
      `SECOND_WEEK`:

```ts
const BUSY_DAY = [
  '[LINE] Chat history with Alice',
  'Saved on: 11/01/2025, 08:00',
  '',
  'Fri, 10/31/2025',
  ...Array.from({ length: 120 }, (_, i) => {
    const hour = 7 + Math.floor(i / 10);
    const minute = String((i % 10) * 5).padStart(2, '0');
    const clock = `${hour % 12 || 12}:${minute}${hour < 12 ? 'AM' : 'PM'}`;
    return `${clock}\t${i % 2 ? 'Bob' : 'Alice'}\tBusy message ${i + 1}`;
  }),
  '',
].join('\n');
```

and in `writeFixtureDataDir`, after the `second-week.txt` line:
`writeFileSync(join(root, 'line', 'busy-day.txt'), BUSY_DAY);`

In `timeline.spec.ts`, the home test now expects four days: `await expect(days).toHaveCount(4);`.
Append:

```ts
test('the hour strip jumps to an hour and follows the scroll', async ({
  page,
}) => {
  await page.goto('/day/2025-10-31');
  const strip = page.locator('#day-2025-10-31 [data-hour-strip]');
  await expect(strip).toBeVisible();
  await strip.getByRole('link', { name: '15 點，10 則' }).click();
  await expect(
    page.getByText('Busy message 81', { exact: true }),
  ).toBeInViewport();
  await expect(strip.locator('[aria-current="time"]')).toHaveAttribute(
    'data-hour',
    '15',
  );
  await page
    .locator('[data-event-id]', { hasText: 'Busy message 101' })
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect(strip.locator('[aria-current="time"]')).toHaveAttribute(
    'data-hour',
    '17',
  );
});

test('the hour strip works on a day loaded while scrolling', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  await expect(page.locator('#day-2025-10-31')).toBeAttached();
  await page
    .locator('[data-event-id]', { hasText: 'Busy message 31' })
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  const strip = page.locator('#day-2025-10-31 [data-hour-strip]');
  await expect(strip.locator('[aria-current="time"]')).toHaveAttribute(
    'data-hour',
    '10',
  );
  await strip.getByRole('link', { name: '08 點，10 則' }).click();
  await expect(
    page.getByText('Busy message 11', { exact: true }),
  ).toBeInViewport();
});
```

- [ ] **Step 8: Run the e2e suite**

Run: `pnpm nx e2e personal-memories-e2e`
Expected: PASS, including the two new tests and the updated home count.

- [ ] **Step 9: Real-browser check.** With `pnpm nx dev personal-memories` on a fixture data dir,
      open `/day/2025-10-31` in Safari and Chrome. Clicking a bar jumps to that hour; scrolling
      moves the marker; Tab reaches each bar with a visible ring.

- [ ] **Step 10: Commit (controller)**

```bash
git add apps/personal-memories/src/lib/weeks.ts apps/personal-memories/src/lib/stream.ts \
  apps/personal-memories/src/lib/stream.test.ts apps/personal-memories/src/components/DaySection.astro \
  apps/personal-memories/src/scripts/day-stream.ts apps/personal-memories/src/styles/global.css \
  apps/personal-memories/src/cli/fixture.ts apps/personal-memories-e2e/src/timeline.spec.ts
git commit -m "fix(personal-memories): make the hour strip navigate and follow the scroll"
```

### Task 2: Wire `@rainforest-dev/rainforest-react` into the app, plus a tokens-only guard

**Files:**

- Modify: `apps/personal-memories/package.json`, `pnpm-lock.yaml`
- Modify: `apps/personal-memories/tsconfig.json` (project reference)
- Modify: `apps/personal-memories/src/styles/global.css` (import the library's Tailwind layer)
- Modify: `apps/personal-memories/Dockerfile` (build the recipes and the library, as rss-manager does)
- Modify: `apps/personal-memories/src/components/EmptyState.astro` (first consumer: `Alert`)
- Create: `apps/personal-memories/src/contract.test.ts`

**Interfaces:**

- Produces: `import { … } from '@rainforest-dev/rainforest-react'` works in `.tsx` islands and in
  `.astro` (static render); `import { badgeVariants, buttonVariants } from
'@rainforest-dev/rainforest-ui/recipes'` works in `.astro`; `lucide-react` is a dependency; the
  brief's rule "tokens only, checked the way `libs/rainforest-react/src/contract.test.ts` checks
  the library" is enforced for `apps/personal-memories/src`.

- [ ] **Step 1: Write the guard test** (`src/contract.test.ts`)

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC = import.meta.dirname;

const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory())
      return name === '__fixtures__' ? [] : sources(path);
    return /\.(astro|tsx|ts|css)$/.test(name) && !/\.test\.tsx?$/.test(name)
      ? [relative(SRC, path)]
      : [];
  });

const PALETTE =
  /\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline)-(?:black|white|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b/;

describe('tokens only', () => {
  it.each(sources(SRC))('%s uses semantic tokens only', (file) => {
    const src = readFileSync(join(SRC, file), 'utf8');
    expect(src).not.toMatch(/\bdark:/);
    expect(src).not.toMatch(PALETTE);
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
```

- [ ] **Step 2: Run it**

Run: `pnpm nx test personal-memories -- src/contract.test.ts`
Expected: PASS today; it is a guard, and every later task runs it again.

- [ ] **Step 3: Add the dependencies**

```bash
pnpm --filter @rainforest-monorepo/personal-memories add \
  @rainforest-dev/rainforest-react@workspace:* lucide-react@^1.8.0
```

In `tsconfig.json`, add `{ "path": "../../libs/rainforest-react" }` to `references` before the
rainforest-ui entry, then run `pnpm nx sync`.

- [ ] **Step 4: Load the library's Tailwind layer.** In `global.css`, directly after
      `@import 'tailwindcss';`:

```css
@import '@rainforest-dev/rainforest-react/tailwind.css';
```

- [ ] **Step 5: Dockerfile.** After `COPY libs/rainforest-ui/package.json libs/rainforest-ui/` add
      `COPY libs/rainforest-react/package.json libs/rainforest-react/`. After the existing
      `shadcn.ts` `tsc` step add:

```dockerfile
COPY libs/rainforest-ui/src/recipes libs/rainforest-ui/src/recipes
RUN pnpm --filter @rainforest-monorepo/personal-memories exec tsc \
    ../../libs/rainforest-ui/src/recipes/index.ts \
    --rootDir ../../libs/rainforest-ui/src/recipes \
    --outDir ../../libs/rainforest-ui/dist/recipes \
    --declaration --module esnext --target es2022 --moduleResolution bundler --skipLibCheck

COPY libs/rainforest-react libs/rainforest-react
RUN pnpm --filter @rainforest-dev/rainforest-react exec vite build
```

- [ ] **Step 6: First consumer.** Replace `EmptyState.astro` with:

```astro
---
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@rainforest-dev/rainforest-react';

type Props = { path: string | undefined };

const { path } = Astro.props;
---

<Alert>
  <AlertTitle>還沒有時間軸</AlertTitle>
  <AlertDescription>
    <p>
      {
        path ? (
          <>
            找不到 <code>{path}</code>。
          </>
        ) : (
          <>
            尚未設定 <code>MEMORIES_DATA_DIR</code>。
          </>
        )
      }
      先執行匯入：
    </p>
    <pre
      class="bg-muted mt-2 overflow-x-auto rounded-md p-3 text-xs"><code>MEMORIES_DATA_DIR=… pnpm nx run personal-memories:ingest</code></pre>
  </AlertDescription>
</Alert>
```

- [ ] **Step 7: Verify build, dev and Docker**

Run: `pnpm nx build personal-memories` → succeeds.
Run: `MEMORIES_DATA_DIR= pnpm nx dev personal-memories`, open `/` → the Alert renders in both
schemes (repo rule: dev, not only the build).
Run: `docker build -f apps/personal-memories/Dockerfile .` → completes.
Run: `pnpm nx run-many -t lint test typecheck -p personal-memories` → PASS.

- [ ] **Step 8: Commit (controller)**

```bash
git add apps/personal-memories/package.json pnpm-lock.yaml apps/personal-memories/tsconfig.json \
  apps/personal-memories/src/styles/global.css apps/personal-memories/Dockerfile \
  apps/personal-memories/src/components/EmptyState.astro apps/personal-memories/src/contract.test.ts
git commit -m "build(personal-memories): use rainforest-react and guard tokens-only styling"
```

### Task 3: Cover scoring and calendar maths

**Files:**

- Create: `apps/personal-memories/src/lib/cover.ts`, `apps/personal-memories/src/lib/cover.test.ts`
- Create: `apps/personal-memories/src/lib/months.ts`, `apps/personal-memories/src/lib/months.test.ts`

**Interfaces:**

- Consumes: `TimelineEvent`, `PhotoSignals` from `timeline.ts`; `DaySummary` (type) from `days.ts`.
- Produces:
  - `isCoverCandidate(e: TimelineEvent): boolean`
  - `scoreCover(photo: PhotoSignals | undefined): number`
  - `type CoverPick = { id: string; manual: boolean }`
  - `pickCover(events: readonly TimelineEvent[], override?: string): CoverPick | undefined`
  - `toggleCover(current: string | undefined, id: string): string | undefined`
  - `MONTH_RE`, `monthOf(date): string`, `monthLabel(month): string` (`2025 年 11 月`),
    `shiftMonth(month, delta): string`, `calendarWeeks(month): (string | null)[][]` (Sunday
    first), `nearestDate(dates: readonly string[], target: string): string | undefined` (dates
    sorted ascending; ties go to the earlier date), `type ScrubberMonth = { month: string; first:
string; total: number }`, `scrubberMonths(summaries: readonly Pick<DaySummary, 'date' |
'total'>[]): ScrubberMonth[]`.

- [ ] **Step 1: Write the failing cover tests** (`cover.test.ts`)

```ts
import { describe, expect, it } from 'vitest';

import { pickCover, scoreCover, toggleCover } from './cover.ts';
import type { PhotoSignals, TimelineEvent } from './timeline.ts';

const SIGNALS: PhotoSignals = {
  favorite: false,
  people: 0,
  screenshot: false,
  movie: false,
  burstPick: true,
};

const photo = (
  id: string,
  signals: Partial<PhotoSignals> = {},
  at = '2025-11-01T10:00:00+08:00',
): TimelineEvent => ({
  id,
  source: 'photo',
  at,
  author: 'photo',
  media: [{ path: `/lib/${id}.jpg` }],
  photo: { ...SIGNALS, ...signals },
});

describe('pickCover', () => {
  it('prefers a favourite over a higher score', () => {
    const events = [
      photo('hi', { score: 0.95 }),
      photo('fav', { favorite: true, score: 0.3 }),
    ];
    expect(pickCover(events)).toEqual({ id: 'fav', manual: false });
  });

  it('ranks by score, with a bonus for people and penalties for screenshots and unpicked burst frames', () => {
    expect(
      pickCover([photo('a', { score: 0.5 }), photo('b', { score: 0.7 })])?.id,
    ).toBe('b');
    expect(
      pickCover([
        photo('shot', { score: 0.9, screenshot: true }),
        photo('plain', { score: 0.5 }),
      ])?.id,
    ).toBe('plain');
    expect(
      pickCover([
        photo('frame', { score: 0.8, burstPick: false }),
        photo('pick', { score: 0.5 }),
      ])?.id,
    ).toBe('pick');
    expect(
      pickCover([
        photo('solo', { score: 0.6 }),
        photo('us', { score: 0.5, people: 2 }),
      ])?.id,
    ).toBe('us');
  });

  it('never picks a movie, and a day of only movies has no cover', () => {
    expect(
      pickCover([
        photo('mov', { movie: true, favorite: true }),
        photo('still', { score: 0.1 }),
      ])?.id,
    ).toBe('still');
    expect(pickCover([photo('mov', { movie: true })])).toBeUndefined();
  });

  it('uses the manual cover when that photo is on the day', () => {
    const events = [photo('fav', { favorite: true }), photo('mine')];
    expect(pickCover(events, 'mine')).toEqual({ id: 'mine', manual: true });
  });

  it('ignores a manual cover that is no longer on the day', () => {
    const events = [photo('fav', { favorite: true }), photo('other')];
    expect(pickCover(events, 'gone')).toEqual({ id: 'fav', manual: false });
  });

  it('skips messages and media-less photos, and breaks ties by order', () => {
    const text: TimelineEvent = {
      id: 't',
      source: 'line',
      at: '2025-11-01T09:00:00+08:00',
      author: 'Alice',
      text: 'hi',
    };
    const bare: TimelineEvent = { ...photo('bare'), media: undefined };
    expect(pickCover([text, bare])).toBeUndefined();
    expect(pickCover([photo('first'), photo('second')])?.id).toBe('first');
    expect(pickCover([])).toBeUndefined();
  });

  it('treats missing signals as an average photo', () => {
    expect(scoreCover(undefined)).toBe(0.5);
  });
});

describe('toggleCover', () => {
  it('sets a new cover and clears the current one', () => {
    expect(toggleCover(undefined, 'a')).toBe('a');
    expect(toggleCover('b', 'a')).toBe('a');
    expect(toggleCover('a', 'a')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm nx test personal-memories -- src/lib/cover.test.ts`
Expected: FAIL, cannot resolve `./cover.ts`.

- [ ] **Step 3: Implement `cover.ts`**

```ts
import type { PhotoSignals, TimelineEvent } from './timeline.ts';

export const isCoverCandidate = (e: TimelineEvent) =>
  e.source === 'photo' && !!e.media?.length && !e.photo?.movie;

export function scoreCover(photo: PhotoSignals | undefined): number {
  if (!photo) return 0.5;
  return (
    (photo.score ?? 0.5) +
    (photo.people > 0 ? 0.15 : 0) -
    (photo.screenshot ? 0.6 : 0) -
    (photo.burstPick ? 0 : 0.4)
  );
}

export type CoverPick = { id: string; manual: boolean };

/** Chooses a day's cover: the manual one when it is still on the day, else the best photo. */
export function pickCover(
  events: readonly TimelineEvent[],
  override?: string,
): CoverPick | undefined {
  const candidates = events.filter(isCoverCandidate);
  if (override && candidates.some((e) => e.id === override))
    return { id: override, manual: true };
  let best: TimelineEvent | undefined;
  let bestTier = -1;
  let bestScore = -Infinity;
  for (const e of candidates) {
    const tier = e.photo?.favorite ? 1 : 0;
    const score = scoreCover(e.photo);
    if (tier > bestTier || (tier === bestTier && score > bestScore)) {
      best = e;
      bestTier = tier;
      bestScore = score;
    }
  }
  return best && { id: best.id, manual: false };
}

export const toggleCover = (current: string | undefined, id: string) =>
  current === id ? undefined : id;
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm nx test personal-memories -- src/lib/cover.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing month tests** (`months.test.ts`)

```ts
import { describe, expect, it } from 'vitest';

import {
  calendarWeeks,
  MONTH_RE,
  monthLabel,
  nearestDate,
  scrubberMonths,
  shiftMonth,
} from './months.ts';

describe('months', () => {
  it('validates YYYY-MM', () => {
    expect(MONTH_RE.test('2025-11')).toBe(true);
    expect(MONTH_RE.test('2025-13')).toBe(false);
    expect(MONTH_RE.test('2025-1')).toBe(false);
  });

  it('shifts across year boundaries and labels in zh-TW', () => {
    expect(shiftMonth('2025-12', 1)).toBe('2026-01');
    expect(shiftMonth('2025-01', -1)).toBe('2024-12');
    expect(shiftMonth('2025-11', 0)).toBe('2025-11');
    expect(monthLabel('2025-01')).toBe('2025 年 1 月');
  });

  it('lays out Sunday-first weeks padded with null', () => {
    const weeks = calendarWeeks('2025-11');
    expect(weeks).toHaveLength(6);
    expect(weeks[0]).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      '2025-11-01',
    ]);
    expect(weeks[5]).toEqual([
      '2025-11-30',
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(calendarWeeks('2024-02')[4][4]).toBe('2024-02-29');
  });

  it('finds the nearest date, earlier on a tie, even for impossible targets', () => {
    const dates = ['2025-11-01', '2025-11-03', '2025-11-10'];
    expect(nearestDate(dates, '2025-11-02')).toBe('2025-11-01');
    expect(nearestDate(dates, '2025-11-08')).toBe('2025-11-10');
    expect(nearestDate(dates, '1999-01-01')).toBe('2025-11-01');
    expect(nearestDate(dates, '2030-01-01')).toBe('2025-11-10');
    expect(nearestDate(dates, '2025-11-31')).toBe('2025-11-10');
    expect(nearestDate([], '2025-11-01')).toBeUndefined();
  });

  it('sums days into scrubber months across a year change', () => {
    expect(
      scrubberMonths([
        { date: '2024-12-30', total: 2 },
        { date: '2024-12-31', total: 3 },
        { date: '2025-01-02', total: 4 },
      ]),
    ).toEqual([
      { month: '2024-12', first: '2024-12-30', total: 5 },
      { month: '2025-01', first: '2025-01-02', total: 4 },
    ]);
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm nx test personal-memories -- src/lib/months.test.ts`
Expected: FAIL, cannot resolve `./months.ts`.

- [ ] **Step 7: Implement `months.ts`**

```ts
import type { DaySummary } from './days.ts';

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const pad = (n: number) => String(n).padStart(2, '0');

export const monthOf = (date: string) => date.slice(0, 7);

export const monthLabel = (month: string) =>
  `${month.slice(0, 4)} 年 ${Number(month.slice(5, 7))} 月`;

export function shiftMonth(month: string, delta: number): string {
  const i =
    Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + delta;
  return `${Math.floor(i / 12)}-${pad((i % 12) + 1)}`;
}

export function calendarWeeks(month: string): (string | null)[][] {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const lead = new Date(Date.UTC(year, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const slots: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => `${month}-${pad(i + 1)}`),
  ];
  while (slots.length % 7) slots.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < slots.length; i += 7) weeks.push(slots.slice(i, i + 7));
  return weeks;
}

const dayNumber = (date: string) =>
  Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  );

export function nearestDate(
  dates: readonly string[],
  target: string,
): string | undefined {
  let lo = 0;
  let hi = dates.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((dates[mid] ?? '') < target) lo = mid + 1;
    else hi = mid;
  }
  const after = dates[lo];
  const before = dates[lo - 1];
  if (after === undefined || before === undefined) return after ?? before;
  const t = dayNumber(target);
  return Math.abs(t - dayNumber(before)) <= Math.abs(dayNumber(after) - t)
    ? before
    : after;
}

export type ScrubberMonth = { month: string; first: string; total: number };

export function scrubberMonths(
  summaries: readonly Pick<DaySummary, 'date' | 'total'>[],
): ScrubberMonth[] {
  const out: ScrubberMonth[] = [];
  for (const { date, total } of summaries) {
    const month = monthOf(date);
    const last = out.at(-1);
    if (last?.month === month) last.total += total;
    else out.push({ month, first: date, total });
  }
  return out;
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `pnpm nx test personal-memories -- src/lib/months.test.ts src/lib/cover.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit (controller)**

```bash
git add apps/personal-memories/src/lib/cover.ts apps/personal-memories/src/lib/cover.test.ts \
  apps/personal-memories/src/lib/months.ts apps/personal-memories/src/lib/months.test.ts
git commit -m "feat(personal-memories): score day covers and add calendar maths"
```

### Task 4: The month calendar page

**Files:**

- Create: `apps/personal-memories/src/lib/month-view.ts`, `apps/personal-memories/src/lib/month-view.test.ts`
- Create: `apps/personal-memories/src/pages/month/[month].astro`
- Create: `apps/personal-memories/src/components/month/MonthCalendar.astro`
- Create: `apps/personal-memories/src/components/month/MonthCellBody.astro`
- Create: `apps/personal-memories/src/components/month/MonthNav.tsx`
- Modify: `apps/personal-memories/src/lib/weeks.ts` (export `WEEKDAYS_ZH`)
- Test: `apps/personal-memories-e2e/src/timeline.spec.ts`

**Interfaces:**

- Consumes: `pickCover` (Task 3); `calendarWeeks`, `MONTH_RE`, `monthOf`, `monthLabel`,
  `nearestDate`, `shiftMonth` (Task 3); `DayIndex`, `indexDays` from `days.ts`; `excerptOf` from
  `notes/attach.ts`; `DayNote` from `notes/types.ts`; `thumbUrl`, `thumbSrcset` from `stream.ts`;
  `notesStore()` from `notes/store.ts`.
- Produces:
  - `type MonthCell = { date: string; day: number; total: number; noted: boolean; cover?: string; memory?: string; excerpt?: string }`
  - `type MonthView = { month: string; weeks: (MonthCell | null)[][]; total: number; prev?: string; next?: string }`
  - `type NoteReader = (date: string) => { note: DayNote; parseError?: true } | undefined`
  - `firstLine(body: string): string | undefined`
  - `dayCell(date: string, events: readonly TimelineEvent[], noted: boolean, read: NoteReader): MonthCell`
  - `monthView(index: DayIndex, month: string, noted: ReadonlySet<string>, read: NoteReader): MonthView | undefined`
    (undefined for a malformed month or one outside the first-to-last month with events)
  - Route `/month/<YYYY-MM>`: 200 with the calendar; otherwise 404 with a link to the nearest day.
  - Presentation: `MonthCalendar.astro` props `{ view: MonthView; morph?: string }` (Task 11
    passes `morph`); each day with events is `a[data-date][data-morph="day-<date>"]`, and the
    calendar itself is `section[data-morph="month-<YYYY-MM>"]`.
  - `MonthNav` props `{ prev?: string; next?: string }`.

- [ ] **Step 1: Write the failing tests** (`month-view.test.ts`)

```ts
import { describe, expect, it } from 'vitest';

import { indexDays } from './days.ts';
import { firstLine, monthView, type NoteReader } from './month-view.ts';
import { emptyNote } from './notes/format.ts';
import type { TimelineEvent } from './timeline.ts';

const SIGNALS = {
  favorite: false,
  people: 0,
  screenshot: false,
  movie: false,
  burstPick: true,
};

const events: TimelineEvent[] = [
  {
    id: 'm1',
    source: 'line',
    at: '2025-11-01T09:00:00+08:00',
    author: 'Alice',
    text: 'Morning   there',
  },
  {
    id: 'p1',
    source: 'photo',
    at: '2025-11-01T10:00:00+08:00',
    author: 'photo',
    media: [{ path: '/a.jpg' }],
    photo: { ...SIGNALS, favorite: true },
  },
  {
    id: 'p2',
    source: 'photo',
    at: '2025-11-01T10:05:00+08:00',
    author: 'photo',
    media: [{ path: '/b.jpg' }],
    photo: SIGNALS,
  },
  {
    id: 'm2',
    source: 'slack',
    at: '2025-11-03T08:00:00+08:00',
    author: 'Bob',
    text: 'Coffee first',
  },
  {
    id: 'm3',
    source: 'line',
    at: '2025-12-02T08:00:00+08:00',
    author: 'Bob',
    text: 'December',
  },
];
const index = indexDays(events);

const notes: Record<string, ReturnType<NoteReader>> = {
  '2025-11-01': {
    note: { ...emptyNote('2025-11-01'), body: '## 下雨\n\n其他', cover: 'p2' },
  },
  '2025-11-03': { note: { ...emptyNote('2025-11-03'), body: '- 咖啡' } },
  '2025-11-05': { note: emptyNote('2025-11-05'), parseError: true },
};
const read: NoteReader = (date) => notes[date];
const noted = new Set(Object.keys(notes));

const cellOf = (view: ReturnType<typeof monthView>, date: string) =>
  view?.weeks.flat().find((c) => c?.date === date);

describe('monthView', () => {
  it('rejects malformed months and months outside the data', () => {
    expect(monthView(index, '2025-13', noted, read)).toBeUndefined();
    expect(monthView(index, '2025-10', noted, read)).toBeUndefined();
    expect(monthView(index, '2026-01', noted, read)).toBeUndefined();
  });

  it('builds Sunday-first weeks with totals and neighbours inside the range', () => {
    const view = monthView(index, '2025-11', noted, read);
    expect(view?.weeks[0]?.[6]?.date).toBe('2025-11-01');
    expect(view?.weeks[0]?.[0]).toBeNull();
    expect(view?.total).toBe(4);
    expect(view?.prev).toBeUndefined();
    expect(view?.next).toBe('2025-12');
    expect(monthView(index, '2025-12', noted, read)?.prev).toBe('2025-11');
  });

  it('uses the manual cover and keeps days without events', () => {
    const view = monthView(index, '2025-11', noted, read);
    expect(cellOf(view, '2025-11-01')).toMatchObject({
      total: 3,
      noted: true,
      cover: 'p2',
    });
    expect(cellOf(view, '2025-11-02')).toEqual({
      date: '2025-11-02',
      day: 2,
      total: 0,
      noted: false,
    });
  });

  it('falls back to the automatic cover when the manual one is not on the day', () => {
    const stale: NoteReader = (date) =>
      date === '2025-11-01'
        ? { note: { ...emptyNote(date), cover: 'gone' } }
        : read(date);
    expect(
      cellOf(monthView(index, '2025-11', noted, stale), '2025-11-01')?.cover,
    ).toBe('p1');
  });

  it('takes the first memory line and the first message excerpt', () => {
    const view = monthView(index, '2025-11', noted, read);
    expect(cellOf(view, '2025-11-03')).toMatchObject({
      memory: '咖啡',
      excerpt: 'Coffee first',
    });
    expect(cellOf(view, '2025-11-01')).toMatchObject({
      memory: '下雨',
      excerpt: 'Morning there',
    });
  });

  it('treats an unreadable note as noted without memory or manual cover', () => {
    expect(
      cellOf(monthView(index, '2025-11', noted, read), '2025-11-05'),
    ).toEqual({
      date: '2025-11-05',
      day: 5,
      total: 0,
      noted: true,
    });
  });
});

describe('firstLine', () => {
  it('strips Markdown markers and skips blank lines', () => {
    expect(firstLine('\n\n## 標題\n內文')).toBe('標題');
    expect(firstLine('> 引用')).toBe('引用');
    expect(firstLine('1. 第一')).toBe('第一');
    expect(firstLine('  \n')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm nx test personal-memories -- src/lib/month-view.test.ts`
Expected: FAIL, cannot resolve `./month-view.ts`.

- [ ] **Step 3: Implement `month-view.ts`**

```ts
import { pickCover } from './cover.ts';
import type { DayIndex } from './days.ts';
import { calendarWeeks, MONTH_RE, monthOf, shiftMonth } from './months.ts';
import { excerptOf } from './notes/attach.ts';
import type { DayNote } from './notes/types.ts';
import type { TimelineEvent } from './timeline.ts';

export type MonthCell = {
  date: string;
  day: number;
  total: number;
  noted: boolean;
  cover?: string;
  memory?: string;
  excerpt?: string;
};

export type MonthView = {
  month: string;
  weeks: (MonthCell | null)[][];
  total: number;
  prev?: string;
  next?: string;
};

export type NoteReader = (
  date: string,
) => { note: DayNote; parseError?: true } | undefined;

const MARKER = /^\s*(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+\.\s+)/;

export function firstLine(body: string): string | undefined {
  for (const raw of body.split('\n')) {
    const line = raw.replace(MARKER, '').trim();
    if (line) return line;
  }
  return undefined;
}

export function dayCell(
  date: string,
  events: readonly TimelineEvent[],
  noted: boolean,
  read: NoteReader,
): MonthCell {
  const cell: MonthCell = {
    date,
    day: Number(date.slice(8, 10)),
    total: events.length,
    noted,
  };
  const result = noted ? read(date) : undefined;
  const note = result && !result.parseError ? result.note : undefined;
  const cover = pickCover(events, note?.cover);
  if (cover) cell.cover = cover.id;
  const memory = note && firstLine(note.body);
  if (memory) cell.memory = memory;
  const message = events.find((e) => e.source !== 'photo' && e.text?.trim());
  if (message) cell.excerpt = excerptOf(message, 60);
  return cell;
}

export function monthView(
  index: DayIndex,
  month: string,
  noted: ReadonlySet<string>,
  read: NoteReader,
): MonthView | undefined {
  const first = index.dates[0];
  const last = index.dates.at(-1);
  if (!MONTH_RE.test(month) || !first || !last) return undefined;
  if (month < monthOf(first) || month > monthOf(last)) return undefined;
  let total = 0;
  const weeks = calendarWeeks(month).map((week) =>
    week.map((date) => {
      if (!date) return null;
      const events = index.byDate.get(date) ?? [];
      total += events.length;
      return dayCell(date, events, noted.has(date), read);
    }),
  );
  const view: MonthView = { month, weeks, total };
  if (month > monthOf(first)) view.prev = shiftMonth(month, -1);
  if (month < monthOf(last)) view.next = shiftMonth(month, 1);
  return view;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm nx test personal-memories -- src/lib/month-view.test.ts`
Expected: PASS.

- [ ] **Step 5: Presentation.** In `weeks.ts` change `const WEEKDAYS_ZH` to
      `export const WEEKDAYS_ZH`. Create `MonthCellBody.astro`, which lays out one day for the
      desktop cell (`layout="cell"`) or the phone row (`layout="row"`):

```astro
---
import { Skeleton } from '@rainforest-dev/rainforest-react';
import { badgeVariants } from '@rainforest-dev/rainforest-ui/recipes';

import type { MonthCell } from '../../lib/month-view.ts';
import { thumbSrcset, thumbUrl } from '../../lib/stream.ts';

type Props = { cell: MonthCell; layout: 'cell' | 'row' };

const { cell, layout } = Astro.props;
const row = layout === 'row';
const showText = row || !cell.cover;
---

<span
  class:list={[
    'text-meta flex items-center gap-1.5 font-medium tabular-nums',
    !row && 'justify-between',
  ]}
>
  <span class="flex items-center gap-1.5">
    {cell.day}
    {cell.noted && <span class="bg-foreground size-1.5 rounded-full" />}
  </span>
  {
    !row && (
      <span class={badgeVariants({ variant: 'muted' })}>{cell.total} 則</span>
    )
  }
</span>
{
  cell.cover ? (
    <span
      class:list={[
        'relative block overflow-hidden rounded-md',
        row ? 'size-12' : 'min-h-10 flex-1',
      ]}
    >
      <Skeleton className="absolute inset-0" />
      <img
        src={thumbUrl(cell.cover, 0, 240)}
        srcset={thumbSrcset(cell.cover, 0)}
        sizes="(min-width: 640px) 160px, 52px"
        alt=""
        loading="lazy"
        class="absolute inset-0 size-full object-cover"
      />
    </span>
  ) : (
    row && <span />
  )
}
{
  showText &&
    (cell.memory ? (
      <span class="text-meta line-clamp-3">{cell.memory}</span>
    ) : cell.excerpt ? (
      <span class="text-meta text-muted-foreground line-clamp-3">
        「{cell.excerpt}」
      </span>
    ) : (
      row && <span />
    ))
}
{
  row && (
    <span class={badgeVariants({ variant: 'muted' })}>{cell.total} 則</span>
  )
}
```

Precedence in the desktop cell is cover, then memory line, then excerpt (`showText`). The phone
row shows the thumbnail and the text side by side, as the visual spec's
`grid-cols-[40px_52px_1fr_auto]` row does.

Create `MonthCalendar.astro`:

```astro
---
import type { MonthCell, MonthView } from '../../lib/month-view.ts';
import { dayHeading, WEEKDAYS_ZH } from '../../lib/weeks.ts';
import MonthCellBody from './MonthCellBody.astro';

type Props = { view: MonthView; morph?: string | undefined };

const { view, morph } = Astro.props;
const FOCUS =
  'focus-visible:ring-ring focus-visible:ring-offset-background outline-none focus-visible:ring-2 focus-visible:ring-offset-2';
const label = (c: MonthCell) =>
  `${dayHeading(c.date)}，${c.total} 則${c.noted ? ' · 已寫回憶' : ''}`;
const days = view.weeks.flat().filter((c): c is MonthCell => c !== null);
const monthKey = `month-${view.month}`;
const morphAttrs = (key: string) =>
  morph === key
    ? { style: `view-transition-name: ${key}`, 'data-morph-target': '' }
    : {};
---

<section
  data-month={view.month}
  data-morph={monthKey}
  tabindex="-1"
  class="outline-none"
  {...morphAttrs(monthKey)}
>
  <div class="hidden sm:block">
    <div
      aria-hidden="true"
      class="text-muted-foreground mb-2 grid grid-cols-7 gap-2 text-xs"
    >
      {WEEKDAYS_ZH.map((d) => <span class="px-2">{d}</span>)}
    </div>
    <ol class="grid grid-cols-7 gap-2">
      {
        view.weeks.flat().map((cell) =>
          !cell ? (
            <li aria-hidden="true" />
          ) : (
            <li>
              {cell.total > 0 ? (
                <a
                  href={`/day/${cell.date}`}
                  data-date={cell.date}
                  data-morph={`day-${cell.date}`}
                  aria-label={label(cell)}
                  class:list={[
                    'bg-card ring-border hover:bg-accent/60 flex h-[104px] flex-col gap-1.5 overflow-hidden rounded-lg p-2 ring-1',
                    FOCUS,
                  ]}
                  {...morphAttrs(`day-${cell.date}`)}
                >
                  <MonthCellBody cell={cell} layout="cell" />
                </a>
              ) : (
                <div
                  data-date={cell.date}
                  class="ring-border text-muted-foreground text-meta h-[104px] rounded-lg p-2 tabular-nums ring-1 ring-inset"
                >
                  {cell.day}
                </div>
              )}
            </li>
          ),
        )
      }
    </ol>
  </div>
  <ol class="divide-border flex flex-col divide-y sm:hidden">
    {
      days.map((cell) =>
        cell.total > 0 ? (
          <li>
            <a
              href={`/day/${cell.date}`}
              data-date={cell.date}
              data-morph={`day-${cell.date}`}
              aria-label={label(cell)}
              class:list={[
                'grid h-16 grid-cols-[40px_52px_1fr_auto] items-center gap-2',
                FOCUS,
              ]}
              {...morphAttrs(`day-${cell.date}`)}
            >
              <MonthCellBody cell={cell} layout="row" />
            </a>
          </li>
        ) : (
          <li
            data-date={cell.date}
            class="text-muted-foreground text-meta flex h-10 items-center tabular-nums"
          >
            {cell.day}
          </li>
        ),
      )
    }
  </ol>
</section>
```

Create `MonthNav.tsx`:

```tsx
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@rainforest-dev/rainforest-react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type Props = { prev?: string | undefined; next?: string | undefined };

function Step({
  month,
  label,
  children,
}: {
  month: string | undefined;
  label: string;
  children: ReactNode;
}) {
  const button = month ? (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      nativeButton={false}
      render={<a href={`/month/${month}`} />}
    />
  ) : (
    <Button variant="ghost" size="icon" aria-label={label} disabled />
  );
  return (
    <Tooltip>
      <TooltipTrigger render={button}>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function MonthNav({ prev, next }: Props) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        <Step month={prev} label="上個月">
          <ChevronLeftIcon />
        </Step>
        <Step month={next} label="下個月">
          <ChevronRightIcon />
        </Step>
      </div>
    </TooltipProvider>
  );
}
```

- [ ] **Step 6: The route** (`src/pages/month/[month].astro`)

```astro
---
import EmptyState from '../../components/EmptyState.astro';
import MonthCalendar from '../../components/month/MonthCalendar.astro';
import { MonthNav } from '../../components/month/MonthNav.tsx';
import Layout from '../../layouts/Layout.astro';
import { indexDays } from '../../lib/days.ts';
import { monthView } from '../../lib/month-view.ts';
import { MONTH_RE, monthLabel, nearestDate } from '../../lib/months.ts';
import { notesStore } from '../../lib/notes/store.ts';
import { getTimeline } from '../../lib/store.ts';
import { dayHeading } from '../../lib/weeks.ts';

const { month = '' } = Astro.params;
const state = getTimeline();
const index =
  state.status === 'ready' ? indexDays(state.timeline.events) : undefined;
const store = notesStore();
const view = index
  ? monthView(index, month, store?.dates() ?? new Set(), (d) => store?.read(d))
  : undefined;
const nearest =
  index && !view
    ? MONTH_RE.test(month)
      ? nearestDate(index.dates, `${month}-01`)
      : index.dates.at(-1)
    : undefined;
if (index && !view) Astro.response.status = 404;
---

<Layout title={`${month} · Memories`} wide>
  {
    state.status === 'missing' ? (
      <EmptyState path={state.path} />
    ) : !view ? (
      <p class="text-body">
        這個月沒有紀錄。
        {nearest && (
          <a class="underline" href={`/day/${nearest}`}>
            {dayHeading(nearest)}
          </a>
        )}
      </p>
    ) : (
      <>
        <header class="mb-6 flex items-center justify-between gap-4">
          <h1 class="text-title font-semibold tracking-[-0.01em]">
            {monthLabel(view.month)}
          </h1>
          <MonthNav client:idle prev={view.prev} next={view.next} />
        </header>
        {view.total === 0 && (
          <p class="text-muted-foreground text-meta mb-4">這個月沒有紀錄</p>
        )}
        <MonthCalendar view={view} />
      </>
    )
  }
</Layout>
```

- [ ] **Step 7: E2E test** (insert right after the home test, before any note is written)

```ts
test('the month calendar shows each day with its cover or a line', async ({
  page,
}) => {
  const response = await page.goto('/month/2025-11');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '2025 年 11 月',
  );
  const cell = (date: string) => page.locator(`a[data-date="${date}"]:visible`);
  await expect(cell('2025-11-01').locator('img')).toHaveAttribute(
    'src',
    /AAAAAAAA-0000-0000-0000-000000000001/,
  );
  await expect(cell('2025-11-03')).toContainText('「New week, new plans」');
  await expect(page.locator('[data-date="2025-11-05"]:visible')).toHaveText(
    '5',
  );
  await cell('2025-11-03').click();
  await expect(page).toHaveURL(/\/day\/2025-11-03$/);

  expect((await page.goto('/month/1999-01'))?.status()).toBe(404);
  await expect(
    page.getByRole('link', { name: '2025-10-31（週五）' }),
  ).toBeVisible();
});
```

- [ ] **Step 8: Run the tests and check in a browser**

Run: `pnpm nx test personal-memories -- src/lib/month-view.test.ts`, then
`pnpm nx e2e personal-memories-e2e -- --grep "month calendar"`.
Expected: PASS.
Browser: `/month/2025-11` at 1280 and 390, light and dark, in Safari and Chrome. Covers show a
Skeleton until they load; days without events keep only their number; the prev/next Tooltips read
上個月 / 下個月.

- [ ] **Step 9: Commit (controller)**

```bash
git add apps/personal-memories/src/lib/month-view.ts apps/personal-memories/src/lib/month-view.test.ts \
  apps/personal-memories/src/lib/weeks.ts apps/personal-memories/src/pages/month \
  apps/personal-memories/src/components/month apps/personal-memories-e2e/src/timeline.spec.ts
git commit -m "feat(personal-memories): add the month calendar with covers"
```

### Task 5: The cover travels with the note draft

**Files:**

- Create: `apps/personal-memories/src/lib/notes/draft.ts`, `apps/personal-memories/src/lib/notes/draft.test.ts`
- Modify: `apps/personal-memories/src/components/notes/useNoteDraft.ts`
- Test: `apps/personal-memories/src/lib/notes/store.test.ts`

**Interfaces:**

- Consumes: `NotePayload` (already has `cover?`), `ResolvedAnnotation`, `Annotation`.
- Produces: `type Draft = { body: string; annotations: ResolvedAnnotation[]; cover?: string | undefined }`,
  re-exported from `useNoteDraft.ts` so the existing `import type { Draft } from './useNoteDraft.ts'`
  lines keep working; `toDraft(p: NotePayload): Draft`; `toAnnotation(a: ResolvedAnnotation):
Annotation`; `saveInput(p: Pick<NotePayload, 'date' | 'version'>, d: Draft)`, the `saveNote`
  input with `cover` taken from the draft; `withCover(d: Draft, cover: string | undefined): Draft`.

- [ ] **Step 1: Write the failing tests** (`draft.test.ts`)

```ts
import { describe, expect, it } from 'vitest';

import type { ResolvedAnnotation } from './attach.ts';
import { saveInput, toDraft, withCover } from './draft.ts';
import type { NotePayload } from './payload.ts';

const annotation: ResolvedAnnotation = {
  eventId: 'e1',
  at: '2025-11-01T09:00:00+08:00',
  source: 'line',
  author: 'Alice',
  excerpt: 'hi',
  body: 'note',
  status: 'exact',
};

const payload: NotePayload = {
  date: '2025-11-01',
  body: '下雨',
  annotations: [annotation],
  cover: 'P1',
  version: 'v1',
  writable: true,
};

describe('draft', () => {
  it('carries the cover from the payload into the draft', () => {
    expect(toDraft(payload).cover).toBe('P1');
    expect(toDraft({ ...payload, cover: undefined }).cover).toBeUndefined();
  });

  it('saves the draft cover, not the payload one, and strips annotation status', () => {
    expect(saveInput(payload, withCover(toDraft(payload), 'P2'))).toEqual({
      date: '2025-11-01',
      body: '下雨',
      annotations: [
        {
          eventId: 'e1',
          at: annotation.at,
          source: 'line',
          author: 'Alice',
          excerpt: 'hi',
          body: 'note',
        },
      ],
      cover: 'P2',
      version: 'v1',
    });
    expect(
      saveInput(payload, withCover(toDraft(payload), undefined)).cover,
    ).toBeUndefined();
  });
});
```

Append inside the `describe('NotesStore')` block of `store.test.ts`:

```ts
it('writes a cover-only note and deletes it once the cover is cleared', () => {
  const store = createNotesStore(root);
  const first = store.write(
    '2025-11-01',
    { body: '', annotations: [], cover: 'DDDD' },
    '',
  );
  const path = join(root, '2025', '2025-11-01.md');
  expect(readFileSync(path, 'utf8')).toMatch(/^cover: DDDD$/m);
  const v1 = (first as { version: string }).version;
  expect(store.write('2025-11-01', { body: '', annotations: [] }, v1)).toEqual({
    ok: true,
    version: '',
  });
  expect(existsSync(path)).toBe(false);
});

it('drops the cover when an edit omits it', () => {
  const store = createNotesStore(root);
  const first = store.write('2025-11-01', { ...EDIT, cover: 'DDDD' }, '');
  store.write('2025-11-01', EDIT, (first as { version: string }).version);
  expect(store.read('2025-11-01').note.cover).toBeUndefined();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm nx test personal-memories -- src/lib/notes/draft.test.ts src/lib/notes/store.test.ts`
Expected: `draft.test.ts` FAILS (cannot resolve `./draft.ts`). The two store tests already PASS;
they pin the store behaviour the draft must work around (an edit without `cover` clears it).

- [ ] **Step 3: Implement `draft.ts`**

```ts
import type { ResolvedAnnotation } from './attach.ts';
import type { NotePayload } from './payload.ts';
import type { Annotation } from './types.ts';

export type Draft = {
  body: string;
  annotations: ResolvedAnnotation[];
  cover?: string | undefined;
};

export const toDraft = (p: NotePayload): Draft => ({
  body: p.body,
  annotations: p.annotations,
  cover: p.cover,
});

export const toAnnotation = (a: ResolvedAnnotation): Annotation => ({
  eventId: a.eventId,
  at: a.at,
  source: a.source,
  author: a.author,
  excerpt: a.excerpt,
  body: a.body,
});

export const saveInput = (
  p: Pick<NotePayload, 'date' | 'version'>,
  d: Draft,
) => ({
  date: p.date,
  body: d.body,
  annotations: d.annotations.map(toAnnotation),
  cover: d.cover,
  version: p.version,
});

export const withCover = (d: Draft, cover: string | undefined): Draft => ({
  ...d,
  cover,
});
```

In `useNoteDraft.ts`: delete the local `Draft`, `toDraft` and `toAnnotation`; add
`import { type Draft, saveInput, toDraft } from '../../lib/notes/draft.ts';` and
`export type { Draft } from '../../lib/notes/draft.ts';`; in `save`, call
`actions.saveNote.orThrow(saveInput(p, d))`.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm nx run-many -t test typecheck -p personal-memories`, then
`pnpm nx e2e personal-memories-e2e -- --grep "saved to the vault"`.
Expected: PASS.

- [ ] **Step 5: Commit (controller)**

```bash
git add apps/personal-memories/src/lib/notes/draft.ts apps/personal-memories/src/lib/notes/draft.test.ts \
  apps/personal-memories/src/lib/notes/store.test.ts apps/personal-memories/src/components/notes/useNoteDraft.ts
git commit -m "refactor(personal-memories): keep the cover in the note draft"
```

### Task 6: Lightbox with 設為封面, reachable from every burst tile (owner #4)

**Files:**

- Create: `apps/personal-memories/src/lib/lightbox.ts`, `apps/personal-memories/src/lib/lightbox.test.ts`
- Create: `apps/personal-memories/src/lib/client/overlays.ts`, `events.ts`, `day-url.ts`
- Create: `apps/personal-memories/src/components/useOverlay.ts`
- Create: `apps/personal-memories/src/components/lightbox/Lightbox.tsx`, `LightboxImage.tsx`, `useLightbox.ts`
- Modify: `apps/personal-memories/src/components/DaySection.astro` (tile attributes, `data-auto-cover`)
- Modify: `apps/personal-memories/src/scripts/day-stream.ts` (`watchLightbox`; its event types move to `events.ts`)
- Modify: `apps/personal-memories/src/components/NotePanel.tsx` (mount and wire the lightbox)
- Test: `apps/personal-memories-e2e/src/timeline.spec.ts`

**Interfaces:**

- Consumes: `pickCover`, `toggleCover` (Task 3); `withCover`, `Draft` (Task 5); `thumbUrl`;
  `taipeiDate`, `taipeiTime`.
- Produces:
  - `type LightboxItem = { id: string; at: string; alt: string; width?: number; height?: number; video: boolean }`
  - `type LightboxRequest = { date: string; items: LightboxItem[]; index: number; autoCover?: string }`
  - `itemFromDataset(d: Readonly<Record<string, string | undefined>>): LightboxItem | undefined`
  - `stepIndex(index: number, count: number, delta: number): number` (clamped, no wrap)
  - `swipeDelta(dx: number, dy: number, min?: number): -1 | 0 | 1` (a left swipe returns `1`)
  - `positionLabel(index: number, count: number): string` (`照片 · 4 / 7`)
  - `type CoverControl = 'hidden' | 'loading' | 'manual' | 'auto' | 'other'`
  - `coverControl(o: { writable: boolean; loaded: boolean; item: LightboxItem; cover: string | undefined; coverOnDay: boolean; autoCover: string | undefined }): CoverControl`
  - `holdOverlay(): () => void`, `isOverlayOpen(): boolean` (client), `useOverlay(open: boolean): void`
  - `dayInUrl(): string | undefined`, the date in `/day/<date>` of `location.pathname`
  - `src/lib/client/events.ts`: `AnnotateDetail`, `LightboxDetail = LightboxRequest & { trigger: HTMLElement }`,
    and the global `DocumentEventMap` entries; later tasks add their events here.
  - `useLightbox()` → `{ request, trigger, step, select, close }`
  - `Lightbox` props `{ items, index, cover, finalFocus, onStep, onSelect, onToggleCover, onClose }`

- [ ] **Step 1: Write the failing tests** (`lightbox.test.ts`)

```ts
import { describe, expect, it } from 'vitest';

import {
  coverControl,
  itemFromDataset,
  type LightboxItem,
  positionLabel,
  stepIndex,
  swipeDelta,
} from './lightbox.ts';

const item: LightboxItem = {
  id: 'P1',
  at: '2025-11-01T10:00:00+08:00',
  alt: '',
  video: false,
};

describe('itemFromDataset', () => {
  it('reads a tile dataset and rejects one without id or time', () => {
    expect(
      itemFromDataset({
        eventId: 'P1',
        at: item.at,
        excerpt: '照片',
        width: '4032',
        height: 'x',
        video: '',
      }),
    ).toEqual({
      id: 'P1',
      at: item.at,
      alt: '照片',
      width: 4032,
      height: undefined,
      video: true,
    });
    expect(itemFromDataset({ at: item.at })).toBeUndefined();
    expect(itemFromDataset({ eventId: 'P1' })).toBeUndefined();
  });
});

describe('stepIndex', () => {
  it('clamps at both ends and reaches the end of a large burst', () => {
    expect(stepIndex(0, 7, -1)).toBe(0);
    expect(stepIndex(6, 7, 1)).toBe(6);
    expect(stepIndex(3, 7, 1)).toBe(4);
    let i = 3;
    for (let n = 0; n < 400; n++) i = stepIndex(i, 300, 1);
    expect(i).toBe(299);
    expect(stepIndex(0, 0, 1)).toBe(0);
  });
});

describe('swipeDelta', () => {
  it('turns a horizontal swipe into a step and ignores short or vertical drags', () => {
    expect(swipeDelta(-80, 5)).toBe(1);
    expect(swipeDelta(80, -5)).toBe(-1);
    expect(swipeDelta(30, 0)).toBe(0);
    expect(swipeDelta(60, 70)).toBe(0);
  });
});

describe('positionLabel', () => {
  it('counts from one', () => {
    expect(positionLabel(3, 7)).toBe('照片 · 4 / 7');
  });
});

describe('coverControl', () => {
  const base = {
    writable: true,
    loaded: true,
    item,
    cover: undefined,
    coverOnDay: false,
    autoCover: 'P9',
  };

  it('hides for read-only notes and videos, and waits for the day to load', () => {
    expect(coverControl({ ...base, writable: false })).toBe('hidden');
    expect(coverControl({ ...base, item: { ...item, video: true } })).toBe(
      'hidden',
    );
    expect(coverControl({ ...base, loaded: false })).toBe('loading');
  });

  it('tells the manual cover, the automatic one and any other photo apart', () => {
    expect(coverControl({ ...base, cover: 'P1', coverOnDay: true })).toBe(
      'manual',
    );
    expect(coverControl({ ...base, autoCover: 'P1' })).toBe('auto');
    expect(
      coverControl({ ...base, cover: 'P5', coverOnDay: true, autoCover: 'P1' }),
    ).toBe('other');
    expect(coverControl(base)).toBe('other');
  });

  it('treats the automatic cover as current when the manual one left the day', () => {
    expect(
      coverControl({
        ...base,
        cover: 'gone',
        coverOnDay: false,
        autoCover: 'P1',
      }),
    ).toBe('auto');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm nx test personal-memories -- src/lib/lightbox.test.ts`
Expected: FAIL, cannot resolve `./lightbox.ts`.

- [ ] **Step 3: Implement `lightbox.ts`**

```ts
export type LightboxItem = {
  id: string;
  at: string;
  alt: string;
  width?: number | undefined;
  height?: number | undefined;
  video: boolean;
};

export type LightboxRequest = {
  date: string;
  items: LightboxItem[];
  index: number;
  autoCover?: string | undefined;
};

const positive = (raw: string | undefined) => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export function itemFromDataset(
  d: Readonly<Record<string, string | undefined>>,
): LightboxItem | undefined {
  const id = d['eventId'];
  const at = d['at'];
  if (!id || !at) return undefined;
  return {
    id,
    at,
    alt: d['excerpt'] ?? '',
    width: positive(d['width']),
    height: positive(d['height']),
    video: d['video'] !== undefined,
  };
}

export const stepIndex = (index: number, count: number, delta: number) =>
  Math.min(Math.max(index + delta, 0), Math.max(count - 1, 0));

export function swipeDelta(dx: number, dy: number, min = 48): -1 | 0 | 1 {
  if (Math.abs(dx) < min || Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? 1 : -1;
}

export const positionLabel = (index: number, count: number) =>
  `照片 · ${index + 1} / ${count}`;

export type CoverControl = 'hidden' | 'loading' | 'manual' | 'auto' | 'other';

export function coverControl(o: {
  writable: boolean;
  loaded: boolean;
  item: LightboxItem;
  cover: string | undefined;
  coverOnDay: boolean;
  autoCover: string | undefined;
}): CoverControl {
  if (!o.writable || o.item.video) return 'hidden';
  if (!o.loaded) return 'loading';
  if (o.cover === o.item.id) return 'manual';
  if ((!o.cover || !o.coverOnDay) && o.autoCover === o.item.id) return 'auto';
  return 'other';
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm nx test personal-memories -- src/lib/lightbox.test.ts`
Expected: PASS.

- [ ] **Step 5: Client plumbing.** `src/lib/client/overlays.ts`:

```ts
const ATTR = 'data-overlays';

export function holdOverlay(): () => void {
  const root = document.documentElement;
  root.setAttribute(ATTR, String(Number(root.getAttribute(ATTR) ?? '0') + 1));
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    const left = Number(root.getAttribute(ATTR) ?? '1') - 1;
    if (left > 0) root.setAttribute(ATTR, String(left));
    else root.removeAttribute(ATTR);
  };
}

export const isOverlayOpen = () => document.documentElement.hasAttribute(ATTR);
```

`src/components/useOverlay.ts`:

```ts
import { useEffect } from 'react';

import { holdOverlay } from '../lib/client/overlays.ts';

export function useOverlay(open: boolean) {
  useEffect(() => (open ? holdOverlay() : undefined), [open]);
}
```

`src/lib/client/day-url.ts`:

```ts
export const dayInUrl = () =>
  /^\/day\/(\d{4}-\d{2}-\d{2})\/?$/.exec(location.pathname)?.[1];
```

`src/lib/client/events.ts`. Move the `declare global` block and `AnnotateDetail` out of
`day-stream.ts` into here, and import `AnnotateDetail` from here in `day-stream.ts`:

```ts
import type { LightboxRequest } from '../lightbox.ts';

export type AnnotateDetail = {
  eventId: string;
  at: string;
  source: string;
  author: string;
  excerpt: string;
};

export type LightboxDetail = LightboxRequest & { trigger: HTMLElement };

declare global {
  interface DocumentEventMap {
    'memories:day': CustomEvent<{ date: string }>;
    'memories:day-restored': CustomEvent<{ date: string }>;
    'memories:annotate': CustomEvent<AnnotateDetail>;
    'memories:lightbox': CustomEvent<LightboxDetail>;
  }
}
```

- [ ] **Step 6: Stream side.** In `DaySection.astro`, import `pickCover` and add
      `data-auto-cover={pickCover(events)?.id}` to the `<section>`. On each burst
      `li[data-event-id]` add `data-width={media?.width}`, `data-height={media?.height}` and
      `data-video={event.photo?.movie ? '' : undefined}`, and on its tile `<a>` add
      `data-lightbox`. The `+N` tile is one of these tiles, so it opens the lightbox at its own
      index, and the filmstrip reaches every hidden overflow photo.

In `day-stream.ts` add, and call from `startDayStream()`:

```ts
const LIGHTBOX_READY = 'data-lightbox-ready';

function watchLightbox(stream: HTMLElement) {
  stream.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    if (!document.documentElement.hasAttribute(LIGHTBOX_READY)) return;
    const link = (event.target as Element).closest<HTMLElement>(
      'a[data-lightbox]',
    );
    const tile = link?.closest<HTMLElement>('li[data-event-id]');
    const burst = tile?.closest<HTMLElement>('[data-burst]');
    const section = tile?.closest<HTMLElement>('[data-day]');
    const date = section?.dataset['day'];
    if (!link || !tile || !burst || !date) return;
    const tiles = [
      ...burst.querySelectorAll<HTMLElement>(':scope > li[data-event-id]'),
    ];
    const items = tiles
      .map((t) => itemFromDataset(t.dataset))
      .filter((i): i is LightboxItem => i !== undefined);
    event.preventDefault();
    document.dispatchEvent(
      new CustomEvent('memories:lightbox', {
        detail: {
          date,
          items,
          index: Math.max(0, tiles.indexOf(tile)),
          autoCover: section?.dataset['autoCover'],
          trigger: link,
        },
      }),
    );
  });
}
```

Until the island has hydrated, `data-lightbox-ready` is absent and the tile keeps its `/media`
link, so a click always does something.

- [ ] **Step 7: The island pieces.** `src/components/lightbox/useLightbox.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';

import type { LightboxDetail } from '../../lib/client/events.ts';
import { type LightboxRequest, stepIndex } from '../../lib/lightbox.ts';
import { useOverlay } from '../useOverlay.ts';

const READY = 'data-lightbox-ready';

export function useLightbox() {
  const [request, setRequest] = useState<LightboxRequest>();
  const trigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onOpen = (e: CustomEvent<LightboxDetail>) => {
      const { trigger: el, ...rest } = e.detail;
      trigger.current = el;
      setRequest(rest);
    };
    document.addEventListener('memories:lightbox', onOpen);
    document.documentElement.setAttribute(READY, '');
    return () => {
      document.removeEventListener('memories:lightbox', onOpen);
      document.documentElement.removeAttribute(READY);
    };
  }, []);
  useOverlay(request !== undefined);

  const step = useCallback(
    (delta: number) =>
      setRequest(
        (r) => r && { ...r, index: stepIndex(r.index, r.items.length, delta) },
      ),
    [],
  );
  const select = useCallback(
    (index: number) =>
      setRequest(
        (r) => r && { ...r, index: stepIndex(0, r.items.length, index) },
      ),
    [],
  );
  const close = useCallback(() => setRequest(undefined), []);
  return { request, trigger, step, select, close };
}
```

`src/components/lightbox/LightboxImage.tsx`:

```tsx
import { Skeleton } from '@rainforest-dev/rainforest-react';
import { ImageOffIcon } from 'lucide-react';
import { useState } from 'react';

import type { LightboxItem } from '../../lib/lightbox.ts';
import { thumbUrl } from '../../lib/stream.ts';

export function LightboxImage({ item }: { item: LightboxItem }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  if (item.video) {
    return (
      <video
        controls
        preload="metadata"
        src={`/media/${encodeURIComponent(item.id)}`}
        className="max-h-[70vh] w-full rounded-lg"
      />
    );
  }
  const ratio =
    item.width && item.height ? `${item.width} / ${item.height}` : '3 / 2';
  return (
    <div
      className="relative mx-auto max-h-[70vh] w-full"
      style={{ aspectRatio: ratio }}
    >
      {state === 'loading' && (
        <Skeleton className="absolute inset-0 rounded-lg" />
      )}
      {state === 'error' ? (
        <div
          role="img"
          aria-label="圖片載入失敗"
          className="bg-muted text-muted-foreground text-meta absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg"
        >
          <ImageOffIcon className="size-4" aria-hidden />
          圖片載入失敗
        </div>
      ) : (
        <img
          src={thumbUrl(item.id, 0, 960)}
          alt={item.alt}
          onLoad={() => setState('ready')}
          onError={() => setState('error')}
          className="absolute inset-0 size-full rounded-lg object-contain"
        />
      )}
    </div>
  );
}
```

`src/components/lightbox/Lightbox.tsx`:

```tsx
import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  ScrollArea,
} from '@rainforest-dev/rainforest-react';
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
} from 'lucide-react';
import { type RefObject, useEffect, useRef } from 'react';

import {
  type CoverControl,
  type LightboxItem,
  positionLabel,
  swipeDelta,
} from '../../lib/lightbox.ts';
import { thumbUrl } from '../../lib/stream.ts';
import { taipeiDate, taipeiTime } from '../../lib/weeks.ts';
import { LightboxImage } from './LightboxImage.tsx';

type Props = {
  items: readonly LightboxItem[] | undefined;
  index: number;
  cover: CoverControl;
  finalFocus: RefObject<HTMLElement | null>;
  onStep: (delta: number) => void;
  onSelect: (index: number) => void;
  onToggleCover: () => void;
  onClose: () => void;
};

function CoverButton({
  state,
  onToggle,
}: {
  state: CoverControl;
  onToggle: () => void;
}) {
  if (state === 'hidden') return null;
  if (state === 'manual') {
    return (
      <Button variant="secondary" size="sm" aria-pressed onClick={onToggle}>
        <CheckIcon />
        已設為封面
      </Button>
    );
  }
  return (
    <>
      {state === 'auto' && <Badge variant="muted">目前的封面</Badge>}
      <Button
        variant="outline"
        size="sm"
        aria-pressed={false}
        disabled={state === 'loading'}
        onClick={onToggle}
      >
        設為封面
      </Button>
    </>
  );
}

export function Lightbox({
  items,
  index,
  cover,
  finalFocus,
  onStep,
  onSelect,
  onToggleCover,
  onClose,
}: Props) {
  const item = items?.[index];
  const count = items?.length ?? 0;
  const start = useRef<{ x: number; y: number }>(undefined);
  const active = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    active.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [index, items]);

  return (
    <Dialog
      open={item !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        finalFocus={finalFocus}
        className="gap-3 p-3 sm:max-w-5xl"
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') onStep(-1);
          if (e.key === 'ArrowRight') onStep(1);
        }}
      >
        {item && (
          <>
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <DialogTitle className="text-meta tabular-nums">
                  {taipeiDate(item.at)} {taipeiTime(item.at)}
                </DialogTitle>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {positionLabel(index, count)}
                </span>
              </div>
              <CoverButton state={cover} onToggle={onToggleCover} />
              <DialogClose
                render={
                  <Button variant="ghost" size="icon-sm" aria-label="關閉" />
                }
              >
                <XIcon />
              </DialogClose>
            </div>
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
              <Button
                variant="outline"
                size="icon-lg"
                aria-label="上一張"
                disabled={index === 0}
                onClick={() => onStep(-1)}
              >
                <ChevronLeftIcon />
              </Button>
              <div
                className="touch-pan-y"
                onPointerDown={(e) => {
                  start.current = { x: e.clientX, y: e.clientY };
                }}
                onPointerUp={(e) => {
                  const from = start.current;
                  start.current = undefined;
                  const delta = from
                    ? swipeDelta(e.clientX - from.x, e.clientY - from.y)
                    : 0;
                  if (delta) onStep(delta);
                }}
              >
                <LightboxImage key={item.id} item={item} />
              </div>
              <Button
                variant="outline"
                size="icon-lg"
                aria-label="下一張"
                disabled={index >= count - 1}
                onClick={() => onStep(1)}
              >
                <ChevronRightIcon />
              </Button>
            </div>
            {count > 1 && (
              <ScrollArea orientation="horizontal" className="w-full">
                <ol className="flex gap-2 p-1">
                  {items?.map((it, i) => (
                    <li key={it.id} className="shrink-0">
                      <button
                        ref={i === index ? active : undefined}
                        type="button"
                        aria-label={positionLabel(i, count)}
                        aria-current={i === index}
                        onClick={() => onSelect(i)}
                        className={`bg-muted focus-visible:ring-ring block size-14 overflow-hidden rounded-md outline-none focus-visible:ring-2 ${i === index ? 'ring-ring ring-2' : 'opacity-70'}`}
                      >
                        <img
                          src={thumbUrl(it.id, 0, 240)}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      </button>
                    </li>
                  ))}
                </ol>
              </ScrollArea>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 8: Wire it in `NotePanel.tsx`.** Import `useLightbox`, `Lightbox`, `coverControl`,
      `toggleCover`, `withCover` and `dayInUrl`. Inside the component, after `useStreamBridge`:

```tsx
const lightbox = useLightbox();
const shown = lightbox.request;
useEffect(() => {
  if (shown && shown.date !== date) request(shown.date);
}, [shown?.date, date, request]);
const item = shown?.items[shown.index];
const coverOnDay =
  !!shown &&
  !!draft.cover &&
  !!document.querySelector(
    `[data-day="${shown.date}"] [data-event-id="${CSS.escape(draft.cover)}"]`,
  );
const cover = item
  ? coverControl({
      writable: !readOnly,
      loaded: hydrated && shown?.date === date && status !== 'conflict',
      item,
      cover: draft.cover,
      coverOnDay,
      autoCover: shown?.autoCover,
    })
  : 'hidden';
const closeLightbox = () => {
  lightbox.close();
  const inView = dayInUrl();
  if (inView && inView !== date) request(inView);
};
```

`document` is read only while `shown` is set, which never happens during SSR. Opening a photo from
a neighbouring day moves the panel to that day; `closeLightbox` moves it back to the day in view,
because no scroll event will. Wrap the returned `BottomSheet` in a fragment and add after it:

```tsx
<Lightbox
  items={shown?.items}
  index={shown?.index ?? 0}
  cover={cover}
  finalFocus={lightbox.trigger}
  onStep={lightbox.step}
  onSelect={lightbox.select}
  onClose={closeLightbox}
  onToggleCover={() => {
    if (item) edit(date, (d) => withCover(d, toggleCover(d.cover, item.id)));
  }}
/>
```

- [ ] **Step 9: E2E test** (after the conflict test, so the 2025-11-01 note exists)

```ts
test('the +N tile opens the whole burst, and 設為封面 is saved', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  await page.locator('#day-2025-11-01 [data-burst] [data-more] a').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('照片 · 4 / 7');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await expect(dialog).toContainText('照片 · 7 / 7');
  await expect(dialog.getByRole('button', { name: '下一張' })).toBeDisabled();

  await dialog.getByRole('button', { name: '照片 · 1 / 7' }).click();
  await expect(dialog.getByText('目前的封面')).toBeVisible();
  await dialog.getByRole('button', { name: '照片 · 3 / 7' }).click();
  await dialog.getByRole('button', { name: '設為封面' }).click();
  await expect(
    dialog.getByRole('button', { name: '已設為封面' }),
  ).toBeVisible();
  await expect
    .poll(() => readFileSync(noteFile('2025-11-01'), 'utf8'))
    .toMatch(/^cover: DDDDDDDD-0000-0000-0000-000000000004$/m);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/day\/2025-11-01$/);
  await page.goto('/month/2025-11');
  await expect(
    page.locator('a[data-date="2025-11-01"]:visible img'),
  ).toHaveAttribute('src', /DDDDDDDD/);
});
```

- [ ] **Step 10: Run and check in a browser**

Run: `pnpm nx run-many -t test typecheck -p personal-memories`, then `pnpm nx e2e personal-memories-e2e`.
Expected: PASS.
Browser (Safari and Chrome, 1280 and 390): swipe left and right with touch emulation; focus
returns to the tapped tile on close; a video item plays; a photo whose thumbnail fails shows
圖片載入失敗.

- [ ] **Step 11: Commit (controller)**

```bash
git add apps/personal-memories/src/lib/lightbox.ts apps/personal-memories/src/lib/lightbox.test.ts \
  apps/personal-memories/src/lib/client apps/personal-memories/src/components/useOverlay.ts \
  apps/personal-memories/src/components/lightbox apps/personal-memories/src/components/DaySection.astro \
  apps/personal-memories/src/scripts/day-stream.ts apps/personal-memories/src/components/NotePanel.tsx \
  apps/personal-memories-e2e/src/timeline.spec.ts
git commit -m "feat(personal-memories): open bursts in a lightbox with 設為封面"
```

### Task 7: 眉批 carry the name of whoever wrote them (owner #6)

**Files:**

- Create: `apps/personal-memories/src/lib/notes/authors.ts`, `apps/personal-memories/src/lib/notes/authors.test.ts`
- Modify: `apps/personal-memories/src/lib/notes/types.ts` (`Annotation.by?`)
- Modify: `apps/personal-memories/src/lib/notes/format.ts`, `format.test.ts` (the `by:` field)
- Modify: `apps/personal-memories/src/lib/notes/draft.ts`, `draft.test.ts` (carry `by`)
- Modify: `apps/personal-memories/src/lib/notes/payload.ts`, `payload.test.ts` (`viewer`)
- Modify: `apps/personal-memories/src/actions/index.ts` (resolve and stamp)
- Modify: `apps/personal-memories/src/pages/day/[date].astro` (initial payload gets `viewer`)
- Create: `apps/personal-memories/src/components/notes/useAuthorName.ts`
- Modify: `apps/personal-memories/src/components/notes/useStreamBridge.ts`, `AnnotationItem.tsx`, `NotePanel.tsx`
- Modify: `apps/personal-memories-e2e/playwright.config.ts`, `apps/personal-memories-e2e/src/timeline.spec.ts`

**Interfaces:**

- Consumes: `ANCHOR` parsing in `format.ts`; `saveNote` / `getNote` actions; `useStreamBridge`'s
  `annotate`.
- Produces:
  - `Annotation.by?: string`
  - `IDENTITY_HEADER = 'cf-access-authenticated-user-email'`
  - `cleanName(raw: string): string` (no `%%`, no newlines, whitespace collapsed, at most 40 chars)
  - `parseAuthors(raw: string | undefined): Map<string, string>` (lower-cased email → name)
  - `viewerName(headers: Headers, env?: Record<string, string | undefined>): string | undefined`
  - `stampAuthors<T extends { by?: string | undefined }>(annotations: readonly T[], viewer: string | undefined): T[]`
  - `NotePayload.viewer?: string`; `notePayload(store, date, dayEvents, viewer?)`
  - `useAuthorName(viewer: string | undefined)` → `{ name: string | undefined; needsName: boolean; save(raw: string): void }`
  - Anchor comment `%% ev:<id> at:<iso> src:<source> by:<name> %%`, with `by:` optional and last

- [ ] **Step 1: Write the failing tests.** `authors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  cleanName,
  parseAuthors,
  stampAuthors,
  viewerName,
} from './authors.ts';

const HEADER = 'Cf-Access-Authenticated-User-Email';

describe('parseAuthors', () => {
  it('maps lower-cased emails to cleaned names and skips junk', () => {
    const map = parseAuthors(
      ' Alice@Example.com = Alice , bob@example.com=Bob 🌷,broken,=x,carol@example.com=',
    );
    expect([...map]).toEqual([
      ['alice@example.com', 'Alice'],
      ['bob@example.com', 'Bob 🌷'],
    ]);
    expect(parseAuthors(undefined).size).toBe(0);
  });
});

describe('viewerName', () => {
  const env = { MEMORIES_AUTHORS: 'alice@example.com=Alice' };

  it('resolves the Access email header through the mapping', () => {
    expect(
      viewerName(new Headers({ [HEADER]: 'ALICE@example.com' }), env),
    ).toBe('Alice');
  });

  it('is undefined without a header, for an unknown email, or with no mapping', () => {
    expect(viewerName(new Headers(), env)).toBeUndefined();
    expect(
      viewerName(new Headers({ [HEADER]: 'eve@example.com' }), env),
    ).toBeUndefined();
    expect(
      viewerName(new Headers({ [HEADER]: 'alice@example.com' }), {}),
    ).toBeUndefined();
  });
});

describe('cleanName', () => {
  it('removes what would break the anchor comment', () => {
    expect(cleanName('Eve %% x\ny ')).toBe('Eve x y');
    expect(cleanName('x'.repeat(50))).toHaveLength(40);
  });
});

describe('stampAuthors', () => {
  it('keeps an author, fills a missing one, and leaves it absent without a viewer', () => {
    expect(
      stampAuthors([{ eventId: 'e', by: 'Bob' }, { eventId: 'f' }], 'Alice'),
    ).toEqual([
      { eventId: 'e', by: 'Bob' },
      { eventId: 'f', by: 'Alice' },
    ]);
    expect(stampAuthors([{ eventId: 'f' }], undefined)).toEqual([
      { eventId: 'f' },
    ]);
    expect(stampAuthors([{ eventId: 'g', by: ' %% ' }], undefined)).toEqual([
      { eventId: 'g' },
    ]);
  });
});
```

Append to `format.test.ts` (extend its imports with `emptyNote` and `DayNote` if missing):

```ts
describe('annotation authors', () => {
  const note: DayNote = {
    ...emptyNote('2025-11-01'),
    annotations: [
      {
        eventId: 'abc',
        at: '2025-11-01T09:05:00+08:00',
        source: 'line',
        author: 'Alice',
        excerpt: 'hi',
        body: '寫的',
        by: 'Bob 🌷',
      },
    ],
  };

  it('writes by: last in the anchor and reads it back byte for byte', () => {
    const text = serializeNote(note);
    expect(text).toContain(
      '%% ev:abc at:2025-11-01T09:05:00+08:00 src:line by:Bob 🌷 %%',
    );
    const parsed = parseNote(text, '2025-11-01');
    expect(parsed.annotations[0]?.by).toBe('Bob 🌷');
    expect(serializeNote(parsed)).toBe(text);
  });

  it('still reads anchors written before by: existed', () => {
    const old = serializeNote(note).replace(' by:Bob 🌷', '');
    const [annotation] = parseNote(old, '2025-11-01').annotations;
    expect(annotation && 'by' in annotation).toBe(false);
    expect(annotation?.eventId).toBe('abc');
  });

  it('never lets a name break the comment', () => {
    const text = serializeNote({
      ...note,
      annotations: [{ ...note.annotations[0]!, by: 'Eve %% x\ny' }],
    });
    expect(text).toContain('src:line by:Eve x y %%');
  });
});
```

Append to `draft.test.ts`:

```ts
it('keeps the annotation author when saving', () => {
  const signed = { ...payload, annotations: [{ ...annotation, by: 'Bob' }] };
  expect(saveInput(signed, toDraft(signed)).annotations[0]).toMatchObject({
    by: 'Bob',
  });
});
```

Append to `payload.test.ts` (import `notePayload` if missing):

```ts
it('passes the resolved viewer name to the panel', () => {
  expect(notePayload(undefined, '2025-11-01', [], 'Alice').viewer).toBe(
    'Alice',
  );
  expect('viewer' in notePayload(undefined, '2025-11-01', [])).toBe(false);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm nx test personal-memories -- src/lib/notes`
Expected: FAIL: `authors.ts` missing; `by` not parsed or written; `viewer` absent.

- [ ] **Step 3: Implement.** `authors.ts`:

```ts
export const IDENTITY_HEADER = 'cf-access-authenticated-user-email';
const MAX_NAME = 40;

export function cleanName(raw: string): string {
  return raw
    .replace(/%%|[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME);
}

export function parseAuthors(raw: string | undefined): Map<string, string> {
  const out = new Map<string, string>();
  for (const pair of (raw ?? '').split(',')) {
    const at = pair.indexOf('=');
    if (at < 1) continue;
    const email = pair.slice(0, at).trim().toLowerCase();
    const name = cleanName(pair.slice(at + 1));
    if (email && name) out.set(email, name);
  }
  return out;
}

export function viewerName(
  headers: Headers,
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const email = headers.get(IDENTITY_HEADER)?.trim().toLowerCase();
  return email ? parseAuthors(env['MEMORIES_AUTHORS']).get(email) : undefined;
}

export function stampAuthors<T extends { by?: string | undefined }>(
  annotations: readonly T[],
  viewer: string | undefined,
): T[] {
  return annotations.map((a) => {
    const { by: raw, ...rest } = a;
    const by = cleanName(raw ?? '') || viewer;
    return (by ? { ...rest, by } : rest) as T;
  });
}
```

`types.ts`: add `by?: string;` to `Annotation`.

`format.ts`: import `cleanName` from `./authors.ts`; change the anchor pattern to

```ts
const ANCHOR = /^%% ev:(\S+) at:(\S+) src:(line|slack|photo)(?: by:(.+?))? %%$/;
```

In `parseAnnotation`, build the annotation into a `const annotation: Annotation = { … }`, then
`if (anchor?.[4]) annotation.by = anchor[4];` and return it. In `serializeAnnotation`, write the
anchor as:

```ts
const by = a.by ? cleanName(a.by) : '';
if (a.eventId)
  parts.push(
    `%% ev:${a.eventId} at:${a.at} src:${a.source}${by ? ` by:${by}` : ''} %%`,
  );
```

An annotation without an anchor (one written by hand in Obsidian) has nowhere to keep `by`, and
that is accepted.

`draft.ts` `toAnnotation`: end the object with `...(a.by ? { by: a.by } : {}),`.

`payload.ts`: add `viewer?: string` to `NotePayload`; give `notePayload` a fourth parameter
`viewer?: string` and set `if (viewer) payload.viewer = viewer;` before returning.

`actions/index.ts`: import `stampAuthors` and `viewerName`; add `by: z.string().max(80).optional()`
to `annotation`; change the handlers to take `context`:

```ts
handler: ({ date: d }, context) =>
  notePayload(notesStore(), d, dayEvents(d), viewerName(context.request.headers)),
```

and in `saveNote`:

```ts
handler: ({ date: d, version, ...edit }, context) => {
  const store = notesStore();
  if (!store?.writable) {
    throw new ActionError({ code: 'FORBIDDEN', message: 'notes are read-only' });
  }
  const signed = {
    ...edit,
    annotations: stampAuthors(edit.annotations, viewerName(context.request.headers)),
  };
  let result;
  try {
    result = store.write(d, signed, version);
  } catch (error) {
    if (!(error instanceof UnreadableNoteError)) throw error;
    throw new ActionError({ code: 'UNPROCESSABLE_CONTENT', message: error.message });
  }
  return result.ok
    ? { ok: true as const, version: result.version }
    : { ok: false as const, current: toPayload(result.current, true, dayEvents(d)) };
},
```

`pages/day/[date].astro`: `notePayload(notesStore(), date, day.events, viewerName(Astro.request.headers))`.

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm nx test personal-memories -- src/lib/notes`
Expected: PASS, and every existing `format.test.ts` round trip still passes.

- [ ] **Step 5: Client.** `src/components/notes/useAuthorName.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';

import { cleanName } from '../../lib/notes/authors.ts';

const KEY = 'memories:author-name';

export function useAuthorName(viewer: string | undefined) {
  const [stored, setStored] = useState<string>();
  useEffect(() => {
    try {
      setStored(localStorage.getItem(KEY) ?? undefined);
    } catch {
      setStored(undefined);
    }
  }, []);
  const save = useCallback((raw: string) => {
    const name = cleanName(raw);
    setStored(name || undefined);
    try {
      if (name) localStorage.setItem(KEY, name);
      else localStorage.removeItem(KEY);
    } catch {
      return;
    }
  }, []);
  return { name: viewer ?? stored, needsName: !viewer && !stored, save };
}
```

`useStreamBridge.ts`: add `author: string | undefined` to `Options`; in `annotate`, the new
annotation becomes
`{ ...anchor, body: '', status: 'exact', ...(latest.current.author ? { by: latest.current.author } : {}) }`.

`AnnotationItem.tsx`: import `PenLineIcon` from `lucide-react`; in the header row, between the
meta span and the 刪除 button, add:

```tsx
{
  a.by && (
    <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
      <PenLineIcon className="size-3" aria-hidden />
      {a.by}
    </span>
  );
}
```

`AnnotationList` gets two props, `needsName: boolean` and `onName: (raw: string) => void`, and
renders, above the list and only when `needsName && !rest.readOnly`:

```tsx
<label className="mb-3 flex flex-col gap-1.5">
  <span className="text-muted-foreground text-xs">眉批署名</span>
  <Input
    placeholder="你的名字"
    className="h-8"
    onBlur={(e) => onName(e.currentTarget.value)}
    onKeyDown={(e) => {
      if (e.key === 'Enter') onName(e.currentTarget.value);
    }}
  />
</label>
```

(`Input` from `@rainforest-dev/rainforest-react`.) In `NotePanel.tsx`:
`const author = useAuthorName(payload.viewer);`, pass `author: author.name` to `useStreamBridge`,
and `needsName={author.needsName}` and `onName={author.save}` to `AnnotationList`.

- [ ] **Step 6: E2E config.** In `playwright.config.ts` `webServer.env` add
      `MEMORIES_AUTHORS: 'alice@example.com=Alice,bob@example.com=Bob'`.

- [ ] **Step 7: E2E test, with an identity**

```ts
test.describe('an annotation signed through Access', () => {
  test.use({
    extraHTTPHeaders: {
      'Cf-Access-Authenticated-User-Email': 'alice@example.com',
    },
  });

  test('carries the signed-in author', async ({ page }) => {
    await page.goto('/day/2025-11-02');
    const panel = page.getByRole('complementary', { name: '筆記' });
    const message = page.locator('[data-event-id]', {
      hasText: 'Thread reply',
    });
    await message.hover();
    await message.getByRole('button', { name: '眉批' }).click();
    await panel
      .getByLabel(/^眉批：/)
      .last()
      .fill('Alice 寫的眉批');
    await expect
      .poll(() => readFileSync(noteFile('2025-11-02'), 'utf8'))
      .toMatch(/ src:slack by:Alice %%$/m);
    await expect(panel.getByText('Alice', { exact: true })).toBeVisible();
    await expect(panel.getByPlaceholder('你的名字')).toHaveCount(0);
  });
});
```

- [ ] **Step 8: E2E test, without an identity header**

```ts
test('without an identity, the name set once in the panel signs 眉批', async ({
  page,
}) => {
  await page.goto('/day/2025-11-03');
  const panel = page.getByRole('complementary', { name: '筆記' });
  await panel.getByPlaceholder('你的名字').fill('Bob');
  await panel.getByPlaceholder('你的名字').press('Enter');
  const message = page.locator('[data-event-id]', { hasText: 'Coffee first' });
  await message.hover();
  await message.getByRole('button', { name: '眉批' }).click();
  await panel
    .getByLabel(/^眉批：/)
    .last()
    .fill('Bob 的眉批');
  await expect
    .poll(() => readFileSync(noteFile('2025-11-03'), 'utf8'))
    .toMatch(/ by:Bob %%$/m);
});
```

- [ ] **Step 9: Run**

Run: `pnpm nx run-many -t test typecheck -p personal-memories`, then `pnpm nx e2e personal-memories-e2e`.
Expected: PASS.

- [ ] **Step 10: Commit (controller)**

```bash
git add apps/personal-memories/src/lib/notes apps/personal-memories/src/actions/index.ts \
  apps/personal-memories/src/pages/day/[date].astro apps/personal-memories/src/components/notes \
  apps/personal-memories/src/components/NotePanel.tsx apps/personal-memories-e2e
git commit -m "feat(personal-memories): sign 眉批 with the author's name"
```

### Task 8: Tell speakers apart in the stream (owner #5)

**Files:**

- Modify: `apps/personal-memories/src/lib/stream.ts` (`authorAccents`, `initialOf`), `stream.test.ts`
- Modify: `apps/personal-memories/src/components/DaySection.astro` (head row and row rule)
- Test: `apps/personal-memories-e2e/src/timeline.spec.ts`

**Interfaces:**

- Consumes: `getTimeline()`; `groupRuns` runs (`run.author`, `run.isOwner`).
- Produces: `type Accent = 1 | 2 | 3 | 4 | 5`;
  `authorAccents(events: readonly TimelineEvent[]): Map<string, Accent>` (cached per events array;
  ranked by message count, ties alphabetical, photos ignored, cycles after five);
  `initialOf(author: string): string`. DOM: text-run `li[data-accent="1..5"]`; each
  `[data-row-body]` carries a 2 px left rule in its accent; owner indent is now margin
  (`ml-7 sm:ml-12`).

The treatment: on a speaker change the head row shows an initial chip (`bg-chart-N/15`), the
author in `text-meta font-semibold`, then the source in muted `text-xs`. Every message row carries
`border-l-2 border-chart-N/65`, so rows in the middle of a long run still say who wrote them. The
owner's rows keep their indent, and the rule moves with them. Colour is never the only signal:
the name heads each run.

- [ ] **Step 1: Write the failing tests** (append to `stream.test.ts`, extend its imports)

```ts
describe('authorAccents', () => {
  it('ranks authors by message count, alphabetically on ties, ignoring photos', () => {
    const accents = authorAccents([
      ev('1', 'Bob'),
      ev('2', 'Bob'),
      ev('3', 'Alice'),
      ev('4', 'Carol'),
      ev('5', 'photo', 'photo'),
    ]);
    expect([...accents]).toEqual([
      ['Bob', 1],
      ['Alice', 2],
      ['Carol', 3],
    ]);
  });

  it('cycles after five authors and returns the same map for the same events', () => {
    const events = ['A', 'B', 'C', 'D', 'E', 'F'].map((a, i) =>
      ev(String(i), a),
    );
    const accents = authorAccents(events);
    expect(accents.get('F')).toBe(1);
    expect(authorAccents(events)).toBe(accents);
  });
});

describe('initialOf', () => {
  it('takes the first character, upper-cased', () => {
    expect(initialOf('alice 🌷')).toBe('A');
    expect(initialOf('  ')).toBe('?');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm nx test personal-memories -- src/lib/stream.test.ts`
Expected: FAIL, `authorAccents` is not exported.

- [ ] **Step 3: Implement** (in `stream.ts`)

```ts
export type Accent = 1 | 2 | 3 | 4 | 5;

const accentCache = new WeakMap<
  readonly TimelineEvent[],
  Map<string, Accent>
>();

export function authorAccents(
  events: readonly TimelineEvent[],
): Map<string, Accent> {
  const hit = accentCache.get(events);
  if (hit) return hit;
  const counts = new Map<string, number>();
  for (const e of events)
    if (e.source !== 'photo')
      counts.set(e.author, (counts.get(e.author) ?? 0) + 1);
  const ranked = [...counts].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const accents = new Map(
    ranked.map(([author], i) => [author, ((i % 5) + 1) as Accent]),
  );
  accentCache.set(events, accents);
  return accents;
}

export const initialOf = (author: string) =>
  [...author.trim()][0]?.toUpperCase() ?? '?';
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm nx test personal-memories -- src/lib/stream.test.ts`
Expected: PASS.

- [ ] **Step 5: Render it.** In `DaySection.astro`, import `authorAccents`, `initialOf`,
      `type Accent` and `getTimeline`, then in the frontmatter:

```ts
const timeline = getTimeline();
const accents =
  timeline.status === 'ready'
    ? authorAccents(timeline.timeline.events)
    : new Map<string, Accent>();
const accentOf = (author: string): Accent => accents.get(author) ?? 1;
const ACCENT_RULE: Record<Accent, string> = {
  1: 'border-chart-1/65',
  2: 'border-chart-2/65',
  3: 'border-chart-3/65',
  4: 'border-chart-4/65',
  5: 'border-chart-5/65',
};
const ACCENT_CHIP: Record<Accent, string> = {
  1: 'bg-chart-1/15',
  2: 'bg-chart-2/15',
  3: 'bg-chart-3/15',
  4: 'bg-chart-4/15',
  5: 'bg-chart-5/15',
};
```

Change `const INDENT = 'pl-7 sm:pl-12';` to `const INDENT = 'ml-7 sm:ml-12';`. For text runs,
replace the run's `<li>` opening tag and head row with:

```astro
<li
  data-source={run.source}
  data-accent={accentOf(run.author)}
  class="mt-[22px] first:mt-1.5"
>
  <div class:list={[ROW, 'items-center py-0.5']}>
    <span></span>
    <div class:list={['flex items-center gap-2', run.isOwner && INDENT]}>
      <span
        aria-hidden="true"
        class:list={[
          'text-foreground flex size-5 items-center justify-center rounded-full text-xs font-semibold',
          ACCENT_CHIP[accentOf(run.author)],
        ]}
      >
        {initialOf(run.author)}
      </span>
      <span class="text-meta font-semibold">{run.author}</span>
      <span class="text-muted-foreground text-xs">
        {SOURCE_LABEL[run.source]}
      </span>
    </div>
    <span></span>
  </div>
</li>
```

and give each row body the rule:

```astro
<div
  data-row-body
  class:list={[
    'min-w-0 border-l-2 pl-3',
    ACCENT_RULE[accentOf(run.author)],
    run.isOwner && INDENT,
  ]}
>
</div>
```

- [ ] **Step 6: E2E.** The owner test now compares left edges, since the indent is margin:

```ts
const [ownerLeft, otherLeft] = await Promise.all([
  ownerRow.evaluate((el) => el.getBoundingClientRect().left),
  otherRow.evaluate((el) => el.getBoundingClientRect().left),
]);
expect(ownerLeft).toBeGreaterThan(otherLeft);
```

Append:

```ts
test('each speaker keeps an accent on every row', async ({ page }) => {
  await page.goto('/day/2025-11-01');
  const day = page.locator('#day-2025-11-01');
  const accentOf = (author: string) =>
    day
      .locator('li[data-accent]', {
        has: page.locator(`[data-author="${author}"]`),
      })
      .first()
      .getAttribute('data-accent');
  expect(await accentOf('Alice 🌷')).not.toBe(await accentOf('Bob'));
  const width = await day
    .locator('[data-event-id][data-author="Bob"] [data-row-body]')
    .first()
    .evaluate((el) => getComputedStyle(el).borderLeftWidth);
  expect(width).toBe('2px');
});
```

- [ ] **Step 7: Run and look**

Run: `pnpm nx e2e personal-memories-e2e`
Expected: PASS.
Browser: `/day/2025-11-01` light and dark at 1280 and 390. The accents are distinct in both
schemes, and the owner's indented rows keep their rule.

- [ ] **Step 8: Commit (controller)**

```bash
git add apps/personal-memories/src/lib/stream.ts apps/personal-memories/src/lib/stream.test.ts \
  apps/personal-memories/src/components/DaySection.astro apps/personal-memories-e2e/src/timeline.spec.ts
git commit -m "feat(personal-memories): give each speaker an accent in the stream"
```

### Task 9: App bar with 年/月/日, date jump and the shortcuts overlay

**Files:**

- Create: `apps/personal-memories/src/lib/nav.ts`, `nav.test.ts`, `apps/personal-memories/src/lib/jump.ts`, `jump.test.ts`
- Create: `apps/personal-memories/src/lib/shortcuts.ts` (the overlay's data; Task 10 adds the resolver)
- Create: `apps/personal-memories/src/lib/client/step-day.ts`
- Create: `apps/personal-memories/src/components/useActiveDay.ts`
- Create: `apps/personal-memories/src/components/chrome/AppBar.tsx`, `TopBar.tsx`, `DateJump.tsx`, `ShortcutsDialog.tsx`, `useChrome.ts`
- Create: `apps/personal-memories/src/pages/days.json.ts`
- Modify: `apps/personal-memories/src/lib/client/events.ts` (`memories:open-jump`, `memories:open-shortcuts`)
- Modify: `apps/personal-memories/src/layouts/Layout.astro` (`bar` prop)
- Modify: `apps/personal-memories/src/pages/index.astro`, `month/[month].astro`, `day/[date].astro`
- Test: `apps/personal-memories-e2e/src/timeline.spec.ts`

**Interfaces:**

- Consumes: `MONTH_RE`, `monthOf`, `monthLabel`, `nearestDate` (Task 3); `dayInUrl`,
  `useOverlay` (Task 6); `indexDays`, `summarize`; `dayHeading`.
- Produces:
  - `type Level = 'year' | 'month' | 'day'`; `type Place = { level: 'year' } | { level: 'month'; month: string } | { level: 'day'; date: string }`
  - `placeOf(pathname: string): Place | undefined`, `zoomOutHref(place: Place): string | undefined`,
    `levelHrefs(place: Place, dates: readonly string[]): Record<Level, string>`
  - `queryPrefixes(raw: string): string[]`, `matchDates(dates: readonly string[], raw: string): string[]`,
    `groupByMonth(dates: readonly string[]): { month: string; dates: string[] }[]`,
    `type JumpTarget = { date: string; exact: boolean }`, `jumpTarget(dates: readonly string[], raw: string): JumpTarget | undefined`
  - `type ShortcutRow = { keys: string[]; label: string }`, `type ShortcutGroup = { title?: string; rows: ShortcutRow[] }`,
    `SHORTCUT_GROUPS: ShortcutGroup[]`
  - `stepDay(delta: -1 | 1): void` (loads `/day/<prev|next>` of the day in the URL)
  - `useActiveDay(initial: string | undefined): string | undefined` (follows `memories:day`)
  - `GET /days.json` → `{ date: string; total: number }[]`
  - `AppBar` props `{ place: Place; hrefs: Record<Level, string> }`; `Layout` prop
    `bar?: { place: Place; hrefs: Record<Level, string> }`
  - Day page: `?nearest=1` shows `Alert variant="info"` 沒有這一天，已跳到最近的 {dayHeading}; an
    unknown day's 404 links to the nearest day.

- [ ] **Step 1: Write the failing tests.** `nav.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { levelHrefs, placeOf, zoomOutHref } from './nav.ts';

describe('placeOf', () => {
  it('reads the three zoom levels from a path', () => {
    expect(placeOf('/')).toEqual({ level: 'year' });
    expect(placeOf('/month/2025-11')).toEqual({
      level: 'month',
      month: '2025-11',
    });
    expect(placeOf('/day/2025-11-01')).toEqual({
      level: 'day',
      date: '2025-11-01',
    });
  });

  it('ignores every other path', () => {
    for (const path of [
      '',
      '/month/2025-13',
      '/day/2025-11-01/partial',
      '/week/2025-W44',
      '/media/x',
    ])
      expect(placeOf(path)).toBeUndefined();
  });
});

describe('zoomOutHref', () => {
  it('goes day → month → year and stops there', () => {
    expect(zoomOutHref({ level: 'day', date: '2025-11-03' })).toBe(
      '/month/2025-11',
    );
    expect(zoomOutHref({ level: 'month', month: '2025-11' })).toBe('/');
    expect(zoomOutHref({ level: 'year' })).toBeUndefined();
  });
});

describe('levelHrefs', () => {
  const dates = ['2025-10-31', '2025-11-01', '2025-11-03'];

  it('on a day, points at that day and its month', () => {
    expect(levelHrefs({ level: 'day', date: '2025-11-03' }, [])).toEqual({
      year: '/',
      month: '/month/2025-11',
      day: '/day/2025-11-03',
    });
  });

  it('on a month, opens its first day with events, else the nearest day', () => {
    expect(levelHrefs({ level: 'month', month: '2025-11' }, dates).day).toBe(
      '/day/2025-11-01',
    );
    expect(levelHrefs({ level: 'month', month: '2025-12' }, dates).day).toBe(
      '/day/2025-11-03',
    );
  });

  it('on the year, opens the latest month and day, and points home without data', () => {
    expect(levelHrefs({ level: 'year' }, dates)).toEqual({
      year: '/',
      month: '/month/2025-11',
      day: '/day/2025-11-03',
    });
    expect(levelHrefs({ level: 'year' }, [])).toEqual({
      year: '/',
      month: '/',
      day: '/',
    });
  });
});
```

`jump.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { groupByMonth, jumpTarget, matchDates, queryPrefixes } from './jump.ts';

const DATES = [
  '2025-10-31',
  '2025-11-01',
  '2025-11-02',
  '2025-11-10',
  '2026-01-01',
];

describe('queryPrefixes', () => {
  it('normalises separators and pads closed parts', () => {
    expect(queryPrefixes('')).toEqual(['']);
    expect(queryPrefixes('2025')).toEqual(['2025']);
    expect(queryPrefixes('202')).toEqual(['202']);
    expect(queryPrefixes('2025/11/01')).toEqual(['2025-11-01']);
    expect(queryPrefixes('20251101')).toEqual(['2025-11-01']);
    expect(queryPrefixes('2025年11月')).toEqual(['2025-11']);
    expect(queryPrefixes('2025-11-')).toEqual(['2025-11']);
  });

  it('keeps an open single digit as both a padded value and a prefix', () => {
    expect(queryPrefixes('2025-1')).toEqual(['2025-01', '2025-1']);
    expect(queryPrefixes('2025.11.1')).toEqual(['2025-11-01', '2025-11-1']);
  });

  it('rejects what cannot be a date', () => {
    expect(queryPrefixes('abc')).toEqual([]);
    expect(queryPrefixes('2025-111')).toEqual([]);
    expect(queryPrefixes('12-01')).toEqual([]);
  });
});

describe('matchDates and groupByMonth', () => {
  it('matches every prefix and groups by month in order', () => {
    expect(matchDates(DATES, '2025-11-1')).toEqual([
      '2025-11-01',
      '2025-11-10',
    ]);
    expect(matchDates(DATES, '')).toEqual(DATES);
    expect(matchDates(DATES, 'abc')).toEqual([]);
    expect(groupByMonth(['2025-10-31', '2025-11-01', '2025-11-02'])).toEqual([
      { month: '2025-10', dates: ['2025-10-31'] },
      { month: '2025-11', dates: ['2025-11-01', '2025-11-02'] },
    ]);
  });
});

describe('jumpTarget', () => {
  it('goes to the first match', () => {
    expect(jumpTarget(DATES, '2025/11/2')).toEqual({
      date: '2025-11-02',
      exact: true,
    });
  });

  it('goes to the nearest day for a missing, partial or impossible date', () => {
    expect(jumpTarget(DATES, '2025-11-20')).toEqual({
      date: '2025-11-10',
      exact: false,
    });
    expect(jumpTarget(DATES, '1999')).toEqual({
      date: '2025-10-31',
      exact: false,
    });
    expect(jumpTarget(DATES, '2025-13')).toEqual({
      date: '2026-01-01',
      exact: false,
    });
  });

  it('gives up on nonsense or no data', () => {
    expect(jumpTarget(DATES, 'abc')).toBeUndefined();
    expect(jumpTarget([], '2025-11-01')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm nx test personal-memories -- src/lib/nav.test.ts src/lib/jump.test.ts`
Expected: FAIL, cannot resolve `./nav.ts` and `./jump.ts`.

- [ ] **Step 3: Implement.** `nav.ts`:

```ts
import { MONTH_RE, monthOf, nearestDate } from './months.ts';

export type Level = 'year' | 'month' | 'day';
export type Place =
  | { level: 'year' }
  | { level: 'month'; month: string }
  | { level: 'day'; date: string };

const DAY_PATH = /^\/day\/(\d{4}-\d{2}-\d{2})\/?$/;
const MONTH_PATH = /^\/month\/([^/]+)\/?$/;

export function placeOf(pathname: string): Place | undefined {
  if (pathname === '/') return { level: 'year' };
  const date = DAY_PATH.exec(pathname)?.[1];
  if (date) return { level: 'day', date };
  const month = MONTH_PATH.exec(pathname)?.[1];
  return month && MONTH_RE.test(month) ? { level: 'month', month } : undefined;
}

export function zoomOutHref(place: Place): string | undefined {
  if (place.level === 'day') return `/month/${monthOf(place.date)}`;
  if (place.level === 'month') return '/';
  return undefined;
}

export function levelHrefs(
  place: Place,
  dates: readonly string[],
): Record<Level, string> {
  if (place.level === 'day') {
    return {
      year: '/',
      month: `/month/${monthOf(place.date)}`,
      day: `/day/${place.date}`,
    };
  }
  if (place.level === 'month') {
    const day =
      dates.find((d) => monthOf(d) === place.month) ??
      nearestDate(dates, `${place.month}-01`);
    return {
      year: '/',
      month: `/month/${place.month}`,
      day: day ? `/day/${day}` : '/',
    };
  }
  const last = dates.at(-1);
  return {
    year: '/',
    month: last ? `/month/${monthOf(last)}` : '/',
    day: last ? `/day/${last}` : '/',
  };
}
```

`jump.ts`:

```ts
import { monthOf, nearestDate } from './months.ts';

const pad2 = (s: string) => s.padStart(2, '0');

export function queryPrefixes(raw: string): string[] {
  const q = raw.trim();
  if (!q) return [''];
  if (/^\d{8}$/.test(q))
    return [`${q.slice(0, 4)}-${q.slice(4, 6)}-${q.slice(6)}`];
  const [year, ...rest] = q.split(/\D+/).filter(Boolean);
  if (!year || year.length > 4 || rest.length > 2) return [];
  if (year.length < 4) return rest.length ? [] : [year];
  const last = rest[rest.length - 1];
  if (last === undefined) return [year];
  if (rest.some((p) => p.length > 2)) return [];
  const head = [year, ...rest.slice(0, -1).map(pad2)];
  const join = (tail: string) => [...head, tail].join('-');
  if (last.length === 2 || /\D$/.test(q)) return [join(pad2(last))];
  return [join(`0${last}`), join(last)];
}

export function matchDates(dates: readonly string[], raw: string): string[] {
  const prefixes = queryPrefixes(raw);
  return dates.filter((d) => prefixes.some((p) => d.startsWith(p)));
}

export function groupByMonth(
  dates: readonly string[],
): { month: string; dates: string[] }[] {
  const groups: { month: string; dates: string[] }[] = [];
  for (const date of dates) {
    const month = monthOf(date);
    const last = groups.at(-1);
    if (last?.month === month) last.dates.push(date);
    else groups.push({ month, dates: [date] });
  }
  return groups;
}

function probeDate(raw: string): string | undefined {
  const prefix = queryPrefixes(raw).find((p) => /^\d{4}/.test(p));
  if (!prefix) return undefined;
  const [year, month = '01', day = '01'] = prefix.split('-');
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export type JumpTarget = { date: string; exact: boolean };

export function jumpTarget(
  dates: readonly string[],
  raw: string,
): JumpTarget | undefined {
  const [first] = matchDates(dates, raw);
  if (first && raw.trim()) return { date: first, exact: true };
  const probe = probeDate(raw);
  const near = probe ? nearestDate(dates, probe) : undefined;
  return near ? { date: near, exact: false } : undefined;
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm nx test personal-memories -- src/lib/nav.test.ts src/lib/jump.test.ts`
Expected: PASS.

- [ ] **Step 5: Shared pieces.** `src/lib/shortcuts.ts`:

```ts
export type ShortcutRow = { keys: string[]; label: string };
export type ShortcutGroup = { title?: string; rows: ShortcutRow[] };

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    rows: [
      { keys: ['/'], label: '跳至日期' },
      { keys: ['?'], label: '鍵盤快速鍵' },
      { keys: ['Esc'], label: '縮小一層' },
    ],
  },
  {
    title: '年',
    rows: [
      { keys: ['←', '→'], label: '在日子間移動' },
      { keys: ['Enter'], label: '打開那一天' },
    ],
  },
  {
    title: '日',
    rows: [
      { keys: ['j'], label: '後一天' },
      { keys: ['k'], label: '前一天' },
      { keys: ['n'], label: '這一天的回憶' },
    ],
  },
  {
    title: '照片',
    rows: [
      { keys: ['←'], label: '上一張' },
      { keys: ['→'], label: '下一張' },
    ],
  },
];
```

`src/lib/client/step-day.ts`:

```ts
import { dayInUrl } from './day-url.ts';

export function stepDay(delta: -1 | 1) {
  const date = dayInUrl();
  const section = date
    ? document.querySelector<HTMLElement>(`[data-day="${date}"]`)
    : null;
  const target =
    delta > 0 ? section?.dataset['next'] : section?.dataset['prev'];
  if (target) location.assign(`/day/${target}`);
}
```

`src/components/useActiveDay.ts`:

```ts
import { useEffect, useState } from 'react';

export function useActiveDay(initial: string | undefined) {
  const [date, setDate] = useState(initial);
  useEffect(() => {
    const onDay = (e: CustomEvent<{ date: string }>) => setDate(e.detail.date);
    document.addEventListener('memories:day', onDay);
    return () => document.removeEventListener('memories:day', onDay);
  }, []);
  return date;
}
```

In `events.ts`, add to `DocumentEventMap`:
`'memories:open-jump': CustomEvent<undefined>;` and `'memories:open-shortcuts': CustomEvent<undefined>;`.

- [ ] **Step 6: The day list endpoint** (`src/pages/days.json.ts`)

```ts
import type { APIRoute } from 'astro';

import { indexDays, summarize } from '../lib/days.ts';
import { getTimeline } from '../lib/store.ts';

export const GET: APIRoute = () => {
  const state = getTimeline();
  const days =
    state.status === 'ready'
      ? summarize(indexDays(state.timeline.events)).map(({ date, total }) => ({
          date,
          total,
        }))
      : [];
  return Response.json(days, {
    headers: { 'Cache-Control': 'private, no-cache' },
  });
};
```

- [ ] **Step 7: State hook** (`src/components/chrome/useChrome.ts`)

```ts
import { useEffect, useState } from 'react';

import { type Level, levelHrefs, type Place } from '../../lib/nav.ts';
import { useActiveDay } from '../useActiveDay.ts';
import { useOverlay } from '../useOverlay.ts';

export type DayCount = { date: string; total: number };

export function useChrome(place: Place, initial: Record<Level, string>) {
  const active = useActiveDay(place.level === 'day' ? place.date : undefined);
  const hrefs =
    place.level === 'day' && active
      ? levelHrefs({ level: 'day', date: active }, [])
      : initial;
  const [jumpOpen, setJumpOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [days, setDays] = useState<DayCount[] | 'error'>();

  useEffect(() => {
    const onJump = () => setJumpOpen(true);
    const onKeys = () => setKeysOpen(true);
    document.addEventListener('memories:open-jump', onJump);
    document.addEventListener('memories:open-shortcuts', onKeys);
    return () => {
      document.removeEventListener('memories:open-jump', onJump);
      document.removeEventListener('memories:open-shortcuts', onKeys);
    };
  }, []);

  useEffect(() => {
    if (!jumpOpen || Array.isArray(days)) return;
    let live = true;
    fetch('/days.json')
      .then((r) =>
        r.ok
          ? (r.json() as Promise<DayCount[]>)
          : Promise.reject(new Error(String(r.status))),
      )
      .then(
        (list) => live && setDays(list),
        () => live && setDays('error'),
      );
    return () => {
      live = false;
    };
  }, [jumpOpen, days]);

  useOverlay(jumpOpen || keysOpen);
  return { hrefs, jumpOpen, setJumpOpen, keysOpen, setKeysOpen, days };
}
```

A failed load is retried the next time the dialog opens.

- [ ] **Step 8: Presentation and container.** `src/components/chrome/TopBar.tsx`:

```tsx
import {
  Button,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Kbd,
  Tabs,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@rainforest-dev/rainforest-react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  KeyboardIcon,
  SearchIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import type { Level } from '../../lib/nav.ts';

const LEVELS: { value: Level; label: string }[] = [
  { value: 'year', label: '年' },
  { value: 'month', label: '月' },
  { value: 'day', label: '日' },
];

type Props = {
  level: Level;
  hrefs: Record<Level, string>;
  onJump: () => void;
  onKeys: () => void;
  onStep?: ((delta: -1 | 1) => void) | undefined;
};

function IconTip({
  label,
  tip,
  onClick,
  className,
  children,
}: {
  label: string;
  tip: ReactNode;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            className={className}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

export function TopBar({ level, hrefs, onJump, onKeys, onStep }: Props) {
  return (
    <header className="border-border mb-6 flex h-14 items-center gap-3 border-b">
      <a href="/" className="text-heading font-semibold">
        回憶
      </a>
      <Tabs value={level}>
        <TabsList aria-label="縮放">
          {LEVELS.map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              nativeButton={false}
              render={<a href={hrefs[value]} />}
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {onStep && (
        <div className="flex items-center">
          <IconTip
            label="前一天"
            tip={
              <>
                前一天 <Kbd>k</Kbd>
              </>
            }
            onClick={() => onStep(-1)}
          >
            <ChevronLeftIcon />
          </IconTip>
          <IconTip
            label="後一天"
            tip={
              <>
                後一天 <Kbd>j</Kbd>
              </>
            }
            onClick={() => onStep(1)}
          >
            <ChevronRightIcon />
          </IconTip>
        </div>
      )}
      <div className="flex-1" />
      <InputGroup className="relative hidden w-56 sm:flex">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          readOnly
          tabIndex={-1}
          aria-hidden
          placeholder="跳至日期"
        />
        <InputGroupAddon align="inline-end">
          <Kbd>/</Kbd>
        </InputGroupAddon>
        <button
          type="button"
          aria-label="跳至日期"
          onClick={onJump}
          className="focus-visible:ring-ring absolute inset-0 rounded-lg outline-none focus-visible:ring-2"
        />
      </InputGroup>
      <IconTip
        label="跳至日期"
        tip="跳至日期"
        onClick={onJump}
        className="sm:hidden"
      >
        <SearchIcon />
      </IconTip>
      <IconTip label="鍵盤快速鍵" tip="按 ? 看所有快速鍵" onClick={onKeys}>
        <KeyboardIcon />
      </IconTip>
    </header>
  );
}
```

The jump trigger is a transparent button over a read-only `InputGroup`, so the brief's look stays.
A focusable read-only input would reopen the dialog when focus returns to it after closing.

`src/components/chrome/DateJump.tsx`:

```tsx
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  Skeleton,
} from '@rainforest-dev/rainforest-react';
import { useMemo, useState } from 'react';

import { groupByMonth, jumpTarget, matchDates } from '../../lib/jump.ts';
import { monthLabel } from '../../lib/months.ts';
import { dayHeading } from '../../lib/weeks.ts';
import type { DayCount } from './useChrome.ts';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  days: DayCount[] | 'error' | undefined;
  onGo: (date: string, nearest: boolean) => void;
};

export function DateJump({ open, onOpenChange, days, onGo }: Props) {
  const [query, setQuery] = useState('');
  const list = useMemo(() => (Array.isArray(days) ? days : []), [days]);
  const dates = useMemo(() => list.map((d) => d.date), [list]);
  const totals = useMemo(
    () => new Map(list.map((d) => [d.date, d.total])),
    [list],
  );
  const groups = useMemo(
    () => groupByMonth(matchDates(dates, query)),
    [dates, query],
  );
  const target = groups.length === 0 ? jumpTarget(dates, query) : undefined;

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery('');
      }}
      title="跳至日期"
      description="YYYY-MM-DD"
    >
      <Command shouldFilter={false}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="YYYY-MM-DD"
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || !target) return;
            e.preventDefault();
            onGo(target.date, !target.exact);
          }}
        />
        <CommandList>
          {days === undefined && (
            <div className="flex flex-col gap-2 p-2" aria-label="載入中…">
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </div>
          )}
          {days === 'error' && (
            <p className="text-muted-foreground text-meta p-3">
              載入失敗，請再開一次
            </p>
          )}
          {Array.isArray(days) && (
            <CommandEmpty>
              {target
                ? `沒有這一天，按 Enter 跳到最近的 ${target.date}`
                : '沒有這一天'}
            </CommandEmpty>
          )}
          {groups.map(({ month, dates: inMonth }) => (
            <CommandGroup key={month} heading={monthLabel(month)}>
              {inMonth.map((date) => (
                <CommandItem
                  key={date}
                  value={date}
                  onSelect={() => onGo(date, false)}
                >
                  {dayHeading(date)}
                  <CommandShortcut>{totals.get(date)} 則</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
```

`src/components/chrome/ShortcutsDialog.tsx`:

```tsx
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Kbd,
  KbdGroup,
  Separator,
} from '@rainforest-dev/rainforest-react';
import { XIcon } from 'lucide-react';

import { SHORTCUT_GROUPS } from '../../lib/shortcuts.ts';

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

export function ShortcutsDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader className="flex-row items-center justify-between">
          <DialogTitle>鍵盤快速鍵</DialogTitle>
          <DialogClose
            render={<Button variant="ghost" size="icon-sm" aria-label="關閉" />}
          >
            <XIcon />
          </DialogClose>
        </DialogHeader>
        {SHORTCUT_GROUPS.map((group, i) => (
          <section key={group.title ?? 'all'} className="flex flex-col gap-2">
            {i > 0 && <Separator />}
            {group.title && (
              <h3 className="text-muted-foreground text-xs">{group.title}</h3>
            )}
            <dl className="flex flex-col gap-1.5">
              {group.rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-4"
                >
                  <dt className="text-meta">{row.label}</dt>
                  <dd>
                    <KbdGroup>
                      {row.keys.map((key) => (
                        <Kbd key={key}>{key}</Kbd>
                      ))}
                    </KbdGroup>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </DialogContent>
    </Dialog>
  );
}
```

`src/components/chrome/AppBar.tsx`:

```tsx
import { TooltipProvider } from '@rainforest-dev/rainforest-react';

import { stepDay } from '../../lib/client/step-day.ts';
import type { Level, Place } from '../../lib/nav.ts';
import { DateJump } from './DateJump.tsx';
import { ShortcutsDialog } from './ShortcutsDialog.tsx';
import { TopBar } from './TopBar.tsx';
import { useChrome } from './useChrome.ts';

type Props = { place: Place; hrefs: Record<Level, string> };

const go = (date: string, nearest: boolean) =>
  location.assign(`/day/${date}${nearest ? '?nearest=1' : ''}`);

export function AppBar({ place, hrefs }: Props) {
  const chrome = useChrome(place, hrefs);
  return (
    <TooltipProvider>
      <TopBar
        level={place.level}
        hrefs={chrome.hrefs}
        onJump={() => chrome.setJumpOpen(true)}
        onKeys={() => chrome.setKeysOpen(true)}
        onStep={place.level === 'day' ? stepDay : undefined}
      />
      <DateJump
        open={chrome.jumpOpen}
        onOpenChange={chrome.setJumpOpen}
        days={chrome.days}
        onGo={go}
      />
      <ShortcutsDialog
        open={chrome.keysOpen}
        onOpenChange={chrome.setKeysOpen}
      />
    </TooltipProvider>
  );
}
```

- [ ] **Step 9: Layout and pages.** `Layout.astro`:

```astro
---
import '../styles/global.css';

import { AppBar } from '../components/chrome/AppBar.tsx';
import type { Level, Place } from '../lib/nav.ts';

type Props = {
  title: string;
  wide?: boolean;
  bar?: { place: Place; hrefs: Record<Level, string> } | undefined;
};

const { title, wide = false, bar } = Astro.props;
---

<html lang="zh-TW">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
  </head>
  <body class="antialiased">
    <main class:list={['mx-auto px-4 py-8', wide ? 'max-w-6xl' : 'max-w-2xl']}>
      {bar && <AppBar client:load place={bar.place} hrefs={bar.hrefs} />}
      <slot />
    </main>
  </body>
</html>
```

`index.astro`: import `levelHrefs` and pass
`bar={{ place: { level: 'year' }, hrefs: levelHrefs({ level: 'year' }, days.map((d) => d.id)) }}`.
`month/[month].astro`: pass
`bar={{ place: { level: 'month', month }, hrefs: levelHrefs({ level: 'month', month }, index?.dates ?? []) }}`
when `MONTH_RE.test(month)`, else `{ place: { level: 'year' }, hrefs: levelHrefs({ level: 'year' }, index?.dates ?? []) }`.

`day/[date].astro`: import `Alert`, `AlertDescription` from `@rainforest-dev/rainforest-react`,
`indexDays`, `nearestDate`, `levelHrefs` and `dayHeading`. In the frontmatter:

```ts
const dates =
  state.status === 'ready' ? indexDays(state.timeline.events).dates : [];
const nearest = !day?.events ? nearestDate(dates, date) : undefined;
const jumped = Astro.url.searchParams.has('nearest') && !!day?.events;
const bar = {
  place: { level: 'day', date } as const,
  hrefs: levelHrefs({ level: 'day', date }, dates),
};
```

Pass `bar={bar}` to `Layout`. Replace `<p>找不到 {date} 這一天。</p>` with:

```astro
<p>
  找不到 {date} 這一天。
  {
    nearest && (
      <a class="underline" href={`/day/${nearest}`}>
        {dayHeading(nearest)}
      </a>
    )
  }
</p>
```

and put above the stream grid:

```astro
{
  jumped && (
    <Alert variant="info" className="mb-4">
      <AlertDescription>
        沒有這一天，已跳到最近的 {dayHeading(date)}
      </AlertDescription>
    </Alert>
  )
}
```

- [ ] **Step 10: E2E, date jump** (the fixture's last day is 2025-11-03)

```ts
test('the date jump opens a typed day, or the nearest one', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '跳至日期' }).first().click();
  const input = page.getByRole('dialog').getByPlaceholder('YYYY-MM-DD');
  await input.fill('2025-11-0');
  await expect(page.getByRole('dialog').getByRole('option')).toHaveCount(3);
  await input.fill('2025/11/2');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/day\/2025-11-02/);

  await page.getByRole('button', { name: '跳至日期' }).first().click();
  await page
    .getByRole('dialog')
    .getByPlaceholder('YYYY-MM-DD')
    .fill('2025-11-20');
  await expect(page.getByRole('dialog')).toContainText(
    '沒有這一天，按 Enter 跳到最近的 2025-11-03',
  );
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toContainText(
    '沒有這一天，已跳到最近的 2025-11-03（週一）',
  );
});
```

- [ ] **Step 11: E2E, shortcuts overlay from the bar**

```ts
test('the keyboard button opens the shortcuts overlay', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '鍵盤快速鍵' }).click();
  const dialog = page.getByRole('dialog', { name: '鍵盤快速鍵' });
  await expect(dialog).toContainText('在日子間移動');
  await dialog.getByRole('button', { name: '關閉' }).click();
  await expect(dialog).toBeHidden();
});
```

- [ ] **Step 12: E2E, the tabs follow the day in view (owner #2)**

```ts
test('the 年/月/日 tabs follow the day in view', async ({ page }) => {
  await page.goto('/day/2025-11-02');
  await page.locator('[data-load="next"]').scrollIntoViewIfNeeded();
  await expect(page.locator('#day-2025-11-03')).toBeAttached();
  await page
    .locator('#day-2025-11-03')
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect(page).toHaveURL(/\/day\/2025-11-03$/);
  await expect(page.getByRole('tab', { name: '日' })).toHaveAttribute(
    'href',
    '/day/2025-11-03',
  );
  await page.getByRole('tab', { name: '月' }).click();
  await expect(page).toHaveURL(/\/month\/2025-11$/);
});
```

- [ ] **Step 13: Run and check in the dev server** (the layout changed, so the repo rule applies)

Run: `pnpm nx run-many -t lint test typecheck -p personal-memories`, then `pnpm nx e2e personal-memories-e2e`.
Expected: PASS.
Dev: `pnpm nx dev personal-memories` on the fixture; load `/`, `/month/2025-11` and
`/day/2025-11-01` in Safari and Chrome at 1280 and 390, light and dark. The Tabs are links (a
middle-click opens a tab), and the jump dialog shows the Skeleton on a throttled network.

- [ ] **Step 14: Commit (controller)**

```bash
git add apps/personal-memories/src/lib/nav.ts apps/personal-memories/src/lib/nav.test.ts \
  apps/personal-memories/src/lib/jump.ts apps/personal-memories/src/lib/jump.test.ts \
  apps/personal-memories/src/lib/shortcuts.ts apps/personal-memories/src/lib/client \
  apps/personal-memories/src/components/useActiveDay.ts apps/personal-memories/src/components/chrome \
  apps/personal-memories/src/pages apps/personal-memories/src/layouts/Layout.astro \
  apps/personal-memories-e2e/src/timeline.spec.ts
git commit -m "feat(personal-memories): add the app bar, date jump and shortcuts overlay"
```

### Task 10: Keyboard shortcuts

**Files:**

- Modify: `apps/personal-memories/src/lib/shortcuts.ts` (add `resolveShortcut`), create `shortcuts.test.ts`
- Create: `apps/personal-memories/src/scripts/shortcuts.ts`
- Modify: `apps/personal-memories/src/layouts/Layout.astro` (start the script)
- Modify: `apps/personal-memories/src/lib/client/events.ts` (`memories:focus-note`)
- Modify: `apps/personal-memories/src/components/NotePanel.tsx` (handle `memories:focus-note`)
- Test: `apps/personal-memories-e2e/src/timeline.spec.ts`

**Interfaces:**

- Consumes: `Place`, `placeOf`, `zoomOutHref` (Task 9); `isOverlayOpen` (Task 6); `stepDay` (Task 9).
- Produces:
  - `type Shortcut = { type: 'navigate'; href: string } | { type: 'step-day'; delta: -1 | 1 } | { type: 'step-cell'; delta: -1 | 1 } | { type: 'blur' } | { type: 'focus-note' } | { type: 'open-jump' } | { type: 'open-shortcuts' }`
  - `type KeyInput = { key: string; modified: boolean; typing: boolean; overlayOpen: boolean; onCell: boolean; place: Place | undefined }`
  - `resolveShortcut(k: KeyInput): Shortcut | undefined`
  - `startShortcuts(): void` (one capture-phase `keydown` listener on `window`)

- [ ] **Step 1: Write the failing tests** (`shortcuts.test.ts`)

```ts
import { describe, expect, it } from 'vitest';

import type { Place } from './nav.ts';
import { type KeyInput, resolveShortcut } from './shortcuts.ts';

const DAY: Place = { level: 'day', date: '2025-11-02' };
const key = (k: string, over: Partial<KeyInput> = {}): KeyInput => ({
  key: k,
  modified: false,
  typing: false,
  overlayOpen: false,
  onCell: false,
  place: DAY,
  ...over,
});

describe('resolveShortcut', () => {
  it('opens the overlays anywhere', () => {
    expect(resolveShortcut(key('?', { place: { level: 'year' } }))).toEqual({
      type: 'open-shortcuts',
    });
    expect(resolveShortcut(key('/'))).toEqual({ type: 'open-jump' });
  });

  it('zooms out one level on Escape, and blurs a heat cell on the year', () => {
    expect(resolveShortcut(key('Escape'))).toEqual({
      type: 'navigate',
      href: '/month/2025-11',
    });
    expect(
      resolveShortcut(
        key('Escape', { place: { level: 'month', month: '2025-11' } }),
      ),
    ).toEqual({ type: 'navigate', href: '/' });
    expect(
      resolveShortcut(key('Escape', { place: { level: 'year' } })),
    ).toBeUndefined();
    expect(
      resolveShortcut(
        key('Escape', { place: { level: 'year' }, onCell: true }),
      ),
    ).toEqual({ type: 'blur' });
  });

  it('never acts while typing, with an overlay open, with a modifier, or off the three levels', () => {
    for (const k of ['Escape', 'j', '/', '?', 'n']) {
      expect(resolveShortcut(key(k, { typing: true }))).toBeUndefined();
      expect(resolveShortcut(key(k, { overlayOpen: true }))).toBeUndefined();
      expect(resolveShortcut(key(k, { modified: true }))).toBeUndefined();
      expect(resolveShortcut(key(k, { place: undefined }))).toBeUndefined();
    }
  });

  it('keeps day keys on the day and cell keys on a focused heat cell', () => {
    expect(resolveShortcut(key('j'))).toEqual({ type: 'step-day', delta: 1 });
    expect(resolveShortcut(key('k'))).toEqual({ type: 'step-day', delta: -1 });
    expect(resolveShortcut(key('n'))).toEqual({ type: 'focus-note' });
    expect(
      resolveShortcut(key('j', { place: { level: 'year' } })),
    ).toBeUndefined();
    const year = { place: { level: 'year' } as Place };
    expect(
      resolveShortcut(key('ArrowRight', { ...year, onCell: true })),
    ).toEqual({ type: 'step-cell', delta: 1 });
    expect(
      resolveShortcut(key('ArrowLeft', { ...year, onCell: true })),
    ).toEqual({ type: 'step-cell', delta: -1 });
    expect(resolveShortcut(key('ArrowRight', year))).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm nx test personal-memories -- src/lib/shortcuts.test.ts`
Expected: FAIL, `resolveShortcut` is not exported.

- [ ] **Step 3: Implement** (append to `shortcuts.ts`)

```ts
import { type Place, zoomOutHref } from './nav.ts';

export type Shortcut =
  | { type: 'navigate'; href: string }
  | { type: 'step-day'; delta: -1 | 1 }
  | { type: 'step-cell'; delta: -1 | 1 }
  | { type: 'blur' }
  | { type: 'focus-note' }
  | { type: 'open-jump' }
  | { type: 'open-shortcuts' };

export type KeyInput = {
  key: string;
  modified: boolean;
  typing: boolean;
  overlayOpen: boolean;
  onCell: boolean;
  place: Place | undefined;
};

export function resolveShortcut(k: KeyInput): Shortcut | undefined {
  if (k.modified || k.typing || k.overlayOpen || !k.place) return undefined;
  const { level } = k.place;
  switch (k.key) {
    case '?':
      return { type: 'open-shortcuts' };
    case '/':
      return { type: 'open-jump' };
    case 'Escape': {
      if (level === 'year') return k.onCell ? { type: 'blur' } : undefined;
      const href = zoomOutHref(k.place);
      return href ? { type: 'navigate', href } : undefined;
    }
    case 'j':
      return level === 'day' ? { type: 'step-day', delta: 1 } : undefined;
    case 'k':
      return level === 'day' ? { type: 'step-day', delta: -1 } : undefined;
    case 'n':
      return level === 'day' ? { type: 'focus-note' } : undefined;
    case 'ArrowRight':
      return level === 'year' && k.onCell
        ? { type: 'step-cell', delta: 1 }
        : undefined;
    case 'ArrowLeft':
      return level === 'year' && k.onCell
        ? { type: 'step-cell', delta: -1 }
        : undefined;
    default:
      return undefined;
  }
}
```

(Put the `import` at the top of the file with the other imports.)

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm nx test personal-memories -- src/lib/shortcuts.test.ts`
Expected: PASS.

- [ ] **Step 5: DOM glue.** `src/scripts/shortcuts.ts`:

```ts
import { isOverlayOpen } from '../lib/client/overlays.ts';
import { stepDay } from '../lib/client/step-day.ts';
import { placeOf } from '../lib/nav.ts';
import { resolveShortcut, type Shortcut } from '../lib/shortcuts.ts';

const TYPING =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
const CELL = 'a[data-date]';

function stepCell(delta: -1 | 1) {
  const cells = [...document.querySelectorAll<HTMLElement>(CELL)].filter((c) =>
    c.checkVisibility(),
  );
  cells[cells.indexOf(document.activeElement as HTMLElement) + delta]?.focus();
}

const emit = (
  type:
    'memories:open-jump' | 'memories:open-shortcuts' | 'memories:focus-note',
) => document.dispatchEvent(new CustomEvent(type));

function run(action: Shortcut) {
  switch (action.type) {
    case 'navigate':
      return location.assign(action.href);
    case 'step-day':
      return stepDay(action.delta);
    case 'step-cell':
      return stepCell(action.delta);
    case 'blur':
      return (document.activeElement as HTMLElement | null)?.blur();
    case 'focus-note':
      return emit('memories:focus-note');
    case 'open-jump':
      return emit('memories:open-jump');
    case 'open-shortcuts':
      return emit('memories:open-shortcuts');
  }
}

export function startShortcuts() {
  window.addEventListener(
    'keydown',
    (event) => {
      const active = document.activeElement;
      const action = resolveShortcut({
        key: event.key,
        modified: event.metaKey || event.ctrlKey || event.altKey,
        typing: !!active?.closest(TYPING) || event.isComposing,
        overlayOpen: isOverlayOpen() || event.defaultPrevented,
        onCell: !!active?.matches(CELL),
        place: placeOf(location.pathname),
      });
      if (!action) return;
      event.preventDefault();
      run(action);
    },
    // Capture phase: Base UI closes an overlay on Escape before a bubbling listener would run.
    true,
  );
}
```

In `Layout.astro`, after `</main>`:

```astro
<script>
  import { startShortcuts } from '../scripts/shortcuts.ts';
  startShortcuts();
</script>
```

In `events.ts`, add `'memories:focus-note': CustomEvent<undefined>;`.

- [ ] **Step 6: `n` focuses the memory.** In `NotePanel.tsx`:

```tsx
const memoryRef = useRef<HTMLTextAreaElement>(null);
const [focusTick, setFocusTick] = useState(0);
useEffect(() => {
  const onFocus = () => {
    setOpen(true);
    setFocusTick((n) => n + 1);
  };
  document.addEventListener('memories:focus-note', onFocus);
  return () => document.removeEventListener('memories:focus-note', onFocus);
}, []);
useEffect(() => {
  if (focusTick) memoryRef.current?.focus();
}, [focusTick, open]);
```

and give the memory textarea `ref={memoryRef}`. On a phone this expands the sheet first, and the
effect focuses once the expanded body has rendered.

- [ ] **Step 7: E2E, keys and Escape** (Review Focus 4)

```ts
test('keys: j and k, n, ? and /, and Escape only when nothing else claims it', async ({
  page,
}) => {
  await page.goto('/day/2025-11-02');
  await page.keyboard.press('j');
  await expect(page).toHaveURL(/\/day\/2025-11-03$/);
  await page.keyboard.press('k');
  await expect(page).toHaveURL(/\/day\/2025-11-02$/);

  const memory = page.getByLabel('當天的回憶');
  const before = await memory.inputValue();
  await page.keyboard.press('n');
  await expect(memory).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.type('jk');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/day\/2025-11-02$/);
  await expect(memory).toHaveValue(`${before}jk`);
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await memory.evaluate((el) => (el as HTMLElement).blur());

  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: '鍵盤快速鍵' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page).toHaveURL(/\/day\/2025-11-02$/);

  await page.keyboard.press('/');
  await expect(
    page.getByRole('dialog').getByPlaceholder('YYYY-MM-DD'),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page).toHaveURL(/\/day\/2025-11-02$/);

  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/month\/2025-11$/);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);

  await page.locator('a[data-date="2025-11-01"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('a[data-date="2025-11-02"]')).toBeFocused();
});
```

- [ ] **Step 8: Run**

Run: `pnpm nx run-many -t test typecheck -p personal-memories`, then `pnpm nx e2e personal-memories-e2e`.
Expected: PASS. Also check in Safari: `?` needs Shift, and typing 注音 in the memory (IME
composition) never triggers a shortcut.

- [ ] **Step 9: Commit (controller)**

```bash
git add apps/personal-memories/src/lib/shortcuts.ts apps/personal-memories/src/lib/shortcuts.test.ts \
  apps/personal-memories/src/scripts/shortcuts.ts apps/personal-memories/src/layouts/Layout.astro \
  apps/personal-memories/src/lib/client/events.ts apps/personal-memories/src/components/NotePanel.tsx \
  apps/personal-memories-e2e/src/timeline.spec.ts
git commit -m "feat(personal-memories): add keyboard shortcuts"
```

### Task 11: Zoom transitions year → month → day, in step with the scroll (owner #2)

**Files:**

- Create: `apps/personal-memories/src/lib/zoom.ts`, `apps/personal-memories/src/lib/zoom.test.ts`
- Create: `apps/personal-memories/src/scripts/zoom.ts`
- Modify: `apps/personal-memories/src/styles/global.css` (`@view-transition`, motion, reduced motion)
- Modify: `apps/personal-memories/src/layouts/Layout.astro` (start the script)
- Modify: `apps/personal-memories/src/components/Heatmap.astro` (`morph` prop, `data-morph`, month links)
- Modify: `apps/personal-memories/src/components/month/MonthCalendar.astro` (use `morphAttrs` from `zoom.ts`)
- Modify: `apps/personal-memories/src/components/DaySection.astro` (`morph` prop on the heading)
- Modify: `apps/personal-memories/src/pages/index.astro`, `month/[month].astro`, `day/[date].astro` (compute `morph`)
- Test: `apps/personal-memories-e2e/src/timeline.spec.ts`

**Interfaces:**

- Consumes: `Place`, `placeOf` (Task 9); `monthOf` (Task 3).
- Produces:
  - `morphKey(from: Place | undefined, to: Place | undefined): string | undefined`
    (`day-<date>` or `month-<YYYY-MM>`)
  - `refererPath(referer: string | null, host: string | null): string | undefined` (same host only)
  - `morphFromRequest(request: Request, url: URL): string | undefined`
  - `morphAttrs(key: string, morph: string | undefined): Record<string, string>` (inline
    `view-transition-name` plus `data-morph-target` when `key === morph`, else `{}`)
  - `startZoom(): void` (names the old element in `pageswap`, focuses `[data-morph-target]` on load)

Acceptance for owner #2, across Tasks 1, 9, 11 and 12: while scrolling, the URL, the 年/月/日 tab
targets, the hour-strip marker and the scrubber's current month all follow the day in view; `月`,
`Escape` and pinch zoom out from the day in view; the morph pairs the in-view day's heading with
its month cell.

- [ ] **Step 1: Write the failing tests** (`zoom.test.ts`)

```ts
import { describe, expect, it } from 'vitest';

import { morphAttrs, morphKey, refererPath } from './zoom.ts';

const YEAR = { level: 'year' } as const;
const NOV = { level: 'month', month: '2025-11' } as const;
const DAY = { level: 'day', date: '2025-11-03' } as const;

describe('morphKey', () => {
  it('ties a day to its heat cell and to its month cell, both ways', () => {
    expect(morphKey(YEAR, DAY)).toBe('day-2025-11-03');
    expect(morphKey(DAY, YEAR)).toBe('day-2025-11-03');
    expect(morphKey(NOV, DAY)).toBe('day-2025-11-03');
    expect(morphKey(DAY, NOV)).toBe('day-2025-11-03');
  });

  it('ties a month to its heatmap row', () => {
    expect(morphKey(YEAR, NOV)).toBe('month-2025-11');
    expect(morphKey(NOV, YEAR)).toBe('month-2025-11');
  });

  it('names nothing for sideways moves, other months or unknown pages', () => {
    expect(morphKey(DAY, { level: 'month', month: '2025-12' })).toBeUndefined();
    expect(morphKey(NOV, { level: 'month', month: '2025-12' })).toBeUndefined();
    expect(morphKey(DAY, { level: 'day', date: '2025-11-04' })).toBeUndefined();
    expect(morphKey(undefined, DAY)).toBeUndefined();
  });
});

describe('refererPath', () => {
  it('accepts only a same-host referer', () => {
    expect(
      refererPath('http://127.0.0.1:3024/month/2025-11', '127.0.0.1:3024'),
    ).toBe('/month/2025-11');
    expect(
      refererPath('https://elsewhere.example/', '127.0.0.1:3024'),
    ).toBeUndefined();
    expect(refererPath('not a url', '127.0.0.1:3024')).toBeUndefined();
    expect(refererPath(null, '127.0.0.1:3024')).toBeUndefined();
  });
});

describe('morphAttrs', () => {
  it('names only the element that matches', () => {
    expect(morphAttrs('day-2025-11-03', 'day-2025-11-03')).toEqual({
      style: 'view-transition-name: day-2025-11-03',
      'data-morph-target': '',
    });
    expect(morphAttrs('day-2025-11-03', undefined)).toEqual({});
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm nx test personal-memories -- src/lib/zoom.test.ts`
Expected: FAIL, cannot resolve `./zoom.ts`.

- [ ] **Step 3: Implement `zoom.ts`**

```ts
import { monthOf } from './months.ts';
import { type Place, placeOf } from './nav.ts';

export function morphKey(
  from: Place | undefined,
  to: Place | undefined,
): string | undefined {
  if (!from || !to || from.level === to.level) return undefined;
  const day =
    from.level === 'day' ? from.date : to.level === 'day' ? to.date : undefined;
  if (day) {
    const other = from.level === 'day' ? to : from;
    if (other.level === 'month' && other.month !== monthOf(day))
      return undefined;
    return `day-${day}`;
  }
  const month =
    from.level === 'month'
      ? from.month
      : to.level === 'month'
        ? to.month
        : undefined;
  return month ? `month-${month}` : undefined;
}

export function refererPath(
  referer: string | null,
  host: string | null,
): string | undefined {
  if (!referer || !host) return undefined;
  try {
    const url = new URL(referer);
    return url.host === host ? url.pathname : undefined;
  } catch {
    return undefined;
  }
}

export function morphFromRequest(
  request: Request,
  url: URL,
): string | undefined {
  const from = refererPath(
    request.headers.get('referer'),
    request.headers.get('host') ?? url.host,
  );
  return from === undefined
    ? undefined
    : morphKey(placeOf(from), placeOf(url.pathname));
}

export const morphAttrs = (
  key: string,
  morph: string | undefined,
): Record<string, string> =>
  morph === key
    ? { style: `view-transition-name: ${key}`, 'data-morph-target': '' }
    : {};
```

The host comes from the `Host` header rather than `url.origin`, because behind the Cloudflare
tunnel the server's own origin is not the public one the browser puts in `Referer`.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm nx test personal-memories -- src/lib/zoom.test.ts`
Expected: PASS.

- [ ] **Step 5: CSS** (append to `global.css`)

```css
@view-transition {
  navigation: auto;
}

::view-transition-group(*),
::view-transition-old(*),
::view-transition-new(*) {
  animation-duration: 300ms;
  animation-timing-function: cubic-bezier(0.2, 0, 0, 1);
}

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation-duration: 150ms;
  }

  [data-morph] {
    view-transition-name: none !important;
  }
}
```

- [ ] **Step 6: Mark the morphing elements.**

`MonthCalendar.astro`: delete the local `morphAttrs` and import the one from `../../lib/zoom.ts`.
Every call site passes the key plus the `morph` prop: `morphAttrs(key, morph)`.

`DaySection.astro`: add `morph?: string | undefined` to `Props` and import `morphAttrs`. The
heading link becomes:

```astro
<a
  href={`/day/${date}`}
  data-morph={`day-${date}`}
  {...morphAttrs(`day-${date}`, morph)}
>
  {dayHeading(date)}
</a>
```

`Heatmap.astro`: add `morph?: string | undefined` to `Props`, import `morphAttrs`, and add a
helper in the frontmatter:

```ts
const monthKey = (row: MonthRow) =>
  `${row.year}-${String(row.month).padStart(2, '0')}`;
```

Each desktop cell, the `<a>` and the `<span>`, gets these two attributes:

```astro
data-morph={`day-${cell.date}`}
{morphAttrs(`day-${cell.date}`, morph)}
```

The desktop month label becomes a link:

```astro
<a
  href={`/month/${monthKey(row)}`}
  data-morph={`month-${monthKey(row)}`}
  {...morphAttrs(`month-${monthKey(row)}`, morph)}
  class="text-meta text-muted-foreground hover:text-foreground tabular-nums"
>
  {row.month} 月
</a>
```

A phone row whose month has any event links to its month instead of its first day (D6). Delete
`firstDayWithEvents` and render the row link as:

```astro
<a
  href={`/month/${monthKey(row)}`}
  data-morph={`month-${monthKey(row)}`}
  {...morphAttrs(`month-${monthKey(row)}`, morph)}
  class={`grid h-7 items-center ${PHONE_GRID_COLS}`}
>
  {rowLabel}
</a>
```

using `row.cells.some((c) => c !== null && c.total > 0)` as the condition in place of `target`.

Pages: `index.astro`, `month/[month].astro` and `day/[date].astro` each compute
`const morph = morphFromRequest(Astro.request, Astro.url);` and pass it as `morph` to
`Heatmap`, `MonthCalendar` and the first `DaySection`. Partials pass nothing.

- [ ] **Step 7: The script.** `src/scripts/zoom.ts`:

```ts
import { placeOf } from '../lib/nav.ts';
import { morphKey } from '../lib/zoom.ts';

const REDUCE = '(prefers-reduced-motion: reduce)';

const firstVisible = (selector: string) =>
  [...document.querySelectorAll<HTMLElement>(selector)].find((el) =>
    el.checkVisibility(),
  );

export function startZoom() {
  window.addEventListener('pageswap', (event) => {
    const to = event.activation?.entry.url;
    if (!event.viewTransition || !to || matchMedia(REDUCE).matches) return;
    const key = morphKey(
      placeOf(location.pathname),
      placeOf(new URL(to).pathname),
    );
    const el = key ? firstVisible(`[data-morph="${key}"]`) : undefined;
    if (key && el) el.style.viewTransitionName = key;
  });
  firstVisible('[data-morph-target]')?.focus({ preventScroll: true });
}
```

On the day page `location.pathname` is already the day in view, because `day-stream.ts` keeps it
in sync with `replaceState`; so zooming out after scrolling morphs the right heading. In
`Layout.astro` add `import { startZoom } from '../scripts/zoom.ts'; startZoom();` to the existing
`<script>`.

- [ ] **Step 8: E2E, zooming after scrolling** (Review Focus 3)

```ts
test('zooming out after scrolling lands on the day in view', async ({
  page,
}) => {
  await page.goto('/day/2025-11-02');
  await page.locator('[data-load="next"]').scrollIntoViewIfNeeded();
  await expect(page.locator('#day-2025-11-03')).toBeAttached();
  await page
    .locator('#day-2025-11-03')
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect(page).toHaveURL(/\/day\/2025-11-03$/);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/month\/2025-11$/);
  const cell = page.locator('a[data-date="2025-11-03"]:visible');
  await expect(cell).toHaveAttribute(
    'style',
    /view-transition-name: day-2025-11-03/,
  );
  await expect(cell).toBeFocused();
  await cell.click();
  await expect(
    page.locator('#day-2025-11-03 [data-morph="day-2025-11-03"]'),
  ).toHaveAttribute('style', /view-transition-name: day-2025-11-03/);
});

test('under reduced motion no element morphs', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/month/2025-11');
  await page.locator('a[data-date="2025-11-01"]:visible').click();
  const name = await page
    .locator('#day-2025-11-01 [data-morph="day-2025-11-01"]')
    .evaluate((el) => getComputedStyle(el).viewTransitionName);
  expect(name).toBe('none');
});
```

- [ ] **Step 9: Build and browser checks**

Run: `pnpm nx build personal-memories`, then
`grep -l "@view-transition" apps/personal-memories/dist/client/_astro/*.css` → one match. This
confirms the CSS minifier kept the at-rule.
Run: `pnpm nx e2e personal-memories-e2e` → PASS.
Dev (repo rule): in Safari and Chrome, year → month → day → `Escape` → `Escape`. The heat cell,
month cell and day heading visibly morph at 300 ms; with Reduce Motion on, there is a 150 ms
cross-fade and nothing moves; focus lands on the cell or heading that morphed.

- [ ] **Step 10: Commit (controller)**

```bash
git add apps/personal-memories/src/lib/zoom.ts apps/personal-memories/src/lib/zoom.test.ts \
  apps/personal-memories/src/scripts/zoom.ts apps/personal-memories/src/styles/global.css \
  apps/personal-memories/src/layouts/Layout.astro apps/personal-memories/src/components \
  apps/personal-memories/src/pages apps/personal-memories-e2e/src/timeline.spec.ts
git commit -m "feat(personal-memories): zoom between year, month and day with view transitions"
```

### Task 12: Month scrubber beside the stream

**Files:**

- Create: `apps/personal-memories/src/components/day/MonthScrubber.tsx`
- Modify: `apps/personal-memories/src/pages/day/[date].astro` (a third column on `lg`)
- Test: `apps/personal-memories-e2e/src/timeline.spec.ts`

**Interfaces:**

- Consumes: `ScrubberMonth`, `scrubberMonths`, `monthOf` (Task 3); `useActiveDay` (Task 9);
  `summarize`, `indexDays`.
- Produces: `MonthScrubber` props `{ months: ScrubberMonth[]; date: string }`; DOM
  `nav[aria-label="月份"] a[data-month]`, with the month in view marked `aria-current="date"`.

The pure part (`scrubberMonths`, including the year change) is tested in Task 3; this task is the
presentation and its wiring.

- [ ] **Step 1: Write the failing e2e test** (the fixture spans 2025-10 and 2025-11)

```ts
test('the month scrubber marks the month in view and jumps to another', async ({
  page,
}) => {
  await page.goto('/day/2025-11-02');
  const rail = page.getByRole('navigation', { name: '月份' });
  await expect(rail.locator('[aria-current="date"]')).toHaveAttribute(
    'data-month',
    '2025-11',
  );
  await expect(rail).toContainText('2025');
  await rail.getByRole('link', { name: /10 月/ }).click();
  await expect(page).toHaveURL(/\/day\/2025-10-31$/);
  await expect(rail.locator('[aria-current="date"]')).toHaveAttribute(
    'data-month',
    '2025-10',
  );
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm nx e2e personal-memories-e2e -- --grep "month scrubber"`
Expected: FAIL, no navigation named 月份.

- [ ] **Step 3: Implement** `MonthScrubber.tsx`:

```tsx
import {
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@rainforest-dev/rainforest-react';
import { useEffect, useRef } from 'react';

import { monthOf, type ScrubberMonth } from '../../lib/months.ts';
import { useActiveDay } from '../useActiveDay.ts';

type Props = { months: ScrubberMonth[]; date: string };

export function MonthScrubber({ months, date }: Props) {
  const active = monthOf(useActiveDay(date) ?? date);
  const current = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    current.current?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <TooltipProvider>
      <nav aria-label="月份" className="h-full">
        <ScrollArea className="h-full">
          <ol className="flex flex-col py-2">
            {months.map((m, i) => {
              const year = m.month.slice(0, 4);
              const newYear =
                i === 0 || months[i - 1]?.month.slice(0, 4) !== year;
              const isActive = m.month === active;
              return (
                <li key={m.month}>
                  {newYear && (
                    <span className="text-muted-foreground block px-2 pt-2 text-xs tabular-nums">
                      {year}
                    </span>
                  )}
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <a
                          ref={isActive ? current : undefined}
                          href={`/day/${m.first}`}
                          data-month={m.month}
                          aria-current={isActive ? 'date' : undefined}
                          className={`focus-visible:ring-ring text-meta flex h-9 items-center gap-2 rounded-md px-2 tabular-nums outline-none focus-visible:ring-2 ${isActive ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                        />
                      }
                    >
                      <span
                        aria-hidden
                        className={`size-1 rounded-full ${isActive ? 'bg-primary' : 'bg-border'}`}
                      />
                      {Number(m.month.slice(5))} 月
                    </TooltipTrigger>
                    <TooltipContent side="right">{m.total} 則</TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ol>
        </ScrollArea>
      </nav>
    </TooltipProvider>
  );
}
```

In `day/[date].astro`, import `MonthScrubber`, `scrubberMonths` and `summarize`; compute
`const months = state.status === 'ready' ? scrubberMonths(summarize(indexDays(state.timeline.events))) : [];`.
Change the stream grid to three columns and put the rail first:

```astro
<div class="lg:grid lg:grid-cols-[56px_minmax(0,1fr)_400px] lg:gap-8">
  <aside class="hidden lg:sticky lg:top-4 lg:block lg:h-[calc(100vh-2rem)]">
    <MonthScrubber client:idle months={months} date={date} />
  </aside>
  <div data-stream class="pb-[172px] lg:pb-0">…unchanged…</div>
  <NotePanel client:load initial={initial} />
</div>
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm nx e2e personal-memories-e2e -- --grep "month scrubber"`
Expected: PASS.
Dev: with a scratch data dir spanning 18 months across a year change (extra synthetic LINE lines
in the scratch copy only), the rail scrolls inside its `ScrollArea`, the year label shows before
each January, and the marker follows the scroll.

- [ ] **Step 5: Commit (controller)**

```bash
git add apps/personal-memories/src/components/day/MonthScrubber.tsx \
  apps/personal-memories/src/pages/day/[date].astro apps/personal-memories-e2e/src/timeline.spec.ts
git commit -m "feat(personal-memories): add the month scrubber beside the stream"
```

### Task 13: Year heatmap day preview with CSS anchor positioning (owner #3)

**Files:**

- Modify: `apps/personal-memories/src/lib/month-view.ts` (add `dayCells`), `month-view.test.ts`
- Create: `apps/personal-memories/src/components/year/DayPreview.astro`
- Modify: `apps/personal-memories/src/components/Heatmap.astro` (preview replaces the CSS tooltip; `Kbd` hints)
- Modify: `apps/personal-memories/src/pages/index.astro` (build previews)
- Modify: `apps/personal-memories/src/styles/global.css` (preview positioning and fallback)
- Test: `apps/personal-memories-e2e/src/timeline.spec.ts`

**Interfaces:**

- Consumes: `dayCell`, `MonthCell`, `NoteReader` (Task 4); `morphAttrs` (Task 11); `thumbUrl`;
  `dayHeading`.
- Produces: `dayCells(index: DayIndex, noted: ReadonlySet<string>, read: NoteReader): Map<string, MonthCell>`;
  `Heatmap` gains the prop `previews: Map<string, MonthCell>`; each desktop cell is
  `[data-heat-cell]` with `anchor-name: --d<yyyymmdd>` and a child `[data-preview]` with the
  matching `position-anchor`. Task 11's `data-morph` attributes stay on every cell.

Support (D9): anchor positioning ships in Chrome/Edge 125+ and Safari 26+ (macOS and iOS). In
browsers without it, `@supports not (anchor-name: --a)` puts the preview absolutely above the cell,
as v2a's tooltip did. No polyfill. The preview opens on hover only where `(hover: hover)`, and on
keyboard focus (`:focus-visible`); a tap on a touch screen follows the link. The cell's
`aria-label` already carries the date and count, so the preview is `aria-hidden`.

- [ ] **Step 1: Write the failing test** (append to `month-view.test.ts`)

```ts
describe('dayCells', () => {
  it('builds one preview per day with events', () => {
    const cells = dayCells(index, noted, read);
    expect([...cells.keys()]).toEqual([
      '2025-11-01',
      '2025-11-03',
      '2025-12-02',
    ]);
    expect(cells.get('2025-11-03')).toMatchObject({
      memory: '咖啡',
      excerpt: 'Coffee first',
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm nx test personal-memories -- src/lib/month-view.test.ts`
Expected: FAIL, `dayCells` is not exported.

- [ ] **Step 3: Implement** (append to `month-view.ts`)

```ts
export function dayCells(
  index: DayIndex,
  noted: ReadonlySet<string>,
  read: NoteReader,
): Map<string, MonthCell> {
  return new Map(
    index.dates.map((date) => [
      date,
      dayCell(date, index.byDate.get(date) ?? [], noted.has(date), read),
    ]),
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm nx test personal-memories -- src/lib/month-view.test.ts`
Expected: PASS.

- [ ] **Step 5: The preview.** `src/components/year/DayPreview.astro`:

```astro
---
import type { MonthCell } from '../../lib/month-view.ts';
import { thumbUrl } from '../../lib/stream.ts';
import { dayHeading } from '../../lib/weeks.ts';

type Props = {
  date: string;
  detail: string;
  anchor: string;
  cell?: MonthCell | undefined;
};

const { date, detail, anchor, cell } = Astro.props;
---

<span
  data-preview
  aria-hidden="true"
  style={`position-anchor: ${anchor}`}
  class="bg-popover text-popover-foreground ring-foreground/10 pointer-events-none z-50 w-56 flex-col gap-1.5 rounded-md p-3 text-left text-xs shadow-md ring-1"
>
  <span class="font-semibold tabular-nums">{dayHeading(date)}</span>
  <span class="text-muted-foreground">{detail}</span>
  {
    cell?.cover ? (
      <img
        src={thumbUrl(cell.cover, 0, 240)}
        alt=""
        loading="lazy"
        class="bg-muted mt-1 aspect-video w-full rounded-sm object-cover"
      />
    ) : cell?.memory ? (
      <span class="text-meta line-clamp-2">{cell.memory}</span>
    ) : cell?.excerpt ? (
      <span class="text-meta text-muted-foreground line-clamp-2">
        「{cell.excerpt}」
      </span>
    ) : null
  }
</span>
```

In `global.css`:

```css
[data-preview] {
  display: none;
}

@media (hover: hover) {
  [data-heat-cell]:hover > [data-preview] {
    display: flex;
  }
}

[data-heat-cell]:focus-visible > [data-preview] {
  display: flex;
}

@supports (anchor-name: --a) {
  [data-preview] {
    position: fixed;
    position-area: top center;
    margin-block-end: 0.5rem;
    position-try-fallbacks:
      flip-block,
      top span-right,
      top span-left;
  }
}

@supports not (anchor-name: --a) {
  [data-preview] {
    position: absolute;
    bottom: calc(100% + 0.5rem);
    left: 50%;
    translate: -50% 0;
  }
}
```

`position: fixed` lets the preview escape the heatmap's `overflow-x-auto` scroller, and
`position-try-fallbacks` flips it below, or shifts it sideways, near the viewport edges. A lazy
image inside a `display: none` preview loads only when the preview first shows.

- [ ] **Step 6: Use it in `Heatmap.astro`.** Add `previews: Map<string, MonthCell>` to `Props`,
      import `DayPreview`, `Kbd` and `KbdGroup` (from `@rainforest-dev/rainforest-react`, rendered
      statically). In the desktop grid, replace the per-cell `<a>`/`<span>` and their tooltip
      markup with:

```astro
{
  row.cells.map((cell) => {
    if (!cell) return <span class="size-6" />;
    const isNoted = noted.has(cell.date);
    const lvl = level(cell.total);
    const tip = tooltip(cell.date, cell.total, isNoted);
    const anchor = `--d${cell.date.replaceAll('-', '')}`;
    const key = `day-${cell.date}`;
    const { style: morphStyle, ...morphRest } = morphAttrs(key, morph);
    const style = [`anchor-name: ${anchor}`, morphStyle]
      .filter(Boolean)
      .join('; ');
    const cellClass = `focus-visible:ring-ring focus-visible:ring-offset-background relative flex size-6 items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${LEVEL[lvl]}`;
    const preview = (
      <DayPreview
        date={cell.date}
        detail={tip.detail}
        anchor={anchor}
        cell={previews.get(cell.date)}
      />
    );
    const dot = isNoted && (
      <span class={`size-1.5 rounded-full ${dotClass(lvl)}`} />
    );
    return cell.total > 0 ? (
      <a
        href={`/day/${cell.date}`}
        data-date={cell.date}
        data-noted={isNoted}
        data-heat-cell
        data-morph={key}
        aria-label={`${tip.date}，${tip.detail}`}
        class={cellClass}
        style={style}
        {...morphRest}
      >
        {dot}
        {preview}
      </a>
    ) : (
      <span
        role="img"
        data-date={cell.date}
        data-noted={isNoted}
        data-heat-cell
        data-morph={key}
        aria-label={`${tip.date}，${tip.detail}`}
        class={cellClass}
        style={style}
        {...morphRest}
      >
        {dot}
        {preview}
      </span>
    );
  })
}
```

(`morph` is the prop Task 11 added.) Replace the footer hint block with:

```astro
<div class="text-muted-foreground hidden gap-5 text-xs sm:flex">
  <span class="flex items-center gap-1.5">
    <KbdGroup><Kbd>←</Kbd><Kbd>→</Kbd></KbdGroup>在日子間移動
  </span>
  <span class="flex items-center gap-1.5"><Kbd>Enter</Kbd>打開那一天</span>
</div>
```

In `index.astro`:

```ts
const store = notesStore();
const index =
  state.status === 'ready' ? indexDays(state.timeline.events) : undefined;
const previews = index
  ? dayCells(index, noted, (d) => store?.read(d))
  : new Map();
```

and pass `previews={previews}` to `Heatmap`.

- [ ] **Step 7: E2E**

```ts
test('a heat cell previews its day above it on hover and on keyboard focus', async ({
  page,
}) => {
  await page.goto('/');
  const cell = page.locator('a[data-date="2025-11-03"]');
  const preview = cell.locator('[data-preview]');
  await expect(preview).toBeHidden();
  await cell.hover();
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('2025-11-03（週一）');
  await expect(preview).toContainText('「New week, new plans」');
  const [c, p] = await Promise.all([cell.boundingBox(), preview.boundingBox()]);
  expect(p && c && p.y + p.height <= c.y).toBe(true);

  await page.mouse.move(0, 0);
  await expect(preview).toBeHidden();
  await page.locator('a[data-date="2025-11-02"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(preview).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(preview).toBeHidden();
});
```

- [ ] **Step 8: Run and check support**

Run: `pnpm nx e2e personal-memories-e2e` → PASS.
Browser: Safari 26 and Chrome at 1280: the preview sits above the cell and flips below for a cell
near the top of the viewport. Force the fallback by testing in a browser without anchor
positioning (Firefox, or Chrome with the feature disabled in `chrome://flags`): the preview still
shows above the cell. On iOS Safari a tap opens the day and no preview sticks.

- [ ] **Step 9: Commit (controller)**

```bash
git add apps/personal-memories/src/lib/month-view.ts apps/personal-memories/src/lib/month-view.test.ts \
  apps/personal-memories/src/components/year apps/personal-memories/src/components/Heatmap.astro \
  apps/personal-memories/src/pages/index.astro apps/personal-memories/src/styles/global.css \
  apps/personal-memories-e2e/src/timeline.spec.ts
git commit -m "feat(personal-memories): preview a day from the heatmap with anchor positioning"
```

### Task 14: Notes panel, phone sheet and conflict view on rainforest-react

**Files:**

- Create: `apps/personal-memories/src/components/useMediaQuery.ts`
- Create: `apps/personal-memories/src/components/notes/NotesSurface.tsx`, `StatusBadge.tsx`, `ReadOnlyNotice.tsx`
- Delete: `apps/personal-memories/src/components/notes/BottomSheet.tsx`
- Modify: `apps/personal-memories/src/components/NotePanel.tsx`, `notes/AnnotationItem.tsx`, `notes/ConflictView.tsx`
- Test: `apps/personal-memories-e2e/src/timeline.spec.ts`

**Interfaces:**

- Consumes: everything `NotePanel` wires after Tasks 6, 7 and 10 (lightbox, author name,
  `memories:focus-note`); `useOverlay` (Task 6).
- Produces: `useMediaQuery(query: string, serverValue?: boolean): boolean`;
  `NotesSurface` props `{ expanded; onExpandedChange; title: string; date: ReactNode; status: ReactNode; peek: ReactNode; children: ReactNode }`,
  rendering a desktop `aside[aria-label="筆記"]` or a phone `Sheet side="bottom"` with
  `snapPoints={['156px', 1]}`; `StatusBadge` with `CHIPS` and `LOAD_FAILED` (moved from
  `BottomSheet.tsx`); `ReadOnlyNotice` props `{ parseError: boolean }`. Labels that e2e relies on
  stay: `筆記`, `當天的回憶`, `眉批：<excerpt>`, `保留這個版本`, `Obsidian 的版本`, `已儲存`,
  `有衝突`.

This task changes presentation only. Hydration locking, flush-before-switch, conflict handling
and autosave stay exactly as they are in the hooks.

- [ ] **Step 1: Write the failing e2e test** (the phone sheet)

```ts
test.describe('on a phone', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test('the notes sheet peeks, expands, and Escape returns it to the peek', async ({
    page,
  }) => {
    await page.goto('/day/2025-11-02');
    const sheet = page.getByRole('dialog', { name: '這一天的回憶' });
    await expect(sheet).toContainText('已儲存');
    await expect(sheet.getByLabel('當天的回憶')).toHaveCount(0);
    await sheet.getByRole('button', { name: '展開筆記' }).click();
    await expect(sheet.getByLabel('當天的回憶')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet.getByLabel('當天的回憶')).toHaveCount(0);
    await expect(page).toHaveURL(/\/day\/2025-11-02$/);
  });
});
```

Change the conflict test's card locator, because the keep button now sits in the card footer:

```ts
const obsidianCard = panel.locator('[data-slot="card"]', {
  has: page.getByRole('heading', { name: 'Obsidian 的版本' }),
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm nx e2e personal-memories-e2e -- --grep "on a phone"`
Expected: FAIL, no dialog named 這一天的回憶 (today's sheet is an `aside`).

- [ ] **Step 3: Implement.** `src/components/useMediaQuery.ts`:

```ts
import { useSyncExternalStore } from 'react';

export function useMediaQuery(query: string, serverValue = true): boolean {
  return useSyncExternalStore(
    (notify) => {
      const list = matchMedia(query);
      list.addEventListener('change', notify);
      return () => list.removeEventListener('change', notify);
    },
    () => matchMedia(query).matches,
    () => serverValue,
  );
}
```

`notes/StatusBadge.tsx`:

```tsx
import { Badge } from '@rainforest-dev/rainforest-react';
import { CheckIcon } from 'lucide-react';

import type { SaveStatus } from './useNoteDraft.ts';

export type Chip = { label: string; mark: 'check' | 'pulse' | 'warn' };

export const CHIPS: Record<SaveStatus, Chip> = {
  saved: { label: '已儲存', mark: 'check' },
  dirty: { label: '儲存中…', mark: 'pulse' },
  saving: { label: '儲存中…', mark: 'pulse' },
  error: { label: '未儲存', mark: 'warn' },
  conflict: { label: '有衝突', mark: 'warn' },
};

export const LOAD_FAILED: Chip = {
  label: '載入失敗，捲動時會再試',
  mark: 'warn',
};

export function StatusBadge({ chip }: { chip: Chip }) {
  return (
    <Badge
      variant={chip.mark === 'warn' ? 'warning' : 'muted'}
      className="shrink-0"
    >
      {chip.mark === 'check' && <CheckIcon aria-hidden />}
      {chip.mark === 'pulse' && (
        <span
          aria-hidden
          className="bg-muted-foreground size-1.5 animate-pulse rounded-full motion-reduce:animate-none"
        />
      )}
      {chip.label}
    </Badge>
  );
}
```

`notes/ReadOnlyNotice.tsx`:

```tsx
import { Alert, AlertDescription } from '@rainforest-dev/rainforest-react';
import { LockIcon } from 'lucide-react';

export function ReadOnlyNotice({ parseError }: { parseError: boolean }) {
  return (
    <Alert variant="warning" className="mb-3">
      <LockIcon aria-hidden />
      <AlertDescription>
        {parseError
          ? '這一天的筆記檔格式有誤，請在 Obsidian 修正後重新整理。'
          : '唯讀。尚未設定儲存位置，回憶和眉批暫時無法寫入。'}
      </AlertDescription>
    </Alert>
  );
}
```

`notes/NotesSurface.tsx`:

```tsx
import {
  Button,
  ScrollArea,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@rainforest-dev/rainforest-react';
import type { ReactNode } from 'react';

import { useMediaQuery } from '../useMediaQuery.ts';
import { useOverlay } from '../useOverlay.ts';

const DESKTOP = '(min-width: 64rem)';
const PEEK = '156px';

type Props = {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  title: string;
  date: ReactNode;
  status: ReactNode;
  peek: ReactNode;
  children: ReactNode;
};

export function NotesSurface({
  expanded,
  onExpandedChange,
  title,
  date,
  status,
  peek,
  children,
}: Props) {
  const desktop = useMediaQuery(DESKTOP);
  useOverlay(!desktop && expanded);

  if (desktop) {
    return (
      <aside
        aria-label="筆記"
        className="bg-sidebar border-sidebar-border hidden flex-col rounded-lg border lg:sticky lg:top-4 lg:flex lg:max-h-[calc(100vh-2rem)] lg:self-start"
      >
        <div className="flex items-center justify-between gap-3 px-6 pt-5">
          <div className="flex min-w-0 items-baseline gap-2">
            <h2 className="text-meta font-semibold">{title}</h2>
            {date}
          </div>
          {status}
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="px-6 pb-8 pt-3">{children}</div>
        </ScrollArea>
      </aside>
    );
  }

  return (
    <Sheet
      side="bottom"
      open
      onOpenChange={(next) => {
        if (!next) onExpandedChange(false);
      }}
      snapPoints={[PEEK, 1]}
      snapPoint={expanded ? 1 : PEEK}
      onSnapPointChange={(point) => onExpandedChange(point === 1)}
      modal={expanded}
      disablePointerDismissal
    >
      <SheetContent
        initialFocus={false}
        showOverlay={expanded}
        showCloseButton={expanded}
        closeLabel="關閉"
        className="bg-sidebar"
      >
        <SheetHeader className="flex-row items-center justify-between gap-3 pb-2">
          <SheetTitle className="text-meta font-semibold">{title}</SheetTitle>
          {status}
        </SheetHeader>
        <SheetBody className="flex flex-col gap-3 pb-6">
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            aria-expanded={expanded}
            onClick={() => onExpandedChange(!expanded)}
          >
            {expanded ? '收合筆記' : '展開筆記'}
          </Button>
          {expanded ? children : peek}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
```

The server renders the desktop `aside` (hidden below `lg`); on a phone the first client render
switches to the Sheet. `Escape` in the expanded sheet returns it to the peek, and the overlay it
holds keeps `Escape` from also zooming out.

`notes/ConflictView.tsx` (same props as today):

```tsx
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@rainforest-dev/rainforest-react';

import { lineDiff } from '../../lib/diff.ts';
import type { NotePayload } from '../../lib/notes/payload.ts';
import type { Draft } from './useNoteDraft.ts';

type Props = {
  theirs: NotePayload;
  mine: Draft;
  onResolve: (keep: 'theirs' | 'mine') => void;
};

type Line = { text: string; changed: boolean };

function VersionCard({
  title,
  lines,
  annotations,
  countChanged,
  onKeep,
}: {
  title: string;
  lines: Line[];
  annotations: number;
  countChanged: boolean;
  onKeep: () => void;
}) {
  return (
    <Card size="sm" className="min-w-0">
      <CardHeader>
        <CardTitle role="heading" aria-level={3}>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <div className="max-h-40 overflow-y-auto whitespace-pre-wrap">
          {lines.length === 0 ? (
            <p className="text-body text-muted-foreground">（空白）</p>
          ) : (
            lines.map((line, i) => (
              <p
                key={i}
                className={`text-body rounded-sm ${line.changed ? 'bg-info/15' : ''}`}
              >
                {line.text || ' '}
              </p>
            ))
          )}
        </div>
        <p
          className={`text-meta ${countChanged ? 'bg-info/15 text-foreground' : 'text-muted-foreground'}`}
        >
          {annotations} 則眉批
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" onClick={onKeep}>
          保留這個版本
        </Button>
      </CardFooter>
    </Card>
  );
}

export function ConflictView({ theirs, mine, onResolve }: Props) {
  const diff = lineDiff(theirs.body, mine.body);
  const countChanged = theirs.annotations.length !== mine.annotations.length;
  return (
    <section className="mb-4 flex flex-col gap-3">
      <Alert variant="info">
        <AlertTitle>這一天在 Obsidian 裡也改過了</AlertTitle>
        <AlertDescription>
          兩個版本都在下面，不同的地方已標出。選一個保留。
        </AlertDescription>
      </Alert>
      <div className="grid gap-3 lg:grid-cols-2">
        <VersionCard
          title="Obsidian 的版本"
          lines={diff.a}
          annotations={theirs.annotations.length}
          countChanged={countChanged}
          onKeep={() => onResolve('theirs')}
        />
        <VersionCard
          title="這個畫面的版本"
          lines={diff.b}
          annotations={mine.annotations.length}
          countChanged={countChanged}
          onKeep={() => onResolve('mine')}
        />
      </div>
    </section>
  );
}
```

`notes/AnnotationItem.tsx`: keep `Props`, `ListProps` and every handler. Import `Button`, `Card`,
`CardContent`, `Input` (already, from Task 7) and `Textarea`, and replace `AnnotationItem`'s
returned markup with:

```tsx
<li>
  <Card
    size="sm"
    className={
      attached
        ? 'focus-within:bg-primary/10 focus-within:ring-primary/40'
        : 'border-border border border-dashed bg-transparent ring-0'
    }
  >
    <CardContent className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs tabular-nums">
          {!attached && <UnlinkIcon />}
          {attached ? meta : `找不到原本的訊息 · 原為 ${meta}`}
        </span>
        {a.by && (
          <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
            <PenLineIcon className="size-3" aria-hidden />
            {a.by}
          </span>
        )}
        {!readOnly && (
          <Button
            variant="ghost"
            size="xs"
            disabled={disabled}
            onClick={onDelete}
          >
            刪除
          </Button>
        )}
      </div>
      {attached ? (
        <a
          href={`#ev-${a.eventId}`}
          className={`${EXCERPT} underline-offset-2 hover:underline ${FOCUS}`}
        >
          {a.excerpt}
        </a>
      ) : (
        <p className={EXCERPT}>{a.excerpt}</p>
      )}
      {readOnly ? (
        a.body && <p className={`${NOTE} whitespace-pre-wrap`}>{a.body}</p>
      ) : (
        <Textarea
          ref={textareaRef}
          aria-label={`眉批：${a.excerpt}`}
          value={a.body}
          disabled={disabled}
          rows={2}
          onChange={(e) => onBody(e.target.value)}
          className={`${NOTE} min-h-0 resize-y px-2.5 py-1.5`}
        />
      )}
      {!attached && !readOnly && (
        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            aria-pressed={reattaching}
            disabled={disabled}
            onClick={onReattach}
          >
            重新連結
          </Button>
          <span
            className={`text-xs ${reattaching ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            再點選串流裡的一則訊息
          </span>
        </div>
      )}
    </CardContent>
  </Card>
</li>
```

In `AnnotationList`, change the heading row's `mt-7` to `mt-0`, since a `Separator` now sits
above it.

`NotePanel.tsx`: keep every hook call from Tasks 6, 7 and 10 as it is. Replace the imports of
`BottomSheet`, `CHIPS`, `LOAD_FAILED`, `Notice` and `StatusChip` with `NotesSurface`,
`StatusBadge`, `CHIPS`, `LOAD_FAILED` and `ReadOnlyNotice`, and import `Separator` and `Textarea`.
The render becomes:

```tsx
const peek = (
  <>
    <span className="text-muted-foreground text-xs tabular-nums">
      眉批 {count}
    </span>
    <span
      className={`text-meta line-clamp-2 whitespace-pre-line ${draft.body ? '' : 'text-muted-foreground'}`}
    >
      {draft.body || (readOnly ? '' : PLACEHOLDER)}
    </span>
  </>
);

return (
  <>
    <NotesSurface
      expanded={open}
      onExpandedChange={setOpen}
      title="這一天的回憶"
      date={
        <span className="text-muted-foreground truncate text-xs tabular-nums">
          {dayHeading(date)}
        </span>
      }
      status={chip && <StatusBadge chip={chip} />}
      peek={peek}
    >
      {(payload.parseError || readOnly) && (
        <ReadOnlyNotice parseError={!!payload.parseError} />
      )}
      {conflict && (
        <ConflictView
          theirs={conflict}
          mine={draft}
          onResolve={note.resolveConflict}
        />
      )}
      {readOnly ? (
        draft.body && (
          <div className="bg-muted/50 text-body whitespace-pre-wrap rounded-lg px-4 py-3.5">
            {draft.body}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-2" hidden={!!conflict}>
          <Textarea
            ref={memoryRef}
            aria-label="當天的回憶"
            placeholder={PLACEHOLDER}
            value={draft.body}
            disabled={locked}
            onChange={(e) =>
              edit(date, (d) => ({ ...d, body: e.target.value }))
            }
            className="text-body md:text-body min-h-[180px] resize-none px-4 py-3.5 lg:min-h-[232px]"
          />
          <p className="text-muted-foreground text-xs">Markdown · 自動儲存</p>
        </div>
      )}
      <Separator className="my-6" />
      <AnnotationList
        annotations={draft.annotations}
        disabled={locked}
        readOnly={readOnly}
        reattach={reattach}
        refs={refs}
        needsName={author.needsName}
        onName={author.save}
        onBody={(i, body) => setAnnotation(date, i, { body })}
        onReattach={setReattach}
        onDelete={(i) => {
          setReattach(undefined);
          edit(date, (d) => ({
            ...d,
            annotations: d.annotations.filter((_, j) => j !== i),
          }));
        }}
      />
    </NotesSurface>
    <Lightbox
      items={shown?.items}
      index={shown?.index ?? 0}
      cover={cover}
      finalFocus={lightbox.trigger}
      onStep={lightbox.step}
      onSelect={lightbox.select}
      onClose={closeLightbox}
      onToggleCover={() => {
        if (item)
          edit(date, (d) => withCover(d, toggleCover(d.cover, item.id)));
      }}
    />
  </>
);
```

`md:text-body` is there because the library's `Textarea` sets `text-base md:text-sm`, and both
breakpoints need overriding. Delete `notes/BottomSheet.tsx`.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm nx run-many -t lint test typecheck -p personal-memories`, then `pnpm nx e2e personal-memories-e2e`.
Expected: PASS, including every existing note, annotation and conflict test.

- [ ] **Step 5: Browser check** (Safari and Chrome, 1280 and 390, light and dark)

Desktop: the panel is `bg-sidebar` and scrolls inside its `ScrollArea`; 已儲存 / 儲存中… /
未儲存 badges; the conflict cards sit side by side. Phone: drag the handle between the peek and
full snap points; the page behind the peek stays scrollable and focusable; the sheet traps focus
only when full; the pulsing dot stops under Reduce Motion. The memory textarea's computed font
size is 15 px.

- [ ] **Step 6: Commit (controller)**

```bash
git add apps/personal-memories/src/components apps/personal-memories-e2e/src/timeline.spec.ts
git commit -m "refactor(personal-memories): build the notes panel from rainforest-react"
```

### Task 15: Stream controls on the library, plus phone gestures

**Files:**

- Create: `apps/personal-memories/src/lib/sources.ts`, `sources.test.ts`, `apps/personal-memories/src/lib/gestures.ts`, `gestures.test.ts`
- Create: `apps/personal-memories/src/components/day/SourceFilter.tsx`, `useSourceFilter.ts`
- Create: `apps/personal-memories/src/components/day/StreamMenu.tsx`, `useStreamMenu.ts`
- Create: `apps/personal-memories/src/components/day/Sentinel.astro`
- Modify: `apps/personal-memories/src/components/DaySection.astro` (眉批 button from `buttonVariants`)
- Modify: `apps/personal-memories/src/pages/day/[date].astro` (filter island, menu island, sentinels)
- Modify: `apps/personal-memories/src/scripts/day-stream.ts` (drop `watchFilter`; sentinel state; long-press; pinch)
- Modify: `apps/personal-memories/src/lib/client/events.ts` (`memories:longpress`)
- Modify: `apps/personal-memories/src/styles/global.css` (sentinel states, touch callout)
- Test: `apps/personal-memories-e2e/src/timeline.spec.ts`

**Interfaces:**

- Consumes: `useOverlay` (Task 6); `placeOf`, `zoomOutHref` (Task 9); `AnnotateDetail`.
- Produces:
  - `SOURCES: { source: TimelineSource; label: string }[]`, `HIDDEN_KEY`,
    `parseHidden(raw: string | null): TimelineSource[]`, `visibleFrom(hidden: readonly string[]): string[]`,
    `hiddenFrom(visible: readonly string[]): string[]`
  - `LONG_PRESS_MS = 450`, `MOVE_TOLERANCE_PX = 10`, `PINCH_ZOOM_OUT = 0.75`,
    `distance(a: Point, b: Point): number`, `movedBeyond(a: Point, b: Point, tolerance?: number): boolean`,
    `pinchRatio(start: number, end: number): number`, `isZoomOutPinch(ratio: number): boolean`
  - `LongPressDetail = { x: number; y: number; anchor: AnnotateDetail; text: string }` on `memories:longpress`
  - `SourceFilter` (island); `StreamMenu` (island); `Sentinel.astro` props `{ direction: 'prev' | 'next'; date?: string }`

- [ ] **Step 1: Write the failing tests.** `sources.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { hiddenFrom, parseHidden, visibleFrom } from './sources.ts';

describe('sources', () => {
  it('reads the stored hidden list defensively', () => {
    expect(parseHidden('["photo","nope",3]')).toEqual(['photo']);
    expect(parseHidden('{')).toEqual([]);
    expect(parseHidden('"photo"')).toEqual([]);
    expect(parseHidden(null)).toEqual([]);
  });

  it('converts between hidden and visible', () => {
    expect(visibleFrom(['photo'])).toEqual(['line', 'slack']);
    expect(hiddenFrom(['line'])).toEqual(['slack', 'photo']);
  });
});
```

`gestures.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  distance,
  isZoomOutPinch,
  movedBeyond,
  pinchRatio,
} from './gestures.ts';

describe('gestures', () => {
  it('cancels a long press once the finger moves more than 10 px', () => {
    expect(movedBeyond({ x: 0, y: 0 }, { x: 6, y: 6 })).toBe(false);
    expect(movedBeyond({ x: 0, y: 0 }, { x: 8, y: 8 })).toBe(true);
  });

  it('zooms out when two fingers close to 75 % of their distance or less', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(isZoomOutPinch(pinchRatio(200, 150))).toBe(true);
    expect(isZoomOutPinch(pinchRatio(200, 170))).toBe(false);
    expect(isZoomOutPinch(pinchRatio(200, 260))).toBe(false);
    expect(pinchRatio(0, 50)).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm nx test personal-memories -- src/lib/sources.test.ts src/lib/gestures.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement.** `sources.ts`:

```ts
import type { TimelineSource } from './timeline.ts';

export const SOURCES: { source: TimelineSource; label: string }[] = [
  { source: 'line', label: 'LINE' },
  { source: 'slack', label: 'Slack' },
  { source: 'photo', label: '照片' },
];

export const HIDDEN_KEY = 'memories:hidden-sources';

const ALL: readonly string[] = SOURCES.map((s) => s.source);

export function parseHidden(raw: string | null): TimelineSource[] {
  try {
    const value: unknown = JSON.parse(raw ?? '[]');
    return Array.isArray(value)
      ? value.filter(
          (s): s is TimelineSource => typeof s === 'string' && ALL.includes(s),
        )
      : [];
  } catch {
    return [];
  }
}

export const visibleFrom = (hidden: readonly string[]) =>
  ALL.filter((s) => !hidden.includes(s));

export const hiddenFrom = (visible: readonly string[]) =>
  ALL.filter((s) => !visible.includes(s));
```

`gestures.ts`:

```ts
export type Point = { x: number; y: number };

export const LONG_PRESS_MS = 450;
export const MOVE_TOLERANCE_PX = 10;
export const PINCH_ZOOM_OUT = 0.75;

export const distance = (a: Point, b: Point) =>
  Math.hypot(b.x - a.x, b.y - a.y);

export const movedBeyond = (
  a: Point,
  b: Point,
  tolerance = MOVE_TOLERANCE_PX,
) => distance(a, b) > tolerance;

export const pinchRatio = (start: number, end: number) =>
  start > 0 ? end / start : 1;

export const isZoomOutPinch = (ratio: number) => ratio <= PINCH_ZOOM_OUT;
```

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm nx test personal-memories -- src/lib/sources.test.ts src/lib/gestures.test.ts`
Expected: PASS.

- [ ] **Step 5: Source filter as a `ToggleGroup`.** `day/useSourceFilter.ts`:

```ts
import { useEffect, useState } from 'react';

import {
  HIDDEN_KEY,
  hiddenFrom,
  parseHidden,
  SOURCES,
  visibleFrom,
} from '../../lib/sources.ts';

export function useSourceFilter() {
  const [visible, setVisible] = useState<string[]>(() =>
    SOURCES.map((s) => s.source),
  );
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(HIDDEN_KEY);
    } catch {
      raw = null;
    }
    setVisible(visibleFrom(parseHidden(raw)));
  }, []);
  useEffect(() => {
    const stream = document.querySelector('[data-stream]');
    for (const { source } of SOURCES)
      stream?.toggleAttribute(`data-hide-${source}`, !visible.includes(source));
  }, [visible]);
  const change = (next: string[]) => {
    setVisible(next);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(hiddenFrom(next)));
    } catch {
      return;
    }
  };
  return { visible, change };
}
```

`day/SourceFilter.tsx`:

```tsx
import { ToggleGroup, ToggleGroupItem } from '@rainforest-dev/rainforest-react';

import { SOURCES } from '../../lib/sources.ts';
import { useSourceFilter } from './useSourceFilter.ts';

export function SourceToggles({
  visible,
  onChange,
}: {
  visible: string[];
  onChange: (visible: string[]) => void;
}) {
  return (
    <ToggleGroup
      multiple
      variant="outline"
      size="sm"
      value={visible}
      onValueChange={(next) => onChange(next as string[])}
      aria-label="來源"
    >
      {SOURCES.map(({ source, label }) => (
        <ToggleGroupItem key={source} value={source}>
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function SourceFilter() {
  const { visible, change } = useSourceFilter();
  return <SourceToggles visible={visible} onChange={change} />;
}
```

In `day/[date].astro`, replace the `<fieldset data-source-filter>` block with
`<div class="mb-4"><SourceFilter client:load /></div>` and delete the `SOURCES` constant. In
`day-stream.ts`, delete `watchFilter`, `HIDDEN_KEY` and their call.

- [ ] **Step 6: Loading and failed sentinels.** `day/Sentinel.astro`:

```astro
---
import { Skeleton } from '@rainforest-dev/rainforest-react';

type Props = { direction: 'prev' | 'next'; date?: string | undefined };

const { direction, date } = Astro.props;
---

<div data-load={direction} data-date={date}>
  <div data-skeleton class="mx-auto hidden max-w-[660px] flex-col gap-2 py-4">
    <Skeleton className="h-5 w-1/3" />
    <Skeleton className="h-4 w-2/3" />
    <Skeleton className="h-4 w-1/2" />
  </div>
  <p
    data-failed
    class="text-muted-foreground text-meta hidden py-4 text-center"
  >
    載入失敗，捲動時會再試
  </p>
</div>
```

In `day/[date].astro`, use `<Sentinel direction="prev" date={day.prev} />` and
`<Sentinel direction="next" date={day.next} />` in place of the two bare sentinels. In
`global.css`:

```css
[data-load='next'][data-state='loading'] [data-skeleton] {
  display: flex;
}

[data-load='next'][data-state='error'] [data-failed] {
  display: block;
}
```

Only the `next` sentinel shows either state: content that grows above the viewport would shift the
page. In `watchLoaders`, set `sentinel.dataset['state'] = 'loading'` next to `loading.add(sentinel)`;
in the result handler, set it to `'error'` on `status === 'error'`, and `delete
sentinel.dataset['state']` on the other outcomes.

- [ ] **Step 7: 眉批 button from the recipe.** In `DaySection.astro` import
      `buttonVariants` and `cn` from `@rainforest-dev/rainforest-ui/recipes` and replace
      `PILL_BASE` with:

```ts
const PILL_BASE = cn(
  buttonVariants({ variant: 'outline', size: 'xs' }),
  'bg-popover absolute z-1 shadow-md opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100',
);
```

- [ ] **Step 8: Long-press menu.** In `events.ts`:

```ts
export type LongPressDetail = {
  x: number;
  y: number;
  anchor: AnnotateDetail;
  text: string;
};
```

and add `'memories:longpress': CustomEvent<LongPressDetail>;` to `DocumentEventMap`. In
`day-stream.ts` import `LONG_PRESS_MS`, `movedBeyond`, `distance`, `pinchRatio` and
`isZoomOutPinch` from `../lib/gestures.ts`, `placeOf` and `zoomOutHref` from `../lib/nav.ts`, then
add, and call both from `startDayStream()`:

```ts
function watchLongPress(stream: HTMLElement) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let start: { x: number; y: number } | undefined;
  let fired = false;
  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
    start = undefined;
  };
  stream.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    const row = (e.target as Element).closest<HTMLElement>('li[data-event-id]');
    if (!row) return;
    fired = false;
    const at = { x: e.clientX, y: e.clientY };
    start = at;
    timer = setTimeout(() => {
      fired = true;
      const {
        eventId = '',
        at: time = '',
        source = '',
        author = '',
        excerpt = '',
      } = row.dataset;
      document.dispatchEvent(
        new CustomEvent('memories:longpress', {
          detail: {
            ...at,
            anchor: { eventId, at: time, source, author, excerpt },
            text: row.querySelector('p')?.textContent ?? excerpt,
          },
        }),
      );
      cancel();
    }, LONG_PRESS_MS);
  });
  stream.addEventListener('pointermove', (e) => {
    if (start && movedBeyond(start, { x: e.clientX, y: e.clientY })) cancel();
  });
  stream.addEventListener('pointerup', cancel);
  stream.addEventListener('pointercancel', cancel);
  stream.addEventListener(
    'click',
    (e) => {
      if (!fired) return;
      fired = false;
      e.preventDefault();
      e.stopPropagation();
    },
    true,
  );
  stream.addEventListener('contextmenu', (e) => {
    const touch = (e as PointerEvent).pointerType === 'touch';
    if (touch && (e.target as Element).closest('li[data-event-id]'))
      e.preventDefault();
  });
}

function watchPinch(stream: HTMLElement) {
  let startDistance = 0;
  let lastDistance = 0;
  const spread = (t: TouchList) =>
    distance(
      { x: t[0].clientX, y: t[0].clientY },
      { x: t[1].clientX, y: t[1].clientY },
    );
  stream.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length === 2)
        startDistance = lastDistance = spread(e.touches);
    },
    { passive: true },
  );
  stream.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length === 2 && startDistance)
        lastDistance = spread(e.touches);
    },
    { passive: true },
  );
  stream.addEventListener('touchend', () => {
    if (!startDistance) return;
    const ratio = pinchRatio(startDistance, lastDistance);
    startDistance = 0;
    const place = placeOf(location.pathname);
    const href = place && zoomOutHref(place);
    if (href && isZoomOutPinch(ratio)) location.assign(href);
  });
}
```

In `global.css`:

```css
@media (pointer: coarse) {
  [data-stream] li[data-event-id] {
    -webkit-touch-callout: none;
  }
}
```

`day/useStreamMenu.ts`:

```ts
import { useEffect, useState } from 'react';

import type { LongPressDetail } from '../../lib/client/events.ts';
import { useOverlay } from '../useOverlay.ts';

export function useStreamMenu() {
  const [menu, setMenu] = useState<LongPressDetail>();
  useEffect(() => {
    const onPress = (e: CustomEvent<LongPressDetail>) => setMenu(e.detail);
    document.addEventListener('memories:longpress', onPress);
    return () => document.removeEventListener('memories:longpress', onPress);
  }, []);
  useOverlay(menu !== undefined);
  return {
    at: menu && { x: menu.x, y: menu.y },
    close: () => setMenu(undefined),
    annotate: () => {
      if (menu)
        document.dispatchEvent(
          new CustomEvent('memories:annotate', { detail: menu.anchor }),
        );
    },
    copy: () => {
      if (menu)
        void navigator.clipboard?.writeText(menu.text).catch(() => undefined);
    },
  };
}
```

`day/StreamMenu.tsx`:

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@rainforest-dev/rainforest-react';

import { useStreamMenu } from './useStreamMenu.ts';

type ViewProps = {
  at: { x: number; y: number } | undefined;
  onClose: () => void;
  onAnnotate: () => void;
  onCopy: () => void;
};

export function StreamMenuView({ at, onClose, onAnnotate, onCopy }: ViewProps) {
  return (
    <DropdownMenu
      open={at !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DropdownMenuTrigger
        nativeButton={false}
        render={
          <span
            aria-hidden
            className="pointer-events-none fixed size-px"
            style={{ left: at?.x ?? 0, top: at?.y ?? 0 }}
          />
        }
      />
      <DropdownMenuContent className="w-40" finalFocus={false}>
        <DropdownMenuItem onClick={onAnnotate}>眉批</DropdownMenuItem>
        <DropdownMenuItem onClick={onCopy}>複製</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function StreamMenu() {
  const menu = useStreamMenu();
  return (
    <StreamMenuView
      at={menu.at}
      onClose={menu.close}
      onAnnotate={menu.annotate}
      onCopy={menu.copy}
    />
  );
}
```

`finalFocus={false}` stops the closing menu from pulling focus back to its invisible trigger
after 眉批 has focused the new annotation. Mount `<StreamMenu client:idle />` once in
`day/[date].astro`, next to `NotePanel`.

- [ ] **Step 9: E2E.** Update the source-filter test to the toggles:

```ts
const toggle = page.getByRole('button', { name: '照片', exact: true });
await toggle.click();
await expect(toggle).toHaveAttribute('aria-pressed', 'false');
await expect(photo).toBeHidden();
await page.reload();
await expect(toggle).toHaveAttribute('aria-pressed', 'false');
await toggle.click();
```

Append:

```ts
test('a long press on a message opens 眉批 and 複製', async ({ page }) => {
  await page.goto('/day/2025-11-03');
  const row = page.locator('[data-event-id]', { hasText: 'Coffee first' });
  const box = await row.boundingBox();
  await row.dispatchEvent('pointerdown', {
    pointerType: 'touch',
    pointerId: 1,
    isPrimary: true,
    bubbles: true,
    clientX: (box?.x ?? 0) + 20,
    clientY: (box?.y ?? 0) + 10,
  });
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem')).toHaveText(['眉批', '複製']);
  await menu.getByRole('menuitem', { name: '眉批' }).click();
  await expect(
    page
      .getByRole('complementary', { name: '筆記' })
      .getByLabel(/^眉批：Coffee first/),
  ).toBeFocused();
});

test('the next day shows skeleton rows while it loads', async ({ page }) => {
  await page.route('**/day/2025-11-03/partial', async (route) => {
    await new Promise((r) => setTimeout(r, 800));
    await route.continue();
  });
  await page.goto('/day/2025-11-02');
  await expect(
    page.locator('[data-load="next"] [data-skeleton]'),
  ).toBeVisible();
  await expect(page.locator('#day-2025-11-03')).toBeAttached();
});
```

- [ ] **Step 10: Run and check on a phone**

Run: `pnpm nx run-many -t lint test typecheck -p personal-memories`, then `pnpm nx e2e personal-memories-e2e`.
Expected: PASS.
iOS Safari and Android Chrome (or a touch-emulated viewport): a 450 ms press opens the menu with
no system callout; moving the finger cancels it; 複製 copies the message; pinching two fingers
together on the stream opens the month. Each gesture also has a button: 眉批 on the row, 月 in the
bar.

- [ ] **Step 11: Commit (controller)**

```bash
git add apps/personal-memories/src/lib/sources.ts apps/personal-memories/src/lib/sources.test.ts \
  apps/personal-memories/src/lib/gestures.ts apps/personal-memories/src/lib/gestures.test.ts \
  apps/personal-memories/src/components/day apps/personal-memories/src/components/DaySection.astro \
  apps/personal-memories/src/pages/day/[date].astro apps/personal-memories/src/scripts/day-stream.ts \
  apps/personal-memories/src/lib/client/events.ts apps/personal-memories/src/styles/global.css \
  apps/personal-memories-e2e/src/timeline.spec.ts
git commit -m "feat(personal-memories): stream controls on rainforest-react and phone gestures"
```

### Task 16: `MEMORIES_AUTHORS` in the homelab (controller, other repo)

**Files:** `rainforest-homelab` `modules/personal-memories` (variables, container env) and the
gitignored `terraform.tfvars`.

- [ ] **Step 1:** Add a sensitive variable `memories_authors` (string, default `""`) and pass it
      as `MEMORIES_AUTHORS=${var.memories_authors}` to the container, next to `MEMORIES_OWNER`.
- [ ] **Step 2:** Set the real `email=Name` pairs only in `terraform.tfvars`, which is gitignored.
      Neither emails nor names go into either repo.
- [ ] **Step 3:** Confirm the Cloudflare Access application in front of the app is the only route
      to the container: no LAN port published to other hosts. The app trusts
      `Cf-Access-Authenticated-User-Email` because of that.
- [ ] **Step 4:** Open a PR, `terraform plan`, and apply after the monorepo PR merges and the
      image is released. Check: open a day as each Google account, add a 眉批, and see the right
      name on the card and as `by:` in the vault file.

### Task 17: README, full verification, PR

**Files:** `apps/personal-memories/README.md`.

- [ ] **Step 1: README.** Under Browsing, document: `/month/<YYYY-MM>` (calendar, covers,
      404 → nearest day); the lightbox and 設為封面 (stored as `cover:` in the day note; only
      photos, not videos or Slack files); `/days.json`; the keyboard shortcuts (`?` lists them);
      the heatmap preview; gestures (long-press, pinch, swipe). Under Notes, document the
      `by:` field of the anchor comment, `MEMORIES_AUTHORS="email=Name,…"` with the
      `Cf-Access-Authenticated-User-Email` trust note, and the one-time name prompt when no mapping
      applies. Names containing a comma are not supported in `MEMORIES_AUTHORS`.
- [ ] **Step 2: Comment audit.** `git diff origin/main -U0 | grep -E '^\+\s*(//|/\*|\*|#|<!--)'`.
      Every hit is one of: a one-line public JSDoc, an external-constraint line (the capture-phase
      Base UI note), a lint-suppression reason, or a `TODO(<ticket>)`. Delete the rest.
- [ ] **Step 3: Full verification.** Run
      `pnpm nx run-many -t lint test typecheck -p personal-memories personal-memories-e2e` and
      `pnpm nx e2e personal-memories-e2e` → PASS. Then `docker build -f apps/personal-memories/Dockerfile .`
      and a container run on the fixture: `/month/2025-11` renders, the lightbox opens, and
      `/days.json` answers.
- [ ] **Step 4: Dev check** (repo rule): with `pnpm nx dev personal-memories` on the fixture, walk
      year → month → day → lightbox → `Escape` × 3 in Safari and Chrome, light and dark, at 1280
      and 390.
- [ ] **Step 5: PR.** Use the `rainforest-core:create-pr` skill. Attach captures from the fixture
      data only, at 1280 and 390 in both schemes: month calendar, lightbox (manual and automatic
      cover), heatmap preview, app bar with date jump, shortcuts overlay, hour strip marker,
      author accents, phone sheet (peek and full), long-press menu. The brief's
      `toHaveScreenshot` baselines wait for the Claude Design restyle and are not part of this PR.
      List the "New copy that needs the owner" strings and decisions D10 and D13 in the PR body
      for confirmation.

---

## Self-review

- Spec coverage. v2b scope: month calendar with covers (T3, T4), lightbox with 設為封面
  persisted (T5, T6), zoom view transitions with the reduced-motion fallback (T11), month scrubber
  (T12), date jump (T9), keyboard shortcuts and overlay with `Escape` zooming out (T9, T10),
  gestures with button equivalents (T6 swipe, T14 sheet drag, T15 long-press and pinch).
  Migration per the brief: heatmap `Kbd` and first-run `Alert` (T2, T13; the preview replaces the
  Tooltip per owner #3), day stream (T8, T15), notes panel, sheet and conflict view (T14). Design
  spec items: `scoreCover` (T3), a cover-only note is kept and deleted by the store (T5), unknown
  month or day 404 with the nearest day (T4, T9). Owner feedback 1–6: T1, T9/T11, T13, T6, T8, T7.
  The invited viewer needs no work (no role gating). The brief's `toHaveScreenshot` baselines are
  explicitly deferred until after the Claude Design restyle (T17).
- Placeholders. None. Each code step shows the code; the steps that edit existing markup name
  the exact block and give its replacement.
- Type consistency. Checked across tasks: `Draft`/`withCover`/`saveInput` (T5 → T6, T7, T14);
  `LightboxItem`/`coverControl` (T6); `Place`/`placeOf`/`zoomOutHref`/`levelHrefs` (T9 → T10, T11,
  T15); `morphAttrs(key, morph)` (T11 → T4 call sites, T13); `MonthCell`/`dayCell`/`dayCells`
  (T4 → T13); `useActiveDay` (T9 → T12); `AnnotateDetail`/`LightboxDetail`/`LongPressDetail` in
  `events.ts` (T6 → T9, T10, T15); `useOverlay` (T6 → T9, T14, T15); `Annotation.by`,
  `NotePayload.viewer` (T7 → T14).
- Review Focus. Each of the five lines has its test in the owning task (T1 step 7, T6 step 9
  and step 1, T9 step 12 and T11 step 8, T10 step 7, T3 step 1, T4 step 1, T7 steps 1 and 8).
