# rainforest.tools design conventions

These rules apply to every screen built with `@rainforest-dev/rainforest-react`, in the apps and in
Claude Design. `.design-sync/config.json` points `readmeHeader` at this file.

## In Claude Design

- No provider or root wrapper is needed. The design system's `styles.css` carries the tokens, the
  three fonts and every class listed below; set `data-scheme="light"` or `"dark"` on `<html>` to
  pick a scheme.
- Before styling, read the bound `styles.css` (and the `_ds_bundle.css` it imports) for the exact
  class list, and each component's `.prompt.md` for its props and examples.
- Draw with fixture data only: made-up names, dates and text. Never real people, photos or
  messages.

## Colour

- Every colour comes from a semantic token: `background`, `foreground`, `card`, `popover`,
  `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, the status
  trio `success` / `warning` / `info`, `chart-1..5` and `sidebar-*`. Use them as Tailwind
  utilities (`bg-muted`, `text-muted-foreground`) or as `var(--muted)`.
- Never use raw palette classes (`text-gray-500`, `bg-violet-600`), hex values or `black` / `white`.
  They skip the seed and do not switch scheme.
- All tokens derive from one `--seed` colour (default teal `#66b2b2`) through
  `oklch(from var(--seed) L C h)`. A page re-themes by setting `--shadcn-seed-override`.
- Tints use opacity on a token: `bg-primary/10` for a selected row, `bg-success/15` for a status
  pill, `ring-foreground/10` for a hairline on an overlay.
- The shipped stylesheet has `bg-`, `text-`, `border-` and `ring-` for every token above, plain and
  at `/10`, `/15`, `/20`, `/35`, `/40`, `/45`, `/50`, `/65`, `/80` and `/90`. Other opacity steps
  are not in it. For SVG
  charts it also has `fill-chart-1..5` and `stroke-chart-1..5`.

## Light and dark

- The tokens follow `prefers-color-scheme` unless an ancestor sets `data-scheme="light"` or
  `data-scheme="dark"`, which always wins.
- Overlays (Popover, Select, DropdownMenu, Dialog, Sheet, Tooltip) and toasts render in a portal on `<body>`, so
  they only see a `data-scheme` set on `<html>`. Force a scheme on `<html>`, not on a wrapper.
- Do not use Tailwind's `dark:` variant. It follows the OS only and disagrees with a forced
  `data-scheme`. Reach for a token that already switches instead.

## Status colours

| Meaning                            | Token         | Components                                           |
| ---------------------------------- | ------------- | ---------------------------------------------------- |
| Done, valid, active                | `success`     | `Badge variant="success"`, `Alert variant="success"` |
| Needs attention, stale, read-only  | `warning`     | `Badge`, `Alert`, `Button variant="warning"`         |
| Neutral news, proposed             | `info`        | `Badge variant="info"`, `Alert variant="info"`       |
| Error, retired, destructive action | `destructive` | `Badge`, `Alert`, `Button variant="destructive"`     |
| Inactive, not applicable           | `muted`       | `Badge variant="muted"`                              |

Status colour is never the only signal: pair it with a word or an icon.

## Type

- Inter (`font-sans`) for all UI text.
- Lora (`font-serif`) is the editorial voice of the personal website only: long-form reading,
  headings on portfolio pages. Never inside controls.
- JetBrains Mono (`font-mono`) for code, identifiers and tabular technical values.
- Sizes come from the Tailwind scale. UI stays within `text-xs` to `text-2xl`; `text-3xl` to
  `text-6xl` are for page titles. Controls use `text-sm`.
- Reading screens (long lists, diaries, message streams) use the theme's type scale instead:
  `text-meta` 13px for timestamps and labels, `text-body` 15px for running text, `text-heading`
  17px for section headings and `text-title` 28px for the page title. Each carries its own line
  height.

## Shape and density

- Radius comes from `--radius` (0.625rem): `rounded-lg` for controls and cards' inner parts,
  `rounded-xl` for cards and dialogs, `rounded-4xl` for pills.
- Controls are compact: 32px (`h-8`) by default, `size="sm"` 28px, `size="lg"` 36px.
- Overlays (Popover, Select, DropdownMenu, Dialog, Sheet) use `bg-popover`, a `ring-1 ring-foreground/10`
  hairline and `shadow-md`.

## Layout utilities

The shipped stylesheet includes these, and nothing else beyond what the components use:

- display and position: `flex`, `inline-flex`, `grid`, `block`, `hidden`, `relative`, `absolute`,
  `sticky`, `inset-0`, `z-10`, `z-50`, `overflow-*`;
- flex and grid: `flex-row` / `flex-col` / `flex-wrap` / `flex-1`, `items-*`, `justify-*`,
  `grid-cols-1` to `grid-cols-12` (also with `sm:`, `md:`, `lg:`), `col-span-1` to `col-span-12`;
- spacing: `gap`, `gap-x`, `gap-y`, `space-x`, `space-y`, `p*` and `m*` on steps 0, 0.5, 1, 1.5,
  2, 2.5, 3 to 12, 14, 16, 20, 24 and 32, plus `mx-auto`;
- sizing: `w-`, `h-`, `size-`, `min-w-`, `min-h-` on steps 0 to 6, 8, 10, 12, 16, 20, 24,
  32, 40, 48, 56, 64, 72, 80 and 96, `full`, `auto`, `fit`, plus `screen` for all but `size-`,
  `w-1/2`, `w-1/3`, `w-2/3`, `w-1/4`, `w-3/4`, and `max-w-xs` to `max-w-7xl`, `max-w-prose`;
- shape: `rounded` to `rounded-4xl`, `rounded-full`, `border`, `border-t|b|l|r`, `ring-1`,
  `ring-2`, `shadow-xs` to `shadow-lg`.

## Icons

- `lucide-react` only, at `size-4` inside controls (the components size them automatically).
- An icon-only button needs `aria-label`.

## Composition

- Import everything from the package root: `import { Button, Card } from '@rainforest-dev/rainforest-react'`.
- Keep framework wrappers (`next/link`, `next/image`, Astro islands) in the app. Pass them through
  the `render` prop, for example `<Button render={<a href="/books" />}>Books</Button>`.
- Use `buttonVariants()` or `badgeVariants()` to style a plain element from a Server Component.
  The recipes and `cn` also ship React-free as `@rainforest-dev/rainforest-ui/recipes` for Vue
  and Astro components.
- Mount `<Toaster />` once per app and call `toast()` from anywhere.
- Tooltips open after Base UI's default hover delay. Wrap an app, or a region with many
  tooltips, in one `<TooltipProvider>`: once one tooltip has shown, moving to the next trigger
  within the provider's `timeout` opens it without waiting again.
- A bottom `Sheet` with a peek: pass `snapPoints={[peekHeight, 1]}` and control `snapPoint`.
  Keep `open` true, map `onOpenChange(false)` (Escape) to the peek snap point, and set
  `modal={snapPoint === 1}` so focus is only trapped when the sheet is expanded. Pass
  `initialFocus={false}` to `SheetContent`: a sheet that is open on mount otherwise takes focus
  from the page as it loads. The control that expands the sheet sits inside it, so focus is
  already there when it grows.
- `SheetContent` labels its close button "Close" for screen readers; pass `closeLabel` (for
  example `closeLabel="關閉"`) in apps whose UI is not English.
- Loading states use `Skeleton` blocks sized like the content they stand for, never a spinner
  alone.
