# personal-memories navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Back, `Esc` and the new 「← N 月」 link land on the day you were last reading, give the
year and month grids full arrow-key navigation with one tab stop each, and give both grids
previews that work on hover, keyboard focus and a touch long press.

**Architecture:** The app stays multi-page with cross-document View Transitions. The morph target
moves to the client: a blocking head script (serialised from the real `placeOf`/`morphKey`)
names the element from `navigation.activation`, and the module script marks, focuses and makes
the tab stop of the same element. Pure rules live in `src/lib/**` with Vitest tests
(`gridTarget`, `resolveShortcut`, `revealKey`, `placePreview`, `monthBack`). DOM glue lives in
`src/scripts/*.ts` and `src/lib/client/*.ts`. Previews become `popover="hint"` elements in the top
layer, driven by one controller.

**Tech Stack:** Astro 7.3.3 (SSR, node adapter), React 19 islands,
`@rainforest-dev/rainforest-react` (Base UI, `Kbd`, `buttonVariants`), `lucide-react`, Tailwind v4
with the shared seed theme, Vitest 3.2 (the app's own pin, `environment: 'node'`), Playwright 1.63
on the synthetic fixture (`apps/personal-memories-e2e/playwright.config.ts`, port 3024).

**Spec:** `docs/superpowers/specs/2026-09-28-memories-navigation-design.md`. The v2c plan
`docs/superpowers/plans/2026-09-26-memories-v2c.md` still governs everything this plan does not
touch.

## Plan decisions (where the spec is silent)

- P1 The head script is built at render time from `Function.prototype.toString` of the real
  `placeOf`, `morphKey`, `revealKey`, `revealStyle` and `installReveal`, passed to each other as
  arguments. `placeOf` and `morphKey` become self-contained (no module-level references) so the
  serialised copy runs on its own. A Vitest test runs the script in an empty `node:vm` context,
  and Task 7 checks the production build's copy parses.
- P2 The head script names the morph with an injected `<style id="reveal-morph">` instead of an
  inline style, so the rule also applies to elements the parser has not reached at `pagereveal`.
  It first sets every `[data-morph]` to `none !important`, which silences a stale server
  (`Referer`) name. It is only injected when there is a transition, the Navigation API exists and
  reduced motion is off. It is removed when the transition finishes and on `pageswap`.
- P3 Marking and focus run in the module script from `navigation.activation`, which exists from
  document creation, so they do not wait for `pagereveal`. A bfcache restore re-runs them on
  `pageshow` with `persisted`. Without the Navigation API the server's `[data-morph-target]` is
  the fallback, as today.
- P4 A mark goes only on day cells (`a[data-date]`) and year month-row links
  (`a[data-month-row]`). Arriving at a deeper level gives a section as the target, which is
  focused as today but never marked.
- P5 The ring is Tailwind v4's `inset-ring-2 inset-ring-primary`, which draws with
  `--tw-inset-ring-shadow` and so composes with the `focus-visible:ring-2` focus ring instead of
  replacing it. It is the spec's "inset ring-2 ring-primary".
- P6 「上次看到」 sits in the desktop month cell's top row, after the day number. The phone month
  list row gets the ring and `aria-description` only, since its four columns are full.
- P7 The arrival focus does not open a preview (`focusWithoutPreview`). The next keyboard move
  does.
- P8 Year month-row labels stay in the Tab order. Each grid has one tabbable day cell. The Tab
  e2e starts from the control just before the grid.
- P9 On day pages below `sm`, the 回憶 wordmark hides so 「← N 月」 fits (the 年 tab still goes
  home).
- P10 The `?` dialog gains a 月 group with the same rows as 年 except `←` `→` 前後一天. 月 is the
  existing tab label.
- P11 Phone month-list rows carry previews too (long press), with their own anchor names.
- P12 Before-captures come from an opt-in spec written in Task 1 before any other change;
  Task 7 takes the after-captures with the same spec.

## Global Constraints

- Every task runs through `pnpm nx`. Unit: `pnpm nx test personal-memories -- <file>`. E2E:
  `pnpm nx e2e personal-memories-e2e -- --grep "<title>"`. Lint and types:
  `pnpm nx run-many -t lint typecheck -p personal-memories personal-memories-e2e`. Never call npm
  scripts or `vitest`/`playwright` directly.
- Imports are sorted with `simple-import-sort` (run `pnpm nx lint <project> --fix` when unsure).
  Single quotes. `z` from `astro/zod` if validation is needed.
- Comment allow-list: a one-line JSDoc on an exported public-API function or component; one line
  naming an external constraint the code works around (browser behaviour, API quirk, library
  trap) without which a reader would "fix" it back; the reason on a lint suppression;
  `TODO(<ticket>)`. No JSDoc on private helpers, props or fields; no history or rationale. Last
  step of every task: `git diff -U0 | grep -E '^\+\s*(//|/\*|\*|#|<!--)'`, and justify each hit.
- Semantic tokens only: no hex, raw palette classes or `dark:`. Token opacity steps are limited to
  `/10 /15 /20 /35 /40 /45 /50 /65 /80 /90`. `src/contract.test.ts` enforces the first part.
- Privacy: the repo is public. Tests and fixtures use only the synthetic e2e data (authors Alice
  and Bob; `alice@example.com`, `bob@example.com`). No other names.
- Commits: conventional, scope `personal-memories`, path-scoped `git add` (never `git add -A` or
  `.`), and every message ends with exactly these two lines after a blank line:

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm
  ```

- Never `--no-verify`. Never disable GPG signing (`-c commit.gpgsign=false`, `--no-gpg-sign` and
  the like). If signing fails, stop and report.
- Subagents do not commit; the controller commits per task with the task's commit step. Touch
  only the files a task lists.
- Stay multi-page: no `ClientRouter`. `@view-transition { navigation: auto }` stays.
- Current Safari and Chrome, no polyfills. Where the Navigation API, `position-area` or
  `popover="hint"` is missing, behaviour degrades as the spec says (server `Referer` fallback, JS
  positioning, `hint` treated as `manual`).
- Copy, verbatim: 上次看到; `← N 月` with `aria-label` `回到 N 月`; 前後一天; 前後一週;
  上下一個月; 上下一行; 第一天／最後一天; 打開那一天. No other new strings.
- Timing: hover shows after 300 ms, instantly while moving between cells, hides 80 ms after
  leaving; keyboard `:focus-visible` shows at once; touch long press 450 ms, cancelled by more
  than 8 px of movement; the JS fallback clamps 8 px inside the viewport.
- Motion: 300 ms `cubic-bezier(0.2, 0, 0, 1)`. Under `prefers-reduced-motion` nothing morphs
  and the arrival flash does not play.
- DOM contract kept: `data-date`, `data-heat-cell`, `data-preview`, `data-morph`,
  `data-morph-target`, `data-month-total`, the `memories:*` events. Added: `data-grid`
  (`year`/`week`/`list`), `data-preview-cell`, `data-last-viewed`, `data-last-label`,
  `data-month-row`, `data-key-hints`, `style#reveal-morph`.
- Layer split: presentation components take plain props and never add document listeners;
  `src/scripts/*.ts` and `src/lib/client/*.ts` hold DOM glue; `src/lib/*.ts` holds pure logic.
  Vitest runs in `node`, so only pure logic gets unit tests; DOM behaviour gets e2e tests.
- Repo rule: after changing a layout or anything a layout imports, load a page from a running
  `pnpm nx dev personal-memories`. A green build does not show that dev works.

## Review Focus

1. Coming back twice. Back to the month, Forward, scroll the stream to another day, Back again:
   exactly one cell per layout carries the mark, and it is the newer day. Test: Task 4 step 1
   (`a second visit moves the mark instead of adding one`).
2. Odd `from` URLs. A foreign origin, a malformed URL, a missing `from`, a day in another month,
   or a URL with `?nearest=1` and a hash must neither throw nor mark the wrong cell. Test: Task 3
   step 1 (`revealKey` cases).
3. The serialised head script. It must run with no outer references, add nothing under reduced
   motion or without a transition, and raise no page error in dev. Test: Task 3 step 1 (`node:vm`
   cases) and step 6 (e2e with `pageerror`); Task 7 step 3 checks the production copy.
4. A long press followed by ordinary taps. The press must not navigate, the next tap anywhere
   closes the preview, a later tap on a cell navigates, and a finger that moves shows nothing.
   Test: Task 6 step 7 (two touch tests).
5. Grid edges and the phone list. `↓` on the last row and `↑` on the first do nothing and do not
   scroll the page; on the phone list `↑`/`↓` move one item; after any move exactly one cell per
   grid is tabbable. Test: Task 1 step 2 (e2e) and step 1 (`gridTarget` edge cases).

## Execution waves

Every task touches `apps/personal-memories-e2e/src/navigation.spec.ts`, and Tasks 1, 2, 4 and 6
all touch `Heatmap.astro`, so tasks run one at a time, in order: 1 → 2 → 3 → 4 → 5 → 6 → 7.

## File map

```
src/lib/
  grid-nav.ts            GridLayout, GridKey, isGridKey, isGridLayout, gridTarget        (T1)
  shortcuts.ts           grid + close-preview shortcuts (T1); groups, YEAR_HINTS,
                         MONTH_HINTS (T2)
  nav.ts                 self-contained placeOf (T3); BackLink, monthBack (T5)
  zoom.ts                self-contained morphKey                                          (T3)
  reveal.ts              REVEAL_STYLE_ID, revealKey, revealStyle, installReveal,
                         revealScript                                                     (T3)
  hover-preview.ts       timing constants, showDelay, placePreview                        (T6)
  client/roving.ts       setStop, moveInGrid                                              (T1)
  client/preview-dom.ts  openPreview                                                      (T1)
src/scripts/
  shortcuts.ts           grid keys, close-preview, roving focusin                         (T1)
  zoom.ts                drop reveal style on pageswap (T3); arrive: mark + focus (T4)
  previews.ts            startPreviews, focusWithoutPreview                               (T6)
src/components/
  Heatmap.astro          data-grid + stop (T1), KeyHints (T2), data-month-row (T4),
                         preview cells (T6)
  month/MonthCalendar.astro data-grid + stop (T1), previews (T6)
  month/MonthCellBody.astro 上次看到 label                                                (T4)
  KeyHints.astro         hint row                                                         (T2)
  DayPreview.astro       moved from year/, popover="hint"                                 (T6)
  chrome/TopBar.tsx, chrome/AppBar.tsx, chrome/useChrome.ts   back link                   (T5)
src/layouts/Layout.astro head reveal script (T3), startPreviews (T6)
src/pages/month/[month].astro  KeyHints                                                   (T2)
src/pages/day/[date].astro     drop 「← 全部日子」                                         (T5)
src/styles/global.css    last-viewed (T4), popover previews (T6)
src/styles/preview-css.test.ts  fallback expectations                                     (T6)
apps/personal-memories-e2e/src/
  navigation.spec.ts     new behaviour tests                                              (T1-T6)
  nav-visual.spec.ts     opt-in before/after captures                                     (T1, T7)
  timeline.spec.ts       tests whose expectations change                                  (T2, T4, T6)
```

Paths under `src/` are relative to `apps/personal-memories/`.

---

### Task 1: Arrow keys and one tab stop per grid

**Files:**

- Create: `apps/personal-memories-e2e/src/nav-visual.spec.ts`
- Create: `apps/personal-memories/src/lib/grid-nav.ts`
- Create: `apps/personal-memories/src/lib/grid-nav.test.ts`
- Modify: `apps/personal-memories/src/lib/shortcuts.ts:1-87`
- Modify: `apps/personal-memories/src/lib/shortcuts.test.ts:1-70`
- Create: `apps/personal-memories/src/lib/client/roving.ts`
- Create: `apps/personal-memories/src/lib/client/preview-dom.ts`
- Modify: `apps/personal-memories/src/scripts/shortcuts.ts:1-64`
- Modify: `apps/personal-memories/src/components/Heatmap.astro:19-51`, `:74`, `:133-143`
- Modify: `apps/personal-memories/src/components/month/MonthCalendar.astro:14-16`, `:32`, `:40-44`, `:67`, `:72-76`
- Create: `apps/personal-memories-e2e/src/navigation.spec.ts`

**Interfaces:**

- Consumes: `Place` from `src/lib/nav.ts`.
- Produces:
  - `type GridLayout = 'year' | 'week' | 'list'`,
    `type GridKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End'`,
    `isGridKey(key: string): key is GridKey`,
    `isGridLayout(value: string | undefined): value is GridLayout`,
    `gridTarget(dates: readonly string[], current: string, key: GridKey, layout: GridLayout): string | undefined`
    from `src/lib/grid-nav.ts`.
  - `Shortcut` gains `{ type: 'grid'; key: GridKey }` and `{ type: 'close-preview' }` and loses
    `step-cell`. `KeyInput` gains `previewOpen: boolean`.
  - `setStop(cell: HTMLElement): void`, `moveInGrid(key: GridKey): void` from
    `src/lib/client/roving.ts`.
  - `openPreview(): HTMLElement | null` from `src/lib/client/preview-dom.ts`.
  - Markup: `[data-grid="year"]` wraps the desktop heatmap rows, `[data-grid="week"]` is the
    desktop month `ol`, `[data-grid="list"]` the phone month `ol`. Day links carry
    `tabindex="0"` on the latest day with data in their grid and `tabindex="-1"` elsewhere.

- [ ] **Step 1: Capture the before state**

Create `apps/personal-memories-e2e/src/nav-visual.spec.ts`:

```ts
import path from 'node:path';

import { expect, type Page, test } from '@playwright/test';

const PHASE = process.env['NAV_VISUAL'];
const OUT = path.join(__dirname, '..', 'test-output', 'nav');
const SCHEMES = ['light', 'dark'] as const;
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
] as const;

test.skip(
  PHASE !== 'before' && PHASE !== 'after',
  'captures run with NAV_VISUAL=before or NAV_VISUAL=after',
);
test.describe.configure({ mode: 'serial' });

const settle = async (page: Page) => {
  await expect(page.locator('html[data-appbar-ready]')).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() =>
    Promise.race([
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
          .map((a) => a.finished.catch(() => undefined)),
      ),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]),
  );
};

for (const scheme of SCHEMES) {
  for (const viewport of VIEWPORTS) {
    test.describe(`nav visual ${scheme} ${viewport.width}`, () => {
      test.use({ colorScheme: scheme, viewport });
      const shot = (surface: string) =>
        path.join(OUT, `${PHASE}-${surface}-${scheme}-${viewport.width}.png`);

      test('month after zooming out of a day', async ({ page }) => {
        await page.goto('/day/2025-11-03');
        await settle(page);
        await page.keyboard.press('Escape');
        await expect(page).toHaveURL(/\/month\/2025-11$/);
        await settle(page);
        await page.screenshot({ path: shot('month-from-day') });
      });

      test('year after zooming out of a month', async ({ page }) => {
        await page.goto('/month/2025-11');
        await settle(page);
        await page.keyboard.press('Escape');
        await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
        await settle(page);
        await page.screenshot({ path: shot('year-from-month') });
      });

      test('day app bar', async ({ page }) => {
        await page.goto('/day/2025-11-03');
        await settle(page);
        await page
          .locator('header')
          .first()
          .screenshot({ path: shot('day-app-bar') });
      });

      test('previews', async ({ page }) => {
        test.skip(viewport.width < 640, 'hover previews are a desktop surface');
        await page.goto('/month/2025-11');
        await settle(page);
        await page.locator('a[data-date="2025-11-03"]:visible').hover();
        await page.waitForTimeout(500);
        await page.screenshot({ path: shot('month-preview') });
        await page.goto('/');
        await settle(page);
        await page.locator('a[data-date="2025-11-03"]').hover();
        await page.waitForTimeout(500);
        await page.screenshot({ path: shot('year-preview') });
      });
    });
  }
}
```

Run: `NAV_VISUAL=before pnpm nx e2e personal-memories-e2e -- --grep "nav visual"`
Expected: PASS; `apps/personal-memories-e2e/test-output/nav/before-*.png` exist (16 files:
3 surfaces × 4 runs, plus 2 preview shots × 2 schemes at 1440). `test-output` is gitignored;
these files are not committed. Read two of them to confirm they show the app, not an error page.

- [ ] **Step 2: Write the failing tests**

Create `apps/personal-memories/src/lib/grid-nav.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { gridTarget, isGridKey, isGridLayout } from './grid-nav.ts';

const FIXTURE = ['2025-10-31', '2025-11-01', '2025-11-02', '2025-11-03'];

describe('gridTarget', () => {
  it('steps to the previous and next day with data, and stops at the ends', () => {
    expect(gridTarget(FIXTURE, '2025-11-01', 'ArrowLeft', 'year')).toBe(
      '2025-10-31',
    );
    expect(gridTarget(FIXTURE, '2025-11-01', 'ArrowRight', 'year')).toBe(
      '2025-11-02',
    );
    expect(
      gridTarget(FIXTURE, '2025-10-31', 'ArrowLeft', 'year'),
    ).toBeUndefined();
    expect(
      gridTarget(FIXTURE, '2025-11-03', 'ArrowRight', 'week'),
    ).toBeUndefined();
  });

  it('jumps to the first and last day with data on Home and End', () => {
    expect(gridTarget(FIXTURE, '2025-11-02', 'Home', 'year')).toBe(
      '2025-10-31',
    );
    expect(gridTarget(FIXTURE, '2025-11-02', 'End', 'list')).toBe('2025-11-03');
  });

  it('on the year, takes the same day in the next month row, else the nearest day with data', () => {
    const dates = ['2025-09-10', '2025-10-03', '2025-10-20', '2025-11-03'];
    expect(gridTarget(dates, '2025-10-03', 'ArrowDown', 'year')).toBe(
      '2025-11-03',
    );
    expect(gridTarget(dates, '2025-10-20', 'ArrowUp', 'year')).toBe(
      '2025-09-10',
    );
    expect(gridTarget(dates, '2025-11-03', 'ArrowUp', 'year')).toBe(
      '2025-10-03',
    );
    expect(gridTarget(FIXTURE, '2025-11-03', 'ArrowUp', 'year')).toBe(
      '2025-10-31',
    );
    expect(gridTarget(FIXTURE, '2025-10-31', 'ArrowDown', 'year')).toBe(
      '2025-11-03',
    );
  });

  it('breaks a tie between two equally near days toward the earlier one', () => {
    const dates = ['2025-10-08', '2025-10-12', '2025-11-10'];
    expect(gridTarget(dates, '2025-11-10', 'ArrowUp', 'year')).toBe(
      '2025-10-08',
    );
  });

  it('keeps going past a month row with no data, and stops past the last row', () => {
    const dates = ['2025-08-05', '2025-11-05'];
    expect(gridTarget(dates, '2025-11-05', 'ArrowUp', 'year')).toBe(
      '2025-08-05',
    );
    expect(gridTarget(dates, '2025-08-05', 'ArrowUp', 'year')).toBeUndefined();
    expect(
      gridTarget(dates, '2025-11-05', 'ArrowDown', 'year'),
    ).toBeUndefined();
  });

  it('on the month calendar (November 2025 starts on a Saturday), moves a week, else the nearest day in that week', () => {
    const dates = ['2025-11-01', '2025-11-02', '2025-11-03', '2025-11-10'];
    expect(gridTarget(dates, '2025-11-03', 'ArrowDown', 'week')).toBe(
      '2025-11-10',
    );
    expect(gridTarget(dates, '2025-11-10', 'ArrowUp', 'week')).toBe(
      '2025-11-03',
    );
    expect(gridTarget(dates, '2025-11-03', 'ArrowUp', 'week')).toBe(
      '2025-11-01',
    );
    expect(gridTarget(dates, '2025-11-01', 'ArrowDown', 'week')).toBe(
      '2025-11-03',
    );
  });

  it('on the phone list, moves one item at a time', () => {
    expect(gridTarget(FIXTURE, '2025-11-01', 'ArrowDown', 'list')).toBe(
      '2025-11-02',
    );
    expect(gridTarget(FIXTURE, '2025-11-01', 'ArrowUp', 'list')).toBe(
      '2025-10-31',
    );
  });

  it('ignores a date that is not in the grid, and copes with unsorted or repeated input', () => {
    expect(
      gridTarget(FIXTURE, '2025-12-01', 'ArrowDown', 'year'),
    ).toBeUndefined();
    expect(
      gridTarget(
        ['2025-11-03', '2025-11-01', '2025-11-01'],
        '2025-11-01',
        'ArrowRight',
        'list',
      ),
    ).toBe('2025-11-03');
  });
});

describe('isGridKey and isGridLayout', () => {
  it('accept only the grid keys and the three layouts', () => {
    for (const key of [
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ])
      expect(isGridKey(key)).toBe(true);
    expect(isGridKey('PageDown')).toBe(false);
    expect(isGridLayout('week')).toBe(true);
    expect(isGridLayout('grid')).toBe(false);
    expect(isGridLayout(undefined)).toBe(false);
  });
});
```

In `apps/personal-memories/src/lib/shortcuts.test.ts`, add `previewOpen: false,` to the `key()`
helper after `overlayOpen: false,`, and replace the whole test
`'keeps day keys on the day and cell keys on a focused heat cell'` with:

```ts
it('keeps day keys on the day', () => {
  expect(resolveShortcut(key('j'))).toEqual({ type: 'step-day', delta: 1 });
  expect(resolveShortcut(key('k'))).toEqual({ type: 'step-day', delta: -1 });
  expect(resolveShortcut(key('n'))).toEqual({ type: 'focus-note' });
  expect(
    resolveShortcut(key('j', { place: { level: 'year' } })),
  ).toBeUndefined();
});

it('moves within a grid on the year and the month, only from a focused cell', () => {
  const places: Place[] = [
    { level: 'year' },
    { level: 'month', month: '2025-11' },
  ];
  for (const place of places)
    for (const k of [
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ]) {
      expect(resolveShortcut(key(k, { place, onCell: true }))).toEqual({
        type: 'grid',
        key: k,
      });
      expect(resolveShortcut(key(k, { place }))).toBeUndefined();
    }
  expect(resolveShortcut(key('ArrowUp', { onCell: true }))).toBeUndefined();
});

it('closes an open preview before Escape does anything else', () => {
  const places: Place[] = [
    { level: 'year' },
    { level: 'month', month: '2025-11' },
  ];
  for (const place of places)
    expect(
      resolveShortcut(
        key('Escape', { place, onCell: true, previewOpen: true }),
      ),
    ).toEqual({ type: 'close-preview' });
  expect(
    resolveShortcut(key('Escape', { previewOpen: true, overlayOpen: true })),
  ).toBeUndefined();
});
```

Create `apps/personal-memories-e2e/src/navigation.spec.ts`:

```ts
import { expect, type Page, test } from '@playwright/test';

const waitForAppBarReady = (page: Page) =>
  expect(page.locator('html[data-appbar-ready]')).toHaveCount(1);

const visibleCell = (page: Page, date: string) =>
  page.locator(`a[data-date="${date}"]:visible`);

const stops = (page: Page, grid: 'year' | 'week' | 'list') =>
  page.locator(`[data-grid="${grid}"] a[data-date][tabindex="0"]`);

test.describe.configure({ mode: 'serial' });

test('each grid has one tab stop, the latest day with data, and Tab lands on it', async ({
  page,
}) => {
  await page.goto('/month/2025-11');
  await waitForAppBarReady(page);
  for (const grid of ['week', 'list'] as const) {
    await expect(stops(page, grid)).toHaveCount(1);
    await expect(stops(page, grid)).toHaveAttribute('data-date', '2025-11-03');
  }
  await page.getByRole('link', { name: '上個月' }).focus();
  await page.keyboard.press('Tab');
  await expect(visibleCell(page, '2025-11-03')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-grid] a[data-date]:focus')).toHaveCount(0);

  await page.goto('/');
  await waitForAppBarReady(page);
  await expect(stops(page, 'year')).toHaveCount(1);
  await expect(stops(page, 'year')).toHaveAttribute('data-date', '2025-11-03');
  await page.locator('[data-grid="year"] a[href="/month/2025-11"]').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('a[data-date="2025-11-03"]')).toBeFocused();
});

test('arrow keys, Home and End move through the month calendar and carry the tab stop', async ({
  page,
}) => {
  await page.goto('/month/2025-11');
  await waitForAppBarReady(page);
  await visibleCell(page, '2025-11-03').focus();
  await page.keyboard.press('ArrowUp');
  await expect(visibleCell(page, '2025-11-01')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(visibleCell(page, '2025-11-03')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(visibleCell(page, '2025-11-02')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(visibleCell(page, '2025-11-01')).toBeFocused();
  await page.keyboard.press('End');
  await expect(visibleCell(page, '2025-11-03')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(stops(page, 'week')).toHaveCount(1);
  await expect(stops(page, 'week')).toHaveAttribute('data-date', '2025-11-02');

  const scrolled = await page.evaluate(() => scrollY);
  await page.keyboard.press('ArrowDown');
  await expect(visibleCell(page, '2025-11-02')).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBe(scrolled);
});

test('arrow keys move between month rows on the year heatmap', async ({
  page,
}) => {
  await page.goto('/');
  await waitForAppBarReady(page);
  const cell = (date: string) => page.locator(`a[data-date="${date}"]`);
  await cell('2025-11-03').focus();
  await page.keyboard.press('ArrowUp');
  await expect(cell('2025-10-31')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(cell('2025-11-03')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(cell('2025-10-31')).toBeFocused();
  await expect(stops(page, 'year')).toHaveCount(1);
  await expect(stops(page, 'year')).toHaveAttribute('data-date', '2025-10-31');
});

test('on a phone, ↑ and ↓ move one day through the month list', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/month/2025-11');
  await waitForAppBarReady(page);
  await visibleCell(page, '2025-11-02').focus();
  await page.keyboard.press('ArrowDown');
  await expect(visibleCell(page, '2025-11-03')).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(visibleCell(page, '2025-11-01')).toBeFocused();
  await expect(stops(page, 'list')).toHaveAttribute('data-date', '2025-11-01');
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm nx test personal-memories -- src/lib/grid-nav.test.ts src/lib/shortcuts.test.ts`
Expected: FAIL. `grid-nav.ts` does not exist; `resolveShortcut` returns `step-cell` and knows no
`ArrowUp`.

Run: `pnpm nx e2e personal-memories-e2e -- src/navigation.spec.ts`
Expected: FAIL. No `[data-grid]` exists.

- [ ] **Step 4: Implement the pure rules**

Create `apps/personal-memories/src/lib/grid-nav.ts`:

```ts
export type GridLayout = 'year' | 'week' | 'list';
export type GridKey =
  'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

const GRID_KEYS: readonly string[] = [
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
];

export const isGridKey = (key: string): key is GridKey =>
  GRID_KEYS.includes(key);

export const isGridLayout = (value: string | undefined): value is GridLayout =>
  value === 'year' || value === 'week' || value === 'list';

type Slot = { date: string; row: string; col: number };

function slotOf(date: string, layout: GridLayout): Slot {
  const month = date.slice(0, 7);
  const day = Number(date.slice(8, 10));
  if (layout === 'list') return { date, row: date, col: 0 };
  if (layout === 'year') return { date, row: month, col: day - 1 };
  const lead = new Date(
    Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, 1),
  ).getUTCDay();
  const index = lead + day - 1;
  return { date, row: `${month}/${Math.floor(index / 7)}`, col: index % 7 };
}

function rowsOf(dates: readonly string[], layout: GridLayout): Slot[][] {
  const rows: Slot[][] = [];
  for (const date of dates) {
    const slot = slotOf(date, layout);
    const last = rows.at(-1);
    if (last?.[0]?.row === slot.row) last.push(slot);
    else rows.push([slot]);
  }
  return rows;
}

function nearest(row: readonly Slot[], col: number): string | undefined {
  let best: Slot | undefined;
  for (const slot of row)
    if (!best || Math.abs(slot.col - col) < Math.abs(best.col - col))
      best = slot;
  return best?.date;
}

export function gridTarget(
  dates: readonly string[],
  current: string,
  key: GridKey,
  layout: GridLayout,
): string | undefined {
  const sorted = [...new Set(dates)].sort();
  const i = sorted.indexOf(current);
  if (i === -1) return undefined;
  if (key === 'ArrowLeft') return sorted[i - 1];
  if (key === 'ArrowRight') return sorted[i + 1];
  if (key === 'Home') return sorted[0];
  if (key === 'End') return sorted.at(-1);
  const rows = rowsOf(sorted, layout);
  const r = rows.findIndex((row) => row.some((slot) => slot.date === current));
  const next = rows[r + (key === 'ArrowDown' ? 1 : -1)];
  return next ? nearest(next, slotOf(current, layout).col) : undefined;
}
```

In `apps/personal-memories/src/lib/shortcuts.ts`, replace the imports with:

```ts
import { type GridKey, isGridKey } from './grid-nav.ts';
import { type Place, zoomOutHref } from './nav.ts';
```

and replace everything from `export type Shortcut =` to the end of the file with:

```ts
export type Shortcut =
  | { type: 'navigate'; href: string }
  | { type: 'step-day'; delta: -1 | 1 }
  | { type: 'grid'; key: GridKey }
  | { type: 'close-preview' }
  | { type: 'blur' }
  | { type: 'focus-note' }
  | { type: 'open-jump' }
  | { type: 'open-shortcuts' };

export type KeyInput = {
  key: string;
  modified: boolean;
  typing: boolean;
  overlayOpen: boolean;
  previewOpen: boolean;
  onCell: boolean;
  place: Place | undefined;
};

export function resolveShortcut(k: KeyInput): Shortcut | undefined {
  if (k.modified || k.typing || k.overlayOpen || !k.place) return undefined;
  const { level } = k.place;
  if (isGridKey(k.key))
    return level !== 'day' && k.onCell
      ? { type: 'grid', key: k.key }
      : undefined;
  switch (k.key) {
    case '?':
      return { type: 'open-shortcuts' };
    case '/':
      return { type: 'open-jump' };
    case 'Escape': {
      if (k.previewOpen) return { type: 'close-preview' };
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
    default:
      return undefined;
  }
}
```

Run: `pnpm nx test personal-memories -- src/lib/grid-nav.test.ts src/lib/shortcuts.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the keys and the roving tab stop**

Create `apps/personal-memories/src/lib/client/preview-dom.ts`:

```ts
export const openPreview = () =>
  document.querySelector<HTMLElement>('[data-preview]:popover-open');
```

Create `apps/personal-memories/src/lib/client/roving.ts`:

```ts
import { type GridKey, gridTarget, isGridLayout } from '../grid-nav.ts';

const CELL = 'a[data-date]';

export function setStop(cell: HTMLElement) {
  const grid = cell.closest<HTMLElement>('[data-grid]');
  if (!grid) return;
  for (const other of grid.querySelectorAll<HTMLElement>(
    `${CELL}[tabindex="0"]`,
  ))
    other.tabIndex = -1;
  cell.tabIndex = 0;
}

export function moveInGrid(key: GridKey) {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return;
  const grid = active.closest<HTMLElement>('[data-grid]');
  const layout = grid?.dataset['grid'];
  const date = active.dataset['date'];
  if (!grid || !isGridLayout(layout) || !date) return;
  const cells = [...grid.querySelectorAll<HTMLElement>(CELL)];
  const target = gridTarget(
    cells.flatMap((cell) => cell.dataset['date'] ?? []),
    date,
    key,
    layout,
  );
  const next = cells.find((cell) => cell.dataset['date'] === target);
  if (!next) return;
  setStop(next);
  next.focus();
}
```

Replace `apps/personal-memories/src/scripts/shortcuts.ts` with:

```ts
import { isOverlayOpen } from '../lib/client/overlays.ts';
import { openPreview } from '../lib/client/preview-dom.ts';
import { moveInGrid, setStop } from '../lib/client/roving.ts';
import { stepDay } from '../lib/client/step-day.ts';
import { placeOf } from '../lib/nav.ts';
import { resolveShortcut, type Shortcut } from '../lib/shortcuts.ts';

const TYPING =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
const CELL = '[data-grid] a[data-date]';

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
    case 'grid':
      return moveInGrid(action.key);
    case 'close-preview':
      return openPreview()?.hidePopover();
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
        typing:
          !!active?.closest(TYPING) ||
          event.isComposing ||
          event.keyCode === 229,
        overlayOpen: isOverlayOpen(),
        previewOpen: !!openPreview(),
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
  document.addEventListener('focusin', (event) => {
    if (event.target instanceof HTMLElement && event.target.matches(CELL))
      setStop(event.target);
  });
}
```

In `apps/personal-memories/src/components/Heatmap.astro`:

- After `const { rows, level, noted, morph, previews } = Astro.props;` add:

  ```ts
  const stop = rows
    .flatMap((row) => row.cells)
    .filter((cell) => cell !== null && cell.total > 0)
    .at(-1)?.date;
  ```

- Change `<div class="flex w-max flex-col">` to `<div data-grid="year" class="flex w-max flex-col">`.
- On the day link (`<a href={`/day/${cell.date}`} data-date={cell.date} …>`), add
  `tabindex={cell.date === stop ? 0 : -1}` after `data-heat-cell`.

In `apps/personal-memories/src/components/month/MonthCalendar.astro`:

- After the `const days = …` line add
  `const stop = days.filter((c) => c.total > 0).at(-1)?.date;`
- Change `<ol class="grid grid-cols-7 gap-2">` to `<ol data-grid="week" class="grid grid-cols-7 gap-2">`.
- Change `<ol class="divide-border flex flex-col divide-y sm:hidden">` to
  `<ol data-grid="list" class="divide-border flex flex-col divide-y sm:hidden">`.
- On both day links (the desktop `<a … data-morph={`day-${cell.date}`}` and the phone one), add
  `tabindex={cell.date === stop ? 0 : -1}` after `data-morph`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm nx test personal-memories -- src/lib/grid-nav.test.ts src/lib/shortcuts.test.ts`
