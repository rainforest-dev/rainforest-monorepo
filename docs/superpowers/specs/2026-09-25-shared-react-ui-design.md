# Shared React UI library — design spec

Task: T-20260924120001, "rainforest-ui — one shared React component library, so /design-sync ships
what the apps use". This spec covers phase 1 (design). Nothing here is implemented yet.

The goal is one React component library that the apps render and that `/design-sync` can later
upload to the "rainforest.tools Design System" Claude Design project. The sync accepts a React
package with a built ESM `dist/` or a React Storybook. It needs one entry exporting every component
and one compiled CSS with every token, class and font inside the package.

## 1. What exists today

### 1.1 Component inventory

| Component | personal-calibre (React, `@base-ui/react`) | personal-website (Vue, `reka-ui`) | Hand-rolled elsewhere |
| --- | --- | --- | --- |
| Button + `buttonVariants` | yes, 6 variants, 8 sizes, `h-8` default | yes, 4 variants, 2 sizes, `h-10` default | portfolio `button()` helper (5 variants incl. `danger`), rss-manager (3 places) |
| Badge | yes | yes | rss-manager status pills |
| Input | yes | yes | rss-manager (2 inputs) |
| Textarea | yes | yes | |
| Popover | yes | yes | |
| Select | yes | yes | |
| InputGroup | yes | | |
| Card | yes | | |
| Dialog | yes (used by Command) | | |
| Command (`cmdk`) | yes | | |
| Toaster (`sonner`) | yes | | |
| DropdownMenu | | yes | |
| Tabs | | yes | |
| Switch | | | portfolio `Switch.tsx` |
| Table | | | rss-manager `SourceTable` |
| Alert (inline notice) | | | rss-manager `bg-warning/15`, `bg-destructive/15` notices |

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

| App | Tailwind entry | Extras |
| --- | --- | --- |
| personal-website | `src/app.css`, `@plugin .../shadcn` | `@source` on `libs/personal-portfolio/src`, forms + typography plugins, Lora + Inter from Google Fonts |
| personal-calibre | `src/app/globals.css`, `@plugin .../shadcn` | `tw-animate-css`, `shadcn/tailwind.css` (the `data-open`/`data-closed`/... custom variants), `@theme inline` radius scale (`--radius * 0.6..2.6`), Inter via `next/font` |
| rss-manager | `src/styles/global.css`, `@plugin .../shadcn` | Inter from Google Fonts |
| personal-memories | `src/styles/global.css`, `@plugin .../shadcn` | system Inter, custom text scale |

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

| | React entry inside `rainforest-ui` | New lib `rainforest-react` (chosen) |
| --- | --- | --- |
| Storybook | One Storybook has one framework. Lit uses `web-components-vite`, React needs `react-vite`, so a second Storybook config or composition is needed in one project. | Its own `react-vite` Storybook. `/design-sync` can point at it directly. |
| Published package | Adds React, Base UI, cmdk, sonner and lucide to a Lit package that `nx release` publishes. | Lit consumers are unaffected. |
| Build | The glob-entry, CJS, `ssr: true` build has to be carved around a React entry that must preserve `'use client'`. | A build config written for this one purpose: ESM, per-module output, compiled CSS. |
| Docker | Images would have to build the full Lit library to get React components. | Images build one small lib (see §7). |
| Tokens | Same package, so no cross-package token reference. | Tokens come from `rainforest-ui` at build time and are compiled into `dist/styles.css`. The shipped CSS reaches outside nothing. |

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
    "@base-ui/react": "^1.4.0", "cmdk": "^1.1.1", "sonner": "^2.0.7", "lucide-react": "^1.8.0",
    "class-variance-authority": "catalog:", "clsx": "^2.1.1", "tailwind-merge": "catalog:",
    "tw-animate-css": "^1.4.0"
  },
  "devDependencies": { "@rainforest-dev/rainforest-ui": "workspace:*",
    "@fontsource-variable/inter": "^5.3.0", "@fontsource-variable/lora": "^5.3.0",
    "@fontsource-variable/jetbrains-mono": "^5.3.0" }
}
```

Ranges match calibre's `package.json`; the fontsource ones are the current 5.3.0 releases.

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

Component list for the first release (see Open decision 3): Button, Badge, Input, Textarea,
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
@source './';

@theme {
  --radius: 0.625rem;
  --font-sans: 'Inter Variable', ui-sans-serif, system-ui, sans-serif;
  --font-serif: 'Lora Variable', serif;
  --font-mono: 'JetBrains Mono Variable', ui-monospace, monospace;
}
```

