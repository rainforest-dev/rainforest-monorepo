# Shared React UI library — design spec

Task: T-20260924120001, "rainforest-ui — one shared React component library, so /design-sync ships
what the apps use". Written as the phase 1 design, then updated to what was built on the same
branch; §10 records the design-sync version it was checked against and §11 the decisions taken.

The goal is one React component library that the apps render and that `/design-sync` can later
upload to the "rainforest.tools Design System" Claude Design project. The sync accepts a React
package with a built ESM `dist/` or a React Storybook. It needs one entry exporting every component
and one compiled CSS with every token, class and font inside the package.

## 1. What exists today

### 1.1 Component inventory

| Component                 | personal-calibre (React, `@base-ui/react`) | personal-website (Vue, `reka-ui`)        | Hand-rolled elsewhere                                                           |
| ------------------------- | ------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------- |
| Button + `buttonVariants` | yes, 6 variants, 8 sizes, `h-8` default    | yes, 4 variants, 2 sizes, `h-10` default | portfolio `button()` helper (5 variants incl. `danger`), rss-manager (3 places) |
| Badge                     | yes                                        | yes                                      | rss-manager status pills                                                        |
| Input                     | yes                                        | yes                                      | rss-manager (2 inputs)                                                          |
| Textarea                  | yes                                        | yes                                      |                                                                                 |
| Popover                   | yes                                        | yes                                      |                                                                                 |
| Select                    | yes                                        | yes                                      |                                                                                 |
| InputGroup                | yes                                        |                                          |                                                                                 |
| Card                      | yes                                        |                                          |                                                                                 |
| Dialog                    | yes (used by Command)                      |                                          |                                                                                 |
| Command (`cmdk`)          | yes                                        |                                          |                                                                                 |
| Toaster (`sonner`)        | yes                                        |                                          |                                                                                 |
| DropdownMenu              |                                            | yes                                      |                                                                                 |
| Tabs                      |                                            | yes                                      |                                                                                 |
| Switch                    |                                            |                                          | portfolio `Switch.tsx`                                                          |
| Table                     |                                            |                                          | rss-manager `SourceTable`                                                       |
| Alert (inline notice)     |                                            |                                          | rss-manager `bg-warning/15`, `bg-destructive/15` notices                        |

Facts that shape the design:

- The task note lists personal-website's `components/ui/*` as React. They are shadcn-vue single-file
  components (`components.json` points at `shadcn-vue.com`), used by 12 Vue files and 4 Astro files.
  personal-website's React surface is the portfolio islands in `libs/personal-portfolio`, which use
  class helpers in `src/shared/ui.ts` and one `Switch.tsx`.
- rss-manager has no `components/ui/` directory. Its four React islands hand-roll buttons, inputs,
  a table, status pills and notices with semantic tokens.
- personal-calibre's copies are shadcn `base-nova` (current shadcn v4, Base UI primitives).
  `button-variants.ts` duplicates the recipe from `button.tsx` so a Server Component
  (`books/[id]/page.tsx`) can call `buttonVariants()` without crossing a `'use client'` boundary.
- `sonner.tsx` imports `useTheme` from `next-themes`, but no `ThemeProvider` is mounted, so it always
  resolves to `system`.
- Raw colour outside tokens: one `bg-black/10` (dialog overlay). `dark:` utilities appear in 7 of the 12
  files (17 occurrences). `dark:` follows the OS only and
  disagrees with a forced `data-scheme`.
