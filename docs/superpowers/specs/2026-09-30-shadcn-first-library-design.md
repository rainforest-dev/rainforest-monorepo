# Shadcn-first shared library: design

Date: 2026-09-30. Branch `feat/shared-library-components`, from `main` at 7beb546.

## Goal

Personal apps stop carrying handmade UI where a shadcn primitive exists. `libs/rainforest-react`
(`@rainforest-dev/rainforest-react`) gains the shadcn primitives that the apps actually need, the
apps replace their handmade markup with them, and the shared theme's primary pair reaches WCAG AA so
the apps can drop their per-component contrast workarounds. App-specific compositions (Facet,
ViewSkeleton, calibre's roving geometry) stay in the apps.

## Owner decisions this design follows

- Shadcn first. A primitive enters the lib only when a named site in calibre, memories or
  rss-manager replaces handmade markup with it.
- Sources come from the shadcn Base UI registry, copied with a pinned CLI, and adapted to the lib's
  existing conventions. The lib has no `components.json`, so `shadcn add` is not used.
- The contrast fix, its unit test and the revert of calibre's workarounds ship in the same PR.
- Every added primitive gets Storybook stories with a `Dark` twin and a `.design-sync` skip entry.
  The /design-sync upload happens after the owner approves the merge and is not part of this work.

## Versions

From the manifests and `pnpm-lock.yaml`: React 19.2.3, `@base-ui/react` 1.8.0, Tailwind 4.2.2
(catalog) with `@tailwindcss/vite`, Storybook 10.5.3 (`@storybook/react-vite`), Vitest 4.1.4,
`class-variance-authority` 0.7.1, `lucide-react` 1.46.0, TypeScript 6.0.3, Next.js 16.2.11
(calibre), Astro 7.3.3 (rss-manager, memories), Playwright 1.63.0 with `@axe-core/playwright`.
Calibre pins zod 3.25; nothing here touches zod. No dependency is added or upgraded: `merge-props`
and `use-render` are entry points of the installed `@base-ui/react`, and `cva` already lives in
`@rainforest-dev/rainforest-ui`.

## How the existing components were added

Comparing `libs/rainforest-react/src/components/checkbox.tsx` with the registry item
`https://ui.shadcn.com/r/styles/base-nova/checkbox.json` shows the source and the adaptation:

- Flavour: `base-nova` (Base UI primitives, `rounded-[4px]`, `ring-3`, `transition-colors`). The
  `base-vega` and `base-lyra` variants differ exactly where the lib matches nova.
- `cn` comes from `../lib/cn`, which re-exports `@rainforest-dev/rainforest-ui/recipes`.
- `IconPlaceholder lucide="X"` becomes a direct `lucide-react` import of `X`.
- Every `dark:` class is dropped (the contract test forbids them; the tokens switch scheme).
- `disabled:` on a Base UI root becomes `data-disabled:`; the `group-has-*/field` hooks that only
  make sense with the registry's own Field are dropped from Checkbox.
- `cva` recipes live in `libs/rainforest-ui/src/recipes/<name>.ts` with the docstring
  "Class recipe behind `X`." and an exported `XVariantProps` type; the component imports the
  recipe and re-exports it (see `input-group.tsx`, `toggle-group.tsx`).
- One-line docstring on the file's main exported component only; `export type XProps`.
- `'use client'` stays where the registry has it, and is added where the file calls a hook.
- Files: `src/components/<name>.tsx`, exported from `src/index.ts` in alphabetical order.
  Stories: `stories/<Name>.stories.tsx` with `title: '<Group>/<Name>'`, fixture data and a
  `Dark` story using `globals: { scheme: 'dark' }`.

New sources are copied with `pnpm dlx shadcn@4.21.0 view https://ui.shadcn.com/r/styles/base-nova/<name>.json`
(verified 2026-09-30: `view` prints the registry JSON without a `components.json`) and adapted by
the rules above. One more rule applies to the new files: the registry's `cn-font-heading`
placeholder becomes `font-heading`, which the lib already defines in `tailwind.css`.

## Primitive inventory

All five candidates have real sites, so none is dropped. `label` enters as a registry dependency of
`field`.

| Primitive      | Decision                              | Sites that replace handmade markup                                                                                                                                                    |
| -------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spinner`      | add                                   | calibre: add-delivery Save, History remove, bulk Mark delivered and ZIP. rss-manager: `…` in SourceTable Activate/Retire and TopicList Activate/Decline, `Checking…` in FeedValidator |
| `empty`        | add                                   | calibre `EmptyResult`. rss-manager: SourceTable "No sources match", ReadingQueue "No reading queue has been generated yet". memories `EmptyState.astro`                               |
| `field`        | add                                   | calibre add-delivery form (hand-rolled `<label>` + `Input` + `<p role="alert">`)                                                                                                      |
| `label`        | add, as `field`'s registry dependency | used by `FieldLabel`; exported so a plain label can use it                                                                                                                            |
| `button-group` | add                                   | calibre `SortControls` (sort select + direction button), `BulkToolbar` (platform select + Mark delivered, format select + ZIP)                                                        |
| `item`         | add                                   | calibre `DeliveryRows`: the per-platform rows and the History entries                                                                                                                 |

Reasons, one line each:

- `spinner`: calibre and rss-manager show pending actions only by disabling a button or swapping
  its text for `…`; shadcn's pattern is a `Spinner` inside the button with the label kept.
- `empty`: `EmptyResult`, both rss-manager empty regions and memories' no-timeline notice are
  hand-built centred stacks (or an `Alert` standing in for an empty state).
- `field` and `label`: the delivery form hand-wires labels, ids and an error paragraph.
- `button-group`: two controls that act as one (a select and its action) sit side by side in a
  `flex gap-1` div with two separate borders.
- `item`: delivery rows and History entries are hand-built `<li>` flex rows with title, meta and
  an action.

Not adopted: calibre's `ViewSwitch` stays `ToggleGroup`, since a single-choice switch is a toggle
group, not a button group. rss-manager's ReadingQueue sort buttons (`aria-pressed` on Buttons) are
the same shape but are not a candidate here; they can move to `ToggleGroup` later.

### Adaptations specific to the new files

- `item`: `ItemGroup` has `role="list"` and the registry's `Item` has no role, which axe reports as
  `aria-required-children`. The component stays as the registry ships it; callers inside an
  `ItemGroup` pass `role="listitem"`, and `conventions.md` says so. `item` and `button-group` call
  `useRender`, so both get `'use client'`.
- `field`: `FieldError`'s `==` becomes `===`; `useMemo` is called as `React.useMemo`.
- `empty`: `EmptyDescription` is typed `React.ComponentProps<'div'>` because it renders a `div`
  (the registry types it as `p`, which does not typecheck against a `div`).
- `spinner`: adds `motion-reduce:animate-none`, the same treatment `Skeleton` gives its pulse.
- `label`: the `jsx-a11y/label-has-associated-control` suppression carries its reason: callers pass
  `htmlFor` or wrap the control, and the rule cannot see through the prop spread.

## Calibre replacements

### SelectMark becomes the lib Checkbox

`components/views/SelectMark.tsx` renders the lib `Checkbox` with the old contract kept:

- Visibility: hidden until the tile is hovered or keyboard-focused, always shown in select mode
  (`visible`) or when checked. The classes move onto the Checkbox root with `bg-background/90`
  over the cover and `size-5`.
- Selection: `checked` and `onCheckedChange` call `onToggle`; the click stops propagation so the
  tile does not open the book, as today.
- Focus: `tabIndex={-1}` keeps the Shelf at one Tab stop (the roving tile), which the shelf and
  grouped-shelf keyboard specs assert. A mouse press does not focus the checkbox
  (`onMouseDown` prevents default); the click focuses the tile instead, which is where a click on
  the old span put focus, so the roving index stays in sync and Space/`x` keep toggling once.
- Accessible name: the tile is `role="option"` with `aria-label="<title>, <authors>"` and
  `aria-selected`. The old mark was `aria-hidden`, and the checkbox stays `aria-hidden`, so what
  assistive tech hears for a tile does not change. An option's children are presentational, so a
  named checkbox inside it would be flattened and axe would report `nested-interactive`.
- `data-select-mark` stays on the root; the keyboard spec reads its background as `--primary`
  when checked, which the lib Checkbox's `data-checked:bg-primary` provides.

Catalogue rows already use the lib `Checkbox` with `tabIndex={-1}` and a name; they are unchanged.

### LoadError stays an Alert

`LoadError` has two variants. `compact` is inline in the detail pane. `page` fills `main` when the
list request fails. Both stay lib `Alert` compositions, for three reasons:

- It is an error, and `Alert` carries `role="alert"`, so the failure is announced when it appears.
  `Empty` has no role and is meant for a region with nothing to show.
- One composition keeps both variants aligned, and the states spec asserts that anatomy: it finds
  the error by role `alert` and checks that Retry lines up with `[data-slot="alert-title"]`.
- `data-load-error` stays on the root; `gotoLibrary` waits on it.

The file is not changed.

### Other calibre sites

- `EmptyResult` becomes `Empty` with `EmptyMedia variant="icon"` (the SearchX icon),
  `EmptyTitle` and `EmptyContent` holding Clear filters. The copy is unchanged.
- `KeyHints` wraps each hint's keys in `KbdGroup`. No new component.
- `DeliveryRows`: the rows become `Item`s inside a bordered `ItemGroup` (`role="listitem"` each,
  `data-platform` kept), History entries become outline `Item`s, the add form becomes
  `FieldGroup` / `Field` / `FieldLabel` / `FieldError` with the same ids, `aria-invalid` and
  `aria-describedby`, and Save shows a `Spinner` while saving. History's remove button swaps its
  X for a `Spinner` while busy.
- `SortControls` wraps the Sort select and the direction button in `ButtonGroup`.
- `BulkToolbar` wraps each select and its action in a `ButtonGroup`. Its single `busy` flag becomes
  `pending: 'deliver' | 'zip' | null`, so the spinner appears on the button whose request is
  running while every control stays disabled as before.
- Facet, ViewSkeleton and the roving geometry (`useRovingNav`, `roving.ts`) stay in the app.

## Contrast fix

### Numbers

Browsers resolve `oklch(from var(--seed) L C h)` and, for an out-of-gamut result, clip each sRGB
channel. With the default seed `#66b2b2` (OKLCh hue 195.6), light `--primary` at L 0.55 C 0.12
clips to `#008688` and `--primary-foreground` (L 0.98 C 0.012) to `#f0fbfb`: 4.18:1, below AA.
That matches the 4.0 to 4.17 the owner measured.

New light values: `--primary` L 0.48 (C 0.12 unchanged) and `--primary-foreground` L 0.99
(C 0.012 unchanged).

| Pair (default seed, clipped)                                 | Before | After |
| ------------------------------------------------------------ | ------ | ----- |
| light primary / primary-foreground                           | 4.18   | 5.69  |
| light primary as text on background                          | 4.18   | 5.51  |
| light primary as text on sidebar                             | 4.01   | 5.29  |
| light primary as text on muted                               | 3.70   | 4.89  |
| dark primary / primary-foreground (L 0.75 / 0.17, unchanged) | 8.93   | 8.93  |

L 0.48 leaves margin for link-styled buttons (`text-primary`), which sit on `background`,
`sidebar` and `card`; L 0.52 would pass the pair test at 4.69 but leave links near the line on
`muted`. With the Storybook seeds the light pair is 6.59 (violet `#7c5cff`) and 6.57 (amber
`#e0784a`), and dark stays above 8.3. `--ring` and `--chart-1` keep L 0.55: a focus ring needs
3:1 against its surroundings, not 4.5:1 against text.

Dark lines 63 to 64 already pass at 8.93:1, so their L values stay.

### Fallbacks

The `@supports not (color: oklch(from red l c h))` block (pre-Safari 26) holds hexes that were
approximated by hand. The four primary hexes are replaced with the clipped resolution of the
relative colours, so the fallback matches what supporting browsers draw:

- light `--primary` `#3e7d7d` becomes `#007173`, `--primary-foreground` `#f7fafa` becomes
  `#f3fffe` (4.51 to 5.69);
- dark `--primary` `#8fc9c8` becomes `#43c3c4`, `--primary-foreground` `#182626` becomes
  `#051212` (8.45 to 8.93).

The rest of the fallback palette keeps its approximations; re-deriving it is out of scope.

### Unit test

`libs/rainforest-ui/src/tailwindcss/shadcn.test.ts` calls the plugin's handler with a stub
`addBase`, reads the light, dark and fallback blocks, and asserts:

- each fallback pair's WCAG ratio is at least 4.5;
- each relative pair, resolved from the seed with channel clipping, is at least 4.5 for the
  default seed and the two Storybook seeds;
- each fallback hex is within one channel step of the resolved relative colour.

Before the change the resolved light pair (4.18) and the fallback-match checks fail.

### Reverting calibre's workarounds

Commits bbb5554 and eeba82e changed primary controls to dodge the low ratio. These are reverted:

- `BookDetail` Read link: `buttonVariants({ variant: 'secondary', size: 'sm' })` back to
  `buttonVariants({ size: 'sm' })`.
- `BulkToolbar`: Mark delivered loses `variant="secondary"`; Select all N loses
  `className="text-foreground"`.
- `DeliveryRows` Save loses `variant="secondary"`.
- Link buttons lose `text-foreground`: Facet Show all/fewer, FilterChips Clear all, FilterPanel
  Clear all, GroupHeading See all.

`DeliveryPills`' `text-foreground` on the success Badge stays: that is the `success` token on its
own tint, which the primary change does not touch.

The calibre axe specs (`a11y.spec.ts`, `a11y.phone.spec.ts`) must stay green with the workarounds
gone; they cover every view, the pane, both Sheets, the bulk toolbar and the add-delivery form.

## Stories and design-sync

New stories: `Feedback/Spinner`, `Feedback/Empty`, `Forms/Label`, `Forms/Field`,
`Actions/ButtonGroup`, `Display/Item`. Each has a `Default`, one or more stories drawn from the
calibre sites with fixture data, and `Dark`. `.design-sync/config.json` gets one override per
component skipping its `*--dark` story id (for example `feedback-spinner--dark`), as NOTES.md
requires: the converter drops story-level `globals`, so Dark previews render light. No
`cardMode` is set; the controller adjusts it during the sync if a grid overflows. `contract.test.ts`
lists the new names, so each must be exported and have a story file.

`conventions.md` gains rules for the new primitives: a pending action puts `Spinner` inside its
button and keeps the label; a region with nothing to show uses `Empty` while errors stay `Alert`;
form fields use `Field`; `ButtonGroup` joins a select and its action and a single-choice switch
stays `ToggleGroup`; `Item` rows inside `ItemGroup` take `role="listitem"`.

## Other apps

rss-manager and memories change only at the sites in the inventory table. rss-manager has no
component tests; its lint, typecheck, Vitest and build stay green and a dev-server check with a
fixture vault covers the new states. memories' `EmptyState.astro` renders only when the data
directory is missing; its lint, typecheck, Vitest and e2e stay green, and a dev-server check with
a missing data directory shows the new state.

The website changes no code. It picks up the new primary through the shared plugin and appears in
the before/after captures.

## Evidence

Light-mode primary buttons are captured before any change and again at the end, at 1280×900 with
`colorScheme: 'light'`, from fixture data only: calibre's Read button (`/?book=38`), rss-manager's
Activate button (fixture vault), the website's floating action button and the first primary-filled
control on memories' fixture timeline. Each capture records the computed colours and ratio. The
calibre sites that change shape (empty result, delivery rows, sort group) are captured before and
after as well. Captures go to the executing session's scratchpad and are never committed.

## Out of scope

The /design-sync upload, the rest of the fallback palette, ToggleGroup for rss-manager's sort
buttons, calibre's TagEditor chips and any website code.

## For the owner to confirm

1. `LoadError` stays an `Alert` in both variants, including the full-region `page` variant.
2. The tile's select mark stays hidden from assistive tech (the tile's option name and
   `aria-selected` carry it), instead of getting its own "Select <title>" name.
3. Light primary moves to L 0.48 with primary-foreground at L 0.99, and the dark fallback hexes are
   re-resolved from the unchanged dark values.
