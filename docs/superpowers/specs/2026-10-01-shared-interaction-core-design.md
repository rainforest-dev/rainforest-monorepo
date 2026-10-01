# Shared interaction core: design

Date: 2026-10-01. Branch `docs/shared-interaction-core`, from `main` at 639cf800.

## Goal

personal-calibre and personal-memories each carry their own copies of the same keyboard machinery:
roving-tabindex grid navigation, a global shortcut runner with typing and modifier guards, and a
row of key hints. This work moves the framework-independent parts into the libraries once, so
rss-manager's redesign starts from them instead of writing a third copy. Behaviour in both apps
stays exactly as it is today; their existing unit and e2e suites are the acceptance test.

## Owner decisions this design follows

Decided 2026-10-01, replacing roadmap item 2 as written on 09-29 ("extract roving grid, KeyHints,
global shortcuts, preview controller, loading and error states"):

- Extract only what two apps already share today: the pure navigation and keyboard-guard core, and
  a presentational `KeyHints`. The preview controller, loading/error compositions and skeletons stay
  in the apps until rss-manager's redesign shows it needs them.
- The core is framework-free so memories' Astro scripts can use it. React-only hooks would not
  serve memories, whose grids are static Astro markup driven by document-level scripts.
- `KeyHints` enters `@rainforest-dev/rainforest-react` as a thin composition of `Kbd` and
  `KbdGroup`. This reverses one line of the 2026-09-30 shadcn-first spec ("`KeyHints` wraps each
  hint's keys in `KbdGroup`. No new component."): shadcn has no key-hints item (its registry has
  only `kbd` and demos), and two named sites now render the same row.
- Both apps listen for global shortcuts in the capture phase on `window`, as memories does today,
  so the runner sees `Escape` before Base UI closes an overlay on it.
- Roadmap: rss-manager's redesign starts with two directions in Claude Design. Whatever it then
  needs beyond this core is extracted at that point, under the shadcn-first rule.

The 2026-09-30 spec's other decisions stand: calibre's `useRovingNav` hook, `LoadError`,
`ViewSkeleton` and `Facet` stay in calibre. Only the pure geometry moves out from under the hook.

## Where the code goes

| Piece                                 | Package                            | Entry                 |
| ------------------------------------- | ---------------------------------- | --------------------- |
| `pickTarget`, nav types               | `@rainforest-dev/rainforest-ui`    | `./interaction` (new) |
| `createRovingController` (DOM)        | `@rainforest-dev/rainforest-ui`    | `./interaction`       |
| keyboard guards, `listenForShortcuts` | `@rainforest-dev/rainforest-ui`    | `./interaction`       |
| `KeyHints`, `KeyHint` type            | `@rainforest-dev/rainforest-react` | root                  |

`./interaction` follows the `./recipes` pattern: source in `libs/rainforest-ui/src/interaction/`,
`interaction` added to the entry glob in `vite.config.ts`
(`src/{lit,utils,recipes,interaction}/**`), and an `./interaction` block in `package.json`
`exports` with `types`/`import`/`default` like `./recipes`. No new dependency.

## `./interaction` API

### Navigation core (`src/interaction/roving.ts`)

```ts
export const NAV_KEYS = [
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
] as const;
export type NavKey = (typeof NAV_KEYS)[number];
export function isNavKey(key: string): key is NavKey;

export interface NavRect {
  left: number;
  top: number;
  width: number;
  height: number;
}
export interface NavItem {
  key: string; // stable id, e.g. calibre's `groupKey:bookId` or memories' ISO date
  row: number; // rows with data only; callers derive it (rects, calendar slots, index)
  order: number; // reading order across the whole page
  col?: number; // logical column, used for ↑/↓ when no rect is given
  rect?: NavRect; // geometry, preferred for ↑/↓ when present
}
export interface PickOptions {
  mode?: 'grid' | 'list'; // default 'grid'
  homeEnd?: 'row' | 'page'; // default 'row'
  ctrl?: boolean; // with homeEnd 'row': Ctrl/Meta+Home/End go to page ends
}
export function pickTarget(
  items: readonly NavItem[],
  current: string | null,
  key: NavKey,
  options?: PickOptions,
): string | null;
export function assignRowsByTop(
  items: readonly Omit<NavItem, 'row'>[],
): NavItem[];
```

Rules, merged from calibre's `pickTarget` and memories' `gridTarget`:

- `←`/`→`: previous/next by `order`. Clamp at the ends (return `null`); never wrap.
- `↑`/`↓` in `grid` mode: the adjacent row that has items, then the nearest item in it.
  - With `rect`: calibre's score, centre-x distance plus 4 × vertical gap.
  - Without `rect`: smallest `|col − current.col|`.
  - Ties go to the lower `order`, which is memories' "earlier date" rule.
  - Only the adjacent row counts, never a closer column two rows down (calibre's existing test).
- `list` mode: `↑`/`↓` step ±1 by `order`; `←`/`→` return `null`.
- `Home`/`End`:
  - `homeEnd: 'row'`: ends of the current row; with `ctrl`, ends of the page (calibre).
  - `homeEnd: 'page'`: ends of the page whatever `ctrl` is (memories).
- If `current` is missing or no longer present, return the first item by `order`.

Callers:

- calibre's `src/lib/roving.ts` becomes a re-export of `pickTarget`, `isNavKey`, `NAV_KEYS` and
  `assignRowsByTop`. `useRovingNav` keeps everything else: `useLibrary()` focus requests, focus
  restore, the Enter/`x`/Space actions. It passes `{ mode, homeEnd: 'row', ctrl }`.
- memories' `src/lib/grid-nav.ts` keeps `GridLayout`, `slotOf` and the date handling, and
  `gridTarget` becomes date items mapped to `{ key, row, col, order }` fed to
  `pickTarget(…, { mode: layout === 'list' ? 'list' : 'grid', homeEnd: 'page' })`.

### DOM controller (`src/interaction/roving-dom.ts`)

```ts
export interface RovingControllerOptions {
  container: HTMLElement;
  items: string; // CSS selector for cells inside the container
  keyOf: (el: HTMLElement) => string;
  rowOf?: (el: HTMLElement) => number; // default: assignRowsByTop over rendered rects
  colOf?: (el: HTMLElement) => number;
  mode?: 'grid' | 'list';
  homeEnd?: 'row' | 'page';
}
export interface RovingController {
  move(key: NavKey, mods?: { ctrl?: boolean }): boolean; // true when focus moved
  setStop(el: HTMLElement): void; // tabIndex 0 here, -1 on the rest
  destroy(): void;
}
export function createRovingController(
  options: RovingControllerOptions,
): RovingController;
```

- It listens for `focusin` on the container and calls `setStop` on the focused cell.
- It focuses with `focus({ preventScroll: true })` then `scrollIntoView({ block: 'nearest' })`, as
  calibre does today. Memories currently calls plain `.focus()`; the e2e suite confirms the switch
  is safe.
- Only rendered cells count (`getClientRects().length > 0`).
- memories' `src/lib/client/roving.ts` (`setStop`, `moveInGrid`) becomes a thin adapter over one
  controller per `[data-grid]`. Calibre keeps its React hook and does not use the DOM controller in
  this work.

### Keyboard guards and runner (`src/interaction/keyboard.ts`)

```ts
export const TYPING_SELECTOR: string; // input, textarea, select, [contenteditable]:not([contenteditable="false"])
export const OVERLAY_SELECTOR: string; // [role=dialog], [role=alertdialog], [role=menu], [data-slot=select-content], [data-slot=popover-content]
export function isTypingTarget(target: EventTarget | null): boolean;
export function isComposing(event: KeyboardEvent): boolean; // isComposing || keyCode === 229
export function isInOverlay(target: EventTarget | null): boolean;
export function hasModifier(
  event: KeyboardEvent,
  keys?: { alt?: boolean },
): boolean; // Ctrl/Meta, and Alt unless alt: false

export function listenForShortcuts(
  handler: (event: KeyboardEvent) => void,
  options?: { target?: Window | Document; capture?: boolean }, // default window, capture true
): () => void; // unsubscribe
```

- `listenForShortcuts` drops events where `isComposing` is true before calling the handler. Calibre
  gains the IME guard it lacks today.
- The resolvers stay in the apps: each app keeps its own `resolveShortcut(KeyInput)`, key table and
  actions.
- Calibre's `useLibraryShortcuts` builds `typing` and `inOverlay` from these helpers and subscribes
  through `listenForShortcuts`. It drops its document bubble-phase listener and its
  `defaultPrevented` check: in the capture phase nothing upstream has handled the event yet, so the
  `typing`/`inOverlay` guards carry that job.
- Memories' `startShortcuts` keeps its `data-overlays` counter, which also covers portalled
  overlays. Its `TYPING` selector and IME check are replaced by the shared helpers.

## `KeyHints` in `@rainforest-dev/rainforest-react`

```tsx
export interface KeyHint {
  keys: readonly string[];
  label: string;
}
export interface KeyHintsProps extends React.ComponentProps<'div'> {
  hints: readonly KeyHint[];
}
export function KeyHints({
  hints,
  className,
  ...props
}: KeyHintsProps): JSX.Element;
```

- The root is `<div data-slot="key-hints" data-key-hints className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground', className)}>`.
- Each hint is a `<span className="inline-flex items-center gap-1.5">` holding a
  `<KbdGroup>{keys.map(k => <Kbd>{k}</Kbd>)}</KbdGroup>` and the label.
- Keys always sit in a `KbdGroup`, even single keys, matching calibre and its e2e check for
  `[data-slot="kbd-group"]`. Memories' e2e only reads labels; confirm it still passes.
- The component does no responsive hiding and no paging filter. Apps pass `className`
  (`hidden lg:flex` in calibre, `hidden sm:flex` in memories) and filter their own lists (calibre's
  `hintsFor(view, paged)`).
- Calibre's `KeyHints.tsx` keeps its sticky wrapper and renders `<KeyHints hints={hintsFor(…)}/>`.
  Memories' `KeyHints.astro` renders the React component statically. `ShortcutRow` becomes an alias
  of `KeyHint`.
- A story `stories/KeyHints.stories.tsx` (title `Display/KeyHints`) with `Default` and a `Dark`
  twin satisfies `src/contract.test.ts`. A `.design-sync/config.json` override skips
  `display-keyhints--dark`, and `conventions.md` gains one line pointing at `KeyHints` for hint rows.
  The Claude Design re-sync runs after merge, as for #418.

## Testing

- `pickTarget`: port both apps' unit suites into `libs/rainforest-ui/src/interaction/roving.test.ts`
  without changing an assertion:
  - calibre `src/lib/roving.test.ts`: rects, rows, grouped rows, duplicates, list mode, Home/End
    with and without Ctrl;
  - memories `src/lib/grid-nav.test.ts`: dates via slots, ties earlier, empty rows, week offsets,
    list.

  The app test files keep testing their adapters (`gridTarget`) through the new core.

- `createRovingController` and the keyboard helpers get jsdom unit tests: setStop, focusin
  tracking, typing and overlay detection, IME, modifiers, unsubscribe.
- `KeyHints` gets a Testing Library test (one `kbd-group` per hint, `data-key-hints` present) plus
  the contract test.
- Acceptance is the existing e2e suites, run unchanged:
  - calibre: `keyboard.spec.ts`, `catalogue.spec.ts`, `shortcuts.spec.ts`,
    `library.phone.spec.ts`, `states.spec.ts`;
  - memories: `navigation.spec.ts`, `timeline.spec.ts`.
- Calibre's Esc order (close the pane, then clear the selection) and the `]]` single page step must
  hold after the switch to the capture phase.

## Rollout

One PR per step, each green on CI before the next:

1. Add `./interaction` to rainforest-ui, with its tests. No app changes.
2. Calibre adopts `pickTarget` and the keyboard helpers, and switches to the capture phase.
3. Memories adopts `pickTarget`, `createRovingController` and the keyboard helpers.
4. Add `KeyHints` to rainforest-react, and both apps adopt it. Re-sync Claude Design after merge.

## Out of scope

- The preview controller (`startPreviews`, `placePreview`, gestures): memories only.
- `LoadError`, `ViewSkeleton`, `BookDetailSkeleton` and memories' sentinel states: they stay app
  compositions of `Alert`, `Skeleton` and `Empty`, per the 2026-09-30 spec.
- Memories' `ShortcutsDialog` and the `?` overlay.
- Calibre's `useRovingNav` focus-restore and action handling.
- rss-manager adoption: it comes with its redesign.
