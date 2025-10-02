# Rainforest Monorepo - AI Coding Agent Instructions

## Architecture Overview

This is an Nx 21.6 monorepo using pnpm workspaces with three main applications and one shared UI library:

- **apps/personal-website** - Astro 5 + SSR personal website (primary app)
- **apps/personal-liff** - Next.js 15 LINE LIFF app
- **apps/personal-liff-e2e** - Playwright e2e tests
- **libs/rainforest-ui** - Shared Lit-based web components library with Tailwind CSS + Material Design 3

### Key Architectural Decisions

**Workspace Dependencies**: The personal-website imports the UI library as `@rainforest-dev/rainforest-ui` using pnpm workspace protocol (`workspace:*`). Build targets have `dependsOn: ["^build"]` to ensure dependencies build first.

**Component Strategy**: rainforest-ui exports Lit web components that work across frameworks (Astro, Vue, React). Components are imported with deep paths like `@rainforest-dev/rainforest-ui/lit/design-system/colors` due to the library's modular export structure (see package.json exports field).

**Material Design Integration**: The website uses Material Web Components (`@material/web`) for UI elements (`md-*` tags) and integrates with custom `rf-*` Lit components. These are registered as custom elements in Astro/Vue compiler options.

## Development Workflows

### Running Projects

```bash
# Development servers (use Nx, not npm)
nx dev personal-website          # Astro dev server with hot reload
nx dev personal-liff --port 9000 # Next.js with turbo + experimental HTTPS

# Building
nx build personal-website        # Depends on rainforest-ui build automatically
nx build rainforest-ui          # Builds lib with Vite (outputs to libs/rainforest-ui/dist)

# Testing
nx test rainforest-ui           # Vitest unit tests with jsdom
nx e2e personal-liff-e2e        # Playwright e2e tests
nx affected -t lint test typecheck  # Run affected tasks (CI workflow)

# Storybook
nx storybook rainforest-ui      # Dev server for component stories
nx build-storybook rainforest-ui # Build static Storybook
```

### Important: Never use npm scripts directly

Always use `nx run <project>:<target>` or `nx <target> <project>` commands. Nx handles dependency graphs and caching.

## Project-Specific Conventions

### Import Sorting

ESLint enforces `simple-import-sort` plugin. Imports must be alphabetically sorted. Run `nx lint --fix` to auto-sort.

### TypeScript Configuration

- **Strict mode enabled** with aggressive compiler options (`noUnusedLocals`, `noImplicitReturns`, etc.)
- **Composite project references** are auto-synced by Nx. Run `nx sync` manually if tsconfig.json references drift.
- **tsconfig.base.json** defines shared compiler options used by all projects.

### rainforest-ui Library Structure

The library uses a glob-based multi-entry build in `vite.config.ts`:

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

This means each `.ts` file in `src/lit/` and `src/utils/` becomes its own entry point. When adding new components, they're automatically exposed for deep imports.

### Astro Integration Points

**Custom Elements**: `astro.config.mjs` registers `md-*`, `rf-*`, and `iconify-icon` as custom elements in Vue integration:

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

**i18n**: Astro uses i18next with language detection. Translations are in `apps/personal-website/locales/{en,zh}/`. The default locale is defined in `src/utils/i18n/settings.ts`.

**Markdown**: Configured with remark-math + rehype-katex for LaTeX math rendering, and Shiki syntax highlighting with Material Theme variants.

## Testing & Quality

### Test Configuration

- **Vitest workspace** (`vitest.workspace.ts`) discovers all `vite.config.ts` and `vitest.config.ts` files
- Tests use `.test.ts` or `.spec.ts` suffixes
- Coverage reports to `coverage/<project-name>` directories

### ESLint Rules

- Enforces Nx module boundaries with buildable lib dependencies
- Blocks imports between projects without proper dependency declarations
- Uses flat config format (`eslint.config.js`)

## CI/CD

The `.github/workflows/ci.yml` workflow:

1. Uses Nx Cloud distributed task execution (3 linux-medium-js agents)
2. Runs `nx affected -t lint test typecheck` on PRs
3. Caches node_modules via pnpm cache
4. Sets up affected SHAs using `nrwl/nx-set-shas@v4`

## Common Patterns

### Adding a New Lit Component to rainforest-ui

1. Create `libs/rainforest-ui/src/lit/<category>/<component-name>.ts`
2. Export from `libs/rainforest-ui/src/index.ts` if needed for barrel exports
3. Write Storybook stories in `libs/rainforest-ui/stories/<component-name>.stories.ts`
4. The component is auto-exposed due to glob-based build config

### Using rainforest-ui in personal-website

```typescript
// Import web component registration side-effect
import '@rainforest-dev/rainforest-ui/lit/design-system/colors';

// Import utility functions
import { sourceColorFromImageBytes } from '@rainforest-dev/rainforest-ui';
```

### Creating React Wrappers for Material Web

See `apps/personal-website/src/components/md3.ts` for the pattern using `@lit/react` createComponent:

```typescript
export const FilterChip = createComponent({
  tagName: 'md-filter-chip',
  elementClass: MdFilterChip,
  react: React,
  events: { onClick: 'click' },
});
```

## Migration Notes

- Currently on Nx 21.6.3 (migrate-nx-21 branch)
- Storybook 9 migration partially complete (see `storybook-migration-summary.md`)
- Using Tailwind CSS v4.1 with new `@tailwindcss/vite` plugin
- React 19 and Next.js 15 in use (latest stable versions)

## Key Files Reference

- `nx.json` - Nx plugin configuration and target defaults
- `pnpm-workspace.yaml` - Workspace package discovery
- `tsconfig.base.json` - Shared TypeScript configuration
- `eslint.config.js` - Root ESLint flat config with Nx rules
- `vitest.workspace.ts` - Vitest multi-project setup