The output holds the `:root`, `[data-scheme='light'|'dark']` and `@supports` fallback blocks with
`--seed` as plain custom properties, every utility the components use, the preflight, and
`@font-face` rules whose `woff2` files Vite copies into `dist/assets/`. It has no `@import` and no
URL outside `dist/`. It is emitted as a separate Vite CSS entry so `index.js` never imports it.

`dist/tailwind.css` is a Tailwind source partial for apps that already compile Tailwind with the
shadcn plugin. It is copied verbatim and contains:

- `@source './';`, which resolves relative to the file, so the app's Tailwind scans the lib's
  `dist/*.js` for classes with no path in the app;
- the `data-open`, `data-closed`, `data-checked`, `data-unchecked`, `data-selected` (and the other
  `shadcn/tailwind.css`) custom variants, and the `tw-animate-css` import, which is why
  `tw-animate-css` is a runtime dependency of the lib.

Apps `@import '@rainforest-dev/rainforest-react/tailwind.css'` after their `@plugin` line and do not
import `styles.css`. That avoids a second preflight and a second copy of every token. Apps keep
loading fonts their own way.

Radius: the lib uses the plugin's scale. Calibre drops its `@theme inline` radius multipliers so a
component renders the same radius in every app (Open decision 4).

## 5. Storybook

- `libs/rainforest-react/.storybook/main.ts` uses `@storybook/react-vite`, pinned to the root
  `storybook` version (10.5.3) and added at the workspace root next to
  `@storybook/web-components-vite`, and `@storybook/addon-docs`, both wrapped
  in `getAbsolutePath()` as the repo requires. The `@nx/storybook` plugin infers `storybook`,
  `build-storybook` and `test-storybook`.
- `preview.ts` imports `../src/styles.css`. A global `scheme` toolbar item (`light`, `dark`,
  `side-by-side`, initial `side-by-side`) drives a decorator that renders the story inside
  `<div data-scheme="light">` and/or `<div data-scheme="dark">` with `bg-background
  text-foreground`. Every story therefore renders in both schemes by default on the shared seed.
- A second global, `seed`, sets `--shadcn-seed-override` on the wrapper so a reviewer can check
  that a component re-themes. It defaults to unset, which is the `#66b2b2` teal.
- One `stories/<Name>.stories.tsx` per component: a `Default` story, one story per `variant` and
  `size` value, and the states that change styling (disabled, invalid, open for overlays). Overlay
  stories render open (`defaultOpen`) so a static render shows them. Types come from
  `@storybook/react-vite`.
- No `@dsCard` comments. Preview cards are generated by `/design-sync`, which is out of scope here.

## 6. Tests

- Vitest 4 with jsdom and `@testing-library/react`, as `libs/personal-portfolio` does. Behaviour
  tests only where there is behaviour: Switch toggles `aria-checked`, Command filters items, Dialog
  and Popover open and close, Select picks a value, `Toaster` follows `data-scheme`.
- A contract test (`src/contract.test.ts`) that reads the source tree and fails if:
  - a component exported from `index.ts` has no matching story file;
  - any file under `src/` imports `next`, `next-themes`, `astro`, `vue` or `@astrojs/*`;
  - any class string contains `dark:`, a raw palette colour (`gray-`, `zinc-`, `black`, `white`,
    ...) or a hex literal.
