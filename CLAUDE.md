# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Structure

Nx 21.6 monorepo using pnpm workspaces (pnpm@9.15.0):

- **apps/personal-website** - Astro 5 + SSR personal website (primary app)
- **apps/personal-liff** - Next.js 15 LINE LIFF app
- **apps/personal-liff-e2e** - Playwright e2e tests
- **libs/rainforest-ui** - Lit web components library with Tailwind CSS v4.1 + Material Design 3

## Essential Commands

```bash
# ALWAYS use nx commands, NEVER npm scripts directly
nx dev personal-website          # Astro dev server
nx dev personal-liff            # Next.js dev server
nx build <project>              # Build project (auto-builds dependencies)
nx test rainforest-ui           # Run Vitest unit tests
nx e2e personal-liff-e2e        # Run Playwright e2e tests
nx lint <project> --fix         # Lint with auto-fix
nx affected -t lint test typecheck  # Run affected tasks (for CI)

# Single test file
nx test rainforest-ui -- src/path/to/file.test.ts

# Nx utilities
nx graph                        # Visualize project dependencies
nx sync                         # Sync TypeScript project references
npx nx release                  # Version and release libraries
```

## Critical Architecture

### Dependency Chain
personal-website → @rainforest-dev/rainforest-ui (via `workspace:*`)

Build targets have `dependsOn: ["^build"]` in nx.json, so building personal-website automatically builds rainforest-ui first.

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

## TypeScript Configuration

- **Strict mode enabled** with aggressive flags (`noUnusedLocals`, `noImplicitReturns`)
- **Composite project references** - run `nx sync` if references drift
- **Target ES2022** defined in [tsconfig.base.json](tsconfig.base.json)

## Code Style

### Import Sorting (Enforced)
ESLint uses `simple-import-sort` - imports must be alphabetically sorted:
```bash
nx lint <project> --fix  # Auto-sort imports
```

### Module Boundaries
ESLint enforces Nx module boundaries with `@nx/enforce-module-boundaries` rule. Projects can only import from declared dependencies in package.json.

## Testing

- **Vitest workspace** discovers all `vite.config.ts` files via [vitest.workspace.ts](vitest.workspace.ts)
- Tests use `.test.ts` or `.spec.ts` suffixes
- Coverage outputs to `coverage/<project-name>/`
- rainforest-ui uses jsdom environment

## Storybook

```bash
nx storybook rainforest-ui      # Dev server
nx build-storybook rainforest-ui # Build static site
```

Stories live in [libs/rainforest-ui/stories/](libs/rainforest-ui/stories/) using Storybook 9 + Web Components format.

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

[.github/workflows/ci.yml](.github/workflows/ci.yml) runs:
```bash
nx affected -t lint test typecheck
```

Uses Nx Cloud with 3 distributed agents (`linux-medium-js`) and caches node_modules via pnpm.

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
nx graph              # Check dependency relationships
nx sync               # Fix TypeScript project references
nx reset              # Clear Nx cache
```

## Migration Status

- Recently migrated to Nx 21.6.3 (migrate-nx-21 branch)
- Storybook 9 migration partially complete (see [storybook-migration-summary.md](storybook-migration-summary.md))
- Using Tailwind CSS v4.1 with new `@tailwindcss/vite` plugin
- React 19 and Next.js 15 (latest stable)

## Package Manager

**MUST use pnpm@9.15.0** - specified in package.json `packageManager` field. Commands:
```bash
pnpm install          # Install dependencies
pnpm add <pkg>        # Add dependency (use -w for workspace root)
```