- personal-memories (React island, not in the task's app list) hand-rolls its own UI too.

### 1.2 Theme and CSS per app

| App               | Tailwind entry                                | Extras                                                                                                                                                                   |
| ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| personal-website  | `src/app.css`, `@plugin .../shadcn`           | `@source` on `libs/personal-portfolio/src`, forms + typography plugins, Lora + Inter from Google Fonts                                                                   |
| personal-calibre  | `src/app/globals.css`, `@plugin .../shadcn`   | `tw-animate-css`, `shadcn/tailwind.css` (the `data-open`/`data-closed`/... custom variants), `@theme inline` radius scale (`--radius * 0.6..2.6`), Inter via `next/font` |
| rss-manager       | `src/styles/global.css`, `@plugin .../shadcn` | Inter from Google Fonts                                                                                                                                                  |
| personal-memories | `src/styles/global.css`, `@plugin .../shadcn` | system Inter, custom text scale                                                                                                                                          |

The plugin's own radius scale is `sm = --radius - 4px`, `md = - 2px`, `lg = --radius`,
`xl = + 4px`. Calibre overrides it with multipliers, so the same class yields a different radius in
calibre than in the other apps. No app loads JetBrains Mono.

### 1.3 Versions

All four apps and `libs/personal-portfolio` take `react`/`react-dom` from the pnpm catalog:
19.2.3, `@types/react` 19.2.9. Tailwind 4.2.2, Vite 8.0.16, Vitest 4.1.4, Storybook 10.5.3,
`@base-ui/react` 1.x, `cmdk` 1.1, `sonner` 2.0, `lucide-react` 1.8, TypeScript 6.0.3.

### 1.4 libs/rainforest-ui today

- Vite library build, ES + CJS, `ssr: true`, entries `index`, `tailwindcss/shadcn` and a glob over
  `src/{lit,utils}/**/*.ts`. Exports `.`, `./tailwindcss/*`, `./lit/*`. Not `private`; `nx release`
  builds it before versioning.
- Storybook 10 with `@storybook/web-components-vite`: three Lit stories.
- Dependencies are Lit, Tailwind and material-color-utilities. No React.
- The calibre, rss-manager and memories Dockerfiles copy only `shadcn.ts` and emit it with `tsc`
  instead of building the library.

## 2. Location: new lib `libs/rainforest-react`

Package `@rainforest-dev/rainforest-react`, Nx project `rainforest-react`. `libs/rainforest-ui`
stays as it is, and the new lib consumes its token plugin at build time.

|                   | React entry inside `rainforest-ui`                                                                                                                               | New lib `rainforest-react` (chosen)                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Storybook         | One Storybook has one framework. Lit uses `web-components-vite`, React needs `react-vite`, so a second Storybook config or composition is needed in one project. | Its own `react-vite` Storybook. `/design-sync` can point at it directly.                                                         |
| Published package | Adds React, Base UI, cmdk, sonner and lucide to a Lit package that `nx release` publishes.                                                                       | Lit consumers are unaffected.                                                                                                    |
| Build             | The glob-entry, CJS, `ssr: true` build has to be carved around a React entry that must preserve `'use client'`.                                                  | A build config written for this one purpose: ESM, per-module output, compiled CSS.                                               |
| Docker            | Images would have to build the full Lit library to get React components.                                                                                         | Images build one small lib (see §7).                                                                                             |
| Tokens            | Same package, so no cross-package token reference.                                                                                                               | Tokens come from `rainforest-ui` at build time and are compiled into `dist/styles.css`. The shipped CSS reaches outside nothing. |

The cost of the new lib is one more project, `tsconfig` and Storybook to maintain, plus a build
dependency on `rainforest-ui` (`dependsOn: ["^build"]`).

## 3. Package shape

```
libs/rainforest-react/
  package.json
  vite.config.ts
  src/
    index.ts                 re-exports every component, variant recipe and `cn`
    lib/cn.ts
    components/<name>.tsx    one file per component, `'use client'` where it needs the client
    components/<name>-variants.ts   cva recipes, never `'use client'`
    styles.css               Tailwind source for the compiled bundle CSS
    tailwind.css             Tailwind partial for apps that compile their own CSS
  stories/<Name>.stories.tsx
  .storybook/{main,preview}.ts
```

`package.json`:

```json
{
  "name": "@rainforest-dev/rainforest-react",
  "type": "module",
  "sideEffects": ["**/*.css"],
  "exports": {
    "./package.json": "./package.json",
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./styles.css": "./dist/styles.css",
    "./tailwind.css": "./dist/tailwind.css"
  },
  "files": ["dist", "!**/*.tsbuildinfo"],
  "peerDependencies": { "react": "catalog:", "react-dom": "catalog:" },
  "dependencies": {
    "@base-ui/react": "^1.4.0",
    "cmdk": "^1.1.1",
    "sonner": "^2.0.7",
    "lucide-react": "^1.8.0",
    "class-variance-authority": "catalog:",
    "clsx": "^2.1.1",
    "tailwind-merge": "catalog:",
    "tw-animate-css": "^1.4.0"
  },
  "devDependencies": {
    "@rainforest-dev/rainforest-ui": "workspace:*",
    "@fontsource-variable/inter": "^5.3.0",
    "@fontsource-variable/lora": "^5.3.0",
    "@fontsource-variable/jetbrains-mono": "^5.3.0",
    "@storybook/react-vite": "10.5.3",
    "@tailwindcss/vite": "catalog:",
    "typescript": "catalog:",
    "vite-plugin-dts": "~4.5.4",
    "vitest": "4.1.4"
  }
}
```

Ranges match calibre's `package.json`; the fontsource ones are the current 5.3.0 releases. The
build toolchain (`vite-plugin-dts`, `vitest`, `typescript`) is declared on the lib itself so the
calibre and rss-manager Docker images, which install only the app's dependency closure, can run
`vite build` in the lib. `conventions.md` at the lib root holds the brand and usage rules.

Rules for the source:

- ESM only. Everything in `dependencies` and `peerDependencies` is external in the build.
- Output keeps one module per source file (`output.preserveModules`, `preserveModulesRoot: 'src'`)
  so each file keeps its own `'use client'` directive. `index.js` has no directive, and the
  `*-variants.js` recipes stay callable from Next Server Components. That removes calibre's
  duplicated `button-variants.ts`.
- Every public component, its props type and its recipe are exported from `index.ts`. `toast` is
  re-exported from `sonner` so apps never import `sonner` directly.
- No `next/*`, `next-themes`, `astro`, `vue` or `@astrojs/*` import. `Toaster` reads the scheme from
  the nearest `[data-scheme]` ancestor or `prefers-color-scheme`, and takes an optional `theme` prop.
- Tokens only: no raw palette classes, no hex, no `bg-black/*` (the dialog overlay becomes
  `bg-foreground/10`), no `dark:` variants. Where a component needs a different look in dark mode it
  uses a token that already switches with the scheme.
- Icons from `lucide-react`.
- Components use Base UI primitives, following calibre's `base-nova` copies. The Vue-only
  components (DropdownMenu, Tabs) are rebuilt from shadcn's `base-nova` React sources, and Switch,
  Table and Alert likewise.

Component list for the first release (decision 3): Button, Badge, Input, Textarea,
InputGroup, Card, Dialog, Command, Popover, Select, Toaster, DropdownMenu, Tabs, Switch, Table,
Alert. Sixteen components, each with its sub-parts (`CardHeader`, `SelectItem`, ...) exported.

## 4. CSS build

Two CSS files ship, for two kinds of consumer.

`dist/styles.css` is compiled and self-contained, for `/design-sync`, Storybook, and any consumer
without Tailwind. It is built from `src/styles.css`:

```css
@import 'tailwindcss';
@import '@fontsource-variable/inter';
@import '@fontsource-variable/lora';
@import '@fontsource-variable/jetbrains-mono';
@import './tailwind.css';
@plugin '@rainforest-dev/rainforest-ui/tailwindcss/shadcn';

@theme {
  --radius: 0.625rem;
  --font-sans: 'Inter Variable', ui-sans-serif, system-ui, sans-serif;
  --font-serif: 'Lora Variable', ui-serif, Georgia, serif;
  --font-mono: 'JetBrains Mono Variable', ui-monospace, monospace;
}
```

The output holds the `:root`, `[data-scheme='light'|'dark']` and `@supports` fallback blocks with
`--seed` as plain custom properties, every utility the components use, the preflight, and the
`@font-face` rules for the three families. Vite's library mode inlines every asset, so the `woff2`
files land in the CSS as `data:` URIs (about 690 KB in total, all subsets). It has no `@import` and
no URL outside the file. It is a separate Vite CSS entry, so `index.js` never imports it.

`dist/tailwind.css` is a Tailwind source partial for apps that already compile Tailwind with the
shadcn plugin. It is copied verbatim and contains:

- `@source './components';`, which resolves relative to the file, so the app's Tailwind scans the
  lib's `dist/components/*.js` for classes with no path in the app (and `src/components` when
  `styles.css` compiles);