- A dist test (`src/dist.test.ts`, the lib's `test` target gains `dependsOn: ["build"]`) that fails
  if `dist/styles.css` lacks `--seed`, `[data-scheme=dark]` or an `@font-face` for each of the three
  families, or contains `@import` or a URL outside `dist/`; and if `dist/index.js` does not export
  every component.
- `test-storybook` renders every story. It is not in CI's `affected` targets; run it locally before
  each PR.
- Apps: calibre's Playwright suite (filter, tag editing, search, bulk delivery) exercises Popover,
  Command, Select, Dialog and Toaster and must pass unchanged. personal-website's CLAUDE.md rule
  applies: load a page from `pnpm nx dev personal-website` after the portfolio migration.

Gate for every PR: `pnpm nx affected -t lint test typecheck build` green.

## 7. Migration order

Each step is its own PR off `main`, so a regression is isolated to one app.

1. Lib: scaffold `libs/rainforest-react` (Nx generator for a Vite React library, then trimmed), port
   the sixteen components, stories, tests, both CSS files. No app changes. Evidence: Storybook
   screenshots, light and dark.
2. personal-calibre: replace `@/components/ui/*` imports with `@rainforest-dev/rainforest-react`,
   delete `src/components/ui/` (keep `lib/utils.ts`, app code uses its `cn`), drop
   `next-themes`, `shadcn`, `@base-ui/react`, `cmdk`, `sonner` and `tw-animate-css` from the app when
   they become unused, swap `shadcn/tailwind.css` for the lib's `tailwind.css`, drop the radius
   override. Dockerfile: copy and build `libs/rainforest-react` (`vite build` in the lib) after the
   `shadcn.ts` step. Calibre goes first because its copies are the lib's source, so the visual diff
   is near zero.
3. rss-manager: replace the hand-rolled buttons, inputs, table, status pills and notices in the four
   islands. The segmented filters become `Button` with `aria-pressed` and the `secondary`/`ghost`
   variants. Dockerfile as in step 2.
4. personal-website: the portfolio islands in `libs/personal-portfolio` take Button and Switch from
   the lib. `shared/ui.ts` keeps only `segment()` and `avatar()` if still used, `Switch.tsx` is
   deleted. The portfolio's `danger` button becomes Button `variant="destructive"` if its look is
   accepted, otherwise a new `destructive-outline` variant in the lib. The Vue components follow
   Open decision 1.

personal-memories is not in scope; it can adopt the lib in a later task (Open decision 5).

## 8. Visual evidence

Captured with the `capture-evidence` skill and attached with `attach-pr-media`; captures are not
committed.

| PR | Before / after screens | Viewports | Schemes |
| --- | --- | --- | --- |
| Lib | Storybook, every component (after only, new feature) | 1280 | light, dark |
| calibre | library grid, filter bar with Popover, Command and Select open, book detail, tag editor, a toast | 1280, 390 | light, dark |
| rss-manager | source table, feed validator (valid and invalid), reading queue, topic list | 1280, 390 | light, dark |
| personal-website | two case-study pages with buttons and a Switch | 1280, 390 | light, dark |

Calibre runs on the e2e fixture library (`apps/personal-calibre-e2e/src/fixtures`), rss-manager on a
local registry copy. No private data leaves the machine.

## 9. Risks

- `'use client'` lost in bundling. Vite drops module-level directives when it merges modules.
  `preserveModules` avoids the merge; the dist test checks that `dist/components/button.js` starts
  with the directive and `dist/components/button-variants.js` does not.
- Tailwind class scanning. If the app's Tailwind misses the lib's `dist/`, components render
  unstyled with no error. The `@source './'` in `tailwind.css` covers it; calibre's Playwright run
  and the screenshots confirm it.
- Look changes in personal-website and rss-manager. The shared recipes are `base-nova` (`h-8`
  buttons, `rounded-lg`), while the website and portfolio use the older `h-10`, `rounded-md` look.
  The migration changes those sizes unless Open decision 2 goes the other way.
- Removing `dark:` from the calibre copies can shift dark-mode contrast of outline and destructive
  buttons and inputs. The dark screenshots are the check.
- Docker images: calibre and rss-manager must build the new lib inside the image, which adds its
  `node_modules` install to the image build.
- `/design-sync` is not exercised in this task. A first sync may still hit issues this spec cannot
  test (secondary sources report React version mismatches and class-scanning gaps).

## 10. Open decisions

1. **personal-website's Vue components.** They cannot import React components, so the task's
   "import from the library, delete local copies" cannot hold for them as written. Options: (a) keep
   the Vue copies and scope the task to React consumers; (b) keep them but point them at recipes from
   a framework-free `@rainforest-dev/rainforest-react/variants` entry so the look stays in one place;
   (c) port the 12 Vue consumers to React islands. Recommendation: (a) in this task, and (b) as a
   follow-up once the recipes settle. (c) is a redesign-sized change and the research note already
   plans it per island after the Claude Design redraw.
2. **Which look wins for shared recipes.** calibre's `base-nova` (compact, `h-8`) or the website's
   `new-york` v3 (`h-10`). Recommendation: `base-nova`. It is current shadcn, matches Base UI, and
   calibre is the densest app. The portfolio islands get a `size="lg"` where the taller button reads
   better.
3. **Scope beyond the existing copies.** Switch, Table and Alert are not copies today. Recommendation:
   include them. rss-manager has nothing to swap without them, and the research note flags Table as
   needed for the rss-manager redesign.
4. **Radius scale.** Plugin scale (`-4px/-2px/0/+4px`) or calibre's multipliers.
   Recommendation: plugin scale, since three of four apps already use it and it lives with the tokens.
5. **personal-memories.** Recommendation: leave it out of this task and adopt the lib when the
   memories v2 redesign is built, since that work rewrites its components anyway.
6. **Package name.** `@rainforest-dev/rainforest-react` or `@rainforest-dev/rainforest-ui-react`.
   Recommendation: `rainforest-react`, short and clearly separate from the Lit package.
7. **Publishing.** Mark the new lib `private: true` or release it with `nx release` next to
   `rainforest-ui`. Recommendation: `private: true` until after the first `/design-sync`; nothing
   outside the monorepo consumes it.
