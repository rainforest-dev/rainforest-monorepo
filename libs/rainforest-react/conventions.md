# rainforest.tools design conventions

These rules apply to every screen built with `@rainforest-dev/rainforest-react`, in the apps and in
Claude Design. A later `.design-sync/config.json` can point `readmeHeader` at this file.

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

## Light and dark

- The tokens follow `prefers-color-scheme` unless an ancestor sets `data-scheme="light"` or
  `data-scheme="dark"`, which always wins.
- Do not use Tailwind's `dark:` variant. It follows the OS only and disagrees with a forced
  `data-scheme`. Reach for a token that already switches instead.

## Status colours

| Meaning                            | Token         | Components                                           |
| ---------------------------------- | ------------- | ---------------------------------------------------- |
| Done, valid, active                | `success`     | `Badge variant="success"`, `Alert variant="success"` |
| Needs attention, stale, read-only  | `warning`     | `Badge variant="warning"`, `Alert variant="warning"` |
| Neutral news, proposed             | `info`        | `Badge variant="info"`, `Alert variant="info"`       |
| Error, retired, destructive action | `destructive` | `Badge`, `Alert`, `Button variant="destructive"`     |
| Inactive, not applicable           | `muted`       | `Badge variant="muted"`                              |

Status colour is never the only signal: pair it with a word or an icon.

## Type

- Inter (`font-sans`) for all UI text.
- Lora (`font-serif`) is the editorial voice of the personal website only: long-form reading,
  headings on portfolio pages. Never inside controls.
- JetBrains Mono (`font-mono`) for code, identifiers and tabular technical values.
- Sizes come from the Tailwind scale (`text-xs` to `text-2xl`). Controls use `text-sm`.

## Shape and density

- Radius comes from `--radius` (0.625rem): `rounded-lg` for controls and cards' inner parts,
  `rounded-xl` for cards and dialogs, `rounded-4xl` for pills.
- Controls are compact: 32px (`h-8`) by default, `size="sm"` 28px, `size="lg"` 36px.
- Overlays (Popover, Select, DropdownMenu, Dialog) use `bg-popover`, a `ring-1 ring-foreground/10`
  hairline and `shadow-md`.

## Icons

- `lucide-react` only, at `size-4` inside controls (the components size them automatically).
- An icon-only button needs `aria-label`.

## Composition

- Import everything from the package root: `import { Button, Card } from '@rainforest-dev/rainforest-react'`.
- Keep framework wrappers (`next/link`, `next/image`, Astro islands) in the app. Pass them through
  the `render` prop, for example `<Button render={<a href="/books" />}>Books</Button>`.
- Use `buttonVariants()` or `badgeVariants()` to style a plain element from a Server Component.
- Mount `<Toaster />` once per app and call `toast()` from anywhere.