- the `data-open`, `data-closed`, `data-checked`, `data-unchecked`, `data-selected`,
  `data-disabled`, `data-active`, `data-horizontal`, `data-vertical` custom variants and the
  `no-scrollbar` utility from `shadcn/tailwind.css`, plus the `tw-animate-css` import, which is why
  `tw-animate-css` is a runtime dependency of the lib;
- `--font-heading: var(--font-sans)` (used by `CardTitle` and `DialogTitle`);
- the radius scale as `@theme static` (`sm`/`md`/`lg`/`xl` on the plugin's `-4px/-2px/0/+4px`
  offsets). Components write `rounded-[min(var(--radius-md),12px)]`, and Tailwind only emits theme
  variables a utility asks for, so without `static` that arbitrary value resolved to nothing and
  the compact buttons rendered square.

Apps `@import '@rainforest-dev/rainforest-react/tailwind.css'` directly after
`@import 'tailwindcss'` and do not import `styles.css`. That avoids a second preflight and a second
copy of every token. Apps keep loading fonts their own way.

Radius: the lib uses the plugin's scale. Calibre drops its `@theme inline` radius multipliers so a
component renders the same radius in every app (decision 4).

## 5. Storybook

- `libs/rainforest-react/.storybook/main.ts` uses `@storybook/react-vite` 10.5.3 (a devDependency
  of the lib, pinned to the root `storybook` version) and `@storybook/addon-docs`, both wrapped in
  `getAbsolutePath()` as the repo requires. It points the builder at a minimal
  `.storybook/vite.config.ts` (just `@tailwindcss/vite`) so Storybook does not inherit the library
  build's `dts` and `preserveModules` settings. The `@nx/storybook` plugin infers `storybook`,
  `build-storybook` and `test-storybook`.
