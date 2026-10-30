# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Monorepo Structure

Nx 23.2.1 monorepo using pnpm workspaces (pnpm@11.7.0):

- **apps/personal-website** - Astro 6 + SSR personal website (primary app), deployed on Vercel
- **apps/personal-liff** - Next.js 16 LINE LIFF app (dev port 9000, self-signed HTTPS via `--experimental-https`)
- **apps/personal-liff-e2e** - Playwright e2e tests
- **apps/personal-calibre** - Next.js Calibre library browser, shipped as a Docker image
- **apps/personal-calibre-e2e** - Playwright e2e tests
- **apps/library-hall** - Next.js 3D hall at the root of `library.rainforest.tools` (dev port 8087), shipped as a Docker image. It also serves the library MCP at `/api/mcp`: `search_library` over every collection or the ones named (`in=` on `/api/search`), plus the book and notebook tools forwarded to their apps. Its static page gathers every collection's `/api/hall-items` through `/api/items`, so the way back from a book is a bfcache restore; a non-bfcache return shows the last frame as a poster until the scene redraws
- **apps/library-hall-e2e** - Playwright e2e tests against a production build and a fictional collections server
- **apps/personal-notebook** - Next.js Bullet Journal notebook app at `/notebooks` (Next `basePath`; dev port 8086), shipped as a Docker image. Owns the notebook DB, page images, OCR and the notebook MCP tools; calibre forwards those tools to it and redirects its old `/notebooks` links
- **apps/personal-notebook-e2e** - Playwright e2e tests
- **apps/reading-room** - Astro + React reading room of the library (renamed from rss-manager): the rack at `/rack` (reading-queue shelves, `/rack/sources` registry desk) and `/kb`, reserved for the knowledge base; shipped as a Docker image
- **apps/reading-room-e2e** - Playwright e2e tests against a generated fictional vault and a local feed server
- **apps/personal-memories** - Astro + React memories album (dev port 3004, bound to 127.0.0.1); private data stays outside the repo, and the homelab image mounts it read-only behind the Cloudflare Access gate
- **apps/personal-memories-e2e** - Playwright e2e tests
- **libs/personal-data** - Profile, work history and project data, read by the website and its MCP tools
- **libs/personal-portfolio** - Case study content and the MCP registrations that expose it
- **libs/web-ai** - Framework-free Chrome built-in AI helpers (Prompt API probe and sessions), used by the website and personal-memories
- **libs/mcp-kit** - Framework-free MCP server kit: a stateless `(Request) => Response` handler, `defineTool`/`registerTools` over zod v4 shapes, result and error helpers, `gatewayAuth` for the OAuth gateway's shared-secret header, and `forwardTools`/`httpToolCaller` to serve another server's tools
- **libs/notebook-tools** - The nine notebook MCP tool definitions, run by personal-notebook and forwarded by personal-calibre
- **libs/book-tools** - The Calibre book MCP tool definitions, run by personal-calibre and forwarded by library-hall
- **libs/library-contract** - Framework-free contract for the one-hostname library (`library.rainforest.tools`): collection paths, the `hall-items` schema, shared URL filter params, the `library-prefs` cookie, the locales (`zh`, `en`) and their negotiation, and cross-tab messages
- **libs/library-shell** - React shell every library app shares: `LibraryBar`, the one top bar (library name back to the hall, collection switcher, the app's own controls, library-wide search, language) with the phone tab bar under it; `SectionNav`, a collection's second level in the row under the bar (a search within the collection goes there, never in place of the bar's); `LibraryBreadcrumb` (collection › … › page) on every detail page; `--library-top`, where sticky columns start under the bar and that row; the filters/content/pane layout, collection nav and phone tab bar, cross-document View Transitions, Speculation Rules, the `/_shell` fonts and same-origin shared state, and i18n: i18next with each app's typed `zh`/`en` dictionaries, `LibraryI18nProvider`/`useLibraryT`, and the `LocaleSwitch` that stores the reader's pick in `library-prefs`. A Next app renders under an `app/[lang]` segment its proxy rewrites to, so URLs carry no locale and static pages stay static. An app that uses it runs `tools/library-shell/sync-assets.mjs` to serve `/_shell` from `public/`
- **libs/rainforest-ui** - Lit web components library with Tailwind CSS v4.1 + Material Design 3

## Essential Commands

```bash
# ALWAYS use nx commands, NEVER npm scripts directly
pnpm nx dev personal-website          # Astro dev server
pnpm nx dev personal-liff            # Next.js dev server (port 9000)
pnpm nx build <project>              # Build project (auto-builds dependencies)
pnpm nx test rainforest-ui           # Run Vitest unit tests
pnpm nx e2e personal-liff-e2e        # Run Playwright e2e tests
pnpm nx lint <project> --fix         # Lint with auto-fix
pnpm nx affected -t lint test typecheck  # Run affected tasks (for CI)

# Single test file
pnpm nx test rainforest-ui -- src/path/to/file.test.ts

# Nx utilities
pnpm nx graph                        # Visualize project dependencies
pnpm nx sync                         # Sync TypeScript project references
pnpm exec nx release                  # Version and release libraries
```

## Critical Architecture

### Dependency Chain

personal-website → @rainforest-dev/rainforest-ui (via `workspace:*`)

The `dependsOn: ["^build"]` is configured in `apps/personal-website/package.json` under `nx.targets.build` and `nx.targets.dev`, so building personal-website automatically builds rainforest-ui first.

### Shared Theme

Every app gets its colours, radius and light/dark switching from one Tailwind plugin,
[libs/rainforest-ui/src/tailwindcss/shadcn.ts](libs/rainforest-ui/src/tailwindcss/shadcn.ts):

```css
@import 'tailwindcss';
@plugin "@rainforest-dev/rainforest-ui/tailwindcss/shadcn";
```

`personal-website`, `personal-calibre` and `reading-room` all load it. Every token is derived from a
single `--seed` with `oklch(from var(--seed) L C h)`, so changing the seed re-themes all three.
Beyond the stock shadcn set it defines `success` / `warning` / `info`, `chart-1..5` and `sidebar-*`.
Each app sets its own `--radius` in `@theme`: a plugin's `addBase` lands in `@layer base`, which
would silently beat `@theme`.

- Style with semantic utilities (`bg-muted`, `text-muted-foreground`, `bg-success/15`). Raw palette
  classes (`text-gray-500`, `bg-violet-600`) and hex literals bypass the seed and do not switch
  scheme.
- The tokens follow `prefers-color-scheme` unless an ancestor carries `data-scheme="light|dark"`.
  Tailwind's `dark:` variant only ever follows the OS, so it disagrees with a forced
  `data-scheme`; reach for a token before a `dark:` utility. Do not add a `.dark` class variant;
  the plugin never sets one.
- UI type is Inter (`--font-sans`). Lora is the website's editorial serif only.
- The plugin resolves from `dist/`, so consuming apps need `dependsOn: ["^build"]`.

`personal-liff` is still the unstyled `create-liff-app` scaffold on Mantine and does not load it.

### rainforest-ui Multi-Entry Build

The library uses glob-based entry points in [vite.config.ts](libs/rainforest-ui/vite.config.ts):

```typescript
entry: {
  index: 'src/index.ts',
  'tailwindcss/md3': 'src/tailwindcss/md3.ts',
  ...Object.fromEntries(
    glob.sync('src/{lit,utils}/**/!(*.spec|*.test).ts')
      .map((e) => [e.replace('src/', '').replace('.ts', ''), e])
  )
}
```

**Key implication**: Every `.ts` file in `src/lit/` and `src/utils/` becomes an entry point. Deep imports work automatically:

```typescript
import '@rainforest-dev/rainforest-ui/lit/design-system/colors';
import { sourceColorFromImageBytes } from '@rainforest-dev/rainforest-ui';
```

### Astro Custom Elements

[astro.config.mjs](apps/personal-website/astro.config.mjs) registers Material Web Components and custom components:

```javascript
vue({
  template: {
    compilerOptions: {
      isCustomElement: (tag) =>
        tag.startsWith('md-') ||
        tag.startsWith('rf-') ||
        ['iconify-icon'].includes(tag),
    },
  },
});
```

Components from `@material/web` (md-_) and rainforest-ui (rf-_) work in Astro/Vue without framework wrappers.

### React Wrappers for Material Web

See [apps/personal-website/src/components/md3.ts](apps/personal-website/src/components/md3.ts) for the pattern:

```typescript
import { createComponent } from '@lit/react';
export const FilterChip = createComponent({
  tagName: 'md-filter-chip',
  elementClass: MdFilterChip,
  react: React,
  events: { onClick: 'click' },
});
```

### Vercel SSR Adapter

`astro.config.mjs` uses `@astrojs/vercel` with `output: 'server'`, Vercel Web Analytics, and Vercel image service enabled. The site deploys to `https://rainforest.tools`.

### PWA

`personal-website` uses `@vite-pwa/astro` (wraps `vite-plugin-pwa`). PWA config lives in `astro.config.mjs`. Service worker is registered via `virtual:pwa-register` in `src/pwa.ts`. `devOptions.enabled: true` means the service worker is active in dev mode too.

> **Note**: `astro-compress` is loaded via dynamic import (`(await import('astro-compress')).default()`) due to ESM compatibility constraints.

## TypeScript Configuration

- **Strict mode enabled** with aggressive flags (`noUnusedLocals`, `noImplicitReturns`)
- **Composite project references** - run `pnpm nx sync` if references drift
- **Target ES2022** defined in [tsconfig.base.json](tsconfig.base.json)

## Code Style

### Prettier

Configured with `singleQuote: true` and `prettier-plugin-tailwindcss` for Tailwind class sorting. Run with:

```bash
pnpm prettier --write <file>
```

### Import Sorting (Enforced)

ESLint uses `simple-import-sort` - imports must be alphabetically sorted:

```bash
pnpm nx lint <project> --fix  # Auto-sort imports
```

### Imports

- Apps: `@/*` maps to `src/*` in every app. A cross-directory import uses the alias and goes
  through that directory's barrel `index.ts` (`@/components/library`), never `../`; lint fails on
  `../` under `apps/*/src`. A same-directory import uses `./file`. A module never imports its own
  directory's barrel or an ancestor's: when the target sits in an ancestor directory, import the
  file itself through the alias (`@/utils/env`, not `@/utils`).
- A barrel never mixes environments. Server-only modules (DB access, `node:` built-ins,
  `server-only`) live in their own directory behind their own barrel (`lib/server`), so a client
  component that imports a barrel cannot drag server code into the browser bundle. In Next.js a
  barrel must not mix `'use client'` modules with server-only ones. Compare the client bundle
  before and after adding a barrel: calibre and memories each caught a leak that way.
- Import these by file, not through a barrel:
  - Astro islands (components rendered with `client:*`). Astro builds one hydration chunk per
    import, so a barrel merges every island it re-exports into one chunk that each page loads.
  - `.astro` components and side-effect scripts (`personal-memories/src/scripts/*`).
- A Next.js app that uses barrels declares `"sideEffects": ["**/*.css"]` in its `package.json`.
  Without it Turbopack keeps every re-export of a client-component barrel, as it did in calibre.
- Relative paths that stay, because the tool cannot resolve the alias:
  - `personal-memories/src/cli` and `src/lib/ingest`, which plain `node` runs. Their own
    `eslint.config.js` turns the `../` rule off there.
  - Tailwind `@reference` in a `<style>` block, and Vite dynamic imports built from a variable
    (``import(`../locales/${lng}.json`)``), which must start with `./` or `../`.
- Packages: consumers import the package root or a declared subpath entry
  (`@rainforest-dev/rainforest-ui/interaction`); deep file paths are not part of the API. Inside
  `libs/*`, keep relative imports: tsconfig `paths` are not rewritten in the emitted `.d.ts`.
- `import-x/no-cycle` runs in lint and fails CI on any cycle. Type-only imports (`import type`)
  do not count as edges, and it cannot see edges inside `.astro` or `.vue` files.

### Module Boundaries

ESLint enforces Nx module boundaries with `@nx/enforce-module-boundaries` rule. Projects can only import from declared dependencies in package.json.

### rainforest-ui Lint Rules

`libs/rainforest-ui` uses `eslint-plugin-lit` (`flat/recommended`) and `eslint-plugin-storybook` (`flat/recommended`). Story files must import types from `@storybook/web-components-vite` (the framework package), not `@storybook/web-components` (the renderer).

## Testing

- **Vitest 4** projects are discovered by the `@nx/vitest` Nx plugin (`nx.json`), not a `vitest.workspace.ts` file
- Tests use `.test.ts` or `.spec.ts` suffixes
- Coverage outputs to `coverage/<project-name>/`
- rainforest-ui uses jsdom environment

## Storybook

```bash
pnpm nx storybook rainforest-ui      # Dev server
pnpm nx build-storybook rainforest-ui # Build static site
```

Stories live in [libs/rainforest-ui/stories/](libs/rainforest-ui/stories/) using Storybook 10 + Web Components format.

**Storybook 10 config pattern**: Addon and framework names in `.storybook/main.ts` must be wrapped with `getAbsolutePath()` (defined in the file using `import.meta.resolve`). Do not pass bare strings.

## Astro 6 — Content Collections

Content collection config lives at `apps/personal-website/src/content.config.ts` (not `src/content/config.ts` — that was the Astro 5 location).

Always import `z` from `astro/zod`, not from `astro:content` (deprecated) or bare `zod`:

```typescript
import { defineCollection, reference } from 'astro:content';
import { z } from 'astro/zod';
```

Zod v4 top-level validators replace deprecated string-chained ones:

```typescript
// ✅ Zod v4
z.url();
z.email();

// ❌ deprecated
z.string().url();
z.string().email();
```

## pnpm Catalogs

Shared dependency versions are defined in `pnpm-workspace.yaml` under the `catalog:` key. When adding a package that already has a catalog entry (`react`, `react-dom`, `next`, `lit`, `tailwindcss`, `@tailwindcss/vite`, `@tailwindcss/typography`, `@material/material-color-utilities`, `@types/node`, `@types/react`, `@types/react-dom`, `typescript`), use `"catalog:"` as the version string in `package.json`:

```json
"react": "catalog:"
```

Run `pnpm install` after editing versions in `pnpm-workspace.yaml`.

## i18n (personal-website)

Uses i18next with:

- Translations in [apps/personal-website/locales/{en,zh}/](apps/personal-website/locales/)
- Settings in `src/utils/i18n/settings.ts`
- Astro i18n config uses `fallbackLng` and `supportedLngs` from settings

## Markdown Rendering

Astro markdown configured with:

- `remark-math` + `rehype-katex` for LaTeX math
- Shiki syntax highlighting with Material Theme (light/dark variants)

## CI/CD

[.github/workflows/ci.yml](.github/workflows/ci.yml) runs on Node 24:

```bash
pnpm format:check
pnpm nx affected -t lint test typecheck
```

Caches the pnpm store via `actions/setup-node` with `cache: 'pnpm'`. Nx Cloud distribution across 3 `linux-medium-js` agents is opt-in: it runs only when the repository variable `NX_CLOUD_ENABLED` is `true`, and no such variable is set, so CI runs without Nx Cloud.

### Docker images

The homelab images (`personal-memories`, `reading-room`, `personal-calibre`, `personal-notebook`, `library-hall`) never build
inside Docker. `nx bundle <app>` builds the app through the normal `^build` chain and writes a
self-contained runtime directory to `dist/artifacts/<app>`: the `@vercel/nft` trace of the Astro
server entry, or Next's standalone output plus `static` and `public`. Its native binaries are
swapped for linux-arm64-musl, the image platform, and any `.node` or `.so` it cannot place fails the
bundle. Each Dockerfile only copies that directory onto `node:24-alpine`, and `docker:build` depends
on `bundle`. The scripts are in [tools/app-artifact/](tools/app-artifact/).

CI runs `nx affected -t smoke-artifact`, which bundles for the host instead, boots the server from
the artifact with the e2e fixture data and requests a page and an API route. A workspace dependency
the build cannot resolve, or a runtime file the trace missed, fails there rather than in the
release image build on `main`.

## Common Workflows

### Adding Lit Component to rainforest-ui

1. Create `libs/rainforest-ui/src/lit/<category>/<component-name>.ts`
2. Export from `libs/rainforest-ui/src/index.ts` if needed for barrel exports
3. Write stories in `libs/rainforest-ui/stories/<component-name>.stories.ts`
4. Component automatically exposed for deep imports via glob config

### Using rainforest-ui Components

```typescript
// Side-effect import (registers web component)
import '@rainforest-dev/rainforest-ui/lit/design-system/colors';

// Function import
import { sourceColorFromImageBytes } from '@rainforest-dev/rainforest-ui';
```

### Debugging Build Issues

```bash
pnpm nx graph              # Check dependency relationships
pnpm nx sync               # Fix TypeScript project references
pnpm nx reset              # Clear Nx cache
```

### A green `astro build` says nothing about `astro dev`

For `personal-website`, the two pipelines diverge enough that each has shipped a break the other
could not see. Both times the build was verified and correct, and dev was unusable:

- **React Fast Refresh leaking into Vue SFCs** — every page died with `$RefreshSig$ is not defined`
  in dev; production strips Fast Refresh, so the build never noticed.
- **`import 'katex/dist/katex.min.css'` in a layout** — SSR externalises bare specifiers to Node,
  which has no `.css` loader, so dev threw `ERR_UNKNOWN_FILE_EXTENSION` on every page while the
  build emitted a correct fingerprinted stylesheet.

Both fixes live in `apps/personal-website/astro.config.mjs` (`vite.plugins` and
`vite.resolve.noExternal`) with the full reasoning inline.

**So: after changing `astro.config.mjs`, a layout, or anything imported by one, load a page from a
running `pnpm nx dev personal-website` before calling it verified.** Checking the built output —
however carefully — cannot catch this class of bug.

## Package Manager

**MUST use pnpm@11.7.0** - specified in package.json `packageManager` field. Commands:

```bash
pnpm install          # Install dependencies
pnpm add <pkg>        # Add dependency (use -w for workspace root)
```
