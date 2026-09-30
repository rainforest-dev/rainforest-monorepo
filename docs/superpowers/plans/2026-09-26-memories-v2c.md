# personal-memories v2c Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the live v2b album to the owner-approved direction C: B's transcript day stream
with fixed per-person accents and inline 眉批, A's diary-page notes panel, and A's year and month
views, without changing any v2b behaviour.

**Architecture:** Presentation only. The data model, note file format, Actions, events and the
v2b DOM contract stay; new DOM hooks are additions. Pure rules go in `src/lib/**` with unit tests
(`authorAccents`, `rowLabel`, `burstLayout`, `notePreviews`, `diaryDate`, `MonthRow.total`). DOM
glue goes in `src/lib/client/*` and the existing hooks. Markup changes stay in the Astro and React
components v2b already has. Every visual task captures the app at 1280 and 390 in both schemes
and compares it with the prototype's C.

**Tech Stack:** Astro 7.3.3, React 19, `@rainforest-dev/rainforest-react` (Base UI 1.8, cmdk,
`lucide-react` 1.8), Tailwind v4 with the shared seed theme, Vitest 3.2 (the app's own pin; the
library's Vitest 4 does not apply), Playwright 1.63, the `claude_design` MCP for the prototype.

**Spec:** `docs/superpowers/specs/2026-09-26-memories-v2c-design.md`. It argues from the
prototype in Claude Design project `4c25a390-c3db-43c1-af89-b0504a180625`, folder
`explorations/memories-redesign/` (`review.md` section C is binding). The v2b plan
`docs/superpowers/plans/2026-09-25-memories-v2b.md` still governs behaviour.

## Plan decisions (where the sources are silent)

- D1 Accent order. Every name in `MEMORIES_OWNER` gets `chart-2`. Other people are ordered by
  the time of their first non-photo message across the whole timeline (ties by name): the first
  gets `chart-4`, the next three `chart-1`, `chart-3`, `chart-5`, and from the sixth person on
  the cycle repeats `chart-1`, `chart-3`, `chart-5`, so no one else ever shares the owner's or
  the partner's colour. With `MEMORIES_OWNER` unset nobody gets `chart-2`. Photo events and blank
  authors take no accent; LINE's `system` author counts as a person, as it did in v2b.
- D2 Inline 眉批 are server-rendered for every day in the stream from the note on disk, and the
  panel repaints only its own day's section as the draft changes. v2b cleared `data-annotated`
  document-wide on every change; v2c scopes that to the panel's day so a day loaded by scrolling
  keeps its notes.
- D3 Margin-note order stays v2b's (unattached first, then file order). The prototype sorts by
  time, but the e2e suite and the focus-after-create path rely on the new note being last.
- D4 The panel keeps `h2` 這一天的回憶 (small label style) and shows the big date as a `p` with
  a `time`, so the `aside` 筆記 and the sheet's `SheetTitle` keep their names.
- D5 The day header gets C's author key, listing that day's authors (not everyone) with chip and
  name.
- D6 No `toHaveScreenshot` baselines: e2e does not run in CI and macOS renders would not match
  Linux. Captures come from an opt-in spec (`V2C_VISUAL=1`) so the normal e2e run stays serial.
- D7 The date-jump input props that `review.md` lists were not in v2b; Task 2 adds them.
- D8 Sizes kept from v2b where C differs slightly: the notes column stays 400px (C: 384px). Taken
  from C: the stream `max-w-2xl`, 116px month cells (`h-29`), 32px year rows (`h-8`).
- D9 On desktop the source label shows under the author only for Slack runs, as in the
  prototype; the phone inline author always shows the source.

## Prototype comparison procedure

Every task that changes visuals ends with this, for the surfaces and states it names:

1. Call `mcp__claude_design__render_preview` with `project_id`
   `4c25a390-c3db-43c1-af89-b0504a180625` and `path`
   `explorations/memories-redesign/Memories Redesign.html`. The `serve_url` is short-lived and
   carries a token: never write it into a file, commit, PR or message.
2. With the Playwright MCP, open `serve_url`, run
   `localStorage.setItem('mm-redesign-tweaks-c', JSON.stringify({ scheme, viewport, direction: 'C', view }))`
   (`scheme` `light`/`dark`; `viewport` `desktop` for 1280, `phone` for 390; `view` `year`,
   `month` or `day`), open `serve_url` again, and resize to 1280×800 or 390×844. For the phone
   notes sheet, click 展開筆記 first.
3. Save each screenshot as
   `apps/personal-memories-e2e/test-output/v2c/proto-<surface>-<scheme>-<width>.png`
   (`test-output` is gitignored).
4. Capture the app with
   `V2C_VISUAL=1 pnpm nx e2e personal-memories-e2e -- --grep "v2c visual"`, which writes
   `app-<surface>-<scheme>-<width>.png` into the same folder.
5. Read each pair. Allowed differences: fixture data (the prototype's day is 2025-11-08 with 128
   messages; the app's are 2025-10-31 to 2025-11-03), striped photo stand-ins, and the plan
   decisions above. Fix any other difference in the task, or list it under "Prototype
   differences" in the task report so it reaches the PR.

## Global Constraints

Kept from v2b:

- The v1/v2a constraints still hold: semantic tokens only (no hex, raw palette classes or
  `dark:`); zh-TW UI copy; sorted imports (`simple-import-sort`); single quotes; `z` from
  `astro/zod`; current Safari and Chrome with no polyfills; Asia/Taipei dates; never lose or
  misfile typed text.
- Comment allow-list: a one-line JSDoc on an exported public-API function or component; one line
  naming an external constraint (browser bug, API quirk, library trap); the reason on a lint
  suppression; `TODO(<ticket>)`. Nothing else. Last step of every task:
  `git diff -U0 | grep -E '^\+\s*(//|/\*|\*|#|<!--)'`, and justify each hit.
- Components are imported by export name from the `@rainforest-dev/rainforest-react` root, and
  icons come from `lucide-react`. An Astro file renders a library component statically (no
  `client:` directive) when it needs no interaction. Otherwise it uses the class recipes
  `badgeVariants`, `buttonVariants` and `cn`, imported from `@rainforest-dev/rainforest-react`.
  `.astro` files never import `@rainforest-dev/rainforest-ui/recipes` directly.
- Token opacity steps are limited to `/10 /15 /20 /35 /40 /45 /50 /65 /80 /90`.
- Layer split: presentation components take plain props and never call `fetch`, actions,
  `localStorage` or `document.addEventListener`; hooks (`use*.ts`) and `src/scripts/*.ts` hold
  state and DOM glue; `src/lib/**` holds pure logic.
- DOM contract kept from v2b: `section[data-day][data-prev][data-next]`,
  `li#ev-<id>[data-event-id][data-source][data-at][data-author][data-excerpt]`,
  `[data-annotate]`, `[data-annotated]`, `[data-stream]`, `[data-load]`, `data-auto-cover`,
  `data-lightbox`, `data-width`, `data-height`, `data-video`, `data-hour-strip`, `data-hour`,
  `data-accent`, `data-morph`, `data-morph-target`, `data-heat-cell`, `data-preview`, and the
  events `memories:day`, `memories:day-restored`, `memories:annotate`, `memories:lightbox`,
  `memories:open-jump`, `memories:open-shortcuts`, `memories:focus-note` and
  `memories:longpress`.
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

Added for C:

- Presentation only: no change to the note file format, Actions, `timeline.json`, the ingest CLI
  or any event. New DOM hooks are additions: `data-author-cell`, `data-author-inline`,
  `data-author-key`, `data-note`, `data-note-body`, `data-note-by`, `data-quote`, `data-ruled`,
  `data-month-total`. Text rows drop v2b's `data-marker` (the inline 眉批 replaces it); photo
  tiles keep theirs.
- Author accent: `MEMORIES_OWNER` names are `chart-2`, the first other person `chart-4`, later
  people `chart-1`, `chart-3`, `chart-5` in order of first appearance (D1). Colour is never the
  only cue: every run shows the initial chip and the name.
- No new copy. C's 全部畫面, 看所有快速鍵, 寫回憶 and 已有眉批 stay out until the owner confirms
  them. New label formats only: `{author}，{HH:MM}：{excerpt}`, `{YYYY} 年 {M} 月，{N} 則`,
  `{M} 月 {D} 日`, `週{W} · {YYYY}`.
- The prototype's inline styles map to utilities: `color-mix(… N%)` becomes a token opacity step
  from the list above, `var(--chart-N)` becomes `border-chart-N` / `ring-chart-N`, pixel sizes
  become the spacing scale (`pr-18` = 72px, `h-29` = 116px); grid track sizes the scale lacks stay arbitrary (`auto-rows-[88px]`).
- The year preview keeps CSS anchor positioning (`year/DayPreview.astro`); the prototype's JS
  positioning is not ported.
- Every task that changes visuals runs the Prototype comparison procedure above for light and
  dark at 1280 and 390.

## Review Focus

1. Owner configuration. `MEMORIES_OWNER` with two spellings of the owner (`Bob,Bobby`), unset,
   or naming someone absent from the data must still give one colour per person, stable across
   days. Test: Task 1 step 1 (`authorAccents` cases for several owner names, no owner, order by
   first appearance).
2. Burst sizes. Bursts of 1, 2, 3, 5, 6 and 300 photos must lay out without holes in the first
   row or a `+N` on a burst of five, and a link to an overflow photo (`#ev-<id>`) must still show
   it. Test: Task 3 step 1 (`burstLayout`) and step 6 (e2e `:target` on the sixth photo).
3. 眉批 across days. A day loaded by scrolling must show its own 眉批 inline, and the panel
   moving to another day must not wipe them. Test: Task 4 step 6.
4. Odd 眉批 bodies in the stream. An empty body shows 眉批, an unattached one shows nothing
   inline, a three-line body clamps to two lines, and a note never becomes the text 複製 copies.
   Test: Task 4 step 1 (`notePreviews`) and step 6 (clamp, and `p` stays the message).
5. Touch and keyboard. With no hover, a follow-on time and the 眉批 button must appear when the
   row takes focus, and the button must never cover the message text on desktop. Test: Task 2
   step 7.

## Execution waves

Every task touches `apps/personal-memories-e2e/src/timeline.spec.ts`, and Tasks 1 to 4 all touch
`DaySection.astro`, so the tasks run one at a time, in order: 1 → 2 → 3 → 4 → 5 → 6 → 7.

## File map

```
src/lib/
  stream.ts            authorAccents(events, owners) (T1); rowLabel, groupRuns(events) (T2);
                       burstLayout, BURST_TILES (T3)
  notes/preview.ts     NotePreview, notePreviews, bySuffix                          (T4)
  client/paint-notes.ts paintNotes                                                  (T4)
  weeks.ts             diaryDate                                                    (T5)
  days.ts              MonthRow.total                                               (T6)
src/components/
  accent-classes.ts    accentRule, accentChip                                       (T1)
  DaySection.astro     accents (T1), transcript rows (T2), hero bursts (T3), inline 眉批 (T4)
  chrome/DateJump.tsx  input props                                                  (T2)
  notes/DiaryDate.tsx  big date                                                     (T5)
  notes/NotesSurface.tsx, notes/AnnotationItem.tsx, NotePanel.tsx                   (T5)
  notes/useStreamBridge.ts scoped repaint                                           (T4)
  Heatmap.astro        month totals                                                 (T6)
  month/MonthCalendar.astro, month/MonthCellBody.astro full-bleed covers            (T6)
src/pages/day/[date].astro accents prop for the panel                               (T5)
src/styles/global.css  [data-note] (T4), [data-ruled] (T5)
apps/personal-memories-e2e/src/
  timeline.spec.ts     updated and new behaviour tests                              (T1 to T6)
  v2c-visual.spec.ts   opt-in captures                                              (T2, T3, T4, T5, T6)
README.md              MEMORIES_OWNER                                               (T2)
```

Paths under `src/` are relative to `apps/personal-memories/`.

---

### Task 1: Fixed accent per person

**Files:**

- Modify: `apps/personal-memories/src/lib/stream.ts:81-105` (`authorAccents`)
- Modify: `apps/personal-memories/src/lib/stream.test.ts:140-164` (`describe('authorAccents')`)
- Create: `apps/personal-memories/src/components/accent-classes.ts`
- Create: `apps/personal-memories/src/components/accent-classes.test.ts`
- Modify: `apps/personal-memories/src/components/DaySection.astro:1-72`, `:175-181`, `:212-218`
- Modify: `apps/personal-memories-e2e/src/timeline.spec.ts:195-211` (test `each speaker keeps an accent on every row`)

**Interfaces:**

- Consumes: `ownersFromEnv(env?): Set<string>` and `type Accent = 1 | 2 | 3 | 4 | 5` from
  `src/lib/stream.ts` (v2b).
- Produces: `authorAccents(events: readonly TimelineEvent[], owners: ReadonlySet<string>):
Map<string, Accent>` (replaces the v2b one-argument version);
  `accentRule(accent: Accent | undefined): string` and
  `accentChip(accent: Accent | undefined): string` from `src/components/accent-classes.ts`.

- [ ] **Step 1: Write the failing unit tests**

Replace the whole `describe('authorAccents', …)` block in `src/lib/stream.test.ts` with:

```ts
describe('authorAccents', () => {
  const at = (hour: number) =>
    `2025-11-01T${String(hour).padStart(2, '0')}:00:00+08:00`;

  it('gives every owner name chart-2 and the first other person chart-4', () => {
    const accents = authorAccents(
      [
        ev('1', 'Carol', 'line', at(9)),
        ev('2', 'Bob', 'line', at(8)),
        ev('3', 'Bobby', 'slack', at(10)),
        ev('4', 'Alice', 'line', at(7)),
      ],
      new Set(['Bob', 'Bobby']),
    );
    expect(accents.get('Bob')).toBe(2);
    expect(accents.get('Bobby')).toBe(2);
    expect(accents.get('Alice')).toBe(4);
    expect(accents.get('Carol')).toBe(1);
  });

  it('orders later people by first appearance, not input order or count, and cycles 1, 3, 5', () => {
    const accents = authorAccents(
      [
        ev('1', 'E', 'line', at(12)),
        ev('2', 'D', 'line', at(11)),
        ev('3', 'D', 'line', at(13)),
        ev('4', 'C', 'line', at(10)),
        ev('5', 'B', 'line', at(9)),
        ev('6', 'A', 'line', at(8)),
        ev('7', 'F', 'line', at(14)),
      ],
      new Set(),
    );
    expect(Object.fromEntries(accents)).toEqual({
      A: 4,
      B: 1,
      C: 3,
      D: 5,
      E: 1,
      F: 3,
    });
  });

  it('ignores photos and blank authors, and leaves chart-2 unused without an owner', () => {
    const accents = authorAccents(
      [
        ev('1', 'photo', 'photo', at(7)),
        ev('2', '', 'line', at(8)),
        ev('3', 'Alice', 'line', at(9)),
      ],
      new Set(),
    );
    expect([...accents]).toEqual([['Alice', 4]]);
  });

  it('gives an owner who never writes nothing, and the rest their usual order', () => {
    const accents = authorAccents(
      [ev('1', 'Alice', 'line', at(9)), ev('2', 'Carol', 'line', at(10))],
      new Set(['Bob']),
    );
    expect(Object.fromEntries(accents)).toEqual({ Alice: 4, Carol: 1 });
  });

  it('breaks a tie on first appearance by name', () => {
    const accents = authorAccents([ev('1', 'Zoe'), ev('2', 'Amy')], new Set());
    expect(Object.fromEntries(accents)).toEqual({ Amy: 4, Zoe: 1 });
  });

  it('returns the same map for the same events and owners, and recomputes for other owners', () => {
    const events = [ev('1', 'Bob'), ev('2', 'Alice')];
    const first = authorAccents(events, new Set(['Bob']));
    expect(authorAccents(events, new Set(['Bob']))).toBe(first);
    expect(authorAccents(events, new Set(['Alice'])).get('Alice')).toBe(2);
  });
});
```

Create `src/components/accent-classes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { accentChip, accentRule } from './accent-classes.ts';

describe('accent classes', () => {
  it('draws the rule in the solid chart colour', () => {
    expect(accentRule(2)).toBe('border-chart-2');
    expect(accentRule(4)).toBe('border-chart-4');
    expect(accentRule(undefined)).toBe('border-muted-foreground');
  });

  it('tints the chip and rings it in the same colour', () => {
    expect(accentChip(4).split(' ')).toEqual(
      expect.arrayContaining(['bg-chart-4/20', 'ring-chart-4', 'ring-inset']),
    );
    expect(accentChip(undefined).split(' ')).toEqual(
      expect.arrayContaining(['bg-muted', 'ring-border']),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm nx test personal-memories -- src/lib/stream.test.ts src/components/accent-classes.test.ts`
Expected: FAIL. `authorAccents` still ranks by count (`Bob` gets 1), and
`accent-classes.ts` does not exist.

- [ ] **Step 3: Implement `authorAccents`**

In `src/lib/stream.ts`, replace everything from `export type Accent` through the end of
`authorAccents` with:

```ts
export type Accent = 1 | 2 | 3 | 4 | 5;

const OWNER_ACCENT: Accent = 2;
const PARTNER_ACCENT: Accent = 4;
const LATER_ACCENTS: readonly Accent[] = [1, 3, 5];

const accentCache = new WeakMap<
  readonly TimelineEvent[],
  { key: string; accents: Map<string, Accent> }
>();

export function authorAccents(
  events: readonly TimelineEvent[],
  owners: ReadonlySet<string>,
): Map<string, Accent> {
  const key = [...owners].sort().join('\n');
  const hit = accentCache.get(events);
  if (hit?.key === key) return hit.accents;
  const firstSeen = new Map<string, number>();
  for (const e of events) {
    if (e.source === 'photo' || !e.author) continue;
    const t = Date.parse(e.at);
    const seen = firstSeen.get(e.author);
    if (seen === undefined || t < seen) firstSeen.set(e.author, t);
  }
  const accents = new Map<string, Accent>();
  for (const author of firstSeen.keys())
    if (owners.has(author)) accents.set(author, OWNER_ACCENT);
  [...firstSeen]
    .filter(([author]) => !owners.has(author))
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .forEach(([author], i) =>
      accents.set(
        author,
        i === 0
          ? PARTNER_ACCENT
          : (LATER_ACCENTS[(i - 1) % LATER_ACCENTS.length] as Accent),
      ),
    );
  accentCache.set(events, { key, accents });
  return accents;
}
```

- [ ] **Step 4: Create the class module**

Create `src/components/accent-classes.ts`:

```ts
import type { Accent } from '../lib/stream.ts';

const RULE: Record<Accent, string> = {
  1: 'border-chart-1',
  2: 'border-chart-2',
  3: 'border-chart-3',
  4: 'border-chart-4',
  5: 'border-chart-5',
};

const CHIP: Record<Accent, string> = {
  1: 'bg-chart-1/20 ring-chart-1',
  2: 'bg-chart-2/20 ring-chart-2',
  3: 'bg-chart-3/20 ring-chart-3',
  4: 'bg-chart-4/20 ring-chart-4',
  5: 'bg-chart-5/20 ring-chart-5',
};

export const accentRule = (accent: Accent | undefined) =>
  accent ? RULE[accent] : 'border-muted-foreground';

export const accentChip = (accent: Accent | undefined) =>
  `ring-[1.5px] ring-inset ${accent ? CHIP[accent] : 'bg-muted ring-border'}`;
```

- [ ] **Step 5: Run the unit tests to verify they pass**

Run: `pnpm nx test personal-memories -- src/lib/stream.test.ts src/components/accent-classes.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing e2e test**

The e2e fixture sets `MEMORIES_OWNER=Bob`. Plain `Alice` first writes on 2025-10-31 07:00 (the
busy day), `Alice 🌷` on 2025-11-01 00:05, so Bob is 2, Alice 4 and Alice 🌷 1. Replace the test
`each speaker keeps an accent on every row` in `timeline.spec.ts` with:

```ts
test('each person keeps one fixed accent on every day', async ({ page }) => {
  const accentOf = (date: string, author: string) =>
    page
      .locator(`#day-${date} li[data-accent]`, {
        has: page.locator(`[data-author="${author}"]`),
      })
      .first()
      .getAttribute('data-accent');
  await page.goto('/day/2025-11-01');
  expect(await accentOf('2025-11-01', 'Bob')).toBe('2');
  expect(await accentOf('2025-11-01', 'Alice 🌷')).toBe('1');
  await page.goto('/day/2025-10-31');
  expect(await accentOf('2025-10-31', 'Bob')).toBe('2');
  expect(await accentOf('2025-10-31', 'Alice')).toBe('4');
  const colours = await page
    .locator(
      '#day-2025-10-31 [data-event-id][data-author="Bob"] [data-row-body]',
    )
    .first()
    .evaluate((el) => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--chart-2)';
      document.body.append(probe);
      const expected = getComputedStyle(probe).color;
      probe.remove();
      return { rule: getComputedStyle(el).borderLeftColor, expected };
    });
  expect(colours.rule).toBe(colours.expected);
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `pnpm nx e2e personal-memories-e2e -- --grep "fixed accent"`
Expected: FAIL. v2b ranks by count, so Bob is not `2`, and the rule is `chart-N/65`, not the
solid colour.

- [ ] **Step 8: Use the new accents in the stream**

In `DaySection.astro`:

1. Add `import { accentChip, accentRule } from './accent-classes.ts';` after the
   `../lib/zoom.ts` import.
2. Replace lines 52-72 (from `const runs = groupRuns(` through the closing `};` of
   `ACCENT_CHIP`) with:

```ts
const owners = ownersFromEnv();
const runs = groupRuns(events, owners);
const timeline = getTimeline();
const accents =
  timeline.status === 'ready'
    ? authorAccents(timeline.timeline.events, owners)
    : new Map<string, Accent>();
const accentOf = (author: string) => accents.get(author);
```

3. In the chip `class:list` (v2b line 177-180) replace `ACCENT_CHIP[accentOf(run.author)]`
   with `accentChip(accentOf(run.author))`.
4. In the row body `class:list` (v2b line 214-218) replace `ACCENT_RULE[accentOf(run.author)]`
   with `accentRule(accentOf(run.author))`.

- [ ] **Step 9: Run the checks to verify they pass**

Run: `pnpm nx e2e personal-memories-e2e -- --grep "fixed accent"` then
`pnpm nx run-many -t lint test typecheck -p personal-memories`
Expected: PASS.

- [ ] **Step 10: Comment check and commit**

Run `git diff -U0 | grep -E '^\+\s*(//|/\*|\*|#|<!--)'` and justify each hit (expected: none).

```bash
git add apps/personal-memories/src/lib/stream.ts apps/personal-memories/src/lib/stream.test.ts \
  apps/personal-memories/src/components/accent-classes.ts \
  apps/personal-memories/src/components/accent-classes.test.ts \
  apps/personal-memories/src/components/DaySection.astro \
  apps/personal-memories-e2e/src/timeline.spec.ts
git commit -m "feat(personal-memories): give each person a fixed accent"
```

---

### Task 2: Transcript rows in the day stream

**Files:**

- Modify: `apps/personal-memories/src/lib/stream.ts` (`groupRuns`, `Run`, new `rowLabel`)
- Modify: `apps/personal-memories/src/lib/stream.test.ts`
- Modify: `apps/personal-memories/src/components/DaySection.astro` (whole file)
- Modify: `apps/personal-memories/src/components/chrome/DateJump.tsx:51-66`
- Modify: `apps/personal-memories/README.md:100-102`
- Modify: `apps/personal-memories-e2e/src/timeline.spec.ts` (tests at v2b lines 121-164 and
  177-193, plus new tests)
- Create: `apps/personal-memories-e2e/src/v2c-visual.spec.ts`

**Interfaces:**

- Consumes: `authorAccents(events, owners)`, `accentRule`, `accentChip` (Task 1).
- Produces: `groupRuns(events: readonly TimelineEvent[]): Run[]` with
  `Run = { kind: 'text'; author; source; events } | { kind: 'photos'; events }` (no `isOwner`);
  `rowLabel(author: string, at: string, excerpt: string): string`; DOM hooks
  `[data-author-cell]`, `[data-author-inline]`, `[data-author-key]`; the capture spec
  `v2c-visual.spec.ts` with one `test.describe` per scheme × width that later tasks add tests to.

- [ ] **Step 1: Write the failing unit tests**

In `src/lib/stream.test.ts`:

1. Delete `const OWNERS = new Set(['Bob']);` and drop the second argument from every
   `groupRuns(…, OWNERS)` call (the `shape` helper and the tests `gives a photo between messages
its own run`, `collects consecutive photos into one run`, `shows the time on the first event
of a run only`).
2. Replace the test `marks runs by an owner and carries author and source` with:

```ts
it('carries author and source, and no owner flag', () => {
  const runs = groupRuns([ev('a', 'Alice'), ev('b', 'Bob', 'slack')]);
  expect(runs).toEqual([
    expect.objectContaining({ kind: 'text', author: 'Alice', source: 'line' }),
    expect.objectContaining({ kind: 'text', author: 'Bob', source: 'slack' }),
  ]);
  expect(runs[0]).not.toHaveProperty('isOwner');
});
```

3. Add `rowLabel` to the import list and append:

```ts
describe('rowLabel', () => {
  it('names a row by author, Taipei time and excerpt', () => {
    expect(rowLabel('Bob', '2025-10-31T16:07:00Z', 'Yes, reading.')).toBe(
      'Bob，00:07：Yes, reading.',
    );
  });

  it('leaves out the excerpt when the message has no text', () => {
    expect(rowLabel('Bob', '2025-11-01T09:30:00+08:00', '')).toBe('Bob，09:30');
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm nx test personal-memories -- src/lib/stream.test.ts`
Expected: FAIL. `rowLabel` is not exported and runs still carry `isOwner`.

- [ ] **Step 3: Implement `groupRuns` and `rowLabel`**

In `src/lib/stream.ts`:

1. Change the import to `import { taipeiHour, taipeiTime } from './weeks.ts';`.
2. Remove `isOwner: boolean;` from the `Run` text branch.
3. Replace `groupRuns` with:

```ts
export function groupRuns(events: readonly TimelineEvent[]): Run[] {
  const runs: Run[] = [];
  for (const event of events) {
    const last = runs.at(-1);
    if (continues(last, event)) {
      last?.events.push({ ...event, showTime: false });
      continue;
    }
    const first = [{ ...event, showTime: true }];
    runs.push(
      event.source === 'photo'
        ? { kind: 'photos', events: first }
        : {
            kind: 'text',
            author: event.author,
            source: event.source,
            events: first,
          },
    );
  }
  return runs;
}
```

4. After `initialOf`, add:

```ts
export const rowLabel = (author: string, at: string, excerpt: string) =>
  excerpt
    ? `${author}，${taipeiTime(at)}：${excerpt}`
    : `${author}，${taipeiTime(at)}`;
```

- [ ] **Step 4: Run the unit tests to verify they pass**

Run: `pnpm nx test personal-memories -- src/lib/stream.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing e2e tests**

In `timeline.spec.ts`:

1. In `a day shows messages and photos in order, with the source filter`, replace
   `await expect(day).toContainText('Alice 🌷 LINE');` with
   `await expect(day.locator('[data-author-cell]').first()).toContainText('Alice 🌷');`.
2. Replace the test `the owner's rows are indented from everyone else's` with the first test
   below, and add the others after it:

```ts
test('rows line up in one column whoever wrote them', async ({ page }) => {
  await page.goto('/day/2025-11-01');
  const day = page.locator('#day-2025-11-01');
  const left = (author: string) =>
    day
      .locator(`[data-event-id][data-author="${author}"] [data-row-body]`)
      .first()
      .evaluate((el) => el.getBoundingClientRect().left);
  expect(await left('Bob')).toBe(await left('Alice 🌷'));
});

test('each run keeps one unbroken 3px rule', async ({ page }) => {
  await page.goto('/day/2025-11-01');
  const pairs = await page.locator('#day-2025-11-01').evaluate((day) => {
    let checked = 0;
    for (const run of day.querySelectorAll('li[data-accent]')) {
      const bodies = [...run.querySelectorAll<HTMLElement>('[data-row-body]')];
      for (const body of bodies)
        if (getComputedStyle(body).borderLeftWidth !== '3px') return -1;
      for (let i = 1; i < bodies.length; i++) {
        const gap =
          bodies[i].getBoundingClientRect().top -
          bodies[i - 1].getBoundingClientRect().bottom;
        if (Math.abs(gap) > 0.5) return -1;
        checked++;
      }
    }
    return checked;
  });
  expect(pairs).toBeGreaterThan(0);
});

test('the author shows once per run, in its column on desktop and inline on a phone', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  const day = page.locator('#day-2025-11-01');
  await expect(day.locator('[data-author-key]')).toContainText('Bob');
  await expect(day.locator('[data-author-key]')).toContainText('Alice 🌷');
  const run = day
    .locator('li[data-accent]')
    .filter({ has: page.locator('[data-event-id] + [data-event-id]') })
    .first();
  const rows = run.locator('[data-event-id]');
  await expect(rows.nth(0).locator('[data-author-cell]')).toBeVisible();
  await expect(rows.nth(1).locator('[data-author-cell]')).toHaveCount(0);
  await expect(rows.nth(0).locator('[data-author-inline]')).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(rows.nth(0).locator('[data-author-cell]')).toBeHidden();
  await expect(rows.nth(0).locator('[data-author-inline]')).toBeVisible();
  await expect(rows.nth(1).locator('[data-author-inline]')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('each message row has an accessible name', async ({ page }) => {
  await page.goto('/day/2025-11-01');
  await expect(
    page.getByRole('listitem', { name: 'Bob，00:07：Yes, reading.' }),
  ).toBeVisible();
});

test('the date jump input asks for digits without autocorrect', async ({
  page,
}) => {
  await page.goto('/');
  await waitForAppBarReady(page);
  await page.getByRole('button', { name: '跳至日期' }).first().click();
  const input = page.getByRole('dialog').getByPlaceholder('YYYY-MM-DD');
  await expect(input).toHaveAttribute('inputmode', 'numeric');
  await expect(input).toHaveAttribute('autocomplete', 'off');
  await expect(input).toHaveAttribute('spellcheck', 'false');
});
```

- [ ] **Step 6: Run them to verify they fail**

Run: `pnpm nx e2e personal-memories-e2e -- --grep "one column|unbroken|once per run|accessible name|asks for digits|messages and photos in order"`
Expected: FAIL. The owner is indented, the rule is 2px, there is no author cell or key, rows
have no name, and the input has no `inputmode`.

- [ ] **Step 7: Write the failing touch and keyboard test (Review Focus 5)**

Add after the tests from step 5:

```ts
test('follow-on times and the 眉批 button appear on hover or focus, beside the text', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  const second = page
    .locator(
      '#day-2025-11-01 li[data-accent] [data-event-id] + [data-event-id]',
    )
    .first();
  const first = page
    .locator('#day-2025-11-01 li[data-accent] [data-event-id]')
    .first();
  const time = second.locator('time');
  const pill = second.locator('[data-annotate]');
  await expect(first.locator('time')).toHaveCSS('opacity', '1');
  await expect(time).toHaveCSS('opacity', '0');
  await expect(pill).toHaveCSS('opacity', '0');

  await second.hover();
  await expect(time).toHaveCSS('opacity', '1');
  await expect(pill).toHaveCSS('opacity', '1');
  const [p, text] = await Promise.all([
    pill.boundingBox(),
    second.locator('[data-row-body] p').first().boundingBox(),
  ]);
  expect(p && text && p.x >= text.x + text.width).toBe(true);

  await page.mouse.move(0, 0);
  await expect(time).toHaveCSS('opacity', '0');
  await second.focus();
  await expect(time).toHaveCSS('opacity', '1');
  await expect(pill).toHaveCSS('opacity', '1');
});
```

Run: `pnpm nx e2e personal-memories-e2e -- --grep "follow-on times"`
Expected: FAIL. v2b does not render follow-on times at all.

- [ ] **Step 8: Rewrite `DaySection.astro`**

Replace the whole file with the version below. Text runs become transcript rows; the photo run
keeps its v2b markup under the old grid (renamed `PHOTO_ROW`) until Task 3. Text rows lose
v2b's `data-marker` dot; Task 4 replaces it with the inline 眉批.

```astro
---
import { buttonVariants, cn } from '@rainforest-dev/rainforest-react';

import { pickCover } from '../lib/cover.ts';
import { excerptOf } from '../lib/notes/attach.ts';
import { getTimeline } from '../lib/store.ts';
import {
  type Accent,
  authorAccents,
  firstEventPerHour,
  groupRuns,
  hourCounts,
  initialOf,
  ownersFromEnv,
  rowLabel,
  thumbSrcset,
  thumbUrl,
} from '../lib/stream.ts';
import type { TimelineEvent, TimelineSource } from '../lib/timeline.ts';
import { dayHeading, taipeiTime } from '../lib/weeks.ts';
import { morphAttrs } from '../lib/zoom.ts';
import { accentChip, accentRule } from './accent-classes.ts';

type Props = {
  date: string;
  events: TimelineEvent[];
  prev?: string | undefined;
  next?: string | undefined;
  morph?: string | undefined;
};

const { date, events, prev, next, morph } = Astro.props;

const BUSY_DAY = 100;
const TILES = 4;
const IMAGE = /\.(avif|gif|jpe?g|png|webp)$/i;
const SOURCE_LABEL: Record<TimelineSource, string> = {
  line: 'LINE',
  slack: 'Slack',
  photo: '照片',
};
const ROW =
  'grid grid-cols-[40px_minmax(0,1fr)] gap-x-3 sm:grid-cols-[48px_84px_minmax(0,1fr)]';
const TIME =
  'text-muted-foreground pt-1 text-right text-xs leading-[26px] tabular-nums';
const FOLLOW_ON =
  'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none';
const CHIP =
  'text-foreground flex shrink-0 items-center justify-center rounded-full text-xs font-semibold';
const PHOTO_ROW =
  'grid grid-cols-[42px_minmax(0,1fr)_12px] sm:grid-cols-[52px_minmax(0,1fr)_20px]';
const GUTTER =
  'text-muted-foreground pl-1 text-xs leading-[25px] tabular-nums sm:pl-2';
const PILL_BASE = cn(
  buttonVariants({ variant: 'outline', size: 'xs' }),
  'bg-popover absolute z-1 shadow-md opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100',
);
const PILL = `${PILL_BASE} pointer-coarse:pointer-events-none pointer-coarse:group-focus-within:pointer-events-auto`;
const PHOTO_PILL = `${PILL_BASE} pointer-coarse:opacity-100 pointer-coarse:pointer-events-auto`;

const owners = ownersFromEnv();
const runs = groupRuns(events);
const timeline = getTimeline();
const accents =
  timeline.status === 'ready'
    ? authorAccents(timeline.timeline.events, owners)
    : new Map<string, Accent>();
const accentOf = (author: string) => accents.get(author);
const dayAuthors = [
  ...new Set(runs.flatMap((run) => (run.kind === 'text' ? [run.author] : []))),
];
const hours = events.length >= BUSY_DAY ? hourCounts(events) : undefined;
const firsts = hours ? firstEventPerHour(events) : undefined;
const peak = Math.max(1, ...(hours ?? []));
const pad2 = (n: number) => String(n).padStart(2, '0');

const fileName = (path: string) => path.split(/[\\/]/).pop();
const mediaUrl = (id: string, n: number) =>
  `/media/${encodeURIComponent(id)}${n ? `?n=${n}` : ''}`;
const TILE_SIZES = '(min-width: 640px) 140px, 22vw';
---

<section
  id={`day-${date}`}
  data-day={date}
  data-prev={prev}
  data-next={next}
  data-auto-cover={pickCover(events)?.id}
  class="mx-auto mb-10 max-w-2xl"
>
  <header
    class="bg-background/90 border-border top-(--app-bar-h) sticky z-10 mb-2 flex flex-col gap-2.5 border-b pb-2.5 pt-3.5 backdrop-blur-md sm:pb-3 sm:pt-5"
  >
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <h2 class="text-heading font-semibold tabular-nums tracking-[-0.01em]">
        <a
          href={`/day/${date}`}
          data-morph={`day-${date}`}
          class="inline-block"
          {...morphAttrs(`day-${date}`, morph)}
        >
          {dayHeading(date)}
        </a>
      </h2>
      <span class="text-meta text-muted-foreground tabular-nums">
        {events.length} 則
      </span>
      {
        dayAuthors.length > 0 && (
          <ul
            data-author-key
            class="text-muted-foreground ms-auto flex flex-wrap items-center gap-3 text-xs"
          >
            {dayAuthors.map((author) => (
              <li class="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  class:list={[CHIP, 'size-4.5', accentChip(accentOf(author))]}
                >
                  {initialOf(author)}
                </span>
                {author}
              </li>
            ))}
          </ul>
        )
      }
    </div>
    {
      hours && firsts && (
        <nav
          aria-label="這一天的時段"
          data-hour-strip
          class="flex flex-col gap-1"
        >
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
  </header>
  <ol>
    {
      runs.map((run) =>
        run.kind === 'text' ? (
          <li
            data-source={run.source}
            data-accent={accentOf(run.author)}
            class="mt-3.5 first:mt-1.5"
          >
            <ol>
              {run.events.map((event) => {
                const excerpt = excerptOf(event);
                return (
                  <li
                    id={`ev-${event.id}`}
                    data-event-id={event.id}
                    data-source={event.source}
                    data-at={event.at}
                    data-author={event.author}
                    data-excerpt={excerpt}
                    aria-label={rowLabel(event.author, event.at, excerpt)}
                    tabindex="0"
                    class:list={[
                      ROW,
                      'hover:bg-accent/50 focus-visible:ring-ring focus-visible:ring-offset-background group relative scroll-mt-32 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                    ]}
                  >
                    <span class:list={[TIME, !event.showTime && FOLLOW_ON]}>
                      <time datetime={event.at}>{taipeiTime(event.at)}</time>
                    </span>
                    {event.showTime ? (
                      <span
                        data-author-cell
                        class="hidden min-w-0 flex-col gap-0.5 pt-1.5 sm:flex"
                      >
                        <span class="flex min-w-0 items-center gap-1.5">
                          <span
                            aria-hidden="true"
                            class:list={[
                              CHIP,
                              'size-5',
                              accentChip(accentOf(run.author)),
                            ]}
                          >
                            {initialOf(run.author)}
                          </span>
                          <span class="text-meta truncate font-semibold">
                            {run.author}
                          </span>
                        </span>
                        {run.source !== 'line' && (
                          <span class="text-muted-foreground pl-6.5 text-xs">
                            {SOURCE_LABEL[run.source]}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span aria-hidden="true" class="hidden sm:block" />
                    )}
                    <div
                      data-row-body
                      class:list={[
                        'border-l-3 sm:pr-18 min-w-0 py-1 pl-3.5 pr-3',
                        accentRule(accentOf(run.author)),
                      ]}
                    >
                      {event.showTime && (
                        <div
                          data-author-inline
                          class="mb-0.5 flex items-center gap-1.5 sm:hidden"
                        >
                          <span
                            aria-hidden="true"
                            class:list={[
                              CHIP,
                              'size-4.5',
                              accentChip(accentOf(run.author)),
                            ]}
                          >
                            {initialOf(run.author)}
                          </span>
                          <span class="text-meta font-semibold">
                            {run.author}
                          </span>
                          <span class="text-muted-foreground text-xs">
                            {SOURCE_LABEL[run.source]}
                          </span>
                        </div>
                      )}
                      {event.text && (
                        <p
                          class="text-body whitespace-pre-wrap text-pretty break-words"
                          set:text={event.text}
                        />
                      )}
                      {event.media?.map(({ path, width, height }, n) =>
                        IMAGE.test(path) ? (
                          <a
                            href={mediaUrl(event.id, n)}
                            class="bg-muted mt-1.5 block aspect-square w-[calc(25%-3px)] overflow-hidden rounded-sm"
                          >
                            <img
                              src={thumbUrl(event.id, n, 480)}
                              srcset={thumbSrcset(event.id, n, width)}
                              sizes={TILE_SIZES}
                              alt={fileName(path)}
                              width={width}
                              height={height}
                              loading="lazy"
                              class="size-full object-cover"
                            />
                          </a>
                        ) : (
                          <a
                            href={mediaUrl(event.id, n)}
                            class="text-meta mt-1 block underline"
                          >
                            {fileName(path)}
                          </a>
                        ),
                      )}
                    </div>
                    <button
                      type="button"
                      data-annotate
                      class:list={[PILL, 'right-1 top-1']}
                    >
                      <svg
                        aria-hidden="true"
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M12 20h9" />
                        <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
                      </svg>
                      眉批
                    </button>
                  </li>
                );
              })}
            </ol>
          </li>
        ) : (
          <li data-source="photo" class="mt-[22px] first:mt-1.5">
            <div class:list={[PHOTO_ROW, 'items-baseline py-0.5']}>
              <span />
              <div class="flex items-baseline gap-1.5">
                <span class="text-meta font-medium">照片</span>
                <span class="text-muted-foreground text-xs tabular-nums">
                  {' '}
                  {run.events.length} 張
                </span>
              </div>
              <span />
            </div>
            <div class:list={[PHOTO_ROW, 'py-1.5']}>
              <span class={GUTTER}>
                <time datetime={run.events[0]?.at}>
                  {run.events[0] && taipeiTime(run.events[0].at)}
                </time>
              </span>
              <ol data-burst class="grid grid-cols-4 gap-[3px] sm:gap-1">
                {run.events.map((event, index) => {
                  const media = event.media?.[0];
                  const more =
                    run.events.length > TILES && index === TILES - 1
                      ? run.events.length - (TILES - 1)
                      : 0;
                  return (
                    <li
                      id={`ev-${event.id}`}
                      data-event-id={event.id}
                      data-source={event.source}
                      data-at={event.at}
                      data-author={event.author}
                      data-excerpt={excerptOf(event)}
                      data-width={media?.width}
                      data-height={media?.height}
                      data-video={event.photo?.movie ? '' : undefined}
                      data-overflow={index >= TILES ? '' : undefined}
                      data-more={more > 0 ? '' : undefined}
                      class:list={[
                        'focus-within:ring-ring focus-within:ring-offset-background group relative scroll-mt-32 rounded-sm focus-within:ring-2 focus-within:ring-offset-2',
                        index >= TILES && 'hidden',
                      ]}
                    >
                      <a
                        href={mediaUrl(event.id, 0)}
                        data-lightbox
                        class="bg-muted relative block aspect-square overflow-hidden rounded-sm outline-none"
                      >
                        {media && (
                          <img
                            src={thumbUrl(event.id, 0, 480)}
                            srcset={thumbSrcset(event.id, 0, media.width)}
                            sizes={TILE_SIZES}
                            alt={event.text ?? `照片 ${taipeiTime(event.at)}`}
                            width={media.width}
                            height={media.height}
                            loading="lazy"
                            class="size-full object-cover"
                          />
                        )}
                        {more > 0 && (
                          <span
                            data-scrim
                            class="bg-background/65 text-foreground text-heading absolute inset-0 flex items-center justify-center font-semibold tabular-nums"
                            set:text={`+${more}`}
                          />
                        )}
                      </a>
                      <span
                        data-marker
                        class="absolute left-1.5 top-1.5 size-1.5 rounded-full"
                      />
                      <button
                        type="button"
                        data-annotate
                        class:list={[PHOTO_PILL, 'right-1 top-1']}
                      >
                        眉批
                      </button>
                    </li>
                  );
                })}
              </ol>
              <span />
            </div>
          </li>
        ),
      )
    }
  </ol>
</section>
```

- [ ] **Step 9: Add the date-jump input props**

In `chrome/DateJump.tsx`, give `CommandInput` three more props after `placeholder="YYYY-MM-DD"`:

```tsx
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
```

- [ ] **Step 10: Update the README**

Replace the `MEMORIES_OWNER` paragraph (README lines 100-102) with:

```markdown
Set `MEMORIES_OWNER` to a comma-separated list of author names (as they appear in the LINE or
Slack export) to give that person's messages the owner's colour, `chart-2`, in the day stream.
Everyone else gets a colour in order of their first message: `chart-4` for the first, then
`chart-1`, `chart-3` and `chart-5`, repeating those three. Each run also shows the author's
initial and name, so colour is never the only cue.
```

- [ ] **Step 11: Run the tests to verify they pass**

Run: `pnpm nx e2e personal-memories-e2e -- --grep "one column|unbroken|once per run|accessible name|asks for digits|messages and photos in order|follow-on times|fixed accent|long press|hour strip"`
then `pnpm nx run-many -t lint test typecheck -p personal-memories personal-memories-e2e`
Expected: PASS. The long-press and hour-strip tests still pass because rows keep
`li[data-event-id]` and the message `p`.

- [ ] **Step 12: Create the capture spec**

Create `apps/personal-memories-e2e/src/v2c-visual.spec.ts`:

```ts
import path from 'node:path';

import { expect, type Page, test } from '@playwright/test';

const OUT = path.join(__dirname, '..', 'test-output', 'v2c');
const SCHEMES = ['light', 'dark'] as const;
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
] as const;

test.skip(!process.env['V2C_VISUAL'], 'captures run with V2C_VISUAL=1');

const settle = async (page: Page) => {
  await expect(page.locator('html[data-appbar-ready]')).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready);
};

const noSideScroll = (page: Page) =>
  expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);

for (const scheme of SCHEMES) {
  for (const viewport of VIEWPORTS) {
    test.describe(`v2c visual ${scheme} ${viewport.width}`, () => {
      test.use({ colorScheme: scheme, viewport });
      const shot = (surface: string) =>
        path.join(OUT, `app-${surface}-${scheme}-${viewport.width}.png`);

      test('day stream', async ({ page }) => {
        await page.goto('/day/2025-11-01');
        await settle(page);
        await noSideScroll(page);
        await page.screenshot({ path: shot('day') });
      });
    });
  }
}
```

Run: `V2C_VISUAL=1 pnpm nx e2e personal-memories-e2e -- --grep "v2c visual"`
Expected: PASS, four `app-day-*.png` files in `apps/personal-memories-e2e/test-output/v2c/`.
Also run `pnpm nx e2e personal-memories-e2e -- --grep "v2c visual"` without the variable and
confirm the four tests are skipped.

- [ ] **Step 13: Prototype comparison**

Run the Prototype comparison procedure for surface `day`, `view: 'day'`, light and dark, 1280
and 390. Check in particular: the time column right-aligned at 48px, the author column at 84px,
the rule running unbroken through a run, the 眉批 pill inside the right gutter, the author key at
the right of the sticky header, and the phone's inline author.

- [ ] **Step 14: Comment check and commit**

Run `git diff -U0 | grep -E '^\+\s*(//|/\*|\*|#|<!--)'` and justify each hit (expected: none).

```bash
git add apps/personal-memories/src/lib/stream.ts apps/personal-memories/src/lib/stream.test.ts \
  apps/personal-memories/src/components/DaySection.astro \
  apps/personal-memories/src/components/chrome/DateJump.tsx \
  apps/personal-memories/README.md \
  apps/personal-memories-e2e/src/timeline.spec.ts \
  apps/personal-memories-e2e/src/v2c-visual.spec.ts
git commit -m "feat(personal-memories): lay the day stream out as a transcript"
```

---

### Task 3: Hero grid for photo bursts

**Files:**

- Modify: `apps/personal-memories/src/lib/stream.ts` (new `burstLayout`, `BURST_TILES`)
- Modify: `apps/personal-memories/src/lib/stream.test.ts`
- Modify: `apps/personal-memories/src/components/DaySection.astro` (constants `TILES`,
  `PHOTO_ROW`, `GUTTER`, and the photo-run branch)
- Modify: `apps/personal-memories-e2e/src/timeline.spec.ts` (tests `a photo run longer than 4
collapses the rest behind a +N tile` and `the +N tile opens the whole burst, and 設為封面 is
saved`, plus a new test)
- Modify: `apps/personal-memories-e2e/src/v2c-visual.spec.ts`

**Interfaces:**

- Consumes: `ROW`, `TIME`, `PHOTO_PILL` constants in `DaySection.astro` (Task 2).
- Produces: `BURST_TILES = 5` and
  `burstLayout(count: number): { hero: boolean; overflow: boolean; more: number }[]` from
  `src/lib/stream.ts`.

- [ ] **Step 1: Write the failing unit tests (Review Focus 2)**

Add `burstLayout` to the import list in `src/lib/stream.test.ts` and append:

```ts
describe('burstLayout', () => {
  const heroes = (n: number) => burstLayout(n).map((t) => t.hero);

  it('gives one or two photos a large tile each', () => {
    expect(heroes(1)).toEqual([true]);
    expect(heroes(2)).toEqual([true, true]);
  });

  it('leads three or more photos with one large tile', () => {
    expect(heroes(3)).toEqual([true, false, false]);
    expect(heroes(6)).toEqual([true, false, false, false, false, false]);
  });

  it('shows five tiles and puts +N on the fifth only past five', () => {
    expect(burstLayout(5).map((t) => t.more)).toEqual([0, 0, 0, 0, 0]);
    expect(burstLayout(5).some((t) => t.overflow)).toBe(false);
    expect(burstLayout(6).map((t) => t.more)).toEqual([0, 0, 0, 0, 2, 0]);
    expect(burstLayout(7).map((t) => [t.more, t.overflow])).toEqual([
      [0, false],
      [0, false],
      [0, false],
      [0, false],
      [3, false],
      [0, true],
      [0, true],
    ]);
  });

  it('keeps a burst of hundreds to five tiles', () => {
    const tiles = burstLayout(300);
    expect(tiles.filter((t) => !t.overflow)).toHaveLength(5);
    expect(tiles[4]?.more).toBe(296);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm nx test personal-memories -- src/lib/stream.test.ts`
Expected: FAIL with `burstLayout` not exported.

- [ ] **Step 3: Implement `burstLayout`**

Append to `src/lib/stream.ts`:

```ts
export const BURST_TILES = 5;

export type BurstTile = { hero: boolean; overflow: boolean; more: number };

export function burstLayout(count: number): BurstTile[] {
  const single = count >= 3;
  return Array.from({ length: count }, (_, i) => ({
    hero: single ? i === 0 : true,
    overflow: i >= BURST_TILES,
    more:
      count > BURST_TILES && i === BURST_TILES - 1
        ? count - (BURST_TILES - 1)
        : 0,
  }));
}
```

Run: `pnpm nx test personal-memories -- src/lib/stream.test.ts`
Expected: PASS.

- [ ] **Step 4: Write the failing e2e tests**

In `timeline.spec.ts`, replace the test `a photo run longer than 4 collapses the rest behind a
+N tile` with:

```ts
test('a photo run longer than 5 leads with a large tile and hides the rest behind +N', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  const burst = page.locator('#day-2025-11-01 [data-burst]').first();
  const tiles = burst.locator(':scope > li[data-event-id]');
  await expect(tiles).toHaveCount(7);
  await expect(burst.locator('li[data-overflow]')).toHaveCount(2);
  await expect(burst.locator('[data-more] [data-scrim]')).toHaveText('+3');
  const [hero, small] = await Promise.all([
    tiles.nth(0).boundingBox(),
    tiles.nth(1).boundingBox(),
  ]);
  expect(hero && small && hero.width > small.width * 1.8).toBe(true);
  expect(hero && small && hero.height > small.height * 1.8).toBe(true);
});
```

In `the +N tile opens the whole burst, and 設為封面 is saved`, change
`await expect(dialog).toContainText('照片 · 4 / 7');` to
`await expect(dialog).toContainText('照片 · 5 / 7');` and
`for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');` to
`for (let i = 0; i < 2; i++) await page.keyboard.press('ArrowRight');`.

- [ ] **Step 5: Run them to verify they fail**

Run: `pnpm nx e2e personal-memories-e2e -- --grep "longer than 5|the \+N tile opens"`
Expected: FAIL. v2b shows `+4` on the fourth tile and square tiles of one size.

- [ ] **Step 6: Write the failing `:target` test (Review Focus 2)**

Add after the burst test:

```ts
test('a link to a photo past the fifth still shows it', async ({ page }) => {
  await page.goto('/day/2025-11-01');
  const tiles = page
    .locator('#day-2025-11-01 [data-burst]')
    .first()
    .locator(':scope > li[data-event-id]');
  const id = await tiles.nth(5).getAttribute('data-event-id');
  await page.goto(`/day/2025-11-01#ev-${id}`);
  await expect(tiles.nth(5)).toBeVisible();
  await expect(
    page.locator('#day-2025-11-01 [data-burst] [data-scrim]').first(),
  ).toBeHidden();
});
```

Run: `pnpm nx e2e personal-memories-e2e -- --grep "past the fifth"`
Expected: PASS already. Index 5 is an overflow tile in both the v2b and the new layout, so this
test is a guard: it must still pass after step 7, when the scrim moves to the fifth tile.

- [ ] **Step 7: Rewrite the photo run**

In `DaySection.astro`:

1. Add `burstLayout` to the `../lib/stream.ts` import list.
2. Delete the constants `TILES`, `PHOTO_ROW` and `GUTTER`.
3. After `const dayAuthors = …;` add one layout per photo run, so a burst of hundreds is laid
   out once rather than once per tile:

```ts
const layouts = new Map(
  runs.flatMap((run) =>
    run.kind === 'photos'
      ? [[run, burstLayout(run.events.length)] as const]
      : [],
  ),
);
```

4. Replace the whole photo-run branch (from `<li data-source="photo" class="mt-[22px] first:mt-1.5">`
   through its closing `</li>`) with:

```astro
<li data-source="photo" class:list={[ROW, 'mt-4.5 first:mt-1.5']}>
  <span class={TIME}>
    <time datetime={run.events[0]?.at}>
      {run.events[0] && taipeiTime(run.events[0].at)}
    </time>
  </span>
  <span class="hidden flex-col pt-1 sm:flex">
    <span class="text-meta font-medium">照片</span>
    <span class="text-muted-foreground text-xs tabular-nums">
      {' '}
      {run.events.length} 張
    </span>
  </span>
  <div class="pl-4.25 min-w-0">
    <div class="mb-1 flex items-baseline gap-1.5 sm:hidden">
      <span class="text-meta font-medium">照片</span>
      <span class="text-muted-foreground text-xs tabular-nums">
        {' '}
        {run.events.length} 張
      </span>
    </div>
    <ol
      data-burst
      class="grid auto-rows-[64px] grid-cols-4 gap-1 sm:auto-rows-[88px]"
    >
      {
        run.events.map((event, index) => {
          const media = event.media?.[0];
          const tile = layouts.get(run)?.[index];
          return (
            <li
              id={`ev-${event.id}`}
              data-event-id={event.id}
              data-source={event.source}
              data-at={event.at}
              data-author={event.author}
              data-excerpt={excerptOf(event)}
              data-width={media?.width}
              data-height={media?.height}
              data-video={event.photo?.movie ? '' : undefined}
              data-overflow={tile?.overflow ? '' : undefined}
              data-more={tile?.more ? '' : undefined}
              class:list={[
                'focus-within:ring-ring focus-within:ring-offset-background group relative scroll-mt-32 rounded-md focus-within:ring-2 focus-within:ring-offset-2',
                tile?.hero && 'col-span-2 row-span-2',
                tile?.overflow && 'hidden',
              ]}
            >
              <a
                href={mediaUrl(event.id, 0)}
                data-lightbox
                class="bg-muted relative block size-full overflow-hidden rounded-md outline-none"
              >
                {media && (
                  <img
                    src={thumbUrl(event.id, 0, 480)}
                    srcset={thumbSrcset(event.id, 0, media.width)}
                    sizes={TILE_SIZES}
                    alt={event.text ?? `照片 ${taipeiTime(event.at)}`}
                    width={media.width}
                    height={media.height}
                    loading="lazy"
                    class="size-full object-cover"
                  />
                )}
                {tile?.more ? (
                  <span
                    data-scrim
                    class="bg-background/65 text-foreground text-heading absolute inset-0 flex items-center justify-center font-semibold tabular-nums"
                    set:text={`+${tile.more}`}
                  />
                ) : null}
              </a>
              <span
                data-marker
                class="absolute left-1.5 top-1.5 size-1.5 rounded-full"
              />
              <button
                type="button"
                data-annotate
                class:list={[PHOTO_PILL, 'right-1 top-1']}
              >
                眉批
              </button>
            </li>
          );
        })
      }
    </ol>
  </div>
</li>
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm nx e2e personal-memories-e2e -- --grep "longer than 5|the \+N tile opens|past the fifth|video in a burst|arrow keys seek|messages and photos in order"`
then `pnpm nx run-many -t lint test typecheck -p personal-memories personal-memories-e2e`
Expected: PASS. `照片 7 張` still matches through the desktop label's text content.

- [ ] **Step 9: Add the capture**

In `v2c-visual.spec.ts`, inside the `test.describe` in the loop, after the `day stream` test, add:

```ts
test('photo burst', async ({ page }) => {
  await page.goto('/day/2025-11-01');
  await settle(page);
  const burst = page.locator('#day-2025-11-01 [data-burst]').first();
  await burst.scrollIntoViewIfNeeded();
  await noSideScroll(page);
  await burst
    .locator('xpath=ancestor::li[@data-source="photo"][1]')
    .screenshot({ path: shot('burst') });
});
```

Run: `V2C_VISUAL=1 pnpm nx e2e personal-memories-e2e -- --grep "v2c visual"`
Expected: PASS, four `app-burst-*.png` files.

- [ ] **Step 10: Prototype comparison**

Run the Prototype comparison procedure for surface `burst`, `view: 'day'` (the prototype's
10:41 burst of seven), light and dark, 1280 and 390. Check the 2 × 2 hero, the four small tiles,
`+N` on the fifth, 88px rows on desktop and 64px on phone, and the 照片 / N 張 label in the author
column.

- [ ] **Step 11: Comment check and commit**

Run `git diff -U0 | grep -E '^\+\s*(//|/\*|\*|#|<!--)'` and justify each hit (expected: none).

```bash
git add apps/personal-memories/src/lib/stream.ts apps/personal-memories/src/lib/stream.test.ts \
  apps/personal-memories/src/components/DaySection.astro \
  apps/personal-memories-e2e/src/timeline.spec.ts \
  apps/personal-memories-e2e/src/v2c-visual.spec.ts
git commit -m "feat(personal-memories): lead photo bursts with a hero tile"
```

---

### Task 4: 眉批 inline under their message

**Files:**

- Create: `apps/personal-memories/src/lib/notes/preview.ts`
- Create: `apps/personal-memories/src/lib/notes/preview.test.ts`
- Create: `apps/personal-memories/src/lib/client/paint-notes.ts`
- Modify: `apps/personal-memories/src/components/DaySection.astro` (frontmatter, text row, photo
  tile)
- Modify: `apps/personal-memories/src/components/notes/useStreamBridge.ts:23-33`, `:131`,
  `:133-142`
- Modify: `apps/personal-memories/src/styles/global.css`
- Modify: `apps/personal-memories-e2e/src/timeline.spec.ts` (new tests at the end of the file)
- Modify: `apps/personal-memories-e2e/src/v2c-visual.spec.ts`

**Interfaces:**

- Consumes: `resolveAnnotations(annotations, dayEvents): ResolvedAnnotation[]` and
  `ResolvedAnnotation` from `src/lib/notes/attach.ts`; `notesStore(): NotesStore | undefined`
  with `read(date): { note: DayNote; version: string; parseError?: true }` from
  `src/lib/notes/store.ts` (v2b).
- Produces: `type NotePreview = { body: string; by?: string }`,
  `notePreviews(annotations: readonly ResolvedAnnotation[]): Map<string, NotePreview>`,
  `bySuffix(by?: string): string` from `src/lib/notes/preview.ts`;
  `paintNotes(root: ParentNode, previews: ReadonlyMap<string, NotePreview>): void` from
  `src/lib/client/paint-notes.ts`; DOM hooks `[data-note]`, `[data-note-body]`,
  `[data-note-by]` inside `[data-row-body]`.

- [ ] **Step 1: Write the failing unit tests (Review Focus 4)**

Create `src/lib/notes/preview.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { ResolvedAnnotation } from './attach.ts';
import { bySuffix, notePreviews } from './preview.ts';

const a = (over: Partial<ResolvedAnnotation>): ResolvedAnnotation => ({
  eventId: 'e1',
  at: '2025-11-01T09:05:00+08:00',
  source: 'line',
  author: 'Alice',
  excerpt: 'Lunch plan',
  body: 'b',
  status: 'exact',
  ...over,
});

describe('notePreviews', () => {
  it('maps an attached 眉批 to its message with trimmed body and author', () => {
    expect(notePreviews([a({ body: '  那天\n下雨  ', by: 'Bob' })])).toEqual(
      new Map([['e1', { body: '那天\n下雨', by: 'Bob' }]]),
    );
  });

  it('shows 眉批 for an empty body and leaves out a missing author', () => {
    expect(notePreviews([a({ body: '   ' })]).get('e1')).toEqual({
      body: '眉批',
    });
  });

  it('skips unattached ones and ones without a message, and keeps the first per message', () => {
    const previews = notePreviews([
      a({ status: 'unattached', eventId: 'e9' }),
      a({ body: 'first' }),
      a({ body: 'second' }),
      a({ eventId: '', status: 'recovered' }),
    ]);
    expect([...previews]).toEqual([['e1', { body: 'first' }]]);
  });

  it('follows a recovered 眉批 to the message it re-attached to', () => {
    expect(
      notePreviews([a({ eventId: 'e2', status: 'recovered' })]).has('e2'),
    ).toBe(true);
  });
});

describe('bySuffix', () => {
  it('prefixes a name with a middle dot and is empty without one', () => {
    expect(bySuffix('Bob')).toBe(' · Bob');
    expect(bySuffix(undefined)).toBe('');
    expect(bySuffix('')).toBe('');
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm nx test personal-memories -- src/lib/notes/preview.test.ts`
Expected: FAIL, `./preview.ts` does not exist.

- [ ] **Step 3: Implement the previews**

Create `src/lib/notes/preview.ts`:

```ts
import type { ResolvedAnnotation } from './attach.ts';

export type NotePreview = { body: string; by?: string };

const EMPTY_BODY = '眉批';

export function notePreviews(
  annotations: readonly ResolvedAnnotation[],
): Map<string, NotePreview> {
  const previews = new Map<string, NotePreview>();
  for (const a of annotations) {
    if (a.status === 'unattached' || !a.eventId || previews.has(a.eventId))
      continue;
    const preview: NotePreview = { body: a.body.trim() || EMPTY_BODY };
    if (a.by) preview.by = a.by;
    previews.set(a.eventId, preview);
  }
  return previews;
}

export const bySuffix = (by?: string) => (by ? ` · ${by}` : '');
```

Create `src/lib/client/paint-notes.ts`:

```ts
import { bySuffix, type NotePreview } from '../notes/preview.ts';

export function paintNotes(
  root: ParentNode,
  previews: ReadonlyMap<string, NotePreview>,
) {
  for (const row of root.querySelectorAll<HTMLElement>('[data-event-id]')) {
    const preview = previews.get(row.dataset['eventId'] ?? '');
    row.toggleAttribute('data-annotated', preview !== undefined);
    const body = row.querySelector('[data-note-body]');
    const by = row.querySelector('[data-note-by]');
    if (body) body.textContent = preview?.body ?? '';
    if (by) by.textContent = bySuffix(preview?.by);
  }
}
```

Run: `pnpm nx test personal-memories -- src/lib/notes/preview.test.ts`
Expected: PASS.

- [ ] **Step 4: Write the failing e2e tests (Review Focus 3 and 4)**

Append at the end of `timeline.spec.ts` (after every existing test, so the 11-03 note it writes
cannot affect them):

```ts
test('眉批 show under their message, clamped, on the panel day and on days loaded by scrolling', async ({
  page,
}) => {
  await page.goto('/day/2025-11-03');
  const panel = page.getByRole('complementary', { name: '筆記' });
  const row = page.locator('#day-2025-11-03 [data-event-id]', {
    hasText: 'Coffee first',
  });
  await row.hover();
  await row.getByRole('button', { name: '眉批' }).click();
  await panel.getByLabel('眉批：Coffee first').fill('第一行\n第二行\n第三行');
  await expect(panel).toContainText('已儲存');
  const note = row.locator('[data-note]');
  await expect(note).toBeVisible();
  await expect(note).toContainText('第一行');
  const clamp = note.locator('.line-clamp-2');
  expect(
    await clamp.evaluate((el) => el.scrollHeight > el.clientHeight + 1),
  ).toBe(true);
  await expect(row.locator('p').first()).toHaveText('Coffee first');

  await page.goto('/day/2025-11-02');
  await page.locator('[data-load="next"]').scrollIntoViewIfNeeded();
  await expect(page.locator('#day-2025-11-03')).toBeAttached();
  const scrolled = page.locator('#day-2025-11-03 [data-event-id]', {
    hasText: 'Coffee first',
  });
  await expect(scrolled).toHaveAttribute('data-annotated', '');
  await expect(scrolled.locator('[data-note]')).toContainText('第一行');
  await page
    .locator('#day-2025-11-03')
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect(page).toHaveURL(/\/day\/2025-11-03$/);
  await page
    .locator('#day-2025-11-02')
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect(page).toHaveURL(/\/day\/2025-11-02$/);
  await expect(scrolled).toHaveAttribute('data-annotated', '');
  await expect(scrolled.locator('[data-note]')).toContainText('第一行');
});

test('a message without 眉批 shows no inline note', async ({ page }) => {
  await page.goto('/day/2025-11-03');
  const row = page.locator('#day-2025-11-03 [data-event-id]', {
    hasText: 'New week, new plans',
  });
  await expect(row).not.toHaveAttribute('data-annotated', '');
  await expect(row.locator('[data-note]')).toBeHidden();
});
```

- [ ] **Step 5: Run them to verify they fail**

Run: `pnpm nx e2e personal-memories-e2e -- --grep "show under their message|no inline note"`
Expected: FAIL, rows have no `[data-note]`.

- [ ] **Step 6: Render the note slot and scope the repaint**

In `DaySection.astro`:

1. Change the attach import to
   `import { excerptOf, resolveAnnotations } from '../lib/notes/attach.ts';` and add
   `import { type NotePreview, notePreviews } from '../lib/notes/preview.ts';` and
   `import { notesStore } from '../lib/notes/store.ts';` in sorted position.
2. After `const dayAuthors = …;` add:

```ts
const stored = notesStore()?.read(date);
const previews =
  stored && !stored.parseError
    ? notePreviews(resolveAnnotations(stored.note.annotations, events))
    : new Map<string, NotePreview>();
```

3. On the text-row `<li id={`ev-${event.id}`}` and on the photo-tile `<li id={`ev-${event.id}`}`,
   add `data-annotated={previews.has(event.id) ? '' : undefined}`.
4. In the text row's `[data-row-body]`, after the `event.media?.map(…)` block, add:

```astro
<div
  data-note
  class="text-meta text-muted-foreground mt-1 flex items-start gap-1.5"
>
  <svg
    aria-hidden="true"
    class="text-primary mt-0.5 shrink-0"
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M12 20h9"></path>
    <path
      d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"
    ></path>
  </svg>
  <span class="line-clamp-2 whitespace-pre-line"
    ><span data-note-body>{previews.get(event.id)?.body}</span><span
      data-note-by
      class="text-xs">{bySuffix(previews.get(event.id)?.by)}</span
    ></span
  >
</div>
```

Keep the two inner spans on one line: the wrapper is `whitespace-pre-line`, so a line break
between them would render. Add `bySuffix` to the `preview.ts` import.

In `global.css`, after the `[data-event-id][data-annotated] [data-marker]` rule, add:

```css
[data-event-id]:not([data-annotated]) [data-note] {
  display: none;
}
```

In `notes/useStreamBridge.ts`:

1. Add imports `import { paintNotes } from '../../lib/client/paint-notes.ts';` and
   `import { notePreviews } from '../../lib/notes/preview.ts';` in sorted position.
2. Replace `markAnnotated` with:

```ts
function markAnnotated(
  date: string,
  annotations: readonly ResolvedAnnotation[],
) {
  const section = document.querySelector(`[data-day="${date}"]`);
  if (section) paintNotes(section, notePreviews(annotations));
}
```

3. Replace `useEffect(() => markAnnotated(o.draft.annotations), [o.draft.annotations]);` with:

```ts
useEffect(
  () => markAnnotated(o.date, o.draft.annotations),
  [o.date, o.draft.annotations],
);
```

4. In the `onRestored` handler, replace `markAnnotated(draft.annotations);` with
   `markAnnotated(payload.date, draft.annotations);`.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm nx e2e personal-memories-e2e -- --grep "show under their message|no inline note|annotation are saved|signed through Access|name set once|established author|long press"`
then `pnpm nx run-many -t lint test typecheck -p personal-memories personal-memories-e2e`
Expected: PASS.

- [ ] **Step 8: Add the capture**

The capture writes a 眉批 on 2025-10-31, a day no behaviour test annotates. In
`v2c-visual.spec.ts`, inside the `test.describe` in the loop, add:

```ts
test('inline 眉批', async ({ page }) => {
  await page.goto('/day/2025-10-31');
  await settle(page);
  const row = page
    .locator('#day-2025-10-31 [data-event-id]', {
      hasText: 'Busy message 1',
    })
    .first();
  if ((await row.getAttribute('data-annotated')) === null) {
    await row.focus();
    await row.getByRole('button', { name: '眉批' }).click();
    await page.getByLabel(/^眉批：Busy message 1$/).fill('那天早上的第一則');
  }
  await expect(row.locator('[data-note]')).toBeVisible();
  await noSideScroll(page);
  await row.screenshot({ path: shot('inline-note') });
});
```

On 390 the label lives in the notes sheet, which opens when 眉批 is pressed. The
`data-annotated` guard makes the four runs share one 眉批.

Run: `V2C_VISUAL=1 pnpm nx e2e personal-memories-e2e -- --grep "v2c visual"`
Expected: PASS, four `app-inline-note-*.png` files.

- [ ] **Step 9: Prototype comparison**

Run the Prototype comparison procedure for surface `inline-note`, `view: 'day'` (the
prototype's 09:13 and 18:02 rows carry 眉批), light and dark, 1280 and 390. Check the pen icon in
`primary`, the `text-meta` muted body clamped to two lines, and `· name` in `text-xs`.

- [ ] **Step 10: Comment check and commit**

Run `git diff -U0 | grep -E '^\+\s*(//|/\*|\*|#|<!--)'` and justify each hit (expected: none).

```bash
git add apps/personal-memories/src/lib/notes/preview.ts \
  apps/personal-memories/src/lib/notes/preview.test.ts \
  apps/personal-memories/src/lib/client/paint-notes.ts \
  apps/personal-memories/src/components/DaySection.astro \
  apps/personal-memories/src/components/notes/useStreamBridge.ts \
  apps/personal-memories/src/styles/global.css \
  apps/personal-memories-e2e/src/timeline.spec.ts \
  apps/personal-memories-e2e/src/v2c-visual.spec.ts
git commit -m "feat(personal-memories): show 眉批 inline under their message"
```

---

### Task 5: The notes panel as a diary page

**Files:**

- Modify: `apps/personal-memories/src/lib/weeks.ts` (new `diaryDate`)
- Modify: `apps/personal-memories/src/lib/weeks.test.ts` (`describe('labels')`)
- Create: `apps/personal-memories/src/components/notes/DiaryDate.tsx`
- Modify: `apps/personal-memories/src/components/notes/NotesSurface.tsx:68-127`
- Modify: `apps/personal-memories/src/components/NotePanel.tsx`
- Modify: `apps/personal-memories/src/components/notes/AnnotationItem.tsx`
- Modify: `apps/personal-memories/src/pages/day/[date].astro`
- Modify: `apps/personal-memories/src/styles/global.css`
- Modify: `apps/personal-memories-e2e/src/timeline.spec.ts` (test `a note typed just before
scrolling stays on its own day`, the `on a phone` describe, new tests at the end)
- Modify: `apps/personal-memories-e2e/src/v2c-visual.spec.ts`

**Interfaces:**

- Consumes: `authorAccents(events, owners)`, `ownersFromEnv()`, `type Accent` (Task 1);
  `accentRule(accent)` (Task 1).
- Produces: `diaryDate(date: string): { day: string; meta: string }` from `src/lib/weeks.ts`;
  `DiaryDate({ date }: { date: string })`; `NotePanel({ initial, accents }: { initial:
NotePayload; accents: Record<string, Accent> })`; `AnnotationList` gains
  `accentOf: (author: string) => Accent | undefined`; DOM hooks `[data-ruled]`, `[data-quote]`.

- [ ] **Step 1: Write the failing unit test**

In `src/lib/weeks.test.ts`, add `diaryDate` to the import list and add inside
`describe('labels')`:

```ts
it('splits a diary date into the big day and its weekday and year', () => {
  expect(diaryDate('2025-11-08')).toEqual({
    day: '11 月 8 日',
    meta: '週六 · 2025',
  });
  expect(diaryDate('2026-01-04')).toEqual({
    day: '1 月 4 日',
    meta: '週日 · 2026',
  });
});
```

Run: `pnpm nx test personal-memories -- src/lib/weeks.test.ts`
Expected: FAIL, `diaryDate` is not exported.

- [ ] **Step 2: Implement `diaryDate`**

Add to `src/lib/weeks.ts`, after `dayHeading`:

```ts
export function diaryDate(date: string): { day: string; meta: string } {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return {
    day: `${Number(date.slice(5, 7))} 月 ${Number(date.slice(8, 10))} 日`,
    meta: `週${WEEKDAYS_ZH[weekday]} · ${date.slice(0, 4)}`,
  };
}
```

Run: `pnpm nx test personal-memories -- src/lib/weeks.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing e2e tests**

In `timeline.spec.ts`:

1. In `a note typed just before scrolling stays on its own day`, change
   `await expect(panel).toContainText('2025-11-03（週一）');` to
   `await expect(panel).toContainText('11 月 3 日');`.
2. Inside `test.describe('on a phone', …)`, add:

```ts
test('the expanded sheet opens on the diary date with ruled lines', async ({
  page,
}) => {
  await page.goto('/day/2025-11-02');
  const sheet = page.getByRole('dialog', { name: '這一天的回憶' });
  await sheet.getByRole('button', { name: '展開筆記' }).click();
  await expect(sheet).toContainText('11 月 2 日');
  await expect(sheet).toContainText('週日 · 2025');
  await expect(sheet.getByLabel('當天的回憶')).toHaveCSS('line-height', '28px');
});
```

3. Append at the end of the file:

```ts
test('the notes panel is a diary page with ruled lines', async ({ page }) => {
  await page.goto('/day/2025-11-01');
  const panel = page.getByRole('complementary', { name: '筆記' });
  await expect(panel).toContainText('11 月 1 日');
  await expect(panel).toContainText('週六 · 2025');
  await expect(
    panel.getByRole('heading', { name: '這一天的回憶' }),
  ).toBeVisible();
  const memory = panel.getByLabel('當天的回憶');
  await expect(memory).toHaveCSS('line-height', '28px');
  await expect(memory).toHaveCSS(
    'background-image',
    /repeating-linear-gradient/,
  );
  const card = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.backgroundColor = 'var(--card)';
    document.body.append(probe);
    const colour = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return colour;
  });
  await expect(panel).toHaveCSS('background-color', card);
});

test('a margin note quotes in the colour of the message author', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  const panel = page.getByRole('complementary', { name: '筆記' });
  const message = page.locator('#day-2025-11-01 [data-event-id]', {
    hasText: 'Yes, reading.',
  });
  await message.hover();
  await message.getByRole('button', { name: '眉批' }).click();
  await expect(panel.getByLabel('眉批：Yes, reading.')).toBeFocused();
  const quote = panel.locator('[data-quote]', { hasText: 'Yes, reading.' });
  await expect(quote).toHaveCSS('border-left-width', '3px');
  const [q, rule] = await Promise.all([
    quote.evaluate((el) => getComputedStyle(el).borderLeftColor),
    message
      .locator('[data-row-body]')
      .evaluate((el) => getComputedStyle(el).borderLeftColor),
  ]);
  expect(q).toBe(rule);
  await expect(quote).toContainText('00:07 · LINE · Bob');
});
```

- [ ] **Step 4: Run them to verify they fail**

Run: `pnpm nx e2e personal-memories-e2e -- --grep "diary|quotes in the colour|typed just before scrolling"`
Expected: FAIL. The panel still shows `2025-11-01（週六）` on `bg-sidebar`, there is no ruled
textarea and no `[data-quote]`.

- [ ] **Step 5: Add the ruled-line CSS**

Append to `global.css`:

```css
[data-ruled] {
  background-color: transparent;
  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0 27px,
    var(--border) 27px 28px
  );
  background-attachment: local;
  border-color: transparent;
  line-height: 28px;
}
```

- [ ] **Step 6: Create `DiaryDate.tsx`**

Create `src/components/notes/DiaryDate.tsx`:

```tsx
import { diaryDate } from '../../lib/weeks.ts';

export function DiaryDate({ date }: { date: string }) {
  const { day, meta } = diaryDate(date);
  return (
    <p className="flex items-baseline gap-2">
      <time
        dateTime={date}
        className="text-title font-semibold tabular-nums tracking-[-0.01em]"
      >
        {day}
      </time>
      <span className="text-meta text-muted-foreground tabular-nums">
        {meta}
      </span>
    </p>
  );
}
```

- [ ] **Step 7: Restyle `NotesSurface.tsx`**

Replace the desktop `return` (the `<aside>`) with:

```tsx
return (
  <aside
    aria-label="筆記"
    className="bg-card text-card-foreground ring-border hidden flex-col rounded-xl shadow-lg ring-1 lg:sticky lg:top-[calc(var(--app-bar-h)+1rem)] lg:flex lg:max-h-[calc(100vh-var(--app-bar-h)-2rem)] lg:self-start"
  >
    <div className="flex flex-col gap-1 px-7 pb-4 pt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-[0.04em]">
          {title}
        </h2>
        {status}
      </div>
      {date}
    </div>
    <ScrollArea className="min-h-0 flex-1">
      <div className="px-7 pb-7">{children}</div>
    </ScrollArea>
  </aside>
);
```

In the `Sheet` branch, change `className="bg-sidebar gap-0"` on `SheetContent` to
`className="bg-card gap-0"`, and replace `{expanded ? children : peek}` with:

```tsx
{
  expanded ? (
    <>
      <div className="pb-4">{date}</div>
      {children}
    </>
  ) : (
    peek
  );
}
```

- [ ] **Step 8: Restyle the margin notes in `AnnotationItem.tsx`**

1. Replace the imports with:

```tsx
import { Button, cn, Input, Textarea } from '@rainforest-dev/rainforest-react';
import { PenLineIcon } from 'lucide-react';
import type { Ref, RefObject } from 'react';

import type { ResolvedAnnotation } from '../../lib/notes/attach.ts';
import { SOURCE_LABELS } from '../../lib/notes/types.ts';
import type { Accent } from '../../lib/stream.ts';
import { taipeiTime } from '../../lib/weeks.ts';
import { accentRule } from '../accent-classes.ts';
```

2. Add `accent: Accent | undefined;` to `Props`, and replace the `FOCUS`/`EXCERPT` constants with:

```tsx
const FOCUS =
  'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2';
const QUOTE = 'flex flex-col gap-0.5 rounded-xs border-l-3 py-0.5 pl-2.5';
const EXCERPT = 'text-muted-foreground text-meta line-clamp-2 leading-[1.6]';
const NOTE = 'text-sm leading-[1.65]';
```

3. Replace the body of `AnnotationItem` (everything from `const attached =` to the end of the
   function) with:

```tsx
const attached = a.status !== 'unattached';
const meta = [taipeiTime(a.at), SOURCE_LABELS[a.source], a.author].join(' · ');
const quote = (
  <>
    <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs tabular-nums">
      {!attached && <UnlinkIcon />}
      {attached ? meta : `找不到原本的訊息 · 原為 ${meta}`}
    </span>
    <span className={EXCERPT}>{a.excerpt}</span>
  </>
);
return (
  <li className="focus-within:bg-primary/10 -mx-2 flex flex-col gap-2 rounded-md px-2 py-1.5">
    {attached ? (
      <a
        href={`#ev-${a.eventId}`}
        data-quote
        className={cn(
          QUOTE,
          accentRule(accent),
          'underline-offset-2 hover:underline',
          FOCUS,
        )}
      >
        {quote}
      </a>
    ) : (
      <div
        data-quote
        className={cn(QUOTE, 'border-muted-foreground border-dashed')}
      >
        {quote}
      </div>
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
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground flex items-center gap-1 text-xs">
        {a.by && (
          <>
            <PenLineIcon className="size-3" aria-hidden />
            {a.by}
          </>
        )}
      </span>
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
    {!attached && !readOnly && (
      <div className="flex items-center gap-2.5">
        <Button
          variant="secondary"
          size="sm"
          className="aria-pressed:ring-ring aria-pressed:ring-2"
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
  </li>
);
```

and add `accent,` to the destructured props.

4. In `ListProps` add `accentOf: (author: string) => Accent | undefined;`, destructure it in
   `AnnotationList`, change `<ul className="flex flex-col gap-2.5">` to
   `<ul className="flex flex-col gap-5">`, and pass `accent={accentOf(a.author)}` to each
   `AnnotationItem`.

- [ ] **Step 9: Wire the panel**

In `NotePanel.tsx`:

1. Replace `import { dayHeading } from '../lib/weeks.ts';` with
   `import type { Accent } from '../lib/stream.ts';`, and add
   `import { DiaryDate } from './notes/DiaryDate.tsx';` in sorted position.
2. Change the signature to:

```tsx
export function NotePanel({
  initial,
  accents,
}: {
  initial: NotePayload;
  accents: Record<string, Accent>;
}) {
```

3. Replace the `date={…}` prop of `NotesSurface` with `date={<DiaryDate date={date} />}`.
4. Replace the memory `Textarea`'s `className` with
   `className="text-body md:text-body min-h-49 resize-none px-1 py-0 lg:min-h-63"` and add the
   prop `data-ruled`.
5. Pass `accentOf={(author) => accents[author]}` to `AnnotationList`.

In `pages/day/[date].astro`:

1. Add `import { authorAccents, ownersFromEnv } from '../../lib/stream.ts';` in sorted position.
2. After `const dates = …;` add:

```ts
const accents =
  state.status === 'ready'
    ? Object.fromEntries(authorAccents(state.timeline.events, ownersFromEnv()))
    : {};
```

3. Change `<NotePanel client:load initial={initial} />` to
   `<NotePanel client:load initial={initial} accents={accents} />`.

- [ ] **Step 10: Run the tests to verify they pass**

Run: `pnpm nx e2e personal-memories-e2e -- --grep "diary|quotes in the colour|typed just before scrolling|annotation are saved|conflict|signed through Access|name set once|established author|on a phone"`
then `pnpm nx run-many -t lint test typecheck -p personal-memories personal-memories-e2e`
Expected: PASS. Save, conflict, author, hydration and sheet tests pass unchanged.

- [ ] **Step 11: Load the day page in dev**

`NotePanel` is imported by the day page's layout tree. Run
`MEMORIES_DATA_DIR=<fixture dir> MEMORIES_NOTES_DIR=<temp dir> pnpm nx dev personal-memories`,
open `http://127.0.0.1:3004/day/2025-11-01`, and confirm the panel renders, typing saves, and
the console has no hydration warning.

- [ ] **Step 12: Add the captures**

In `v2c-visual.spec.ts`, inside the `test.describe` in the loop, add:

```ts
test('notes panel', async ({ page }) => {
  await page.goto('/day/2025-11-01');
  await settle(page);
  if (viewport.width === 390) {
    const sheet = page.getByRole('dialog', { name: '這一天的回憶' });
    await sheet.screenshot({ path: shot('notes-peek') });
    await sheet.getByRole('button', { name: '展開筆記' }).click();
    await expect(sheet.getByLabel('當天的回憶')).toBeVisible();
    await page.screenshot({ path: shot('notes') });
    return;
  }
  await noSideScroll(page);
  await page
    .getByRole('complementary', { name: '筆記' })
    .screenshot({ path: shot('notes') });
});
```

Run: `V2C_VISUAL=1 pnpm nx e2e personal-memories-e2e -- --grep "v2c visual"`
Expected: PASS, `app-notes-*.png` for all four and `app-notes-peek-*-390.png` for both schemes.

- [ ] **Step 13: Prototype comparison**

Run the Prototype comparison procedure for surface `notes`, `view: 'day'`, light and dark, 1280
and 390 (on 390 click 展開筆記 in the prototype). Check the `card` surface with ring and shadow,
the small 這一天的回憶 label beside the badge, the `text-title` date, ruled lines visible in both
schemes, quote rules in `chart-4` for Bob's messages in the prototype (the app's Bob is the owner,
`chart-2`), and the 刪除 / name row under each textarea.

- [ ] **Step 14: Comment check and commit**

Run `git diff -U0 | grep -E '^\+\s*(//|/\*|\*|#|<!--)'` and justify each hit (expected: none).

```bash
git add apps/personal-memories/src/lib/weeks.ts apps/personal-memories/src/lib/weeks.test.ts \
  apps/personal-memories/src/components/notes/DiaryDate.tsx \
  apps/personal-memories/src/components/notes/NotesSurface.tsx \
  apps/personal-memories/src/components/notes/AnnotationItem.tsx \
  apps/personal-memories/src/components/NotePanel.tsx \
  "apps/personal-memories/src/pages/day/[date].astro" \
  apps/personal-memories/src/styles/global.css \
  apps/personal-memories-e2e/src/timeline.spec.ts \
  apps/personal-memories-e2e/src/v2c-visual.spec.ts
git commit -m "feat(personal-memories): turn the notes panel into a diary page"
```

---

### Task 6: Month totals in the year, full-bleed covers in the month

**Files:**

- Modify: `apps/personal-memories/src/lib/days.ts:76-114` (`MonthRow`, `monthRows`)
- Modify: `apps/personal-memories/src/lib/days.test.ts:69-84` and new test
- Modify: `apps/personal-memories/src/components/Heatmap.astro`
- Modify: `apps/personal-memories/src/components/month/MonthCalendar.astro:37-55`
- Modify: `apps/personal-memories/src/components/month/MonthCellBody.astro`
- Modify: `apps/personal-memories-e2e/src/timeline.spec.ts` (new tests at the end)
- Modify: `apps/personal-memories-e2e/src/v2c-visual.spec.ts`

**Interfaces:**

- Consumes: `monthLabel(month: string): string` from `src/lib/months.ts` (v2b).
- Produces: `MonthRow = { year; month; cells; total: number }`; DOM hook
  `[data-month-total="YYYY-MM"]`.

- [ ] **Step 1: Write the failing unit tests**

In `src/lib/days.test.ts`, in `lays out one row per month across a year boundary`, change
`expect(rows[0]).toMatchObject({ year: 2025, month: 12 });` to
`expect(rows[0]).toMatchObject({ year: 2025, month: 12, total: 2 });` and
`expect(rows[1]).toMatchObject({ year: 2026, month: 1 });` to
`expect(rows[1]).toMatchObject({ year: 2026, month: 1, total: 0 });`. Then add:

```ts
it('sums a month total from its days in range only', () => {
  const rows = monthRows(
    '2025-11-02',
    '2025-11-30',
    new Map([
      ['2025-11-01', 50],
      ['2025-11-02', 3],
      ['2025-11-30', 4],
    ]),
  );
  expect(rows[0]?.total).toBe(7);
});
```

Run: `pnpm nx test personal-memories -- src/lib/days.test.ts`
Expected: FAIL, rows have no `total`.

- [ ] **Step 2: Implement the total**

In `src/lib/days.ts`, add `total: number;` to `MonthRow`, and replace
`rows.push({ year, month: month + 1, cells });` with:

```ts
const total = cells.reduce((sum, cell) => sum + (cell?.total ?? 0), 0);
rows.push({ year, month: month + 1, cells, total });
```

Run: `pnpm nx test personal-memories -- src/lib/days.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing e2e tests**

Append at the end of `timeline.spec.ts`:

```ts
test('each year row ends in its month total', async ({ page, request }) => {
  const days = (await (await request.get('/days.json')).json()) as {
    date: string;
    total: number;
  }[];
  const november = days
    .filter((d) => d.date.startsWith('2025-11'))
    .reduce((sum, d) => sum + d.total, 0);
  await page.goto('/');
  await expect(page.locator('[data-month-total="2025-11"]')).toHaveText(
    `${november} 則`,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole('link', { name: `2025 年 11 月，${november} 則` }),
  ).toBeVisible();
});

test('a month cell with a cover shows it edge to edge', async ({ page }) => {
  await page.goto('/month/2025-11');
  const cell = page.locator('a[data-date="2025-11-01"]:visible');
  const img = cell.locator('img');
  await expect(img).toBeVisible();
  await expect(cell).toHaveCSS('height', '116px');
  const [c, i] = await Promise.all([cell.boundingBox(), img.boundingBox()]);
  expect(c && i && Math.abs(c.width - i.width) <= 1).toBe(true);
  expect(c && i && Math.abs(c.height - i.height) <= 1).toBe(true);
  await expect(cell).toContainText('則');
});
```

Run: `pnpm nx e2e personal-memories-e2e -- --grep "month total|edge to edge"`
Expected: FAIL. No `[data-month-total]`, and the v2b cover sits inside a 104px padded cell.

- [ ] **Step 4: Add the totals to `Heatmap.astro`**

1. Add `import { monthLabel } from '../lib/months.ts';` in sorted position.
2. Change the constants to:

```ts
const GRID_COLS = 'grid-cols-[56px_repeat(31,24px)_72px] gap-x-1.5';
const PHONE_GRID_COLS = 'grid-cols-[28px_repeat(31,8px)_minmax(0,1fr)]';
```

3. In the desktop day-number header row, add `<span></span>` after the `Array.from({ length: 31 }, …)` block.
4. Change both year labels (desktop and phone) from
   `class="text-meta mt-2.5 font-semibold tabular-nums first:mt-0"` to
   `class="text-heading mt-3.5 font-semibold tabular-nums first:mt-0"`.
5. Change the desktop row wrapper `class={`grid h-[30px] items-center ${GRID_COLS}`}` to
   ``class={`grid h-8 items-center ${GRID_COLS}`}``, change the month link class to
`text-meta text-muted-foreground hover:text-foreground font-medium tabular-nums`, and after
`{row.cells.map(…)}` add:

```astro
<span
  data-month-total={monthKey(row)}
  class="text-muted-foreground text-right text-xs tabular-nums"
>
  {row.total} 則
</span>
```

6. In the phone branch, change `h-7` to `h-8` on both row elements, append to `rowLabel` after
   `{bars}`:

```astro
<span class="text-muted-foreground text-right text-xs tabular-nums">
  {row.total}
</span>
```

and add `aria-label={`${monthLabel(monthKey(row))}，${row.total} 則`}` to the phone row `<a>`.

- [ ] **Step 5: Make month covers full-bleed**

In `MonthCalendar.astro`, change the desktop cell link's first class string from
`'bg-card ring-border hover:bg-accent/65 flex h-[104px] flex-col gap-1.5 overflow-hidden rounded-lg p-2 ring-1'`
to
`'bg-card ring-border hover:bg-accent/65 relative flex h-29 flex-col overflow-hidden rounded-lg ring-1'`,
and the empty cell's `h-[104px]` to `h-29`.

Replace `MonthCellBody.astro` with:

```astro
---
import { badgeVariants, Skeleton } from '@rainforest-dev/rainforest-react';

import type { MonthCell } from '../../lib/month-view.ts';
import { thumbSrcset, thumbUrl } from '../../lib/stream.ts';

type Props = { cell: MonthCell; layout: 'cell' | 'row' };

const { cell, layout } = Astro.props;
const row = layout === 'row';
const showText = row || !cell.cover;
const image = cell.cover && (
  <>
    <Skeleton className="absolute inset-0" />
    <img
      src={thumbUrl(cell.cover, 0, 240)}
      srcset={thumbSrcset(cell.cover, 0)}
      sizes="(min-width: 640px) 160px, 52px"
      alt=""
      loading="lazy"
      class="absolute inset-0 size-full object-cover"
    />
  </>
);
---

{!row && cell.cover && <span class="absolute inset-0">{image}</span>}
<span
  class:list={[
    'text-meta flex items-center gap-1.5 font-medium tabular-nums',
    !row && 'relative justify-between p-1.5',
  ]}
>
  <span
    class:list={[
      'flex items-center gap-1.5',
      !row && 'h-5.5 rounded-md px-1.5 font-semibold',
      !row && cell.cover && 'bg-background/90',
    ]}
  >
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
  row &&
    (cell.cover ? (
      <span class="relative block size-12 overflow-hidden rounded-md">
        {image}
      </span>
    ) : (
      <span />
    ))
}
{
  showText &&
    (cell.memory ? (
      <span class:list={['text-meta line-clamp-3', !row && 'px-2.5 pb-2.5']}>
        {cell.memory}
      </span>
    ) : cell.excerpt ? (
      <span
        class:list={[
          'text-meta text-muted-foreground line-clamp-3',
          !row && 'px-2.5 pb-2.5',
        ]}
      >
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

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm nx e2e personal-memories-e2e -- --grep "month total|edge to edge|heatmap|month calendar|previews its day|設為封面 is saved|zoom|morph|Escape"`
then `pnpm nx run-many -t lint test typecheck -p personal-memories personal-memories-e2e`
Expected: PASS. The heat-cell preview and morph tests still pass: the cells, `anchor-name` and
`data-morph` are untouched.

- [ ] **Step 7: Add the captures**

In `v2c-visual.spec.ts`, inside the `test.describe` in the loop, add:

```ts
test('year', async ({ page }) => {
  await page.goto('/');
  await settle(page);
  await noSideScroll(page);
  await page.screenshot({ path: shot('year') });
});

test('month', async ({ page }) => {
  await page.goto('/month/2025-11');
  await settle(page);
  await noSideScroll(page);
  await page.screenshot({ path: shot('month') });
});
```

Run: `V2C_VISUAL=1 pnpm nx e2e personal-memories-e2e -- --grep "v2c visual"`
Expected: PASS, `app-year-*.png` and `app-month-*.png` for all four combinations.

- [ ] **Step 8: Prototype comparison**

Run the Prototype comparison procedure for surfaces `year` (`view: 'year'`) and `month`
(`view: 'month'`), light and dark, 1280 and 390. Check the `N 則` column after day 31, the
`text-heading` year labels, the bare number on phone rows, covers filling the cell with the day
chip on `bg-background/90`, and the phone month rows unchanged from v2b.

- [ ] **Step 9: Comment check and commit**

Run `git diff -U0 | grep -E '^\+\s*(//|/\*|\*|#|<!--)'` and justify each hit (expected: none).

```bash
git add apps/personal-memories/src/lib/days.ts apps/personal-memories/src/lib/days.test.ts \
  apps/personal-memories/src/components/Heatmap.astro \
  apps/personal-memories/src/components/month/MonthCalendar.astro \
  apps/personal-memories/src/components/month/MonthCellBody.astro \
  apps/personal-memories-e2e/src/timeline.spec.ts \
  apps/personal-memories-e2e/src/v2c-visual.spec.ts
git commit -m "feat(personal-memories): add month totals and full-bleed month covers"
```

---

### Task 7: Full verification, prototype sweep and PR

**Files:**

- Modify: only files a finding points at, each already listed by Tasks 1-6.

**Interfaces:**

- Consumes: everything above.
- Produces: the PR.

- [ ] **Step 1: Full verification**

Run: `pnpm nx run-many -t lint test typecheck -p personal-memories personal-memories-e2e`
then `pnpm nx e2e personal-memories-e2e`
Expected: PASS, with the eight `v2c visual` tests skipped.

- [ ] **Step 2: Dev server check**

Run `pnpm nx dev personal-memories` against the fixture data and a temp notes dir, load `/`,
`/month/2025-11` and `/day/2025-11-01`, and confirm each renders with no console error.

- [ ] **Step 3: Whole-app prototype sweep**

Run `V2C_VISUAL=1 pnpm nx e2e personal-memories-e2e -- --grep "v2c visual"`, then the Prototype
comparison procedure for `day`, `burst`, `inline-note`, `notes`, `year` and `month` in both
schemes at both widths, side by side. Collect every remaining "Prototype differences" line from
the task reports into one list.

- [ ] **Step 4: Token and comment audit**

Run `pnpm nx test personal-memories -- src/contract.test.ts` (tokens only) and
`git diff origin/main -U0 -- apps/personal-memories apps/personal-memories-e2e | grep -E '^\+\s*(//|/\*|\*|#|<!--)'`.
Expected: the contract test passes; each comment hit is on the allow-list.

- [ ] **Step 5: Open the PR**

Use the `rainforest-core:create-pr` skill. Title: `feat(personal-memories): v2c, direction C`.
The body names the spec and plan, lists the plan decisions D1-D9, the four C strings left out
pending the owner, and the collected prototype differences. Attach the app captures from
`apps/personal-memories-e2e/test-output/v2c/app-*.png` with `rainforest-core:attach-pr-media`
(1280 and 390, light and dark, per surface, labelled as after-captures next to the prototype
state they match); never attach or link the prototype `serve_url`. Keep the PR a draft.

## Self-review

- Spec coverage: decision 1 → Tasks 2, 3, 5, 6; decision 2 → Task 1; decision 3 → Task 2;
  decision 4 → Tasks 4 and 5; decision 5 → Global Constraints (no new copy); decision 6 → no
  change. Accessibility (row names, date-jump props) → Task 2. Acceptance criteria 1-12 map to
  Tasks 1, 2, 2, 2, 2, 3, 4, 5, 6, 2, 2-6 and 7.
- Placeholders: none; every code step carries its code.
- Types: `Accent` from `stream.ts` everywhere; `authorAccents(events, owners)` in Tasks 1, 2 and
  5; `NotePreview`/`notePreviews`/`bySuffix` in Task 4 only; `accentRule` in Tasks 1, 2 and 5;
  `burstLayout` returns `hero`, `overflow`, `more`, used by those names in Task 3.
- Review Focus: each of the five lines has its test in the owning task.