- `preview.tsx` imports `../src/styles.css`. One scheme at a time: a global `scheme` toolbar item
  (`light` | `dark`, initial `light`) drives a decorator that renders the story inside one
  `<div data-scheme>` with `bg-background text-foreground`, and mirrors the scheme onto `<html>` so
  portalled overlays (Popover, Select, Dialog, DropdownMenu, toasts) pick it up too. Side by side
  was dropped: `/design-sync` grades each story as one render and a Claude Design card shows one
  story full-bleed, so a two-panel frame would be graded and shipped as the component.
- Every story file also exports a `Dark` story (`globals: { scheme: 'dark' }`), so both schemes are
  reachable as stories, not only through the toolbar.
- A second global, `seed`, sets `--shadcn-seed-override` so a reviewer can check that a component
  re-themes. It defaults to unset, which is the `#66b2b2` teal.
- One `stories/<Name>.stories.tsx` per component, titled `<Group>/<ExportName>` (`Actions/Button`,
  `Forms/Select`, `Overlays/Dialog`, ...), because the sync maps a story title's last segment to the
  export name and the one before it to the card group. Each has a `Default` story, stories for the
  variants and sizes, and the states that change styling. Overlay stories render open
  (`defaultOpen`) so a static render shows them. Stories import from `../src`, which the sync
  redirects to its bundle.
- No `@dsCard` comments. Preview cards are generated by `/design-sync`, which is out of scope here.

## 6. Tests