Run: `pnpm nx e2e personal-memories-e2e -- src/navigation.spec.ts`
Run: `pnpm nx e2e personal-memories-e2e -- --grep "keys: j and k|a heat cell previews"`
Expected: PASS. The two existing tests still move with `→` on the year.

- [ ] **Step 7: Lint, types and comment audit**

Run: `pnpm nx run-many -t lint typecheck -p personal-memories personal-memories-e2e`
Run: `git diff -U0 | grep -E '^\+\s*(//|/\*|\*|#|<!--)'`
Expected: lint and types PASS, no new comment hits (the `// Capture phase: …` line in
`scripts/shortcuts.ts` is unchanged).

- [ ] **Step 8: Commit**

```bash
git add apps/personal-memories/src/lib/grid-nav.ts apps/personal-memories/src/lib/grid-nav.test.ts \
  apps/personal-memories/src/lib/shortcuts.ts apps/personal-memories/src/lib/shortcuts.test.ts \
  apps/personal-memories/src/lib/client/roving.ts apps/personal-memories/src/lib/client/preview-dom.ts \
  apps/personal-memories/src/scripts/shortcuts.ts apps/personal-memories/src/components/Heatmap.astro \
  apps/personal-memories/src/components/month/MonthCalendar.astro \
  apps/personal-memories-e2e/src/navigation.spec.ts apps/personal-memories-e2e/src/nav-visual.spec.ts
git commit -m "$(cat <<'EOF'
feat(personal-memories): move through the year and month grids with arrow keys

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm
EOF
)"
```

