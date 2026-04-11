# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Structure

Nx 22.6.4 monorepo using pnpm workspaces (pnpm@9.15.0):

- **apps/personal-website** - Astro 6 + SSR personal website (primary app), deployed on Vercel
- **apps/personal-liff** - Next.js 16 LINE LIFF app (dev port 9000, self-signed HTTPS via `--experimental-https`)
- **apps/personal-liff-e2e** - Playwright e2e tests
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
        tag.startsWith('md-') || tag.startsWith('rf-') || ['iconify-icon'].includes(tag)
    }
  }
})
```

Components from `@material/web` (md-*) and rainforest-ui (rf-*) work in Astro/Vue without framework wrappers.

### React Wrappers for Material Web
See [apps/personal-website/src/components/md3.ts](apps/personal-website/src/components/md3.ts) for the pattern:
```typescript
import { createComponent } from '@lit/react';
export const FilterChip = createComponent({
  tagName: 'md-filter-chip',
  elementClass: MdFilterChip,
  react: React,
  events: { onClick: 'click' }
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

### Module Boundaries
ESLint enforces Nx module boundaries with `@nx/enforce-module-boundaries` rule. Projects can only import from declared dependencies in package.json.

### rainforest-ui Lint Rules
`libs/rainforest-ui` uses `eslint-plugin-lit` (`flat/recommended`) and `eslint-plugin-storybook` (`flat/recommended`). Story files must import types from `@storybook/web-components-vite` (the framework package), not `@storybook/web-components` (the renderer).

## Testing

- **Vitest 4 workspace** discovers all `vite.config.ts` and `vitest.config.ts` files via [vitest.workspace.ts](vitest.workspace.ts)
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
z.url()
z.email()

// ❌ deprecated
z.string().url()
z.string().email()
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

[.github/workflows/ci.yml](.github/workflows/ci.yml) runs on Node 20:
```bash
pnpm nx affected -t lint test typecheck
```

Uses Nx Cloud with 3 distributed agents (`linux-medium-js`) and caches the pnpm store via `actions/setup-node` with `cache: 'pnpm'`.

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

## Package Manager

**MUST use pnpm@9.15.0** - specified in package.json `packageManager` field. Commands:
```bash
pnpm install          # Install dependencies
pnpm add <pkg>        # Add dependency (use -w for workspace root)
```


<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