- Vitest 4 with jsdom and `@testing-library/react`, as `libs/personal-portfolio` does. Behaviour
  tests only where there is behaviour: Switch toggles `aria-checked`, Command filters by the typed
  query, Dialog opens from its trigger, `Toaster` follows a forced `data-scheme` on `<html>`.
  `src/test-setup.ts` stubs `ResizeObserver` and `matchMedia`, which jsdom lacks and cmdk and
  sonner call.
- A contract test (`src/contract.test.ts`) that fails if one of the sixteen components is missing
  from the single entry or has no story file, if any component file imports `next`, `next-themes`,
  `astro`, `vue` or `@astrojs/*`, or if any class string contains `dark:`, a raw palette colour
  (`gray-500`, `black`, `white`, ...) or a hex literal.
- A dist test (`src/dist.test.ts`; the lib's `test` target has `dependsOn: ["build"]`) that fails if
  `dist/styles.css` lacks `--seed`, the override hook, either `[data-scheme]` scope or an
  `@font-face` for each of the three families, or contains `@import` or a non-`data:` URL; and if
  `'use client'` is missing from `components/button.js` or present on the variant recipes or
  `index.js`.
- `build-storybook` must pass. `test-storybook` is not in CI's `affected` targets and was not run.
- Apps: calibre's Playwright suite exercises Popover, Command, Select, Dialog and Toaster. On
  `origin/main` 7 of its 29 tests already fail in this environment (the author/tag combobox tests
  type a name, but the items' cmdk `value` is the numeric id; bulk delivery; platform filter; back
  navigation; tag removal; existing tags). The migrated app fails the same 7 and passes the other 22. personal-website's CLAUDE.md rule applies: pages were loaded from
  `pnpm nx dev personal-website`, not only built.

Gate: `pnpm nx affected -t lint test typecheck build` green, plus `build-storybook` for the lib.

## 7. Migration order

The owner asked for one draft PR, so the steps below are commits on one branch rather than
separate PRs. Each commit leaves the workspace green.

1. Lib: `libs/rainforest-react` with the sixteen components, stories, tests, both CSS files and
   `conventions.md`. No app changes.
2. personal-calibre: imports move to `@rainforest-dev/rainforest-react`; `src/components/ui/` and
   `components.json` are deleted (`lib/utils.ts` stays, app code uses its `cn`); `@base-ui/react`,
   `cmdk`, `sonner`, `next-themes`, `shadcn`, `tw-animate-css` and `class-variance-authority` leave
   the app; `shadcn/tailwind.css` gives way to the lib's partial; the radius multipliers go. The
   Dockerfile builds the lib (`vite build`) after the `shadcn.ts` step.
3. rss-manager: the four islands use Button, Input, Table, Badge and Alert. Status colours map to
   the `success` / `info` / `warning` / `muted` / `destructive` variants; the segmented filters are
   Buttons with `aria-pressed`. The Re-subscribe link keeps its warning fill through
   `buttonVariants` plus token classes. Dockerfile as in step 2.
4. personal-website: the portfolio islands in `libs/personal-portfolio` take `buttonVariants` and
   `Switch` from the lib. `Switch.tsx` is deleted; `shared/ui.ts` keeps `cx`, `segment` and
   `avatar`. The old sizes map `default → lg`, `sm → default`, `icon → icon-lg` so the islands keep
   their height; `danger` maps to `destructive`. The Vue components stay (decision 1).

## 8. Visual evidence

Captured with Playwright into the session scratchpad and attached to the PR; captures are not
committed.

| Surface               | Screens                                                           | Viewport  | Schemes     |
| --------------------- | ----------------------------------------------------------------- | --------- | ----------- |
| Lib (after only, new) | Storybook, every story                                            | 900 × 600 | light, dark |
| calibre               | library grid, author filter open (Popover + Command), book detail | 1280      | light, dark |
| rss-manager           | sources, topics, validate, queue                                  | 1280      | light, dark |
| personal-website      | OfferState, ZapLiquidity (Switch), WalletStateMachine islands     | element   | light, dark |

Calibre runs on the e2e fixture library, rss-manager on a scratch vault built from its own test
fixtures. Mobile viewports were not captured.

## 9. Risks

- `'use client'` lost in bundling. `preserveModules` keeps it per file; the dist test guards it.
- Tailwind class scanning. If an app's Tailwind misses the lib's `dist/`, components render
  unstyled with no error. The `@source './components'` in the partial covers it; the screenshots
  confirm it for all three apps.
- Look changes. The shared recipes are `base-nova` (`h-8`, `rounded-lg`); rss-manager's hand-rolled
  controls change shape, and calibre loses the `dark:` fills on inputs and outline buttons, so
  those read slightly flatter in dark mode.
- Docker images now build the lib inside the image. Neither image was built locally.
- The release workflows for calibre and rss-manager trigger on their app paths only, so a
  lib-only change does not rebuild their images.
- `/design-sync` is not exercised here. The first sync may still hit issues this task cannot see.

## 10. Alignment with `/design-sync` (bundled skill 2.1.281)

Checked against the design-sync skill bundled with Claude Code 2.1.281 (its `storybook/` and
`non-storybook/` sub-skills and the converter scripts), not only the research note. What that
version consumes, and how the lib meets it:

- Source shape `storybook`: the converter bundles the package's built `dist/` entry into
  `_ds_bundle.js` and uses the reference Storybook as the fidelity oracle. The lib has both, in
  the package directory, with `.storybook/` next to `package.json`.
- Entry: `exports['.']` and `module` point at `dist/index.js`; every component is a PascalCase value
  export there. The `.d.ts` tree ships next to it.
- Props: the converter looks up `<Name>Props` across the package's files for each component's API
  contract. Every component exports one (`ButtonProps`, `SelectProps`, ...), and each has a one-line
  JSDoc that feeds the synthesized `.prompt.md`.
- CSS: the converter picks up `dist/styles.css` by default and rendered designs only receive the
  `styles.css` import closure, so the file is self-contained: tokens, utilities and fonts, no
  `@import`.
- Fonts: `[FONT_MISSING]` fires for any family the CSS references without an `@font-face`. All three
  are shipped inline.
- Tokens: no sibling tokens package is needed (`tokensPkg` stays unset); the token plugin is compiled
  into the stylesheet.
- Storybook: one scheme per render, the scheme decorator bundles as the preview wrapper, story
  titles resolve to export names without a `titleMap`, overlays render open. Overlay components
  will likely want `cardMode: "single"` in the sync config.
- Conventions: `libs/rainforest-react/conventions.md` is written so a later
  `.design-sync/config.json` can point `readmeHeader` at it. `.design-sync/` itself is not created.
- React: all consumers resolve React 19.2.3 from the catalog, and the lib keeps `react` and
  `react-dom` as peers, so the bundle does not carry a second copy.

## 11. Decisions

The owner asked for every open decision to be resolved with the recommendation. Recorded here:

1. **personal-website's Vue components** stay as Vue. They cannot render React components, and the
   12 Vue consumers are a redesign-sized port. The website's React surface (the portfolio islands)
   uses the lib. Follow-up: share the class recipes with the Vue copies, or port islands to React
   after the Claude Design redraw.
2. **Shared look**: calibre's `base-nova` (compact, `h-8`). The portfolio islands use `size="lg"`
   where they were `h-10`.
3. **Scope**: Switch, Table and Alert are included, plus `success` / `warning` / `info` / `muted`
   variants on Badge and Alert for rss-manager's status colours.
4. **Radius**: the token plugin's scale everywhere; calibre's multipliers are gone.
5. **personal-memories** is out of scope. The lib has no app-specific assumptions, so it can adopt
   it by adding the dependency and the partial import.
6. **Package name**: `@rainforest-dev/rainforest-react`.
7. **Publishing**: `private: true` until after the first `/design-sync`.