---

### Task 2: Key hints and the `?` dialog

**Files:**

- Modify: `apps/personal-memories/src/lib/shortcuts.ts:3-37` (`ShortcutRow`, `SHORTCUT_GROUPS`)
- Modify: `apps/personal-memories/src/lib/shortcuts.test.ts`
- Create: `apps/personal-memories/src/components/KeyHints.astro`
- Modify: `apps/personal-memories/src/components/Heatmap.astro:1-9`, `:237-242`
- Modify: `apps/personal-memories/src/pages/month/[month].astro:1-13`, `:66`
- Modify: `apps/personal-memories-e2e/src/timeline.spec.ts:811-827` (test `the keyboard button opens the shortcuts overlay`)
- Modify: `apps/personal-memories-e2e/src/navigation.spec.ts`

**Interfaces:**

- Consumes: `ShortcutRow = { keys: string[]; label: string }` from `src/lib/shortcuts.ts`.
- Produces: `YEAR_HINTS: readonly ShortcutRow[]`, `MONTH_HINTS: readonly ShortcutRow[]` from
  `src/lib/shortcuts.ts`; `KeyHints.astro` with props `{ hints: readonly ShortcutRow[] }`,
  rendering `[data-key-hints]` (hidden below `sm`).

- [ ] **Step 1: Write the failing tests**

Add to `apps/personal-memories/src/lib/shortcuts.test.ts` (and extend its import to
`import { type KeyInput, MONTH_HINTS, resolveShortcut, SHORTCUT_GROUPS, YEAR_HINTS } from './shortcuts.ts';`):

```ts
describe('key hints and the shortcuts dialog', () => {
  it('hints the arrow keys under each grid', () => {
    expect(YEAR_HINTS).toEqual([
      { keys: ['←', '→'], label: '在日子間移動' },
      { keys: ['↑', '↓'], label: '上下一個月' },
      { keys: ['Enter'], label: '打開那一天' },
    ]);
    expect(MONTH_HINTS).toEqual([
      { keys: ['←', '→'], label: '前後一天' },
      { keys: ['↑', '↓'], label: '前後一週' },
      { keys: ['Enter'], label: '打開那一天' },
    ]);
  });

  it('gives the dialog a month group and the new rows on the year and the month', () => {
    expect(SHORTCUT_GROUPS.map((g) => g.title)).toEqual([
      '全部畫面',
      '年',
      '月',
      '日',
      '照片',
    ]);
    for (const title of ['年', '月']) {
      const rows = SHORTCUT_GROUPS.find((g) => g.title === title)?.rows ?? [];
      expect(rows).toContainEqual({ keys: ['↑', '↓'], label: '上下一行' });
      expect(rows).toContainEqual({
        keys: ['Home', 'End'],
        label: '第一天／最後一天',
      });
      expect(rows).toContainEqual({ keys: ['Enter'], label: '打開那一天' });
    }
    expect(SHORTCUT_GROUPS.find((g) => g.title === '月')?.rows[0]).toEqual({
      keys: ['←', '→'],
      label: '前後一天',
    });
  });
});
```

Append to `apps/personal-memories-e2e/src/navigation.spec.ts`:

```ts
test('the year and month pages hint their arrow keys, and the day page does not', async ({
  page,
}) => {
  await page.goto('/month/2025-11');
  const hints = page.locator('[data-key-hints]');
  await expect(hints).toBeVisible();
  for (const label of ['前後一天', '前後一週', '打開那一天'])
    await expect(hints).toContainText(label);

  await page.goto('/');
  await expect(page.locator('[data-key-hints]')).toContainText('上下一個月');

  await page.goto('/day/2025-11-01');
  await expect(page.locator('[data-key-hints]')).toHaveCount(0);
});
```

In `apps/personal-memories-e2e/src/timeline.spec.ts`, test
`the keyboard button opens the shortcuts overlay`, change the heading list to
`['鍵盤快速鍵', '全部畫面', '年', '月', '日', '照片']` and the label loop to
`['看所有快速鍵', '在日子間移動', '上下一行', '第一天／最後一天', '前後一天', '寫回憶']`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm nx test personal-memories -- src/lib/shortcuts.test.ts`
Expected: FAIL. `YEAR_HINTS` is not exported; there is no 月 group.

Run: `pnpm nx e2e personal-memories-e2e -- --grep "hint their arrow keys|opens the shortcuts overlay"`
Expected: FAIL. No `[data-key-hints]`; the dialog has no 月 heading.

- [ ] **Step 3: Implement**

In `apps/personal-memories/src/lib/shortcuts.ts`, replace `SHORTCUT_GROUPS` with:

```ts
const GRID_ROWS: ShortcutRow[] = [
  { keys: ['↑', '↓'], label: '上下一行' },
  { keys: ['Home', 'End'], label: '第一天／最後一天' },
  { keys: ['Enter'], label: '打開那一天' },
];

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: '全部畫面',
    rows: [
      { keys: ['/'], label: '跳至日期' },
      { keys: ['?'], label: '看所有快速鍵' },
      { keys: ['Esc'], label: '縮小一層' },
    ],
  },
  {
    title: '年',
    rows: [{ keys: ['←', '→'], label: '在日子間移動' }, ...GRID_ROWS],
  },
  {
    title: '月',
    rows: [{ keys: ['←', '→'], label: '前後一天' }, ...GRID_ROWS],
  },
  {
    title: '日',
    rows: [
      { keys: ['k'], label: '前一天' },
      { keys: ['j'], label: '後一天' },
      { keys: ['n'], label: '寫回憶' },
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

export const YEAR_HINTS: readonly ShortcutRow[] = [
  { keys: ['←', '→'], label: '在日子間移動' },
  { keys: ['↑', '↓'], label: '上下一個月' },
  { keys: ['Enter'], label: '打開那一天' },
];

export const MONTH_HINTS: readonly ShortcutRow[] = [
  { keys: ['←', '→'], label: '前後一天' },
  { keys: ['↑', '↓'], label: '前後一週' },
  { keys: ['Enter'], label: '打開那一天' },
];
```

Create `apps/personal-memories/src/components/KeyHints.astro`:

```astro
---
import { Kbd, KbdGroup } from '@rainforest-dev/rainforest-react';

import type { ShortcutRow } from '../lib/shortcuts.ts';

type Props = { hints: readonly ShortcutRow[] };

const { hints } = Astro.props;
---

<div data-key-hints class="text-muted-foreground hidden gap-5 text-xs sm:flex">
  {
    hints.map((hint) => (
      <span class="flex items-center gap-1.5">
        {hint.keys.length > 1 ? (
          <KbdGroup>
            {hint.keys.map((key) => (
              <Kbd>{key}</Kbd>
            ))}
          </KbdGroup>
        ) : (
          <Kbd>{hint.keys[0]}</Kbd>
        )}
        {hint.label}
      </span>
    ))
  }
</div>
```

In `apps/personal-memories/src/components/Heatmap.astro`, drop the
`import { Kbd, KbdGroup } from '@rainforest-dev/rainforest-react';` line, add
`import { YEAR_HINTS } from '../lib/shortcuts.ts';` and `import KeyHints from './KeyHints.astro';`
in sorted position, and replace the closing hint block

```astro
<div class="text-muted-foreground hidden gap-5 text-xs sm:flex">
  <span class="flex items-center gap-1.5">
    <KbdGroup><Kbd>←</Kbd><Kbd>→</Kbd></KbdGroup>在日子間移動
  </span>
  <span class="flex items-center gap-1.5"><Kbd>Enter</Kbd>打開那一天</span>
</div>
```

with `<KeyHints hints={YEAR_HINTS} />`.

In `apps/personal-memories/src/pages/month/[month].astro`, add
`import KeyHints from '../../components/KeyHints.astro';` and
`import { MONTH_HINTS } from '../../lib/shortcuts.ts';` in sorted position, and replace
`<MonthCalendar view={view} morph={morph} />` with:

```astro
<MonthCalendar view={view} morph={morph} />
<div class="mt-6">
  <KeyHints hints={MONTH_HINTS} />
</div>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm nx test personal-memories -- src/lib/shortcuts.test.ts`
Run: `pnpm nx e2e personal-memories-e2e -- --grep "hint their arrow keys|opens the shortcuts overlay"`
Expected: PASS.

- [ ] **Step 5: Lint, types and comment audit**

Run: `pnpm nx run-many -t lint typecheck -p personal-memories personal-memories-e2e`
Run: `git diff -U0 | grep -E '^\+\s*(//|/\*|\*|#|<!--)'`
Expected: PASS, no comment hits.

- [ ] **Step 6: Commit**

```bash
git add apps/personal-memories/src/lib/shortcuts.ts apps/personal-memories/src/lib/shortcuts.test.ts \
  apps/personal-memories/src/components/KeyHints.astro apps/personal-memories/src/components/Heatmap.astro \
  "apps/personal-memories/src/pages/month/[month].astro" \
  apps/personal-memories-e2e/src/timeline.spec.ts apps/personal-memories-e2e/src/navigation.spec.ts
git commit -m "$(cat <<'EOF'
feat(personal-memories): hint the grid keys on the year and month pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm
EOF
)"
```

---

### Task 3: Choose the morph on the client

**Files:**

- Modify: `apps/personal-memories/src/lib/nav.ts:1-18` (`placeOf`)
- Modify: `apps/personal-memories/src/lib/zoom.ts:1-24` (`morphKey`)
- Create: `apps/personal-memories/src/lib/reveal.ts`
- Create: `apps/personal-memories/src/lib/reveal.test.ts`
- Modify: `apps/personal-memories/src/layouts/Layout.astro:1-48`
- Modify: `apps/personal-memories/src/scripts/zoom.ts:1-21`
- Modify: `apps/personal-memories-e2e/src/navigation.spec.ts`

**Interfaces:**

- Consumes: `placeOf(pathname: string): Place | undefined` (`src/lib/nav.ts`),
  `morphKey(from: Place | undefined, to: Place | undefined): string | undefined`
  (`src/lib/zoom.ts`). Both keep their signatures and behaviour; their existing tests stay green.
- Produces, from `src/lib/reveal.ts`:
  - `REVEAL_STYLE_ID = 'reveal-morph'`
  - `type RevealDeps = { placeOf: typeof placeOf; morphKey: typeof morphKey }`
  - `revealKey(from: string | undefined, here: string, deps: RevealDeps): string | undefined`
  - `revealStyle(key: string | undefined): string`
  - `installReveal(deps: RevealDeps & { id: string; revealKey: typeof revealKey; revealStyle: typeof revealStyle }): void`
  - `revealScript(): string` (the inline head script source)

- [ ] **Step 1: Write the failing unit tests**

Create `apps/personal-memories/src/lib/reveal.test.ts`:

```ts
import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

import { placeOf } from './nav.ts';
import {
  REVEAL_STYLE_ID,
  revealKey,
  revealScript,
  revealStyle,
} from './reveal.ts';
import { morphKey } from './zoom.ts';

const deps = { placeOf, morphKey };
const ORIGIN = 'http://127.0.0.1:3024';

describe('revealKey', () => {
  it('names the day you left when you land on its month or the year, and the month row from a month', () => {
    expect(
      revealKey(`${ORIGIN}/day/2025-11-03`, `${ORIGIN}/month/2025-11`, deps),
    ).toBe('day-2025-11-03');
    expect(revealKey(`${ORIGIN}/day/2025-11-03`, `${ORIGIN}/`, deps)).toBe(
      'day-2025-11-03',
    );
    expect(revealKey(`${ORIGIN}/month/2025-11`, `${ORIGIN}/`, deps)).toBe(
      'month-2025-11',
    );
    expect(revealKey(`${ORIGIN}/`, `${ORIGIN}/month/2025-11`, deps)).toBe(
      'month-2025-11',
    );
  });

  it('reads the path only, ignoring a query and a hash', () => {
    expect(
      revealKey(
        `${ORIGIN}/day/2025-11-03?nearest=1#ev-1`,
        `${ORIGIN}/month/2025-11`,
        deps,
      ),
    ).toBe('day-2025-11-03');
  });

  it('names nothing for another month, another origin, a missing or a malformed URL', () => {
    expect(
      revealKey(`${ORIGIN}/day/2025-10-31`, `${ORIGIN}/month/2025-11`, deps),
    ).toBeUndefined();
    expect(
      revealKey('https://elsewhere.example/day/2025-11-03', `${ORIGIN}/`, deps),
    ).toBeUndefined();
    expect(revealKey(undefined, `${ORIGIN}/`, deps)).toBeUndefined();
    expect(revealKey('not a url', `${ORIGIN}/`, deps)).toBeUndefined();
  });
});

describe('revealStyle', () => {
  it('silences every morph name, then names only the key', () => {
    expect(revealStyle(undefined)).toBe(
      '[data-morph]{view-transition-name:none!important}',
    );
    expect(revealStyle('day-2025-11-03')).toBe(
      '[data-morph]{view-transition-name:none!important}' +
        '[data-morph="day-2025-11-03"]{view-transition-name:day-2025-11-03!important}',
    );
  });
});

describe('revealScript', () => {
  type Styled = { id: string; textContent: string };
  const run = ({
    from,
    here,
    transition = true,
    reduced = false,
    navigationApi = true,
  }: {
    from?: string;
    here: string;
    transition?: boolean;
    reduced?: boolean;
    navigationApi?: boolean;
  }) => {
    const listeners: Record<string, (event: unknown) => void> = {};
    const head: Styled[] = [];
    const context: Record<string, unknown> = {
      URL,
      Promise,
      location: { href: here },
      matchMedia: () => ({ matches: reduced }),
      addEventListener: (type: string, fn: (event: unknown) => void) => {
        listeners[type] = fn;
      },
      document: {
        readyState: 'complete',
        head: { append: (el: Styled) => head.push(el) },
        createElement: (): Styled => ({ id: '', textContent: '' }),
        getElementById: () => null,
        querySelectorAll: () => [],
        addEventListener: () => undefined,
      },
    };
    if (navigationApi)
      context['navigation'] = {
        activation: { from: from ? { url: from } : null },
      };
    runInNewContext(revealScript(), context);
    listeners['pagereveal']?.({
      viewTransition: transition
        ? { finished: new Promise(() => undefined) }
        : null,
    });
    return head;
  };

  it('runs on its own in an empty global scope and names the day you came back from', () => {
    expect(
      run({
        from: `${ORIGIN}/day/2025-11-03`,
        here: `${ORIGIN}/month/2025-11`,
      }),
    ).toEqual([
      { id: REVEAL_STYLE_ID, textContent: revealStyle('day-2025-11-03') },
    ]);
  });

  it('silences stale names when the Navigation API names nothing', () => {
    expect(run({ here: `${ORIGIN}/month/2025-11` })).toEqual([
      { id: REVEAL_STYLE_ID, textContent: revealStyle(undefined) },
    ]);
  });

  it('adds nothing without a transition, under reduced motion, or without the Navigation API', () => {
    const from = `${ORIGIN}/day/2025-11-03`;
    const here = `${ORIGIN}/month/2025-11`;
    expect(run({ from, here, transition: false })).toEqual([]);
    expect(run({ from, here, reduced: true })).toEqual([]);
    expect(run({ from, here, navigationApi: false })).toEqual([]);
  });
});
```

Run: `pnpm nx test personal-memories -- src/lib/reveal.test.ts`
Expected: FAIL. `reveal.ts` does not exist.

- [ ] **Step 2: Make `placeOf` and `morphKey` self-contained**

In `apps/personal-memories/src/lib/nav.ts`, change the import to
`import { monthOf, nearestDate } from './months.ts';`, delete the `DAY_PATH` and `MONTH_PATH`
constants, and replace `placeOf` with:

```ts
// Serialised into a blocking head script by reveal.ts, so it must not reference anything outside itself.
export function placeOf(pathname: string): Place | undefined {
  if (pathname === '/') return { level: 'year' };
  const date = /^\/day\/(\d{4}-\d{2}-\d{2})\/?$/.exec(pathname)?.[1];
  if (date) return { level: 'day', date };
  const month = /^\/month\/(\d{4}-(?:0[1-9]|1[0-2]))\/?$/.exec(pathname)?.[1];
  return month ? { level: 'month', month } : undefined;
}
```

In `apps/personal-memories/src/lib/zoom.ts`, delete `import { monthOf } from './months.ts';` and
replace `morphKey` with:

```ts
// Serialised into a blocking head script by reveal.ts, so it must not reference anything outside itself.
export function morphKey(
  from: Place | undefined,
  to: Place | undefined,
): string | undefined {
  if (!from || !to || from.level === to.level) return undefined;
  const day =
    from.level === 'day' ? from.date : to.level === 'day' ? to.date : undefined;
  if (day) {
    const other = from.level === 'day' ? to : from;
    if (other.level === 'month' && other.month !== day.slice(0, 7))
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
```

Run: `pnpm nx test personal-memories -- src/lib/nav.test.ts src/lib/zoom.test.ts`
Expected: PASS (behaviour unchanged).

- [ ] **Step 3: Implement `reveal.ts`**

Create `apps/personal-memories/src/lib/reveal.ts`:

```ts
import { placeOf } from './nav.ts';
import { morphKey } from './zoom.ts';

export const REVEAL_STYLE_ID = 'reveal-morph';

export type RevealDeps = {
  placeOf: typeof placeOf;
  morphKey: typeof morphKey;
};

type InstallDeps = RevealDeps & {
  id: string;
  revealKey: typeof revealKey;
  revealStyle: typeof revealStyle;
};

export function revealKey(
  from: string | undefined,
  here: string,
  deps: RevealDeps,
): string | undefined {
  if (!from) return undefined;
  try {
    const left = new URL(from);
    const landed = new URL(here);
    if (left.origin !== landed.origin) return undefined;
    return deps.morphKey(
      deps.placeOf(left.pathname),
      deps.placeOf(landed.pathname),
    );
  } catch {
    return undefined;
  }
}

export function revealStyle(key: string | undefined): string {
  const none = '[data-morph]{view-transition-name:none!important}';
  return key
    ? `${none}[data-morph="${key}"]{view-transition-name:${key}!important}`
    : none;
}

// pagereveal fires before deferred or module scripts can listen, so Layout inlines this as a blocking head script.
export function installReveal(deps: InstallDeps) {
  const clear = () => {
    document.getElementById(deps.id)?.remove();
    for (const el of document.querySelectorAll<HTMLElement>('[data-morph]'))
      el.style.viewTransitionName = '';
  };
  addEventListener('pagereveal', (event) => {
    const activation =
      typeof navigation === 'undefined' ? null : navigation.activation;
    if (
      activation &&
      event.viewTransition &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      const style = document.createElement('style');
      style.id = deps.id;
      style.textContent = deps.revealStyle(
        deps.revealKey(activation.from?.url ?? undefined, location.href, deps),
      );
      document.head.append(style);
    }
    (event.viewTransition?.finished ?? Promise.resolve()).finally(() => {
      clear();
      if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', clear, { once: true });
    });
  });
  addEventListener('pageshow', (event) => {
    if (event.persisted) clear();
  });
}

export function revealScript(): string {
  const deps = [
    `id:${JSON.stringify(REVEAL_STYLE_ID)}`,
    `placeOf:${placeOf.toString()}`,
    `morphKey:${morphKey.toString()}`,
    `revealKey:${revealKey.toString()}`,
    `revealStyle:${revealStyle.toString()}`,
  ].join(',');
  return `(${installReveal.toString()})({${deps}});`;
}
```

Run: `pnpm nx test personal-memories -- src/lib/reveal.test.ts`
Expected: PASS. If a `node:vm` case fails with `__name is not defined` or an
`__vite_ssr_import_*` reference, the transform is adding outer references to a serialised
function: stop and report rather than working around it.

- [ ] **Step 4: Use it in the layout and on `pageswap`**

In `apps/personal-memories/src/layouts/Layout.astro`, add `import { revealScript } from '../lib/reveal.ts';`
after the `../lib/nav.ts` import, and replace the whole first head script (from
`<script is:inline>` through its `</script>`, the one with `clearMorphNames`) with:

```astro
<script is:inline set:html={revealScript()} />
```

In `apps/personal-memories/src/scripts/zoom.ts`, add
`import { REVEAL_STYLE_ID } from '../lib/reveal.ts';` after the `../lib/nav.ts` import, and make
the first line of the `pageswap` listener body:

```ts
document.getElementById(REVEAL_STYLE_ID)?.remove();
```

- [ ] **Step 5: Write the e2e test**

In `apps/personal-memories-e2e/src/navigation.spec.ts`, add below the existing helpers:

```ts
const scrollToDay = async (page: Page, date: string) => {
  const day = page.locator(`#day-${date}`);
  await expect(async () => {
    await page.locator('[data-load="next"]').scrollIntoViewIfNeeded();
    await expect(day).toBeAttached({ timeout: 1000 });
  }).toPass();
  await day.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect(page).toHaveURL(new RegExp(`/day/${date}$`));
};

const recordReveal = (page: Page) =>
  page.addInitScript(() => {
    addEventListener('pagereveal', (event) => {
      const root = document.documentElement;
      root.dataset['revealTransition'] = String(!!event.viewTransition);
      requestAnimationFrame(() => {
        root.dataset['revealStyle'] =
          document.getElementById('reveal-morph')?.textContent ?? '';
      });
    });
  });
```

and append:

```ts
test('Back from a day scrolled past its first names the later day for the morph', async ({
  page,
}) => {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  await recordReveal(page);
  await page.goto('/month/2025-11');
  await waitForAppBarReady(page);
  await visibleCell(page, '2025-11-01').click();
  await expect(page).toHaveURL(/\/day\/2025-11-01$/);
  await waitForAppBarReady(page);
  await scrollToDay(page, '2025-11-03');

  await page.goBack();
  await expect(page).toHaveURL(/\/month\/2025-11$/);
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-reveal-transition', 'true');
  await expect(html).toHaveAttribute(
    'data-reveal-style',
    '[data-morph]{view-transition-name:none!important}' +
      '[data-morph="day-2025-11-03"]{view-transition-name:day-2025-11-03!important}',
  );
  await expect.poll(() => page.locator('style#reveal-morph').count()).toBe(0);
  expect(errors).toEqual([]);
});
```

If `data-reveal-transition` records `false`, headless Chromium is not running cross-document
transitions on traversal: stop and report instead of loosening the test.

- [ ] **Step 6: Run the tests**

Run: `pnpm nx e2e personal-memories-e2e -- --grep "names the later day for the morph"`
Expected: PASS.

Run: `pnpm nx e2e personal-memories-e2e -- --grep "morph|transition|reduced motion|zooming out"`
Expected: PASS. The existing morph, cleanup, late-parse and reduced-motion tests stay green.

- [ ] **Step 7: Dev server check, lint, types and comment audit**

Run `pnpm nx dev personal-memories` with `MEMORIES_DATA_DIR` pointing at
`apps/personal-memories-e2e/test-output/fixture-data` and `MEMORIES_NOTES_DIR` at a temp dir.
Load `/`, `/month/2025-11` and `/day/2025-11-01`; view source and confirm the head holds
`(function installReveal(` and the browser console is clean. Stop the server.

Run: `pnpm nx run-many -t lint typecheck -p personal-memories personal-memories-e2e`
Run: `git diff -U0 | grep -E '^\+\s*(//|/\*|\*|#|<!--)'`
Expected: PASS. Comment hits: the two `// Serialised into a blocking head script …` lines and the
`// pagereveal fires before …` line, each naming a browser or serialisation constraint.

- [ ] **Step 8: Commit**

```bash
git add apps/personal-memories/src/lib/nav.ts apps/personal-memories/src/lib/zoom.ts \
  apps/personal-memories/src/lib/reveal.ts apps/personal-memories/src/lib/reveal.test.ts \
  apps/personal-memories/src/layouts/Layout.astro apps/personal-memories/src/scripts/zoom.ts \
  apps/personal-memories-e2e/src/navigation.spec.ts
git commit -m "$(cat <<'EOF'
feat(personal-memories): pick the morph target on the client from the navigation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm
EOF
)"
```

---

### Task 4: Mark and focus the day you were on

**Files:**

- Modify: `apps/personal-memories/src/scripts/zoom.ts` (whole file)
- Modify: `apps/personal-memories/src/styles/global.css` (after the `[data-hour-strip]` rule)
- Modify: `apps/personal-memories/src/components/month/MonthCellBody.astro:35-44`
- Modify: `apps/personal-memories/src/components/Heatmap.astro` (the two month links)
- Modify: `apps/personal-memories-e2e/src/timeline.spec.ts:975-1002` (test `zooming out after scrolling into a different month lands on the day in view`)
- Modify: `apps/personal-memories-e2e/src/navigation.spec.ts`

**Interfaces:**

- Consumes: `revealKey`, `REVEAL_STYLE_ID` (Task 3); `placeOf`, `morphKey`; `setStop` (Task 1).
- Produces: `startZoom(focus?: (el: HTMLElement) => void): void` from `src/scripts/zoom.ts`
  (Task 6 passes `focusWithoutPreview`). Markup: `a[data-month-row="YYYY-MM"]` on both year
  month links; `[data-last-label]` in the desktop month cell; runtime `data-last-viewed` and
  `aria-description="上次看到"` on the marked element.

- [ ] **Step 1: Write the failing e2e tests**

Append to `apps/personal-memories-e2e/src/navigation.spec.ts`:

```ts
test('Back from a scrolled day marks, focuses and starts the keys from the later day', async ({
  page,
}) => {
  await page.goto('/month/2025-11');
  await waitForAppBarReady(page);
  await visibleCell(page, '2025-11-01').click();
  await expect(page).toHaveURL(/\/day\/2025-11-01$/);
  await waitForAppBarReady(page);
  await scrollToDay(page, '2025-11-03');

  await page.goBack();
  await expect(page).toHaveURL(/\/month\/2025-11$/);
  const cell = visibleCell(page, '2025-11-03');
  await expect(cell).toHaveAttribute('data-last-viewed', '');
  await expect(cell).toHaveAttribute('aria-description', '上次看到');
  await expect(cell.getByText('上次看到')).toBeVisible();
  await expect(cell).toBeFocused();
  await expect(page.locator('[data-last-viewed]:visible')).toHaveCount(1);
  await expect(stops(page, 'week')).toHaveAttribute('data-date', '2025-11-03');

  await page.keyboard.press('ArrowUp');
  await expect(visibleCell(page, '2025-11-01')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(visibleCell(page, '2025-11-03')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(visibleCell(page, '2025-11-02')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(visibleCell(page, '2025-11-03')).toBeFocused();
});

test('Escape from a scrolled day lands on the later day as well', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  await waitForAppBarReady(page);
  await scrollToDay(page, '2025-11-03');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/month\/2025-11$/);
  const cell = visibleCell(page, '2025-11-03');
  await expect(cell).toHaveAttribute('data-last-viewed', '');
  await expect(cell).toBeFocused();
});

test('a second visit moves the mark instead of adding one', async ({
  page,
}) => {
  await page.goto('/month/2025-11');
  await waitForAppBarReady(page);
  await visibleCell(page, '2025-11-01').click();
  await expect(page).toHaveURL(/\/day\/2025-11-01$/);
  await page.goBack();
  await expect(visibleCell(page, '2025-11-01')).toHaveAttribute(
    'data-last-viewed',
    '',
  );

  await page.goForward();
  await expect(page).toHaveURL(/\/day\/2025-11-01$/);
  await waitForAppBarReady(page);
  await scrollToDay(page, '2025-11-03');
  await page.goBack();
  await expect(page).toHaveURL(/\/month\/2025-11$/);
  await expect(visibleCell(page, '2025-11-03')).toHaveAttribute(
    'data-last-viewed',
    '',
  );
  await expect(page.locator('[data-last-viewed]:visible')).toHaveCount(1);
  await expect(
    page.locator('[data-grid="week"] [data-last-viewed]'),
  ).toHaveCount(1);
});

test('the year marks the month row you came from, or the day', async ({
  page,
}) => {
  await page.goto('/month/2025-11');
  await waitForAppBarReady(page);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
  const row = page.locator('a[data-month-row="2025-11"]:visible');
  await expect(row).toHaveAttribute('data-last-viewed', '');
  await expect(row).toHaveAttribute('aria-description', '上次看到');
  await expect(row).toBeFocused();

  await page.goto('/day/2025-11-02');
  await waitForAppBarReady(page);
  await page.getByRole('tab', { name: '年' }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
  const cell = page.locator('a[data-date="2025-11-02"]');
  await expect(cell).toHaveAttribute('data-last-viewed', '');
  await expect(cell).toBeFocused();
  await expect(page.locator('a[data-month-row][data-last-viewed]')).toHaveCount(
    0,
  );
  await expect(stops(page, 'year')).toHaveAttribute('data-date', '2025-11-02');
});
```

In `apps/personal-memories-e2e/src/timeline.spec.ts`, test
`zooming out after scrolling into a different month lands on the day in view`, add after
`await expect(cell).toBeFocused();`:

```ts
await expect(cell).toHaveAttribute('data-last-viewed', '');
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm nx e2e personal-memories-e2e -- --grep "marks, focuses|lands on the later day|moves the mark|month row you came from|different month lands"`
Expected: FAIL. Nothing sets `data-last-viewed`; after Back the page focuses nothing.

- [ ] **Step 3: Implement the arrival**

Replace `apps/personal-memories/src/scripts/zoom.ts` with:

```ts
import { setStop } from '../lib/client/roving.ts';
import { placeOf } from '../lib/nav.ts';
import { REVEAL_STYLE_ID, revealKey } from '../lib/reveal.ts';
import { morphKey } from '../lib/zoom.ts';

const REDUCE = '(prefers-reduced-motion: reduce)';
const MARKABLE = 'a[data-date], a[data-month-row]';

const firstVisible = (selector: string) =>
  [...document.querySelectorAll<HTMLElement>(selector)].find((el) =>
    el.checkVisibility(),
  );

function arrivalKey(): string | undefined {
  const activation =
    typeof navigation === 'undefined' ? null : navigation.activation;
  if (!activation) return firstVisible('[data-morph-target]')?.dataset['morph'];
  return revealKey(activation.from?.url ?? undefined, location.href, {
    placeOf,
    morphKey,
  });
}

function onScreen(el: HTMLElement) {
  const { top, bottom, left, right } = el.getBoundingClientRect();
  const inset =
    parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) ||
    0;
  return (
    top >= inset && bottom <= innerHeight && left >= 0 && right <= innerWidth
  );
}

function arrive(focus: (el: HTMLElement) => void) {
  for (const el of document.querySelectorAll('[data-last-viewed]')) {
    el.removeAttribute('data-last-viewed');
    el.removeAttribute('aria-description');
  }
  const key = arrivalKey();
  if (!key) return;
  const matches = [
    ...document.querySelectorAll<HTMLElement>(`[data-morph="${key}"]`),
  ];
  for (const el of matches.filter((m) => m.matches(MARKABLE))) {
    el.setAttribute('data-last-viewed', '');
    el.setAttribute('aria-description', '上次看到');
    setStop(el);
  }
  const target = matches.find((el) => el.checkVisibility());
  if (!target) return;
  focus(target);
  if (!onScreen(target)) target.scrollIntoView({ block: 'nearest' });
}

const focusOnly = (el: HTMLElement) => el.focus({ preventScroll: true });

export function startZoom(focus: (el: HTMLElement) => void = focusOnly) {
  window.addEventListener('pageswap', (event) => {
    document.getElementById(REVEAL_STYLE_ID)?.remove();
    const to = event.activation?.entry.url;
    if (!event.viewTransition || !to || matchMedia(REDUCE).matches) return;
    const key = morphKey(
      placeOf(location.pathname),
      placeOf(new URL(to).pathname),
    );
    const el = key ? firstVisible(`[data-morph="${key}"]`) : undefined;
    if (key && el) el.style.viewTransitionName = key;
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) arrive(focus);
  });
  arrive(focus);
}
```

In `apps/personal-memories/src/components/Heatmap.astro`, add
`data-month-row={monthKey(row)}` right after `data-morph={`month-${monthKey(row)}`}` on both month
links (the desktop row label and the phone row link).

In `apps/personal-memories/src/components/month/MonthCellBody.astro`, inside the day span, after
`{cell.noted && <span class="bg-foreground size-1.5 rounded-full" />}` add:

```astro
{
  !row && (
    <span
      data-last-label
      aria-hidden="true"
      class="text-primary text-xs font-medium"
    >
      上次看到
    </span>
  )
}
```

In `apps/personal-memories/src/styles/global.css`, after the `[data-hour-strip] …` rule, add:

```css
[data-last-viewed] {
  @apply inset-ring-primary inset-ring-2;
}

[data-last-label] {
  display: none;
}

[data-last-viewed] [data-last-label] {
  display: inline;
}

@keyframes last-viewed-flash {
  from {
    background-color: color-mix(in oklab, var(--primary) 35%, transparent);
  }
}

@media (prefers-reduced-motion: no-preference) {
  [data-last-viewed] {
    animation: last-viewed-flash 600ms cubic-bezier(0.2, 0, 0, 1);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm nx e2e personal-memories-e2e -- --grep "marks, focuses|lands on the later day|moves the mark|month row you came from|different month lands|keys: j and k|transition"`
Expected: PASS.

- [ ] **Step 5: Look at it**

With the dev server from Task 3 step 7, open `/day/2025-11-03`, press `Esc`, and check the
11/3 cell in light and dark at 1440 and 390: primary inset ring, 「上次看到」 in the desktop
cell's top row, one soft flash, and the focus ring still visible outside the mark. Emulate
reduced motion and confirm there is no flash.

- [ ] **Step 6: Lint, types and comment audit**

Run: `pnpm nx run-many -t lint typecheck -p personal-memories personal-memories-e2e`
Run: `pnpm nx test personal-memories -- src/contract.test.ts`
Run: `git diff -U0 | grep -E '^\+\s*(//|/\*|\*|#|<!--)'`
Expected: PASS, no comment hits.

- [ ] **Step 7: Commit**

```bash
git add apps/personal-memories/src/scripts/zoom.ts apps/personal-memories/src/styles/global.css \
  apps/personal-memories/src/components/month/MonthCellBody.astro \
  apps/personal-memories/src/components/Heatmap.astro \
  apps/personal-memories-e2e/src/timeline.spec.ts apps/personal-memories-e2e/src/navigation.spec.ts
git commit -m "$(cat <<'EOF'
feat(personal-memories): mark and focus the day you came back from

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm
EOF
)"
```

---

### Task 5: The back link moves into the app bar

**Files:**

- Modify: `apps/personal-memories/src/lib/nav.ts` (add `BackLink`, `monthBack`)
- Modify: `apps/personal-memories/src/lib/nav.test.ts`
- Modify: `apps/personal-memories/src/components/chrome/useChrome.ts:1-74`
- Modify: `apps/personal-memories/src/components/chrome/TopBar.tsx:24-40`, `:89-104`
- Modify: `apps/personal-memories/src/components/chrome/AppBar.tsx:22-30`
- Modify: `apps/personal-memories/src/pages/day/[date].astro:62-64`
- Modify: `apps/personal-memories-e2e/src/navigation.spec.ts`

**Interfaces:**

- Consumes: `monthOf` from `src/lib/months.ts`; `useActiveDay` (unchanged).
- Produces: `type BackLink = { href: string; label: string; ariaLabel: string }` and
  `monthBack(date: string): BackLink` from `src/lib/nav.ts`; `useChrome` returns `back:
BackLink | undefined`; `TopBar` takes `back?: BackLink | undefined`.

- [ ] **Step 1: Write the failing tests**

In `apps/personal-memories/src/lib/nav.test.ts`, extend the import to
`import { levelHrefs, monthBack, placeOf, zoomOutHref } from './nav.ts';` and add:

```ts
describe('monthBack', () => {
  it('names the month of the day without a leading zero and points at it', () => {
    expect(monthBack('2025-11-03')).toEqual({
      href: '/month/2025-11',
      label: '← 11 月',
      ariaLabel: '回到 11 月',
    });
    expect(monthBack('2026-01-09')).toEqual({
      href: '/month/2026-01',
      label: '← 1 月',
      ariaLabel: '回到 1 月',
    });
  });

  it('goes where Escape goes', () => {
    expect(monthBack('2025-10-31').href).toBe(
      zoomOutHref({ level: 'day', date: '2025-10-31' }),
    );
  });
});
```

Append to `apps/personal-memories-e2e/src/navigation.spec.ts`:

```ts
test('the app bar leads a day with a link back to its month, following the day in view', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  await waitForAppBarReady(page);
  await expect(page.getByRole('link', { name: '← 全部日子' })).toHaveCount(0);
  const november = page.getByRole('link', { name: '回到 11 月' });
  await expect(november).toHaveText('← 11 月');
  await expect(november).toHaveAttribute('href', '/month/2025-11');

  await page
    .locator('[data-event-id]', { hasText: 'Busy message 31' })
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect(page).toHaveURL(/\/day\/2025-10-31$/);
  const october = page.getByRole('link', { name: '回到 10 月' });
  await expect(october).toHaveAttribute('href', '/month/2025-10');
  await expect(october).toBeInViewport();
});

test('the back link lands on the day in view like Escape does', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  await waitForAppBarReady(page);
  await scrollToDay(page, '2025-11-03');
  await page.getByRole('link', { name: '回到 11 月' }).click();
  await expect(page).toHaveURL(/\/month\/2025-11$/);
  const cell = visibleCell(page, '2025-11-03');
  await expect(cell).toHaveAttribute('data-last-viewed', '');
  await expect(cell).toBeFocused();
});

test('on a phone the back link fits in the app bar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/day/2025-11-02');
  await waitForAppBarReady(page);
  await expect(page.getByRole('link', { name: '回到 11 月' })).toBeInViewport({
    ratio: 1,
  });
  await expect(
    page.locator('header').first().getByText('回憶', { exact: true }),
  ).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm nx test personal-memories -- src/lib/nav.test.ts`
Expected: FAIL. `monthBack` is not exported.

Run: `pnpm nx e2e personal-memories-e2e -- --grep "back link|link back to its month"`
Expected: FAIL. 「← 全部日子」 is still there and there is no 「回到 11 月」 link.

- [ ] **Step 3: Implement**

Append to `apps/personal-memories/src/lib/nav.ts`:

```ts
export type BackLink = { href: string; label: string; ariaLabel: string };

export function monthBack(date: string): BackLink {
  const month = Number(date.slice(5, 7));
  return {
    href: `/month/${monthOf(date)}`,
    label: `← ${month} 月`,
    ariaLabel: `回到 ${month} 月`,
  };
}
```

In `apps/personal-memories/src/components/chrome/useChrome.ts`, change the nav import to
`import { type Level, levelHrefs, monthBack, type Place } from '../../lib/nav.ts';`, add after the
`hrefs` constant:

```ts
const back =
  place.level === 'day' ? monthBack(active ?? place.date) : undefined;
```

and return `back` too:
`return { hrefs, back, step, jumpOpen, setJumpOpen, keysOpen, setKeysOpen, days };`

In `apps/personal-memories/src/components/chrome/TopBar.tsx`, change the type import to
`import type { BackLink, Level } from '../../lib/nav.ts';`, add `back?: BackLink | undefined;` to
`Props`, destructure `back` in `TopBar`, and replace the wordmark link

```tsx
<a href="/" className="text-heading font-semibold">
  回憶
</a>
```

with:

```tsx
<a
  href="/"
  className={cn('text-heading font-semibold', back && 'max-sm:hidden')}
>
  回憶
</a>;
{
  back && (
    <a
      href={back.href}
      aria-label={back.ariaLabel}
      className={cn(
        buttonVariants({ variant: 'ghost', size: 'sm' }),
        'tabular-nums',
      )}
    >
      {back.label}
    </a>
  );
}
```

In `apps/personal-memories/src/components/chrome/AppBar.tsx`, pass `back={chrome.back}` to
`TopBar`.

In `apps/personal-memories/src/pages/day/[date].astro`, delete:

```astro
<nav class="mb-4 text-sm">
  <a href="/" class="text-muted-foreground hover:underline">← 全部日子</a>
</nav>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm nx test personal-memories -- src/lib/nav.test.ts`
Run: `pnpm nx e2e personal-memories-e2e -- --grep "back link|link back to its month|tabs follow the day|sticky day header"`
Expected: PASS.

- [ ] **Step 5: Lint, types and comment audit**

Run: `pnpm nx run-many -t lint typecheck -p personal-memories personal-memories-e2e`
Run: `git diff -U0 | grep -E '^\+\s*(//|/\*|\*|#|<!--)'`
Expected: PASS, no comment hits.

- [ ] **Step 6: Commit**

```bash
git add apps/personal-memories/src/lib/nav.ts apps/personal-memories/src/lib/nav.test.ts \
  apps/personal-memories/src/components/chrome/useChrome.ts \
  apps/personal-memories/src/components/chrome/TopBar.tsx \
  apps/personal-memories/src/components/chrome/AppBar.tsx \
  "apps/personal-memories/src/pages/day/[date].astro" \
  apps/personal-memories-e2e/src/navigation.spec.ts
git commit -m "$(cat <<'EOF'
feat(personal-memories): lead the day app bar with a link back to its month

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm
EOF
)"
```

---

### Task 6: Previews on the year and the month

**Files:**

- Move: `apps/personal-memories/src/components/year/DayPreview.astro` →
  `apps/personal-memories/src/components/DayPreview.astro` (`git mv`), then modify it
- Create: `apps/personal-memories/src/lib/hover-preview.ts`
- Create: `apps/personal-memories/src/lib/hover-preview.test.ts`
- Create: `apps/personal-memories/src/scripts/previews.ts`
- Modify: `apps/personal-memories/src/components/Heatmap.astro` (import path, `data-preview-cell`)
- Modify: `apps/personal-memories/src/components/month/MonthCalendar.astro` (whole file)
- Modify: `apps/personal-memories/src/styles/global.css:121-175`
- Modify: `apps/personal-memories/src/styles/preview-css.test.ts:31-38`
- Modify: `apps/personal-memories/src/layouts/Layout.astro` (module script)
- Modify: `apps/personal-memories-e2e/src/timeline.spec.ts:45-92` (the two preview tests)
- Modify: `apps/personal-memories-e2e/src/navigation.spec.ts`

**Interfaces:**

- Consumes: `LONG_PRESS_MS` (450), `movedBeyond(a, b, tolerance)`, `Point` from
  `src/lib/gestures.ts`; `startZoom(focus)` (Task 4); `openPreview()` (Task 1).
- Produces:
  - From `src/lib/hover-preview.ts`: `PREVIEW_SHOW_MS = 300`, `PREVIEW_HIDE_MS = 80`,
    `PREVIEW_MOVE_PX = 8`, `PREVIEW_MARGIN_PX = 8`, `type Box`, `type Size`,
    `showDelay(warm: boolean): number`,
    `placePreview(cell: Box, preview: Size, viewport: Size): { top: number; left: number }`.
  - From `src/scripts/previews.ts`: `startPreviews(): void`,
    `focusWithoutPreview(el: HTMLElement): void`.
  - Markup: every cell that owns a preview carries `data-preview-cell` and an `anchor-name`
    (`--dYYYYMMDD` year, `--mYYYYMMDD` month grid, `--lYYYYMMDD` month list); its
    `[data-preview]` child is `popover="hint"`.

- [ ] **Step 1: Write the failing unit tests**

Create `apps/personal-memories/src/lib/hover-preview.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { movedBeyond } from './gestures.ts';
import {
  PREVIEW_HIDE_MS,
  PREVIEW_MOVE_PX,
  placePreview,
  showDelay,
} from './hover-preview.ts';

describe('showDelay', () => {
  it('waits 300 ms for a first hover and shows at once while moving between cells', () => {
    expect(showDelay(false)).toBe(300);
    expect(showDelay(true)).toBe(0);
    expect(PREVIEW_HIDE_MS).toBe(80);
  });
});

describe('long press tolerance', () => {
  it('cancels once the finger moves more than 8 px', () => {
    expect(movedBeyond({ x: 0, y: 0 }, { x: 5, y: 6 }, PREVIEW_MOVE_PX)).toBe(
      false,
    );
    expect(movedBeyond({ x: 0, y: 0 }, { x: 6, y: 6 }, PREVIEW_MOVE_PX)).toBe(
      true,
    );
  });
});

describe('placePreview', () => {
  const viewport = { width: 390, height: 844 };
  const size = { width: 224, height: 120 };
  const cell = (top: number, left: number, height = 24) => ({
    top,
    left,
    width: 24,
    height,
  });

  it('centres the preview above the cell with an 8 px gap', () => {
    expect(placePreview(cell(400, 150), size, viewport)).toEqual({
      top: 272,
      left: 50,
    });
  });

  it('drops below the cell when there is no room above', () => {
    expect(placePreview(cell(60, 150), size, viewport).top).toBe(92);
  });

  it('keeps 8 px inside the viewport at every edge', () => {
    expect(placePreview(cell(400, 0), size, viewport).left).toBe(8);
    expect(placePreview(cell(400, 380), size, viewport).left).toBe(158);
    expect(placePreview(cell(830, 150), size, viewport).top).toBe(702);
    expect(
      placePreview(cell(800, 150, 60), { width: 224, height: 900 }, viewport)
        .top,
    ).toBe(8);
  });
});
```

In `apps/personal-memories/src/styles/preview-css.test.ts`, replace the
`'falls back to an absolute position above the cell everywhere else'` test with:

```ts
it('leaves the position to script where position-area is missing', () => {
  const fallback = block('not (position-area: top)');
  expect(fallback).toMatch(/\[data-preview\]/);
  expect(fallback).toMatch(/position:\s*fixed/);
  expect(fallback).not.toMatch(/bottom:/);
});

it('shows a preview only as an open popover, never from :hover or :focus-visible', () => {
  expect(css).toMatch(/\[data-preview\]:popover-open\s*\{\s*display:\s*flex;/);
  expect(css).not.toMatch(/:hover\s*>\s*\[data-preview\]/);
  expect(css).not.toMatch(/:focus-visible\s*>\s*\[data-preview\]/);
});
```

Run: `pnpm nx test personal-memories -- src/lib/hover-preview.test.ts src/styles/preview-css.test.ts`
Expected: FAIL. `hover-preview.ts` does not exist; the CSS still has the `:hover` rule and the
absolute fallback.

- [ ] **Step 2: Write the failing e2e tests**

In `apps/personal-memories-e2e/src/timeline.spec.ts`:

- In `the served CSS keeps both the anchored preview and its fallback`, replace the four
  `fallback?.text` expectations with:

  ```ts
  expect(fallback?.text).toMatch(/position: fixed/);
  expect(fallback?.text).not.toMatch(/bottom:/);
  ```

- In `a heat cell previews its day above it on hover and on keyboard focus`, replace the last
  two lines (`await page.keyboard.press('Escape');` and `await expect(preview).toBeHidden();`)
  with:

  ```ts
  await page.keyboard.press('Escape');
  await expect(preview).toBeHidden();
  await expect(cell).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(cell).not.toBeFocused();
  ```

Append to `apps/personal-memories-e2e/src/navigation.spec.ts`:

```ts
test('a month cell previews its day after a short hover, at once while moving on, and on keyboard focus', async ({
  page,
}) => {
  await page.goto('/month/2025-11');
  await waitForAppBarReady(page);
  const cell = visibleCell(page, '2025-11-03');
  const preview = cell.locator('[data-preview]');
  await cell.hover();
  expect(await preview.isVisible()).toBe(false);
  await expect(preview).toBeVisible();
  await expect(preview).toBeInViewport({ ratio: 1 });
  await expect(preview).toContainText('2025-11-03（週一）');
  await expect(preview).toContainText('「New week, new plans」');
  const [c, p] = await Promise.all([cell.boundingBox(), preview.boundingBox()]);
  expect(c && p && (p.y + p.height <= c.y || p.y >= c.y + c.height)).toBe(true);

  const neighbour = visibleCell(page, '2025-11-02');
  await neighbour.hover();
  expect(await neighbour.locator('[data-preview]').isVisible()).toBe(true);
  await expect(preview).toBeHidden();

  await page.mouse.move(0, 0);
  await expect(neighbour.locator('[data-preview]')).toBeHidden();

  await neighbour.focus();
  await page.keyboard.press('ArrowRight');
  await expect(cell).toBeFocused();
  await expect(preview).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(preview).toBeHidden();
  await expect(page).toHaveURL(/\/month\/2025-11$/);
  await expect(cell).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
});

test('arriving by Escape focuses the day without opening its preview', async ({
  page,
}) => {
  await page.goto('/day/2025-11-03');
  await waitForAppBarReady(page);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/month\/2025-11$/);
  await expect(visibleCell(page, '2025-11-03')).toBeFocused();
  await expect(page.locator('[data-preview]:popover-open')).toHaveCount(0);
});

test.describe('previews on touch', () => {
  test.use({ hasTouch: true });

  const touch = async (page: Page) => {
    const cdp = await page.context().newCDPSession(page);
    return (
      type: 'touchStart' | 'touchMove' | 'touchEnd',
      touchPoints: { x: number; y: number; id: number }[],
    ) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  };

  const centre = async (page: Page, date: string) => {
    const box = await visibleCell(page, date).boundingBox();
    if (!box) throw new Error(`no box for ${date}`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
  };

  test('a long press shows the preview without opening the day, and the next tap closes it', async ({
    page,
  }) => {
    await page.goto('/month/2025-11');
    await waitForAppBarReady(page);
    const send = await touch(page);
    const preview = visibleCell(page, '2025-11-03').locator('[data-preview]');
    await send('touchStart', [await centre(page, '2025-11-03')]);
    await page.waitForTimeout(600);
    await expect(preview).toBeVisible();
    await send('touchEnd', []);
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/month\/2025-11$/);
    await expect(preview).toBeVisible();

    await page.touchscreen.tap(20, 400);
    await expect(preview).toBeHidden();
    await expect(page).toHaveURL(/\/month\/2025-11$/);

    await visibleCell(page, '2025-11-02').tap();
    await expect(page).toHaveURL(/\/day\/2025-11-02$/);
  });

  test('a finger that moves before the long press fires shows nothing', async ({
    page,
  }) => {
    await page.goto('/month/2025-11');
    await waitForAppBarReady(page);
    const send = await touch(page);
    const start = await centre(page, '2025-11-03');
    await send('touchStart', [start]);
    await send('touchMove', [{ ...start, x: start.x + 20 }]);
    await page.waitForTimeout(600);
    await send('touchEnd', []);
    await expect(page.locator('[data-preview]:popover-open')).toHaveCount(0);
  });
});
```

Run: `pnpm nx e2e personal-memories-e2e -- --grep "preview"`
Expected: FAIL. Month cells have no preview; `Esc` on a focused heat cell blurs at once.

- [ ] **Step 3: Implement the pure rules**

Create `apps/personal-memories/src/lib/hover-preview.ts`:

```ts
export const PREVIEW_SHOW_MS = 300;
export const PREVIEW_HIDE_MS = 80;
export const PREVIEW_MOVE_PX = 8;
export const PREVIEW_MARGIN_PX = 8;

export type Box = { top: number; left: number; width: number; height: number };
export type Size = { width: number; height: number };

export const showDelay = (warm: boolean) => (warm ? 0 : PREVIEW_SHOW_MS);

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

export function placePreview(
  cell: Box,
  preview: Size,
  viewport: Size,
): { top: number; left: number } {
  const m = PREVIEW_MARGIN_PX;
  const above = cell.top - m - preview.height;
  const top = above >= m ? above : cell.top + cell.height + m;
  return {
    top: clamp(top, m, viewport.height - preview.height - m),
    left: clamp(
      cell.left + cell.width / 2 - preview.width / 2,
      m,
      viewport.width - preview.width - m,
    ),
  };
}
```

Run: `pnpm nx test personal-memories -- src/lib/hover-preview.test.ts`
Expected: PASS.

- [ ] **Step 4: Make the previews popovers on both grids**

Run: `git mv apps/personal-memories/src/components/year/DayPreview.astro apps/personal-memories/src/components/DayPreview.astro`

In `apps/personal-memories/src/components/DayPreview.astro`, change the import paths from
`../../lib/…` to `../lib/…`, and add `popover="hint"` after `data-preview` on the root `span`.

In `apps/personal-memories/src/components/Heatmap.astro`, change the import to
`import DayPreview from './DayPreview.astro';` (sorted position) and add `data-preview-cell` after
`data-heat-cell` on both the day `<a>` and the empty-day `<span role="img">`.

Replace `apps/personal-memories/src/components/month/MonthCalendar.astro` with:

```astro
---
import type { MonthCell, MonthView } from '../../lib/month-view.ts';
import { dayHeading, WEEKDAYS_ZH } from '../../lib/weeks.ts';
import { morphAttrs } from '../../lib/zoom.ts';
import DayPreview from '../DayPreview.astro';
import MonthCellBody from './MonthCellBody.astro';

type Props = { view: MonthView; morph?: string | undefined };

const { view, morph } = Astro.props;
const FOCUS =
  'focus-visible:ring-ring focus-visible:ring-offset-background outline-none focus-visible:ring-2 focus-visible:ring-offset-2';
const detail = (c: MonthCell) => `${c.total} 則${c.noted ? ' · 已寫回憶' : ''}`;
const label = (c: MonthCell) => `${dayHeading(c.date)}，${detail(c)}`;
const days = view.weeks.flat().filter((c): c is MonthCell => c !== null);
const stop = days.filter((c) => c.total > 0).at(-1)?.date;
const monthKey = `month-${view.month}`;
const anchorOf = (c: MonthCell, layout: 'cell' | 'row') =>
  `--${layout === 'cell' ? 'm' : 'l'}${c.date.replaceAll('-', '')}`;
const cellAttrs = (c: MonthCell, layout: 'cell' | 'row') => {
  const { style, ...rest } = morphAttrs(`day-${c.date}`, morph);
  return {
    ...rest,
    style: [`anchor-name: ${anchorOf(c, layout)}`, style]
      .filter(Boolean)
      .join('; '),
  };
};
---

<section
  data-month={view.month}
  data-morph={monthKey}
  tabindex="-1"
  class="outline-none"
  {...morphAttrs(monthKey, morph)}
>
  <div class="hidden sm:block">
    <div
      aria-hidden="true"
      class="text-muted-foreground mb-2 grid grid-cols-7 gap-2 text-xs"
    >
      {WEEKDAYS_ZH.map((d) => <span class="px-2">{d}</span>)}
    </div>
    <ol data-grid="week" class="grid grid-cols-7 gap-2">
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
                  data-preview-cell
                  tabindex={cell.date === stop ? 0 : -1}
                  aria-label={label(cell)}
                  class:list={[
                    'bg-card ring-border hover:bg-accent/65 h-29 relative flex flex-col overflow-hidden rounded-lg ring-1',
                    FOCUS,
                  ]}
                  {...cellAttrs(cell, 'cell')}
                >
                  <MonthCellBody cell={cell} layout="cell" />
                  <DayPreview
                    date={cell.date}
                    detail={detail(cell)}
                    anchor={anchorOf(cell, 'cell')}
                    cell={cell}
                  />
                </a>
              ) : (
                <div
                  data-date={cell.date}
                  class="ring-border text-muted-foreground text-meta h-29 rounded-lg p-2 tabular-nums ring-1 ring-inset"
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
  <ol data-grid="list" class="divide-border flex flex-col divide-y sm:hidden">
    {
      days.map((cell) =>
        cell.total > 0 ? (
          <li>
            <a
              href={`/day/${cell.date}`}
              data-date={cell.date}
              data-morph={`day-${cell.date}`}
              data-preview-cell
              tabindex={cell.date === stop ? 0 : -1}
              aria-label={label(cell)}
              class:list={[
                'grid h-16 grid-cols-[40px_52px_1fr_auto] items-center gap-2',
                FOCUS,
              ]}
              {...cellAttrs(cell, 'row')}
            >
              <MonthCellBody cell={cell} layout="row" />
              <DayPreview
                date={cell.date}
                detail={detail(cell)}
                anchor={anchorOf(cell, 'row')}
                cell={cell}
              />
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

In `apps/personal-memories/src/styles/global.css`, replace everything from `[data-preview] {`
(the `display: none;` rule) through the end of the `@supports not (position-area: top)` block
with:

```css
[data-preview] {
  inset: auto;
  margin: 0;
}

[data-preview]:popover-open {
  display: flex;
}

@media (pointer: coarse) {
  [data-preview-cell] {
    -webkit-touch-callout: none;
    user-select: none;
  }
}

@supports (position-area: top) {
  [data-preview] {
    position: fixed;
    position-area: top;
    margin-block: var(--app-bar-h) 0.5rem;
    position-try-fallbacks:
      --below, --above-right, --below-right, --above-left, --below-left;
  }

  @position-try --below {
    position-area: bottom;
    margin-block: 0.5rem 0;
  }

  @position-try --above-right {
    position-area: top span-right;
  }

  @position-try --below-right {
    position-area: bottom span-right;
    margin-block: 0.5rem 0;
  }

  @position-try --above-left {
    position-area: top span-left;
  }

  @position-try --below-left {
    position-area: bottom span-left;
    margin-block: 0.5rem 0;
  }
}

@supports not (position-area: top) {
  [data-preview] {
    position: fixed;
  }
}
```

- [ ] **Step 5: Implement the controller**

Create `apps/personal-memories/src/scripts/previews.ts`:

```ts
import { LONG_PRESS_MS, movedBeyond, type Point } from '../lib/gestures.ts';
import {
  PREVIEW_HIDE_MS,
  PREVIEW_MOVE_PX,
  placePreview,
  showDelay,
} from '../lib/hover-preview.ts';

const CELL = '[data-preview-cell]';

type Timer = ReturnType<typeof setTimeout>;

let open: HTMLElement | undefined;
let pinned = false;
let showTimer: Timer | undefined;
let hideTimer: Timer | undefined;
let quiet: Element | undefined;
let press: { cell: HTMLElement; start: Point; timer: Timer } | undefined;
let swallow: HTMLElement | undefined;

const cellOf = (target: EventTarget | null) =>
  target instanceof Element ? target.closest<HTMLElement>(CELL) : null;

const previewOf = (cell: HTMLElement) =>
  cell.querySelector<HTMLElement>(':scope > [data-preview]');

function cancelTimers() {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
}

function hide() {
  cancelTimers();
  const preview = open && previewOf(open);
  open = undefined;
  pinned = false;
  if (preview?.matches(':popover-open')) preview.hidePopover();
}

function show(cell: HTMLElement) {
  cancelTimers();
  if (open === cell) return;
  hide();
  const preview = previewOf(cell);
  if (!preview) return;
  preview.showPopover();
  open = cell;
  if (CSS.supports('position-area: top')) return;
  const { top, left } = placePreview(
    cell.getBoundingClientRect(),
    preview.getBoundingClientRect(),
    { width: innerWidth, height: innerHeight },
  );
  preview.style.top = `${top}px`;
  preview.style.left = `${left}px`;
}

function cancelPress() {
  if (press) clearTimeout(press.timer);
  press = undefined;
}

export function focusWithoutPreview(el: HTMLElement) {
  quiet = el;
  el.focus({ preventScroll: true });
  quiet = undefined;
}

export function startPreviews() {
  document.addEventListener(
    'toggle',
    (event) => {
      if (
        event instanceof ToggleEvent &&
        event.newState === 'closed' &&
        open &&
        event.target === previewOf(open)
      ) {
        open = undefined;
        pinned = false;
      }
    },
    true,
  );

  document.addEventListener('pointerover', (event) => {
    if (event.pointerType !== 'mouse') return;
    const cell = cellOf(event.target);
    if (!cell || cell.contains(event.relatedTarget as Node | null)) return;
    if (cell === open) return clearTimeout(hideTimer);
    clearTimeout(showTimer);
    const delay = showDelay(open !== undefined);
    if (delay === 0) show(cell);
    else showTimer = setTimeout(() => show(cell), delay);
  });

  document.addEventListener('pointerout', (event) => {
    if (event.pointerType !== 'mouse') return;
    const cell = cellOf(event.target);
    if (!cell || cell.contains(event.relatedTarget as Node | null)) return;
    clearTimeout(showTimer);
    if (cell === open && !pinned) hideTimer = setTimeout(hide, PREVIEW_HIDE_MS);
  });

  document.addEventListener('focusin', (event) => {
    const cell = cellOf(event.target);
    if (!cell || cell !== event.target || cell === quiet) return;
    if (cell.matches(':focus-visible')) show(cell);
  });

  document.addEventListener('focusout', (event) => {
    const cell = cellOf(event.target);
    if (cell && cell === open && !pinned && !cell.matches(':hover')) hide();
  });

  document.addEventListener(
    'pointerdown',
    (event) => {
      swallow = undefined;
      if (pinned) hide();
      if (event.pointerType !== 'touch') return;
      const cell = cellOf(event.target);
      if (!cell) return;
      press = {
        cell,
        start: { x: event.clientX, y: event.clientY },
        timer: setTimeout(() => {
          press = undefined;
          show(cell);
          pinned = true;
          swallow = cell;
        }, LONG_PRESS_MS),
      };
    },
    true,
  );

  document.addEventListener(
    'pointermove',
    (event) => {
      if (
        press &&
        event.pointerType === 'touch' &&
        movedBeyond(
          press.start,
          { x: event.clientX, y: event.clientY },
          PREVIEW_MOVE_PX,
        )
      )
        cancelPress();
    },
    { passive: true },
  );
  document.addEventListener('pointerup', cancelPress, true);
  document.addEventListener('pointercancel', cancelPress, true);

  document.addEventListener(
    'contextmenu',
    (event) => {
      if (press || (pinned && cellOf(event.target) === open))
        event.preventDefault();
    },
    true,
  );

  document.addEventListener(
    'click',
    (event) => {
      if (swallow && cellOf(event.target) === swallow) {
        event.preventDefault();
        event.stopPropagation();
      }
      swallow = undefined;
    },
    true,
  );

  if (!CSS.supports('position-area: top'))
    addEventListener(
      'scroll',
      () => {
        if (open) hide();
      },
      { capture: true, passive: true },
    );
}
```

In `apps/personal-memories/src/layouts/Layout.astro`, replace the module script at the end of
`body` with:

```astro
<script>
  import { focusWithoutPreview, startPreviews } from '../scripts/previews.ts';
  import { startShortcuts } from '../scripts/shortcuts.ts';
  import { startZoom } from '../scripts/zoom.ts';
  startShortcuts();
  startZoom(focusWithoutPreview);
  startPreviews();
</script>
```

- [ ] **Step 6: Run the unit tests**

Run: `pnpm nx test personal-memories -- src/lib/hover-preview.test.ts src/styles/preview-css.test.ts src/contract.test.ts`
Expected: PASS.

- [ ] **Step 7: Run the e2e tests**

Run: `pnpm nx e2e personal-memories-e2e -- --grep "preview|served CSS|long press|finger that moves"`
Expected: PASS: the year preview test, the served-CSS test, the month hover/focus/`Esc` test,
the arrival test and both touch tests.

Run: `pnpm nx e2e personal-memories-e2e -- --grep "month calendar shows each day"`
Expected: PASS. Cell text assertions still hold with the hidden preview inside the link.

- [ ] **Step 8: Dev server check, lint, types and comment audit**

With the dev server from Task 3 step 7, load `/` and `/month/2025-11` and confirm: a hover
preview is not clipped by the month cell (`overflow-hidden`), it follows the cell when the year
grid scrolls sideways, and the console is clean. Stop the server.

Run: `pnpm nx run-many -t lint typecheck -p personal-memories personal-memories-e2e`
Run: `git diff -U0 | grep -E '^\+\s*(//|/\*|\*|#|<!--)'`
Expected: PASS, no comment hits.

- [ ] **Step 9: Commit**

```bash
git add apps/personal-memories/src/components/year/DayPreview.astro \
  apps/personal-memories/src/components/DayPreview.astro \
  apps/personal-memories/src/lib/hover-preview.ts apps/personal-memories/src/lib/hover-preview.test.ts \
  apps/personal-memories/src/scripts/previews.ts apps/personal-memories/src/components/Heatmap.astro \
  apps/personal-memories/src/components/month/MonthCalendar.astro \
  apps/personal-memories/src/styles/global.css apps/personal-memories/src/styles/preview-css.test.ts \
  apps/personal-memories/src/layouts/Layout.astro \
  apps/personal-memories-e2e/src/timeline.spec.ts apps/personal-memories-e2e/src/navigation.spec.ts
git commit -m "$(cat <<'EOF'
feat(personal-memories): preview days on the month and on touch

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm
EOF
)"
```

---

### Task 7: Full verification, evidence and PR

**Files:**

- Modify: only files a finding points at, each already listed by Tasks 1-6.

**Interfaces:**

- Consumes: everything above; `nav-visual.spec.ts` (Task 1) and the `before-*.png` captures.
- Produces: the draft PR.

- [ ] **Step 1: Full verification**

Run: `pnpm nx run-many -t lint test typecheck -p personal-memories personal-memories-e2e`
then `pnpm nx e2e personal-memories-e2e`
Expected: PASS, with the `v2c visual` and `nav visual` tests skipped.

- [ ] **Step 2: Dev server check**

Run `pnpm nx dev personal-memories` against the fixture data and a temp notes dir, load `/`,
`/month/2025-11` and `/day/2025-11-01`, and confirm each renders with no console error.

- [ ] **Step 3: Production copy of the head script**

```bash
pnpm nx build personal-memories
NOTES=$(mktemp -d)
MEMORIES_DATA_DIR="$PWD/apps/personal-memories-e2e/test-output/fixture-data" \
  MEMORIES_NOTES_DIR="$NOTES" HOST=127.0.0.1 PORT=3099 \
  node apps/personal-memories/dist/server/entry.mjs &
SERVER=$!
until curl -sf http://127.0.0.1:3099/ >/dev/null; do sleep 0.5; done
curl -s http://127.0.0.1:3099/month/2025-11 | node -e "
  const html = require('node:fs').readFileSync(0, 'utf8');
  const script = html.match(/<script>(\(function installReveal[\s\S]*?)<\/script>/)?.[1];
  if (!script) throw new Error('reveal script missing');
  new Function(script);
  if (/__name|__vite_ssr/.test(script)) throw new Error('outer reference in reveal script');
  console.log('reveal script parses');
"
kill $SERVER
```

Expected: `reveal script parses`. Anything else is a blocker: report it.

- [ ] **Step 4: Back/forward cache check in a real browser**

Playwright turns the back/forward cache off, so check it by hand in desktop Chrome against the
dev server: open `/month/2025-11`, click 11/1, scroll the stream to 11/3, press the browser's
Back. In DevTools → Application → Back/forward cache, confirm the month page was restored from
the cache, and that 11/3 is the only marked cell and has focus. Repeat once with Forward then
Back. If the mark is stale, fix `startZoom`'s `pageshow` path in `src/scripts/zoom.ts`.

- [ ] **Step 5: After-captures and comparison**

Run: `NAV_VISUAL=after pnpm nx e2e personal-memories-e2e -- --grep "nav visual"`
Read each `after-*.png` next to its `before-*.png` in
`apps/personal-memories-e2e/test-output/nav/`, light and dark, 1440 and 390: the month after
`Esc` shows the ring and 「上次看到」, the year after `Esc` rings the 11 月 row, the day app bar
shows 「← 11 月」 and fits at 390, and previews sit clear of their cell in both schemes. Fix any
defect in the owning file.

- [ ] **Step 6: Token and comment audit**

Run: `pnpm nx test personal-memories -- src/contract.test.ts`
Run: `git diff origin/main -U0 -- apps/personal-memories apps/personal-memories-e2e | grep -E '^\+\s*(//|/\*|\*|#|<!--)'`
Expected: the contract test passes; each comment hit is on the allow-list (the two
serialisation lines and the `pagereveal` line from Task 3).

- [ ] **Step 7: Open the draft PR**

Use the `rainforest-core:create-pr` skill. Title:
`feat(personal-memories): navigation, back, previews and keyboard`. The body names the spec and
this plan, lists plan decisions P1-P12, and states the bfcache check result from step 4. Attach
the before/after captures from `apps/personal-memories-e2e/test-output/nav/` with
`rainforest-core:attach-pr-media`, paired by surface, scheme and width, labelled before/after
(previews on the month are after-only: the before state had none). Keep the PR a draft. Do not
commit the captures.

## Self-review

- Spec coverage: problem 1 and decision 2 → Task 3 (morph) and Task 4 (mark, focus); decision 3
  → Task 4; decision 4 → Task 1; decision 5 → Task 1 (`gridTarget`, keys) and Task 4 (keys
  from the marked cell); decision 6 → Task 1 (`close-preview` first) and Task 6 (e2e order);
  decision 7 → Task 6; decision 8 → Task 5; decision 9 → Task 2; problem 3 → Task 5; problem 4
  → Task 6. Testing section: unit tests for the ↑/↓ picker (Task 1), the shortcut table
  (Tasks 1, 2), the back-link label (Task 5); every listed e2e case is in Tasks 1, 3, 4, 5 and
  6; the 1440/390 light/dark check with before/after evidence is Task 1 step 1 and Task 7
  step 5. Out of scope items are untouched.
- Placeholders: none; every code step carries its code.
- Types: `GridKey`/`GridLayout`/`gridTarget` (Task 1) are used by the same names in
  `roving.ts` and `shortcuts.ts`; `revealKey(from, here, deps)` (Task 3) is called with
  `{ placeOf, morphKey }` in Task 4; `REVEAL_STYLE_ID` in Tasks 3 and 4; `setStop` in Tasks 1
  and 4; `startZoom(focus)` (Task 4) receives `focusWithoutPreview` (Task 6); `BackLink` and
  `monthBack` (Task 5) in `nav.ts`, `useChrome.ts` and `TopBar.tsx`; `openPreview` (Task 1) in
  `scripts/shortcuts.ts`.
- Review Focus: each of the five lines has its test in the owning task (Task 4 step 1, Task 3
  steps 1 and 5, Task 6 step 2, Task 1 step 2).
