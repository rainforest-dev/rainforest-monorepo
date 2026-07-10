# Personal Website: Material Web → shadcn Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every Material Web (`md-*`) component, the Material HCT theming engine, and the Material Symbols icon font in `apps/personal-website` with shadcn-vue (reka-ui primitives), a native-CSS OKLCH `--seed` token engine, and `@lucide/vue` icons — while keeping the site's fonts, i18n, content, and the "one seed color re-tints everything" feature unchanged.

**Architecture:** A new plain-CSS Tailwind plugin in `rainforest-ui` (`tailwindcss/shadcn.ts`) replaces `tailwindcss/md3.ts`, deriving every shadcn-convention CSS variable from one `--seed` custom property via native CSS relative-color syntax. `apps/personal-website` gets a `components.json` + `src/components/ui/*` shadcn-vue primitives (Button, DropdownMenu, Input, Textarea, Badge, Tabs), which every existing Vue/Astro component is migrated to one file at a time. Icons move from Google's Material Symbols ligature font to `@lucide/vue` (UI glyphs) with `iconify-icon` narrowed to brand/tech logos only.

**Tech Stack:** Astro 6, Vue 3, Tailwind CSS v4, reka-ui, class-variance-authority, tailwind-merge, @lucide/vue, iconify-icon (retained, narrowed scope)

---

## File Structure

**New files:**
- `libs/rainforest-ui/src/tailwindcss/shadcn.ts` — the new token-engine Tailwind plugin
- `apps/personal-website/components.json` — shadcn-vue CLI config (for future `shadcn-vue add`, even though this plan hand-writes the components)
- `apps/personal-website/src/utils/cn.ts` — `clsx` + `tailwind-merge` class helper
- `apps/personal-website/src/components/ui/button/Button.vue`, `index.ts`
- `apps/personal-website/src/components/ui/dropdown-menu/{DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem,DropdownMenuSeparator}.vue`, `index.ts`
- `apps/personal-website/src/components/ui/input/Input.vue`, `index.ts`
- `apps/personal-website/src/components/ui/textarea/Textarea.vue`, `index.ts`
- `apps/personal-website/src/components/ui/badge/Badge.vue`, `index.ts`
- `apps/personal-website/src/components/ui/tabs/{Tabs,TabsList,TabsTrigger,TabsContent}.vue`, `index.ts`

**Modified files (existing Material Web usage → shadcn-vue/lucide):**
- `libs/rainforest-ui/vite.config.ts`, `libs/rainforest-ui/src/index.ts`
- `apps/personal-website/src/app.css`, `apps/personal-website/src/layouts/head.astro`
- `apps/personal-website/src/components/theme-provider.astro`
- `apps/personal-website/src/components/home/nav.vue`, `language-picker.vue`, `fab.vue`, `footer.astro`, `links.astro`, `contact-form.astro`
- `apps/personal-website/src/components/home/hero/three-columns.astro`, `one-column.astro`, `theme-color-modifier.vue`
- `apps/personal-website/src/components/home/experiences/index.astro`
- `apps/personal-website/src/components/blog/post.astro`
- `apps/personal-website/src/components/color-system.vue`, `source-color.vue`
- `apps/personal-website/src/layouts/blog.astro`
- `apps/personal-website/src/pages/blog/index.astro`
- `apps/personal-website/src/components/index.ts`
- `apps/personal-website/package.json`, `pnpm-workspace.yaml`

**Deleted files:**
- `libs/rainforest-ui/src/tailwindcss/md3.ts`
- `apps/personal-website/src/components/md3.ts`
- `apps/personal-website/src/components/ai-button.ts`

**Explicitly out of scope for this plan** (flagging, not silently skipping): `apps/personal-website/src/components/blog/demo/quick-posts/weather-forecast/index.vue` and `.../demo/webgpu/web-llm.vue` still use `md-outlined-button`/`md-outlined-text-field`/`md-filled-button` — these are one-off interactive widgets embedded in specific blog posts (content, not site chrome). They're left on Material Web after this plan; Task 20 files a follow-up rather than converting them here.

**Testing approach:** This app has no component/visual test suite today (`vitest.config.ts` only covers `src/mcp/**`). Every task's verification step is `pnpm nx build personal-website` (catches template/type errors) plus manual visual/responsive checks via the preview tools — consistent with the spec's own Testing section.

---

## Task 1: Add dependencies

**Files:**
- Modify: `pnpm-workspace.yaml`
- Modify: `apps/personal-website/package.json`

- [ ] **Step 1.1: Add shared deps to the pnpm catalog**

Open `pnpm-workspace.yaml` and add two entries to the existing `catalog:` block (matching the versions `personal-calibre` already uses, so both apps converge):

```yaml
catalog:
  '@material/material-color-utilities': ^0.3.0
  '@tailwindcss/typography': ^0.5.19
  '@tailwindcss/vite': 4.2.2
  vite: 8.0.16
  '@types/node': ^25.0.10
  '@types/react': 19.2.9
  '@types/react-dom': 19.2.3
  lit: 3.3.2
  next: 16.2.6
  react: 19.2.3
  react-dom: 19.2.3
  tailwindcss: 4.2.2
  typescript: 5.9.3
  class-variance-authority: ^0.7.1
  tailwind-merge: ^3.5.0
```

- [ ] **Step 1.2: Add new dependencies to `apps/personal-website/package.json`**

In the `dependencies` block, add (alphabetically, matching the file's existing sort order):

```json
"class-variance-authority": "catalog:",
```
right after `"clsx": "^2.1.1",` add nothing (clsx already present, keep as-is), and insert these new lines in alphabetical position among the existing dependency list:

```json
"@lucide/vue": "^1.0.0",
"reka-ui": "^2.6.1",
"tailwind-merge": "catalog:",
```

(`@lucide/vue` is placed alphabetically right after `@lit/react`, not next to `reka-ui`/`tailwind-merge` — see the actual package.json diff. `lucide-vue-next` was the original name for this package; it's deprecated as of this writing in favor of `@lucide/vue`, which is API-identical — this plan uses the current name throughout.)

- [ ] **Step 1.3: Remove `@material/web` from `apps/personal-website/package.json`**

Delete the line:
```json
"@material/web": "^2.4.1",
```
Leave it in place for now — it gets removed in Task 18 once every `md-*` usage is actually gone (removing it now would break `pnpm nx build` on every subsequent task until the migration is complete). **Skip this step until Task 18.**

- [ ] **Step 1.4: Install**

```bash
pnpm install
```

Expected: `class-variance-authority`, `tailwind-merge`, `@lucide/vue`, `reka-ui` appear in `apps/personal-website/node_modules` (or the workspace root `node_modules` via hoisting). No peer dependency errors.

- [ ] **Step 1.5: Commit**

```bash
git add pnpm-workspace.yaml apps/personal-website/package.json pnpm-lock.yaml
git commit -m "chore(personal-website): add shadcn-vue dependencies (reka-ui, cva, tailwind-merge, @lucide/vue)"
```

---

## Task 2: Token engine — new `shadcn.ts` Tailwind plugin in rainforest-ui

**Files:**
- Create: `libs/rainforest-ui/src/tailwindcss/shadcn.ts`
- Modify: `libs/rainforest-ui/vite.config.ts:34-42`

### Why this shape

`md3.ts` runs `@material/material-color-utilities`'s HCT algorithm in JS at Tailwind build time. The new engine needs no JS algorithm at all — CSS relative color syntax (`oklch(from var(--seed) L C h)`) does the derivation live in the browser. So `shadcn.ts` is a Tailwind plugin whose `addBase` call injects a literal CSS string (no color-science computation), and whose theme-extend call maps shadcn variable names to Tailwind color/radius utilities — structurally identical to `md3.ts`, just with static CSS instead of computed CSS-in-JS.

`--destructive` is **not** derived from the seed — it's a fixed semantic red (`oklch(0.577 0.245 27.325)`, the real shadcn/ui default), matching how shadcn's own themes treat "destructive" as brand-independent.

- [ ] **Step 2.1: Write the plugin**

Create `libs/rainforest-ui/src/tailwindcss/shadcn.ts`:

**Important:** Tailwind's `addBase` expects each selector's value to be a nested `Record<string, string>` of declarations — NOT a raw CSS-text string. Passing a raw string (e.g. `':root': someMultilineCssString`) type-checks (because the `CssInJs` type also accepts a plain string as a *declaration value*) but compiles to garbage like `:root: --seed: ...;` instead of a real `:root { }` block. This was caught by code review after an earlier draft of this plan got it wrong — verify by actually compiling the plugin through Tailwind and inspecting generated CSS (Step 2.3 below), not just by running the build.

```typescript
import plugin from 'tailwindcss/plugin';

interface IOptions {
  sourceColor?: string;
}

const lightVars = (seed: string): Record<string, string> => ({
  '--seed': `var(--shadcn-seed-override, ${seed})`,
  '--background': 'oklch(from var(--seed) 0.98 0.012 h)',
  '--foreground': 'oklch(from var(--seed) 0.19 0.02 h)',
  '--card': 'oklch(from var(--seed) 0.995 0.008 h)',
  '--card-foreground': 'oklch(from var(--seed) 0.19 0.02 h)',
  '--popover': 'oklch(from var(--seed) 0.995 0.008 h)',
  '--popover-foreground': 'oklch(from var(--seed) 0.19 0.02 h)',
  '--primary': 'oklch(from var(--seed) 0.55 0.12 h)',
  '--primary-foreground': 'oklch(from var(--seed) 0.98 0.012 h)',
  '--secondary': 'oklch(from var(--seed) 0.94 0.02 h)',
  '--secondary-foreground': 'oklch(from var(--seed) 0.25 0.03 h)',
  '--muted': 'oklch(from var(--seed) 0.94 0.015 h)',
  '--muted-foreground': 'oklch(from var(--seed) 0.48 0.02 h)',
  '--accent': 'oklch(from var(--seed) 0.9 0.035 h)',
  '--accent-foreground': 'oklch(from var(--seed) 0.25 0.03 h)',
  '--destructive': 'oklch(0.577 0.245 27.325)',
  '--destructive-foreground': 'oklch(0.98 0.01 27.325)',
  '--border': 'oklch(from var(--seed) 0.88 0.015 h)',
  '--input': 'oklch(from var(--seed) 0.88 0.015 h)',
  '--ring': 'oklch(from var(--seed) 0.55 0.12 h)',
});

const darkVars: Record<string, string> = {
  '--background': 'oklch(from var(--seed) 0.17 0.02 h)',
  '--foreground': 'oklch(from var(--seed) 0.93 0.015 h)',
  '--card': 'oklch(from var(--seed) 0.21 0.02 h)',
  '--card-foreground': 'oklch(from var(--seed) 0.93 0.015 h)',
  '--popover': 'oklch(from var(--seed) 0.21 0.02 h)',
  '--popover-foreground': 'oklch(from var(--seed) 0.93 0.015 h)',
  '--primary': 'oklch(from var(--seed) 0.75 0.11 h)',
  '--primary-foreground': 'oklch(from var(--seed) 0.17 0.02 h)',
  '--secondary': 'oklch(from var(--seed) 0.27 0.02 h)',
  '--secondary-foreground': 'oklch(from var(--seed) 0.93 0.015 h)',
  '--muted': 'oklch(from var(--seed) 0.27 0.02 h)',
  '--muted-foreground': 'oklch(from var(--seed) 0.65 0.02 h)',
  '--accent': 'oklch(from var(--seed) 0.32 0.035 h)',
  '--accent-foreground': 'oklch(from var(--seed) 0.93 0.015 h)',
  '--destructive': 'oklch(0.55 0.2 27.325)',
  '--destructive-foreground': 'oklch(0.98 0.01 27.325)',
  '--border': 'oklch(from var(--seed) 0.32 0.02 h)',
  '--input': 'oklch(from var(--seed) 0.32 0.02 h)',
  '--ring': 'oklch(from var(--seed) 0.75 0.11 h)',
};

// Static fallback for engines without relative-color-syntax support (pre-Safari 26),
// pre-resolved from the default teal seed (#66b2b2).
const fallbackLight: Record<string, string> = {
  '--seed': '#66b2b2',
  '--background': '#f7fafa',
  '--foreground': '#1c2b2b',
  '--card': '#fdffff',
  '--card-foreground': '#1c2b2b',
  '--popover': '#fdffff',
  '--popover-foreground': '#1c2b2b',
  '--primary': '#3e7d7d',
  '--primary-foreground': '#f7fafa',
  '--secondary': '#e2f0ef',
  '--secondary-foreground': '#23403f',
  '--muted': '#e4f1f0',
  '--muted-foreground': '#5c7877',
  '--accent': '#cfe8e6',
  '--accent-foreground': '#23403f',
  '--destructive': '#c0362d',
  '--destructive-foreground': '#fdf2f1',
  '--border': '#d2e3e2',
  '--input': '#d2e3e2',
  '--ring': '#3e7d7d',
};

const fallbackDark: Record<string, string> = {
  '--background': '#182626',
  '--foreground': '#e8f2f1',
  '--card': '#1e3030',
  '--card-foreground': '#e8f2f1',
  '--popover': '#1e3030',
  '--popover-foreground': '#e8f2f1',
  '--primary': '#8fc9c8',
  '--primary-foreground': '#182626',
  '--secondary': '#2c4443',
  '--secondary-foreground': '#e8f2f1',
  '--muted': '#2c4443',
  '--muted-foreground': '#a7bdbc',
  '--accent': '#35504f',
  '--accent-foreground': '#e8f2f1',
  '--destructive': '#c4544a',
  '--destructive-foreground': '#fdf2f1',
  '--border': '#35504f',
  '--input': '#35504f',
  '--ring': '#8fc9c8',
};

export default plugin.withOptions(
  ({ sourceColor = '#66b2b2' }: IOptions = {}) => {
    const light = lightVars(sourceColor);
    return ({ addBase }) => {
      addBase({
        ':root': light,
        "[data-scheme='light']": light,
        '@media (prefers-color-scheme: dark)': {
          ':root': darkVars,
        },
        "[data-scheme='dark']": darkVars,
        '@supports not (color: oklch(from red l c h))': {
          ':root': fallbackLight,
          "[data-scheme='light']": fallbackLight,
          '@media (prefers-color-scheme: dark)': {
            ':root': fallbackDark,
          },
          "[data-scheme='dark']": fallbackDark,
        },
      });
    };
  },
  () => ({
    theme: {
      extend: {
        colors: {
          background: 'var(--background)',
          foreground: 'var(--foreground)',
          card: 'var(--card)',
          'card-foreground': 'var(--card-foreground)',
          popover: 'var(--popover)',
          'popover-foreground': 'var(--popover-foreground)',
          primary: 'var(--primary)',
          'primary-foreground': 'var(--primary-foreground)',
          secondary: 'var(--secondary)',
          'secondary-foreground': 'var(--secondary-foreground)',
          muted: 'var(--muted)',
          'muted-foreground': 'var(--muted-foreground)',
          accent: 'var(--accent)',
          'accent-foreground': 'var(--accent-foreground)',
          destructive: 'var(--destructive)',
          'destructive-foreground': 'var(--destructive-foreground)',
          border: 'var(--border)',
          input: 'var(--input)',
          ring: 'var(--ring)',
        },
        borderRadius: {
          sm: 'calc(var(--radius) - 4px)',
          md: 'calc(var(--radius) - 2px)',
          lg: 'var(--radius)',
          xl: 'calc(var(--radius) + 4px)',
        },
      },
    },
  }),
);
```

`--radius` itself (the base `0.625rem` value) is set once in `apps/personal-website/src/app.css`'s `@theme` block in Task 3, not here — this plugin only defines how `sm`/`md`/`lg`/`xl` scale off of it, matching where `--breakpoint-3xl` etc. already live today.

- [ ] **Step 2.2: Add the new entry to the library's Vite build**

In `libs/rainforest-ui/vite.config.ts`, find the `lib.entry` object (around line 34-42):

```typescript
      entry: {
        index: 'src/index.ts',
        'tailwindcss/md3': 'src/tailwindcss/md3.ts',
        ...Object.fromEntries(
          glob
            .sync('src/{lit,utils}/**/!(*.spec|*.test).ts')
            .map((e) => [e.replace('src/', '').replace('.ts', ''), e]),
        ),
      },
```

Add the new entry alongside `tailwindcss/md3` (leave `md3` in place — it's deleted in Task 18, not here):

```typescript
      entry: {
        index: 'src/index.ts',
        'tailwindcss/md3': 'src/tailwindcss/md3.ts',
        'tailwindcss/shadcn': 'src/tailwindcss/shadcn.ts',
        ...Object.fromEntries(
          glob
            .sync('src/{lit,utils}/**/!(*.spec|*.test).ts')
            .map((e) => [e.replace('src/', '').replace('.ts', ''), e]),
        ),
      },
```

- [ ] **Step 2.3: Build rainforest-ui and verify the new entry emits**

```bash
pnpm nx build rainforest-ui
ls libs/rainforest-ui/dist/tailwindcss/
```

Expected: `shadcn.js`, `shadcn.cjs`, `shadcn.d.ts` alongside the existing `md3.*` files.

- [ ] **Step 2.3b: Compile the plugin through real Tailwind and inspect the generated CSS**

A passing build only proves the TypeScript compiles — it does NOT prove the plugin emits valid CSS (see the `addBase` string-vs-object pitfall noted above). Verify the actual output:

```bash
cd apps/personal-website
cat > src/__shadcn_verify_test.css <<'EOF'
@import "tailwindcss";
@plugin "@rainforest-dev/rainforest-ui/tailwindcss/shadcn";
EOF
echo '<div class="bg-primary text-foreground rounded-md"></div>' > /tmp/shadcn-verify-input.html
npx @tailwindcss/cli -i src/__shadcn_verify_test.css -o /tmp/shadcn-verify-out.css --content /tmp/shadcn-verify-input.html
grep -A20 "^  :root {" /tmp/shadcn-verify-out.css | head -25
rm src/__shadcn_verify_test.css /tmp/shadcn-verify-input.html /tmp/shadcn-verify-out.css
cd ../..
```

Expected: a real `:root { --seed: var(--shadcn-seed-override, #66b2b2); --background: oklch(from var(--seed) 0.98 0.012 h); ... }` block — not `:root: --seed: ...;` or any other malformed output. Also grep the full output file for `[data-scheme='dark']` and `@supports not (color: oklch(from red l c h))` to confirm those blocks exist too before deleting the temp files.

- [ ] **Step 2.4: Commit**

```bash
git add libs/rainforest-ui/src/tailwindcss/shadcn.ts libs/rainforest-ui/vite.config.ts
git commit -m "feat(rainforest-ui): add shadcn OKLCH seed-color Tailwind plugin"
```

---

## Task 3: Wire personal-website to the new token engine

**Files:**
- Modify: `apps/personal-website/src/app.css:1-20`
- Modify: `apps/personal-website/src/components/theme-provider.astro`

- [ ] **Step 3.1: Swap the Tailwind plugin and add `--radius` in `app.css`**

Open `apps/personal-website/src/app.css`. Replace line 4 and extend the `@theme` block:

```css
/* tailwindcss */
@import 'tailwindcss';
@plugin "@tailwindcss/forms";
@plugin "@rainforest-dev/rainforest-ui/tailwindcss/shadcn";

@theme {
  --font-family-serif: 'Lora', serif;
  --font-family-sans: 'Lora', sans-serif;
  --font-family-resume-serif: Georgia, serif;

  --breakpoint-3xl: 112rem;

  --spacing-lh: 1lh;
  --spacing-2lh: 2lh;
  --spacing-3lh: 3lh;
  --spacing-4lh: 4lh;
  --spacing-5lh: 5lh;

  --radius-lh: 1lh;
  --radius: 0.625rem;
}

@layer base {
  html,
  body {
    @apply p-0 m-0 size-full font-serif bg-background text-foreground;
  }

  .astro-code,
  .astro-code span {
    background-color: transparent !important;
  }
  @media (prefers-color-scheme: dark) {
    .astro-code,
    .astro-code span {
      color: var(--shiki-dark) !important;
      font-style: var(--shiki-dark-font-style) !important;
      font-weight: var(--shiki-dark-font-weight) !important;
      text-decoration: var(--shiki-dark-text-decoration) !important;
    }
  }
}

@utility flex-center {
  @apply flex items-center justify-center;
}

@utility flex-row-center {
  @apply flex flex-row items-center;
}

@utility flex-col-center {
  @apply flex flex-col items-center;
}

@utility container {
  @apply mx-auto px-8 sm:px-0;
}

@utility skeleton-* {
  background-color: --value(--color-*);
  background-color: --value(color);
  background-color: --value([color]);
  @apply animate-pulse rounded-lh;
}
```

Note: `'Material Symbols Outlined'` is removed from all three font-family stacks — that font is deleted from `head.astro` in Task 16, so referencing it here would be a dangling font-family fallback.

- [ ] **Step 3.2: Simplify `theme-provider.astro`**

The old version computes a full Material scheme (`themeFromSourceColor` + `getSchemeProperties`) to emit ~40 `--md-sys-color-*` variables. The new version only needs to set `--seed` — every other variable is now derived by the CSS in `shadcn.ts`. The `<meta name="theme-color">` computation is **kept as-is**, reusing the existing Material scheme utilities purely for that one literal-hex value (this is intentionally the one place old Material color math survives — it's a fully separate, still-correct use of `theme.ts`, which stays untouched because `lit/md3-lit` also depends on it).

Replace the full contents of `apps/personal-website/src/components/theme-provider.astro`:

```astro
---
import { argbFromHex, hexFromArgb } from '@material/material-color-utilities';
import {
  getSchemeProperties,
  themeFromSourceColor,
} from '@rainforest-dev/rainforest-ui';
import { persistentKey } from '@stores';
import { defaultSourceColor } from '@utils/constants';

const sourceColor =
  Astro.cookies.get(persistentKey)?.value ?? defaultSourceColor;

// Only used to compute the two <meta name="theme-color"> hex values below —
// the page's actual visual theming now comes entirely from the shadcn.ts
// Tailwind plugin's CSS relative-color-syntax derivation of `--seed`.
const theme = themeFromSourceColor(argbFromHex(sourceColor));
const themeColorLight = hexFromArgb(
  getSchemeProperties(theme.schemes.light)['--md-sys-color-surface']
);
const themeColorDark = hexFromArgb(
  getSchemeProperties(theme.schemes.dark)['--md-sys-color-surface']
);

const styleRaw = `
  @layer theme, base, components, utilities, app;
  @layer app {
    :root {
      --seed: ${sourceColor};
    }
    [data-scheme='light'] {
      --seed: ${sourceColor};
    }
    [data-scheme='dark'] {
      --seed: ${sourceColor};
    }
  }
`;
---

<meta
  name="theme-color"
  media="(prefers-color-scheme: light)"
  content={themeColorLight}
/>
<meta
  name="theme-color"
  media="(prefers-color-scheme: dark)"
  content={themeColorDark}
/>
<style is:inline set:html={styleRaw}></style>
<script>
  import { $sourceColor, persistentKey } from '@stores';
  import Cookies from 'js-cookie';
  const sourceColor = $sourceColor.get();
  if (sourceColor) {
    Cookies.set(persistentKey, sourceColor);
  }
</script>
```

The dead commented-out `<script>` block at the bottom of the old file (referencing `@utils/md3-utilities`, which doesn't exist) is dropped — it was already inert.

- [ ] **Step 3.3: Build and do a first visual check**

```bash
pnpm nx build personal-website
```

Expected: build succeeds. Material Web components elsewhere in the app will still render (unmigrated), but they'll be visually broken/uncolored since `--md-sys-color-*` no longer exists — **this is expected and temporary**; every consumer of those variables gets fixed in Tasks 9-17. Don't worry about visual regressions yet.

- [ ] **Step 3.4: Commit**

```bash
git add apps/personal-website/src/app.css apps/personal-website/src/components/theme-provider.astro
git commit -m "feat(personal-website): switch theming to the OKLCH shadcn token engine"
```

---

## Task 4: shadcn-vue foundation — `components.json`, `cn.ts`, Button

**Files:**
- Create: `apps/personal-website/components.json`
- Create: `apps/personal-website/src/utils/cn.ts`
- Create: `apps/personal-website/src/components/ui/button/Button.vue`
- Create: `apps/personal-website/src/components/ui/button/index.ts`

- [ ] **Step 4.1: Add `components.json`**

Create `apps/personal-website/components.json`:

```json
{
  "$schema": "https://shadcn-vue.com/schema.json",
  "style": "new-york",
  "typescript": true,
  "tailwind": {
    "config": "",
    "css": "src/app.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "framework": "astro",
  "aliases": {
    "components": "@/components",
    "utils": "@/utils/cn",
    "ui": "@/components/ui",
    "lib": "@/utils"
  },
  "iconLibrary": "lucide"
}
```

This documents the convention for future `shadcn-vue` CLI use; every component in this plan is still hand-written to match exactly, since the CLI would need network access this plan doesn't assume.

- [ ] **Step 4.2: Add the `cn` helper**

Create `apps/personal-website/src/utils/cn.ts`:

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4.3: Write the Button component**

Create `apps/personal-website/src/components/ui/button/Button.vue`:

```vue
<script lang="ts">
import { cva, type VariantProps } from 'class-variance-authority';

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline:
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
export type ButtonSize = VariantProps<typeof buttonVariants>['size'];
</script>

<script setup lang="ts">
import { cn } from '@/utils/cn';

interface Props {
  variant?: ButtonVariant;
  size?: ButtonSize;
  as?: string;
  href?: string;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'default',
  as: 'button',
});
</script>

<template>
  <component
    :is="href ? 'a' : as"
    :href="href"
    :class="cn(buttonVariants({ variant, size }), props.class)"
  >
    <slot />
  </component>
</template>
```

Create `apps/personal-website/src/components/ui/button/index.ts`:

```typescript
export { buttonVariants } from './Button.vue';
export { default as Button } from './Button.vue';
export type { ButtonSize, ButtonVariant } from './Button.vue';
```

- [ ] **Step 4.4: Verify it compiles**

```bash
pnpm nx build personal-website
```

Expected: build succeeds (Button isn't consumed anywhere yet, so this just confirms the new files type-check and the Vue SFC compiles).

- [ ] **Step 4.5: Commit**

```bash
git add apps/personal-website/components.json apps/personal-website/src/utils/cn.ts apps/personal-website/src/components/ui/button
git commit -m "feat(personal-website): add shadcn-vue foundation (components.json, cn helper, Button)"
```

---

## Task 5: DropdownMenu component

**Files:**
- Create: `apps/personal-website/src/components/ui/dropdown-menu/DropdownMenu.vue`
- Create: `apps/personal-website/src/components/ui/dropdown-menu/DropdownMenuTrigger.vue`
- Create: `apps/personal-website/src/components/ui/dropdown-menu/DropdownMenuContent.vue`
- Create: `apps/personal-website/src/components/ui/dropdown-menu/DropdownMenuItem.vue`
- Create: `apps/personal-website/src/components/ui/dropdown-menu/DropdownMenuSeparator.vue`
- Create: `apps/personal-website/src/components/ui/dropdown-menu/index.ts`

Built directly on `reka-ui`'s `DropdownMenu*` primitives (verified against reka-ui's own docs — `useForwardPropsEmits` is the standard wrapping pattern).

- [ ] **Step 5.1: Root and Trigger**

Create `apps/personal-website/src/components/ui/dropdown-menu/DropdownMenu.vue`:

```vue
<script setup lang="ts">
import type { DropdownMenuRootEmits, DropdownMenuRootProps } from 'reka-ui';
import { DropdownMenuRoot, useForwardPropsEmits } from 'reka-ui';

const props = defineProps<DropdownMenuRootProps>();
const emits = defineEmits<DropdownMenuRootEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <DropdownMenuRoot v-bind="forwarded">
    <slot />
  </DropdownMenuRoot>
</template>
```

Create `apps/personal-website/src/components/ui/dropdown-menu/DropdownMenuTrigger.vue`:

```vue
<script setup lang="ts">
import type { DropdownMenuTriggerProps } from 'reka-ui';
import { DropdownMenuTrigger } from 'reka-ui';

defineProps<DropdownMenuTriggerProps & { class?: string }>();
</script>

<template>
  <DropdownMenuTrigger :class="$props.class" as-child>
    <slot />
  </DropdownMenuTrigger>
</template>
```

- [ ] **Step 5.2: Content, Item, Separator**

Create `apps/personal-website/src/components/ui/dropdown-menu/DropdownMenuContent.vue`:

```vue
<script setup lang="ts">
import type { DropdownMenuContentEmits, DropdownMenuContentProps } from 'reka-ui';
import { DropdownMenuContent, DropdownMenuPortal, useForwardPropsEmits } from 'reka-ui';
import { cn } from '@/utils/cn';

const props = defineProps<DropdownMenuContentProps & { class?: string }>();
const emits = defineEmits<DropdownMenuContentEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <DropdownMenuPortal>
    <DropdownMenuContent
      v-bind="forwarded"
      :side-offset="props.sideOffset ?? 6"
      :class="
        cn(
          'z-50 min-w-32 overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md',
          props.class
        )
      "
    >
      <slot />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>
```

Create `apps/personal-website/src/components/ui/dropdown-menu/DropdownMenuItem.vue`:

```vue
<script setup lang="ts">
import type { DropdownMenuItemEmits, DropdownMenuItemProps } from 'reka-ui';
import { DropdownMenuItem, useForwardPropsEmits } from 'reka-ui';
import { cn } from '@/utils/cn';

const props = defineProps<DropdownMenuItemProps & { class?: string }>();
const emits = defineEmits<DropdownMenuItemEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <DropdownMenuItem
    v-bind="forwarded"
    :class="
      cn(
        'relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        props.class
      )
    "
  >
    <slot />
  </DropdownMenuItem>
</template>
```

Create `apps/personal-website/src/components/ui/dropdown-menu/DropdownMenuSeparator.vue`:

```vue
<script setup lang="ts">
import type { DropdownMenuSeparatorProps } from 'reka-ui';
import { DropdownMenuSeparator } from 'reka-ui';
import { cn } from '@/utils/cn';

const props = defineProps<DropdownMenuSeparatorProps & { class?: string }>();
</script>

<template>
  <DropdownMenuSeparator
    v-bind="props"
    :class="cn('-mx-1 my-1 h-px bg-border', props.class)"
  />
</template>
```

- [ ] **Step 5.3: Barrel export**

Create `apps/personal-website/src/components/ui/dropdown-menu/index.ts`:

```typescript
export { default as DropdownMenu } from './DropdownMenu.vue';
export { default as DropdownMenuContent } from './DropdownMenuContent.vue';
export { default as DropdownMenuItem } from './DropdownMenuItem.vue';
export { default as DropdownMenuSeparator } from './DropdownMenuSeparator.vue';
export { default as DropdownMenuTrigger } from './DropdownMenuTrigger.vue';
```

- [ ] **Step 5.4: Build and commit**

```bash
pnpm nx build personal-website
git add apps/personal-website/src/components/ui/dropdown-menu
git commit -m "feat(personal-website): add shadcn-vue DropdownMenu component"
```

---

## Task 6: Input and Textarea components

**Files:**
- Create: `apps/personal-website/src/components/ui/input/Input.vue`, `index.ts`
- Create: `apps/personal-website/src/components/ui/textarea/Textarea.vue`, `index.ts`

These need a label + hint pattern (the old `md-outlined-text-field` had a built-in floating `label` prop; plain `<input>` doesn't) since `contact-form.astro` relies on labeled fields.

- [ ] **Step 6.1: Input**

Create `apps/personal-website/src/components/ui/input/Input.vue`:

```vue
<script setup lang="ts">
import { cn } from '@/utils/cn';

interface Props {
  label?: string;
  name?: string;
  class?: string;
}

defineProps<Props>();
const model = defineModel<string>();
</script>

<template>
  <label class="flex flex-col gap-1 text-sm">
    <span v-if="label" class="text-muted-foreground">{{ label }}</span>
    <input
      v-model="model"
      :name="name"
      :class="
        cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          $props.class
        )
      "
    />
  </label>
</template>
```

Create `apps/personal-website/src/components/ui/input/index.ts`:

```typescript
export { default as Input } from './Input.vue';
```

- [ ] **Step 6.2: Textarea**

Create `apps/personal-website/src/components/ui/textarea/Textarea.vue`:

```vue
<script setup lang="ts">
import { cn } from '@/utils/cn';

interface Props {
  label?: string;
  name?: string;
  class?: string;
}

defineProps<Props>();
const model = defineModel<string>();
</script>

<template>
  <label class="flex flex-col gap-1 text-sm">
    <span v-if="label" class="text-muted-foreground">{{ label }}</span>
    <textarea
      v-model="model"
      :name="name"
      rows="4"
      :class="
        cn(
          'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          $props.class
        )
      "
    />
  </label>
</template>
```

Create `apps/personal-website/src/components/ui/textarea/index.ts`:

```typescript
export { default as Textarea } from './Textarea.vue';
```

- [ ] **Step 6.3: Build and commit**

```bash
pnpm nx build personal-website
git add apps/personal-website/src/components/ui/input apps/personal-website/src/components/ui/textarea
git commit -m "feat(personal-website): add shadcn-vue Input and Textarea components"
```

---

## Task 7: Badge component

**Files:**
- Create: `apps/personal-website/src/components/ui/badge/Badge.vue`, `index.ts`

- [ ] **Step 7.1: Write it**

Create `apps/personal-website/src/components/ui/badge/Badge.vue`:

```vue
<script lang="ts">
import { cva, type VariantProps } from 'class-variance-authority';

export const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];
</script>

<script setup lang="ts">
import { cn } from '@/utils/cn';

interface Props {
  variant?: BadgeVariant;
  class?: string;
}

withDefaults(defineProps<Props>(), { variant: 'default' });
</script>

<template>
  <span :class="cn(badgeVariants({ variant }), $props.class)">
    <slot />
  </span>
</template>
```

Create `apps/personal-website/src/components/ui/badge/index.ts`:

```typescript
export { default as Badge, badgeVariants } from './Badge.vue';
export type { BadgeVariant } from './Badge.vue';
```

- [ ] **Step 7.2: Build and commit**

```bash
pnpm nx build personal-website
git add apps/personal-website/src/components/ui/badge
git commit -m "feat(personal-website): add shadcn-vue Badge component"
```

---

## Task 8: Tabs component

**Files:**
- Create: `apps/personal-website/src/components/ui/tabs/{Tabs,TabsList,TabsTrigger,TabsContent}.vue`, `index.ts`

Used only by `color-system.vue` (the `/settings` page's Colors/Typography switcher). Built on `reka-ui`'s `TabsRoot`/`TabsList`/`TabsTrigger`/`TabsContent`.

- [ ] **Step 8.1: Write the four files**

Create `apps/personal-website/src/components/ui/tabs/Tabs.vue`:

```vue
<script setup lang="ts">
import type { TabsRootEmits, TabsRootProps } from 'reka-ui';
import { TabsRoot, useForwardPropsEmits } from 'reka-ui';

const props = defineProps<TabsRootProps>();
const emits = defineEmits<TabsRootEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <TabsRoot v-bind="forwarded">
    <slot />
  </TabsRoot>
</template>
```

Create `apps/personal-website/src/components/ui/tabs/TabsList.vue`:

```vue
<script setup lang="ts">
import type { TabsListProps } from 'reka-ui';
import { TabsList } from 'reka-ui';
import { cn } from '@/utils/cn';

const props = defineProps<TabsListProps & { class?: string }>();
</script>

<template>
  <TabsList
    v-bind="props"
    :class="
      cn(
        'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
        props.class
      )
    "
  >
    <slot />
  </TabsList>
</template>
```

Create `apps/personal-website/src/components/ui/tabs/TabsTrigger.vue`:

```vue
<script setup lang="ts">
import type { TabsTriggerProps } from 'reka-ui';
import { TabsTrigger } from 'reka-ui';
import { cn } from '@/utils/cn';

const props = defineProps<TabsTriggerProps & { class?: string }>();
</script>

<template>
  <TabsTrigger
    v-bind="props"
    :class="
      cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
        props.class
      )
    "
  >
    <slot />
  </TabsTrigger>
</template>
```

Create `apps/personal-website/src/components/ui/tabs/TabsContent.vue`:

```vue
<script setup lang="ts">
import type { TabsContentProps } from 'reka-ui';
import { TabsContent } from 'reka-ui';
import { cn } from '@/utils/cn';

const props = defineProps<TabsContentProps & { class?: string }>();
</script>

<template>
  <TabsContent v-bind="props" :class="cn('mt-4 focus-visible:outline-none', props.class)">
    <slot />
  </TabsContent>
</template>
```

Create `apps/personal-website/src/components/ui/tabs/index.ts`:

```typescript
export { default as Tabs } from './Tabs.vue';
export { default as TabsContent } from './TabsContent.vue';
export { default as TabsList } from './TabsList.vue';
export { default as TabsTrigger } from './TabsTrigger.vue';
```

- [ ] **Step 8.2: Build and commit**

```bash
pnpm nx build personal-website
git add apps/personal-website/src/components/ui/tabs
git commit -m "feat(personal-website): add shadcn-vue Tabs component"
```

---

## Task 9: Migrate `nav.vue` and `language-picker.vue`

**Files:**
- Modify: `apps/personal-website/src/components/home/nav.vue`
- Modify: `apps/personal-website/src/components/home/language-picker.vue`

- [ ] **Step 9.1: Rewrite `language-picker.vue`**

Replace the full contents of `apps/personal-website/src/components/home/language-picker.vue`:

```vue
<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon" aria-label="language-picker">
        <Globe
          :class="
            clsx(
              'text-muted-foreground xl:text-foreground',
              !isAtTop ? 'md:text-foreground' : 'md:text-background'
            )
          "
        />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem v-for="{ label, href, key } in langs" :key="key" as-child>
        <a :href="href" @click="cacheLocale(key)">{{ label }}</a>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
<script lang="ts" setup>
import { isServerSide, persistentLocaleKey } from '@utils';
import { useWindowScroll } from '@vueuse/core';
import clsx from 'clsx';
import Cookies from 'js-cookie';
import { Globe } from '@lucide/vue';
import { computed } from 'vue';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ILink {
  key: string;
  label: string;
  href: string;
}
export interface IProps {
  langs: ILink[];
}

const { langs } = defineProps<IProps>();

const cacheLocale = (locale: string) => {
  Cookies.set(persistentLocaleKey, locale, {
    path: '/',
  });
};

const { y } = useWindowScroll();
const isAtTop = computed(() => {
  return isServerSide ? true : Math.round(y.value / window.innerHeight) === 0;
});
</script>
```

Note: `md:text-surface` → `md:text-background` — this preserves the "blend into the background when at the very top of a wide viewport" effect the old class achieved.

- [ ] **Step 9.2: Rewrite `nav.vue`**

Replace the full contents of `apps/personal-website/src/components/home/nav.vue`:

```vue
<template>
  <nav
    :class="
      clsx(
        'fixed top-0 inset-x-0 xl:text-foreground h-16 px-10 flex-row-center justify-between z-20',
        !isAtTop ? 'text-foreground' : 'text-background'
      )
    "
  >
    <div></div>
    <div class="hidden md:flex-row-center gap-10">
      <ul class="flex-row-center gap-10">
        <li v-for="{ label, href } in anchors" :key="href">
          <a :href="href" @click="removeUrlHashAfterNavigation">{{ label }}</a>
        </li>
      </ul>
      <LanguagePicker :langs="langs" />
    </div>
    <div class="md:hidden block">
      <aside
        :class="
          clsx(
            'fixed inset-0 bg-background text-foreground px-4 py-6 overflow-auto text-center',
            open ? 'flex-center flex-col gap-10' : 'hidden',
          )
        "
      >
        <LanguagePicker :langs="langs" />
        <slot name="sider"></slot>
      </aside>
      <Button
        variant="ghost"
        size="icon"
        @click="open = !open"
        id="menu-trigger"
        aria-label="menu-and-close"
      >
        <X
          v-if="open"
          class="text-foreground"
        />
        <Menu
          v-else
          :class="clsx('xl:text-foreground', !isAtTop ? 'text-foreground' : 'text-background')"
        />
      </Button>
    </div>
  </nav>
</template>
<script lang="ts" setup>
import { computed, ref, watchEffect } from 'vue';
import clsx from 'clsx';
import { Menu, X } from '@lucide/vue';
import { useWindowScroll } from '@vueuse/core';
import { isServerSide, removeUrlHashAfterNavigation } from '@utils';
import { Button } from '@/components/ui/button';
import LanguagePicker, {
  IProps as ILanguagePickerProps,
} from './language-picker.vue';
import useThemeColorMeta from '@/hooks/use-theme-color-meta';

interface ILink {
  label: string;
  href: string;
}

type Props = {
  anchors: ILink[];
} & ILanguagePickerProps;

const { anchors, langs } = defineProps<Props>();

const open = ref(false);

const { y } = useWindowScroll();
const isAtTop = computed(() => {
  return isServerSide ? true : Math.round(y.value / window.innerHeight) === 0;
});

const { updateThemeColor, reset } = useThemeColorMeta();

watchEffect(() => {
  if (isServerSide) return;
  if (open.value) {
    const color = window.getComputedStyle(document.body).backgroundColor;
    updateThemeColor(color);
  } else {
    reset();
  }
});
</script>

<style>
html {
  &:has(aside:not(.hidden)) {
    @apply overflow-hidden;
  }
}
</style>
```

Key change beyond the component swap: `getComputedStyle(document.body).getPropertyValue('--md-sys-color-surface')` → `getComputedStyle(document.body).backgroundColor`. Reading a plain resolved CSS property (not a custom property string) is what makes this work correctly now that `--background` is derived via relative-color syntax rather than being a literal hex value — `getPropertyValue('--custom-prop')` returns the unresolved specified value, while `.backgroundColor` always returns the browser's fully computed color regardless of how it was derived.

- [ ] **Step 9.3: Build and manually verify**

```bash
pnpm nx dev personal-website
```

Open the site in the preview tools. Check: language picker opens/closes, shows language links; hamburger menu opens the mobile drawer with the Menu/X icon swap; nav text color still contrasts correctly at the top of the page vs. scrolled.

- [ ] **Step 9.4: Commit**

```bash
git add apps/personal-website/src/components/home/nav.vue apps/personal-website/src/components/home/language-picker.vue
git commit -m "feat(personal-website): migrate nav and language-picker to shadcn-vue"
```

---

## Task 10: Migrate `fab.vue`

**Files:**
- Modify: `apps/personal-website/src/components/home/fab.vue`

No shadcn/reka-ui primitive matches the Material FAB pattern, so it stays a small custom component (per the spec), just restyled with the new tokens and componentized with Button/DropdownMenu underneath.

- [ ] **Step 10.1: Rewrite**

Replace the full contents of `apps/personal-website/src/components/home/fab.vue`:

```vue
<template>
  <Button
    v-if="!isChatBubbleEnabled"
    variant="default"
    size="icon"
    class="fixed right-10 bottom-10 z-10 size-14 rounded-full shadow-lg"
    aria-label="back to top"
    @click="handleClick"
  >
    <ArrowUp />
  </Button>
  <div v-else class="fixed right-10 bottom-10 z-10">
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          id="social-media-anchor"
          variant="default"
          size="icon"
          aria-label="contact me"
          class="size-14 rounded-full shadow-lg"
        >
          <MessageCircle />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end">
        <DropdownMenuItem as-child>
          <a
            :href="getLinkedInUrl(info.links.linkedin)"
            target="_blank"
            class="flex items-center gap-2"
          >
            <iconify-icon :icon="getBrandIconName('linkedin')" class="size-4" />
            LinkedIn
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem as-child>
          <a
            :href="getGitHubUrl(info.links.github)"
            target="_blank"
            class="flex items-center gap-2"
          >
            <iconify-icon :icon="getBrandIconName('github')" class="size-4" />
            GitHub
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem as-child>
          <a :href="`mailto:${info.email}`" class="flex items-center gap-2">
            <Mail class="size-4" />
            Email
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
<script lang="ts" setup>
import 'iconify-icon';
import {
  getBrandIconName,
  getGitHubUrl,
  getLinkedInUrl,
  isServerSide,
} from '@utils';
import { useWindowScroll } from '@vueuse/core';
import { ArrowUp, Mail, MessageCircle } from '@lucide/vue';
import { computed } from 'vue';
import { info } from '@utils/constants';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const { y } = useWindowScroll();
const isAtTop = computed(() => {
  return isServerSide ? true : Math.round(y.value / window.innerHeight);
});
const isChatBubbleEnabled = computed(() => isAtTop.value);

const handleClick = () => {
  if (isChatBubbleEnabled.value) return; // DropdownMenuTrigger already handles opening
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
</script>
```

Note: the old imperative `menu.value.open = !menu.value.open` toggle is gone — `DropdownMenuTrigger` handles open/close natively when the click lands on the trigger button itself, so `handleClick` only needs to handle the "scroll to top" FAB case now.

- [ ] **Step 10.2: Build and verify**

```bash
pnpm nx dev personal-website
```

Scroll to the top of the homepage: FAB should show the chat bubble icon and open a dropdown with LinkedIn/GitHub/Email. Scroll down: FAB should show the up-arrow and scroll to top on click.

- [ ] **Step 10.3: Commit**

```bash
git add apps/personal-website/src/components/home/fab.vue
git commit -m "feat(personal-website): migrate fab to a custom shadcn-styled component"
```

---

## Task 11: Migrate the hero (`three-columns.astro`, `one-column.astro`, `theme-color-modifier.vue`)

**Files:**
- Modify: `apps/personal-website/src/components/home/hero/three-columns.astro`
- Modify: `apps/personal-website/src/components/home/hero/one-column.astro`
- Modify: `apps/personal-website/src/components/home/hero/theme-color-modifier.vue`

- [ ] **Step 11.1: Rewrite `three-columns.astro`**

Replace the full contents of `apps/personal-website/src/components/home/hero/three-columns.astro`:

```astro
---
import type { IHeroProps as Props } from '@types';
import { useTranslatedPath, useTranslation } from '@utils/i18n';
import { Picture } from 'astro:assets';
import { ExternalLink } from '@lucide/vue';

import { Button } from '@/components/ui/button';

import Tag from '../../tag.astro';

const props = Astro.props;
const year = props.dateOfBirth.getFullYear();

const lang = Astro.currentLocale;
const { t } = await useTranslation(lang, 'home');
const translatePath = useTranslatedPath(lang);
---

<div
  class="h-3/4 w-full flex-row-center justify-between py-10 px-20 relative z-0 rounded-xl shadow-lg"
>
  <div class="absolute -z-10 inset-0 rounded-[inherit] overflow-clip">
    <div
      class="size-full relative z-0 bg-muted overflow-clip
                  after:bg-foreground after:h-full after:w-1/2 after:absolute after:-skew-x-[45deg] after:scale-200 after:-z-10 after:-right-1/4 after:top-0"
    >
    </div>
  </div>
  <div class="flex flex-col justify-center">
    <p>{year}</p>
    <h1 class="text-7xl mt-1 mb-16 text-secondary-foreground">
      {props.name.fullname}
    </h1>
    <div class="flex-row-center gap-4">
      <Button href="#contact-form-footer" class="px-6"
        >{t('contact-me-title')}</Button
      >
      <Button
        variant="outline"
        href={translatePath('/resume')}
        target="_blank"
        class="px-6 gap-2"
        >{t('resume')}
        <ExternalLink />
      </Button>
    </div>
  </div>
  <Picture
    src={props.profile}
    alt="profile"
    loading="eager"
    pictureAttributes={{
      class: 'self-end -mb-10 h-[120%] w-full',
    }}
    class="object-cover object-center h-full w-max mx-auto"
  />
  <div class="flex flex-col justify-center text-background gap-6">
    <ul class="list-disc">
      <li>
        {t('home:hero-brief')}
      </li>
      {props.summaries.map((summary) => <li>{summary}</li>)}
    </ul>
    <ul class="flex gap-2">
      {
        props.tags.map((tag) => (
          <li>
            <Tag name={tag} class="bg-background/85 text-foreground" />
          </li>
        ))
      }
    </ul>
  </div>
</div>

<script>
  import { removeUrlHashAfterNavigation } from '@utils';

  const contactMeButton = document.querySelector(
    'a[href="#contact-form-footer"]'
  );
  contactMeButton?.addEventListener('click', removeUrlHashAfterNavigation);
</script>
```

Note: the DOM query in the trailing `<script>` changes from `md-filled-button[href="#contact-form-footer"]` to `a[href="#contact-form-footer"]` since `Button` renders a real `<a>` when given `href`.

- [ ] **Step 11.2: Rewrite `one-column.astro`**

Replace the full contents of `apps/personal-website/src/components/home/hero/one-column.astro`:

```astro
---
import type { IHeroProps as Props } from '@types';
import { useTranslatedPath, useTranslation } from '@utils';
import { Picture } from 'astro:assets';
import { ExternalLink } from '@lucide/vue';

import { Button } from '@/components/ui/button';

import ThemeColorModifier from './theme-color-modifier.vue';

const props = Astro.props;
const year = props.dateOfBirth.getFullYear();

const lang = Astro.currentLocale;
const { t } = await useTranslation(lang, 'home');
const translatePath = useTranslatedPath(lang);
---

<div class="flex flex-col size-full">
  <div class="relative aspect-square">
    <div
      id="hero-dark-panel"
      class="size-full bg-foreground rounded-b-3xl origin-top-right skew-y-12 overflow-clip absolute top-0 z-0"
    >
      <Picture
        src={props.profile}
        alt="profile"
        loading="eager"
        pictureAttributes={{
          class:
            'h-full z-10 absolute -bottom-10 md:-bottom-20 left-1/2 -translate-x-1/2 ',
        }}
        class="object-cover object-top -skew-y-12 size-full"
      />
    </div>
    <div
      class="text-9xl text-background/50 rotate-270 origin-bottom inline-block m-4"
    >
      {year}
    </div>
  </div>
  <div class="flex container">
    <div class="flex flex-col w-full">
      <div class="flex-row-center justify-between flex-wrap gap-2">
        <div>
          <h1 class="text-4xl text-secondary-foreground">
            {props.name.first}
          </h1>
          <p>{props.jobPosition}</p>
        </div>
        <div class="flex-row-center gap-4">
          <Button id="contact-me-button" class="px-6"
            >{t('contact-me-title')}</Button
          >
          <Button
            variant="outline"
            href={translatePath('/resume')}
            target="_blank"
            class="px-6 gap-2"
            >{t('resume')}
            <ExternalLink />
          </Button>
        </div>
      </div>
      <ul class="list-disc list-inside mt-4">
        {props.summaries.map((summary) => <li>{summary}</li>)}
      </ul>
    </div>
  </div>
</div>
<ThemeColorModifier client:load />

<script>
  import { removeUrlHashAfterNavigation } from '@utils';

  const contactMeButton = document.getElementById(
    'contact-me-button'
  ) as HTMLAnchorElement;
  const menuButton = document.getElementById('menu-trigger') as HTMLButtonElement;
  const handleOpenContactForm = () => {
    menuButton?.click();
  };

  const handleMatches = (matches: boolean) => {
    if (matches) {
      contactMeButton.removeAttribute('href');
      contactMeButton.onclick = handleOpenContactForm;
    } else {
      contactMeButton.onclick = removeUrlHashAfterNavigation;
      contactMeButton.setAttribute('href', '#contact-form-footer');
    }
  };

  const breakpointMd = getComputedStyle(
    document.documentElement
  ).getPropertyValue('--breakpoint-md');
  handleMatches(window.matchMedia(`(max-width: ${breakpointMd})`).matches);
  window
    .matchMedia(`(max-width: ${breakpointMd})`)
    .addEventListener('change', (e) => {
      handleMatches(e.matches);
    });
</script>
```

Note: `Button` without an `href` renders as `<button>`, and the mobile-breakpoint logic here needs to *dynamically* add/remove the href to switch it between "scroll link" and "open mobile menu" behavior — since `Button`'s `:is="href ? 'a' : as"` binding is evaluated once at render (Vue won't swap the rendered tag reactively from a plain DOM script mutating attributes after the fact), this script now works directly against the initially-rendered `<a>` element's `href` attribute (toggling `href` on/off) rather than relying on the component re-rendering as a different tag — which matches what the original `md-filled-button` version did too (it mutated `.href` on the same custom element instance, never re-rendering as a different tag).

- [ ] **Step 11.3: Rewrite `theme-color-modifier.vue`**

Replace the full contents of `apps/personal-website/src/components/home/hero/theme-color-modifier.vue`:

```vue
<template>
  <div class="hidden"></div>
</template>
<script lang="ts" setup>
import useThemeColorMeta from '@/hooks/use-theme-color-meta';
import { isServerSide } from '@/utils';
import { useWindowScroll } from '@vueuse/core';
import { computed, onMounted, onUnmounted, watchEffect } from 'vue';

const { y } = useWindowScroll();
const isAtTop = computed(() => {
  return isServerSide ? true : Math.round(y.value / window.innerHeight) === 0;
});

const mediaQueryList = computed(() => {
  const breakpointXl = getComputedStyle(
    document.documentElement
  ).getPropertyValue('--breakpoint-xl');
  return window.matchMedia(`(min-width: ${breakpointXl})`);
});
const { updateThemeColor, reset } = useThemeColorMeta();
const handleThemeColor = () => {
  if (isServerSide) return;
  if (mediaQueryList.value.matches) return;
  if (isAtTop.value) {
    const panel = document.getElementById('hero-dark-panel');
    if (panel) {
      updateThemeColor(window.getComputedStyle(panel).backgroundColor);
    }
  } else {
    reset();
  }
};
watchEffect(handleThemeColor);

const handleResize = (e: MediaQueryListEvent) => {
  if (e.matches) {
    reset();
  } else {
    handleThemeColor();
  }
};

onMounted(() => {
  mediaQueryList.value.addEventListener('change', handleResize);
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', handleThemeColor);
});
onUnmounted(() => {
  mediaQueryList.value.removeEventListener('change', handleResize);
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .removeEventListener('change', handleThemeColor);
});
</script>
<style>
@reference 'tailwindcss';
</style>
```

Key change: instead of reading the unresolved `--md-sys-color-inverse-surface` custom property off `document.body`, it now reads the fully-resolved `backgroundColor` of the actual `#hero-dark-panel` element added in Step 11.2 — robust regardless of how that color is derived.

- [ ] **Step 11.4: Build and verify**

```bash
pnpm nx dev personal-website
```

Check both hero layouts (resize the preview to mobile and desktop widths): diagonal split renders with the new `bg-muted`/`after:bg-foreground` (desktop) and `bg-foreground` (mobile) colors instead of transparent/unstyled; Contact Me and Resume buttons work; on mobile, scrolling to the top should tint the browser chrome to the dark panel's color (check via `document.querySelector('meta[name="theme-color"]')` in devtools if the preview tool doesn't show OS chrome).

- [ ] **Step 11.5: Commit**

```bash
git add apps/personal-website/src/components/home/hero
git commit -m "feat(personal-website): migrate hero components to shadcn-vue tokens"
```

---

## Task 12: Migrate `contact-form.astro` and clean up `footer.astro`

**Files:**
- Modify: `apps/personal-website/src/components/home/contact-form.astro`
- Modify: `apps/personal-website/src/components/home/footer.astro`

- [ ] **Step 12.1: Rewrite `contact-form.astro`**

Replace the full contents of `apps/personal-website/src/components/home/contact-form.astro`:

```astro
---
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { useTranslation } from '@utils';
import { info } from '@utils/constants';

interface Props {
  id: string;
}
const { id } = Astro.props;

const { lang } = Astro.params;
const { t } = await useTranslation(lang);
---

<contact-form class="flex flex-col gap-2" id={id}>
  <h2 class="text-xl font-semibold">{t('contact-me-title')}</h2>
  <p class="mb-2">{t('contact-me-description')}</p>
  <div class="flex gap-2">
    <Input label={t('contact-me-from-person')} name="name" />
    <Input label={t('contact-me-from-company')} name="company" />
  </div>
  <Input label={t('contact-me-subject')} name="subject" />
  <Textarea label={t('contact-me-message')} name="message" />
  <Button
    as="a"
    data-contact-submit
    class="mt-4 px-6 w-1/2 self-end"
    href={`mailto:${info.email}`}>{t('contact-me-submit')}</Button
  >
</contact-form>

<script>
  import { info } from '@utils/constants';

  class ContactForm extends HTMLElement {
    connectedCallback() {
      const nameField = this.querySelector(
        'input[name="name"]'
      ) as HTMLInputElement;
      const companyField = this.querySelector(
        'input[name="company"]'
      ) as HTMLInputElement;
      const subjectField = this.querySelector(
        'input[name="subject"]'
      ) as HTMLInputElement;
      const messageField = this.querySelector(
        'textarea[name="message"]'
      ) as HTMLTextAreaElement;
      const submitButton = this.querySelector(
        '[data-contact-submit]'
      ) as HTMLAnchorElement;

      const handleFormChange = () => {
        const name = nameField.value;
        const company = companyField.value;
        let subject = subjectField.value;
        const message = messageField.value;

        if (submitButton) {
          const from =
            name && company ? `${name} (${company})` : name || company;
          if (subject && from) subject = `${subject} - ${from}`;
          else if (from) subject = from;
          submitButton.href = `mailto:${info.email}?subject=${subject}&body=${message}`;
        }
      };

      nameField?.addEventListener('change', handleFormChange);
      companyField?.addEventListener('change', handleFormChange);
      subjectField?.addEventListener('change', handleFormChange);
      messageField?.addEventListener('change', handleFormChange);
    }
  }

  if (!customElements.get('contact-form'))
    customElements.define('contact-form', ContactForm);
</script>
```

Note: `Button as="a" href={...}` always renders as `<a>` regardless of the `as` prop (per `Button.vue`'s `:is="href ? 'a' : as"` logic) — `as="a"` here is just documentation of intent, harmless. The `data-contact-submit` attribute replaces querying by tag name (`md-filled-button`) since `Button` now renders a plain `<a>` that would otherwise be ambiguous to select.

- [ ] **Step 12.2: Clean up `footer.astro`**

`footer.astro` only imported Material Web modules for side-effect registration (redundant with `contact-form.astro`'s own former imports) and had a leftover `.material-symbols-outlined` sizing style that's now dead. Replace the full contents of `apps/personal-website/src/components/home/footer.astro`:

```astro
---
import ContactForm from './contact-form.astro';
import Links from './links.astro';
---

<footer
  class="container md:flex flex-wrap gap-10 hidden justify-between pt-10 pb-20"
>
  <Links />
  <ContactForm id="contact-form-footer" />
</footer>
```

- [ ] **Step 12.3: Build and verify**

```bash
pnpm nx dev personal-website
```

Fill in the contact form's name/company/subject/message fields, confirm the submit button's `mailto:` href updates live as you type (check via devtools element inspector, since clicking would open a mail client).

- [ ] **Step 12.4: Commit**

```bash
git add apps/personal-website/src/components/home/contact-form.astro apps/personal-website/src/components/home/footer.astro
git commit -m "feat(personal-website): migrate contact form to shadcn-vue Input/Textarea/Button"
```

---

## Task 13: Migrate `links.astro`

**Files:**
- Modify: `apps/personal-website/src/components/home/links.astro`

- [ ] **Step 13.1: Rewrite**

Replace the full contents of `apps/personal-website/src/components/home/links.astro`:

```astro
---
import type { ILink } from '@/types';
import { getBrandIconName, useTranslatedPath, useTranslation } from '@/utils';
import { links } from '@/utils/constants';
import { ExternalLink } from '@lucide/vue';

const { lang } = Astro.params;
const { t } = await useTranslation(lang);
const translatePath = useTranslatedPath(lang);

const transformLink = (link: ILink) => ({
  ...link,
  label: t(link.label),
  href: link?.i18n ? translatePath(link.href) : link.href,
  target: link?.external ? '_blank' : '',
  icon: getBrandIconName(link.icon ?? ''),
});

const sections = [
  {
    title: t('resources'),
    links: links.internal.map(transformLink),
  },
  {
    title: t('social-media'),
    links: links.external.map(transformLink),
  },
];
---

{
  sections.map((section) => (
    <div class="flex flex-col gap-2">
      <h2 class="text-xl font-semibold">{section.title}</h2>
      <ul class="space-y-1">
        {section.links.map(({ label, icon, external, ...rest }) => (
          <li>
            <a {...rest} class="flex-row-center gap-1">
              <iconify-icon icon={icon} />
              {label}
              {external && <ExternalLink class="size-4" />}
            </a>
          </li>
        ))}
      </ul>
    </div>
  ))
}
```

This matches the real site's "Resources" (Resume/Blog/Portfolio) / "Social Media" (LinkedIn/GitHub) footer structure exactly — `iconify-icon` stays here since these are brand/tech logos, only the `open_in_new` UI glyph moves to lucide's `ExternalLink`.

- [ ] **Step 13.2: Build and verify**

```bash
pnpm nx dev personal-website
```

Scroll to the footer; confirm "Resources" and "Social Media" columns render with brand icons plus the external-link glyph next to external links.

- [ ] **Step 13.3: Commit**

```bash
git add apps/personal-website/src/components/home/links.astro
git commit -m "feat(personal-website): swap open_in_new glyph to @lucide/vue in footer links"
```

---

## Task 14: Migrate blog post, blog index, and blog layout

**Files:**
- Modify: `apps/personal-website/src/components/blog/post.astro`
- Modify: `apps/personal-website/src/pages/blog/index.astro`
- Modify: `apps/personal-website/src/layouts/blog.astro`

- [ ] **Step 14.1: Rewrite `post.astro` (chip-set/filter-chip → Badge)**

Replace the full contents of `apps/personal-website/src/components/blog/post.astro`:

```astro
---
import type { CollectionEntry } from 'astro:content';
import { getEntry } from 'astro:content';
import { render } from 'astro:content';
import { format } from 'date-fns';

import { Badge } from '@/components/ui/badge';

type Props = CollectionEntry<'blog'>;

const {
  data: { title, pubDate, tags: _tags, author: _author },
} = Astro.props;
const author = (await getEntry(_author)).data;
const { Content } = await render(Astro.props);
const tags = _tags.filter((e) => !e.includes(':'));
---

<div
  class="w-full p-10 bg-card rounded-lg prose dark:bg-card max-w-none"
>
  <h1>{title}</h1>
  <p>{format(pubDate, 'd MMM, yyyy')}<br />By {author.name}</p>
  <Content />
  <div class="flex flex-wrap gap-2 mt-10">
    {tags.map((tag) => <Badge variant="secondary" class="capitalize">{tag}</Badge>)}
  </div>
</div>
```

- [ ] **Step 14.2: Rewrite `pages/blog/index.astro`**

Replace the full contents of `apps/personal-website/src/pages/blog/index.astro`:

```astro
---
import { SourceColor } from '@components';
import Layout from '@layouts/index.astro';
import {
  getBrandIconName,
  getGitHubUrl,
  getLinkedInUrl,
  useTranslatedPath,
  useTranslation,
} from '@utils';
import { info } from '@utils/constants';
import { Image } from 'astro:assets';
import { getCollection } from 'astro:content';
import { Home, ImageIcon } from '@lucide/vue';

import { Button } from '@/components/ui/button';
import { Navigation } from '@/components/blog';

const posts = (
  await getCollection(
    'blog',
    (entry) => !entry.data.tags.includes('type:quick-post')
  )
).sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
const { t } = await useTranslation('en', 'blog');
const translatePath = useTranslatedPath(Astro.currentLocale);
---

<Layout
  title={t('metadata-title')}
  description={t('metadata-description')}
  viewTransition={{ enabled: true }}
>
  <nav class="flex-row-center justify-between container">
    <div>
      <Button variant="ghost" size="icon" href="/">
        <Home />
      </Button>
    </div>
    <div>
      <Button
        variant="ghost"
        size="icon"
        href={getGitHubUrl(info.links.github)}
        target="_blank"
      >
        <iconify-icon icon={getBrandIconName('github')} height="none"
        ></iconify-icon>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        href={getLinkedInUrl(info.links.linkedin)}
        target="_blank"
      >
        <iconify-icon icon={getBrandIconName('linkedin')} height="none"
        ></iconify-icon>
      </Button>
    </div>
  </nav>
  <main class="container py-10">
    <h1 class="text-5xl md:text-9xl text-center mb-10">Rainforest Cheng</h1>
    <div
      class="grid grid-flow-row grid-cols-1 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-5 gap-5 auto-rows-max"
    >
      {
        posts.map(({ data: post, id }) => (
          <a
            href={translatePath(`/blog/${id}`)}
            class="
              md:first:col-span-full lg:first:h-[30dvh] md:first:h-[20dvh] bg-card rounded-lg overflow-hidden hover:shadow 
              @container prose-sm max-w-none
              flex gap-4 flex-col md:first:flex-row-center"
          >
            <div class="md:@2xl:h-full @2xl:w-auto w-full aspect-square flex-center">
              {post.image?.src ? (
                <Image
                  width={128}
                  height={128}
                  class="size-full object-cover m-0!"
                  src={post.image.src}
                  alt={post.image.alt}
                  transition:name={`blog-${id}`}
                />
              ) : (
                <ImageIcon />
              )}
            </div>
            <div class="flex flex-col px-4 pb-3">
              <h2 class="mt-0">{post.title}</h2>
              <p>{post.description}</p>
            </div>
          </a>
        ))
      }
    </div>
    <div class="fixed bottom-10 left-1/2 -translate-x-1/2">
      <Navigation />
    </div>
    <div class="fixed right-10 bottom-10 z-10">
      <SourceColor client:only="vue" />
    </div>
  </main>
</Layout>
```

Note: `@lucide/vue`'s icon is imported as `ImageIcon` (not `Image`) to avoid colliding with Astro's own `Image` import from `astro:assets`.

- [ ] **Step 14.3: Rewrite `layouts/blog.astro`**

Replace the full contents of `apps/personal-website/src/layouts/blog.astro`:

```astro
---
import { Comments } from '@components/blog';
import { Image } from 'astro:assets';
import type { CollectionEntry } from 'astro:content';
import clsx from 'clsx';
import { format } from 'date-fns';
import { ArrowLeft } from '@lucide/vue';

import { Button } from '@/components/ui/button';

import BaseLayout from './index.astro';

type Props = CollectionEntry<'blog'>;
const id = Astro.props.id;
const {
  title,
  description,
  pubDate,
  author: _author,
  image,
} = Astro.props.data;
---

<BaseLayout
  title={title}
  description={description}
  imageUrl={image?.src}
  viewTransition={{ enabled: true }}
>
  {
    image?.src && (
      <Image
        src={image?.src}
        width={512}
        height={512}
        alt={image?.alt}
        class="w-full max-h-75 md:max-h-1/2 object-cover"
        transition:name={`blog-${id}`}
      />
    )
  }
  <Button
    variant="secondary"
    size="icon"
    onclick="history.back()"
    class="fixed top-10 left-10 rounded-full text-primary"
  >
    <ArrowLeft />
  </Button>
  <article
    class={clsx(
      'container prose md:prose-xl lg:prose-2xl py-4',
      image?.src && '-mt-0 md:-mt-75'
    )}
  >
    <p class="text-center">{format(pubDate, 'd MMM, yyyy')}</p>
    <div class={clsx(image?.src && 'bg-background/25 px-4 backdrop-blur-sm')}>
      <slot />
    </div>
  </article>
  <section class="container pb-20">
    <Comments />
  </section>
</BaseLayout>
```

- [ ] **Step 14.4: Build and verify**

```bash
pnpm nx dev personal-website
```

Visit `/blog`: nav icons (home/github/linkedin) render; post grid shows the featured + grid layout; a post without an image shows the lucide image-placeholder icon. Open an individual post: back button (top-left) works, tags render as `Badge` pills at the bottom.

- [ ] **Step 14.5: Commit**

```bash
git add apps/personal-website/src/components/blog/post.astro apps/personal-website/src/pages/blog/index.astro apps/personal-website/src/layouts/blog.astro
git commit -m "feat(personal-website): migrate blog post/index/layout to shadcn-vue and lucide icons"
```

---

## Task 15: Migrate the settings page (`color-system.vue`, `source-color.vue`)

**Files:**
- Modify: `apps/personal-website/src/components/color-system.vue`
- Modify: `apps/personal-website/src/components/source-color.vue`

- [ ] **Step 15.1: Rewrite `color-system.vue`**

Replace the full contents of `apps/personal-website/src/components/color-system.vue`:

```vue
<script lang="ts" setup>
import '@rainforest-dev/rainforest-ui/lit/design-system/colors';
import '@rainforest-dev/rainforest-ui/lit/design-system/typography';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
</script>

<template>
  <Tabs default-value="colors">
    <TabsList>
      <TabsTrigger value="colors">Colors</TabsTrigger>
      <TabsTrigger value="typography">Typography</TabsTrigger>
    </TabsList>
    <TabsContent value="colors" class="py-10">
      <rf-design-system-colors />
    </TabsContent>
    <TabsContent value="typography" class="py-10">
      <rf-design-system-typography />
    </TabsContent>
  </Tabs>
</template>
```

This drops the old manual `aria-controls`/`hidden`-attribute panel-switching JS entirely — `reka-ui`'s `TabsContent` already handles showing/hiding the active panel, so the hand-rolled `getPanelByTab`/`handleTabChange` logic is redundant with what `Tabs` now does natively.

- [ ] **Step 15.2: Rewrite `source-color.vue`**

Replace the full contents of `apps/personal-website/src/components/source-color.vue`:

```vue
<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <button
        id="source-color"
        class="size-10 block rounded-full ring-4 ring-accent/80 ring-offset-3 duration-300 cursor-pointer"
        :style="{
          backgroundColor: $sourceColor.value,
        }"
        title="Source Color Picker"
      >
        <img
          :src="sourceImage"
          alt="source image"
          class="size-full rounded-full"
          v-if="sourceImage"
        />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <div class="px-4 py-2 space-y-2">
        <div class="relative">
          <label
            for="source-color-image"
            :style="{
              borderColor: $sourceColor.value,
              color: $sourceColor.value,
            }"
            class="w-full aspect-square cursor-pointer border rounded flex-center"
            title="Source Image"
          >
            <img
              :src="sourceImage"
              alt="source image"
              class="object-cover size-full peer"
              v-if="sourceImage"
            />
            <ImageIcon v-else class="size-12" />
          </label>
          <input
            type="file"
            name="source-color-image"
            id="source-color-image"
            accept="image/*"
            @change="handleImageChange"
            class="sr-only size-auto inset-4"
          />
        </div>
        <div class="relative">
          <label
            for="source-color-picker"
            class="w-full h-6 block cursor-pointer rounded"
            :style="{ backgroundColor: $sourceColor.value }"
            title="Source Color"
          ></label>
          <input
            type="color"
            name="source-color-picker"
            id="source-color-picker"
            v-model="sourceColor"
            @change="handleColorChange"
            class="sr-only size-auto inset-0"
          />
        </div>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
<script lang="ts" setup>
import { hexFromArgb } from '@material/material-color-utilities';
import { useVModel } from '@nanostores/vue';
import { sourceColorFromImageBytes } from '@rainforest-dev/rainforest-ui';
import { $sourceColor } from '@stores';
import { useLocalStorage } from '@vueuse/core';
import { ImageIcon } from '@lucide/vue';

import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const sourceColor = useVModel($sourceColor);
const sourceImage = useLocalStorage('source-image', '');

const reload = () => location.reload();

const handleColorChange = () => {
  if (sourceImage.value) sourceImage.value = '';
  reload();
};

const handleImageChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = async () => {
      sourceImage.value = reader.result as string;

      const img = new Image();
      img.src = sourceImage.value;
      await new Promise((resolve) => (img.onload = resolve));
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const imageData = ctx?.getImageData(0, 0, img.width, img.height);
      if (!imageData) return;
      const argb = sourceColorFromImageBytes(imageData.data);
      const color = hexFromArgb(argb);
      if (color && color !== sourceColor.value) {
        sourceColor.value = color;
        reload();
      }
    };
    reader.readAsDataURL(file);
  }
};
</script>
```

Note: `ring-tertiary/80` → `ring-accent/80` (no `tertiary` role exists in the shadcn token set; `accent` is the closest equivalent supporting role). `sourceColorFromImageBytes` import is untouched — it's the one Material utility this migration explicitly keeps.

- [ ] **Step 15.3: Build and verify**

```bash
pnpm nx dev personal-website
```

Visit `/settings`: Colors/Typography tabs switch correctly. Visit the homepage or `/blog`: click the floating source-color swatch (bottom-right), pick a new color or upload an image — page should reload and re-tint from the new seed (the signature feature — confirm it still works end-to-end).

- [ ] **Step 15.4: Commit**

```bash
git add apps/personal-website/src/components/color-system.vue apps/personal-website/src/components/source-color.vue
git commit -m "feat(personal-website): migrate settings page (Tabs, source-color DropdownMenu)"
```

---

## Task 16: Clean up dead Material Web imports and remove the Material Symbols icon font

**Files:**
- Modify: `apps/personal-website/src/components/home/experiences/index.astro`
- Modify: `apps/personal-website/src/layouts/head.astro`

- [ ] **Step 16.1: Remove the dead chip import from `experiences/index.astro`**

In `apps/personal-website/src/components/home/experiences/index.astro`, delete the entire `<script>` block (lines 16-19):

```astro
<script>
  import '@material/web/chips/chip-set';
  import '@material/web/chips/filter-chip';
</script>
```

Nothing in this file or its children (`item.astro`, `project.astro`) actually renders `md-chip-set`/`md-filter-chip` — this was a dangling registration.

- [ ] **Step 16.2: Remove Material Symbols from `head.astro`**

Replace the full contents of `apps/personal-website/src/layouts/head.astro`:

```astro
---
import SpeedInsights from '@vercel/speed-insights/astro';
import { pwaInfo } from 'virtual:pwa-info';

import type { HeadProps as Props } from './types';

const {
  title,
  description,
  imageUrl = new URL('/images/thumbnail/1.jpg', Astro.site),
} = Astro.props;
const url = Astro.url.toString();
---

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <meta name="generator" content={Astro.generator} />
  <link rel="sitemap" href="/sitemap-index.xml" />

  <!-- Open Graph and Twitter Card Metadata  -->
  <title>{title}</title>
  <meta name="title" content={title} />
  <meta property="og:title" content={title} />
  <meta property="twitter:title" content={title} />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Rainforest Tools" />
  <meta property="og:url" content={url} />
  <meta property="twitter:card" content="summary_large_image" />
  <meta property="twitter:site" content="@rainforesttools" />
  <meta property="twitter:url" content={url} />

  {
    description && (
      <>
        <meta name="description" content={description} />
        <meta property="og:description" content={description} />
        <meta property="twitter:description" content={description} />
      </>
    )
  }
  {
    imageUrl && (
      <>
        <meta property="og:image" content={imageUrl} />
        <meta property="twitter:image" content={imageUrl} />
      </>
    )
  }

  <!-- Google Fonts -->
  <link
    rel="preload"
    href="https://fonts.googleapis.com/css2?family=Lora&display=swap"
    as="style"
    onload="this.onload=null;this.rel='stylesheet'"
  />
  <noscript>
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Lora&display=swap"
    />
  </noscript>

  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="preconnect" href="https://fonts.googleapis.com" crossorigin />
  <link rel="dns-prefetch" href="https://fonts.gstatic.com" crossorigin />
  <link rel="dns-prefetch" href="https://fonts.googleapis.com" crossorigin />

  <link
    rel="alternate"
    type="application/rss+xml"
    title={title}
    href={new URL('rss.xml', Astro.site)}
  />

  <slot />

  <!-- PWA Manifest -->
  {pwaInfo && <Fragment set:html={pwaInfo.webManifest.linkTag} />}

  <SpeedInsights />
</head>
```

The `icons` array, `googleFontsLink` computation, and both `<link>`/`<noscript>` tags referencing it are removed — Lora's Google Fonts link stays exactly as-is (per the explicit decision to keep font loading unchanged).

- [ ] **Step 16.3: Build and full-site smoke test**

```bash
pnpm nx build personal-website
pnpm nx dev personal-website
```

Browse every page (home, `/blog`, an individual post, `/resume`, `/settings`) and confirm no icon renders as missing/tofu-box text (which would indicate something still expects the Material Symbols font).

- [ ] **Step 16.4: Commit**

```bash
git add apps/personal-website/src/components/home/experiences/index.astro apps/personal-website/src/layouts/head.astro
git commit -m "feat(personal-website): remove Material Symbols icon font and dead chip import"
```

---

## Task 17: Verify no `iconify-icon` regressions and confirm scope

**Files:** none — read-only verification

- [ ] **Step 17.1: Confirm iconify-icon usage is now limited to brand/tech logos**

```bash
grep -rn "iconify-icon" apps/personal-website/src --include="*.vue" --include="*.astro"
```

Expected matches: `fab.vue` (LinkedIn/GitHub), `links.astro` (resource/social icons), `pages/blog/index.astro` (github/linkedin nav icons), `source-color.vue` should have **no** `iconify-icon` matches after Task 15 (its `material-symbols-outlined` span was replaced with lucide's `ImageIcon`), `home/experiences/item.astro` (tech-stack tags — untouched, already correct). If any UI-glyph use of `iconify-icon` remains (anything that isn't a brand/tech logo), fix it before proceeding.

- [ ] **Step 17.2: Confirm no remaining `material-symbols-outlined` references**

```bash
grep -rn "material-symbols-outlined" apps/personal-website/src
```

Expected: no matches.

---

## Task 18: Delete dead code and remove `@material/web`

**Files:**
- Delete: `apps/personal-website/src/components/md3.ts`
- Delete: `apps/personal-website/src/components/ai-button.ts`
- Delete: `libs/rainforest-ui/src/tailwindcss/md3.ts`
- Modify: `apps/personal-website/src/components/index.ts`
- Modify: `libs/rainforest-ui/vite.config.ts:34-42`
- Modify: `apps/personal-website/package.json`

- [ ] **Step 18.1: Confirm nothing references the files about to be deleted**

```bash
grep -rln "from '\./md3'\|from '@components/md3'\|ai-button\|AiButton" apps/personal-website/src
grep -rln "tailwindcss/md3" apps/personal-website/src apps/personal-website
```

Expected: `components/index.ts` (its `export * from './md3'` line, removed in Step 18.3) and `components/ai-button.ts` itself. `tailwindcss/md3` should have **zero** matches in `apps/personal-website` — Task 3 already swapped `app.css` to `tailwindcss/shadcn`.

- [ ] **Step 18.2: Delete the dead files**

```bash
rm apps/personal-website/src/components/md3.ts
rm apps/personal-website/src/components/ai-button.ts
rm libs/rainforest-ui/src/tailwindcss/md3.ts
```

- [ ] **Step 18.3: Remove the `md3` export from `components/index.ts`**

Replace the full contents of `apps/personal-website/src/components/index.ts`:

```typescript
export { default as ColorSystem } from './color-system.vue';
export { default as SourceColor } from './source-color.vue';
export { default as Tag } from './tag.astro';
export { default as ThemeProvider } from './theme-provider.astro';
```

- [ ] **Step 18.4: Remove the `md3` entry from `rainforest-ui`'s Vite build**

In `libs/rainforest-ui/vite.config.ts`, remove the now-dangling entry (the plugin file no longer exists):

```typescript
      entry: {
        index: 'src/index.ts',
        'tailwindcss/shadcn': 'src/tailwindcss/shadcn.ts',
        ...Object.fromEntries(
          glob
            .sync('src/{lit,utils}/**/!(*.spec|*.test).ts')
            .map((e) => [e.replace('src/', '').replace('.ts', ''), e]),
        ),
      },
```

(`'tailwindcss/md3': 'src/tailwindcss/md3.ts',` is deleted.)

- [ ] **Step 18.5: Remove `@material/web` from `apps/personal-website/package.json`**

Delete the line:
```json
"@material/web": "^2.4.1",
```

- [ ] **Step 18.6: Reinstall and rebuild**

```bash
pnpm install
pnpm nx build rainforest-ui
pnpm nx build personal-website
```

Expected: both build successfully. `libs/rainforest-ui/dist/tailwindcss/` now contains only `shadcn.*` files (no `md3.*`).

- [ ] **Step 18.7: Commit**

```bash
git add -A apps/personal-website/src/components/md3.ts apps/personal-website/src/components/ai-button.ts \
  libs/rainforest-ui/src/tailwindcss/md3.ts apps/personal-website/src/components/index.ts \
  libs/rainforest-ui/vite.config.ts apps/personal-website/package.json pnpm-lock.yaml
git commit -m "chore(personal-website): remove dead Material Web code and the @material/web dependency"
```

---

## Task 19: RWD hardening pass

**Files:** none expected, unless issues are found (then: whichever `.astro`/`.vue` file needs a breakpoint fix)

No known responsive bugs exist today, so this is a full verification pass rather than targeted fixes, per the spec. For each page below, use the preview tools' `preview_resize` at three widths — mobile (375×812), tablet (768×1024), desktop (1280×800) — and `preview_screenshot` to check.

- [ ] **Step 19.1: Home page (`/`)**

Check: nav collapses to the hamburger menu below `md`; the hero switches from `one-column.astro` (mobile) to `three-columns.astro` (desktop) at the expected breakpoint with no layout break at the transition; Experience timeline switches from single-column to the alternating left/right layout at `sm`; FAB stays pinned bottom-right at all sizes without overlapping content; footer's two columns stack on mobile.

- [ ] **Step 19.2: Blog index (`/blog`)**

Check: post grid goes from `grid-cols-1` (mobile) → `sm:grid-cols-3` → `lg:grid-cols-5`; the featured (first) post spans full width and doesn't clip its image at mobile widths; the bottom navigation and source-color picker don't overlap each other or page content on small screens.

- [ ] **Step 19.3: Blog post page**

Check: the back button (top-left) doesn't overlap the hero image on mobile; code blocks and KaTeX-rendered math scroll horizontally *within their own container* at narrow widths — never causing the page itself to scroll horizontally. If a code block or math expression does overflow the page, add `overflow-x-auto` to its containing element in `apps/personal-website/src/components/blog/post.astro`'s wrapping `<div>` (currently `class="w-full p-10 bg-card rounded-lg prose ..."` — Tailwind's `prose` class from `@tailwindcss/typography` already scopes `pre`/code blocks to scroll internally by default, so this should already hold; only patch if the check finds otherwise).

- [ ] **Step 19.4: Resume (`/resume`)**

`resume/ats-friendly.astro` uses no Material Web components (pure Tailwind/typography), so this page needed no component migration — verify it's still responsive and print-friendly: check the two-column `grid-cols-2` Education/Skills section collapses sensibly on mobile (add `sm:grid-cols-2 grid-cols-1` if it currently doesn't — check the actual rendered behavior first), and use the browser's print preview to confirm the page still prints cleanly on a single reasonable page count.

- [ ] **Step 19.5: Settings (`/settings`)**

Check: the light/dark side-by-side preview (`w-full lg:flex-row flex-col`) stacks vertically on mobile instead of squeezing two columns into a narrow viewport.

- [ ] **Step 19.6: Fix any issues found, then re-verify**

If any of the above checks fail, fix the specific file and re-run the check for that page only. Do not proceed to Task 20 until all six checks pass.

- [ ] **Step 19.7: Commit (only if fixes were needed)**

```bash
git add -A
git commit -m "fix(personal-website): RWD fixes found during migration verification pass"
```

---

## Task 20: Final full-site verification and follow-up flag

**Files:** none

- [ ] **Step 20.1: Full build**

```bash
pnpm nx build personal-website
pnpm nx build rainforest-ui
pnpm nx affected -t lint typecheck --all
```

Expected: all pass.

- [ ] **Step 20.2: Manual pass — the signature feature**

```bash
pnpm nx dev personal-website
```

On the homepage, open the source-color picker (bottom-right swatch) and change the seed color. Confirm: nav, hero, buttons, badges, and cards across the page re-tint instantly to the new color, in both light and dark OS color-scheme settings. This is the one behavior the whole migration must not regress.

- [ ] **Step 20.3: Flag the out-of-scope blog demo components**

```bash
grep -rln "md-outlined-button\|md-outlined-text-field\|md-filled-button" apps/personal-website/src/components/blog/demo
```

Expected: `quick-posts/weather-forecast/index.vue` and `webgpu/web-llm.vue`. These are intentionally left on Material Web per this plan's scope note — if `@material/web` were removed from `package.json` without addressing these, they'd break. Since Task 18 already removed `@material/web` from `package.json`, **these two files will fail to build** unless fixed. Confirm this now:

```bash
pnpm nx build personal-website
```

If the build fails specifically on these two files (missing `@material/web` module errors), the pragmatic fix within this plan's scope is to re-add `@material/web` as a `package.json` dependency (it's cheap — a handful of KB, used in exactly two demo files) rather than doing a full migration of the demo widgets now. If so:

```json
"@material/web": "^2.4.1",
```

Re-add this line to `apps/personal-website/package.json`, run `pnpm install`, and note in the commit message that these two demo files still depend on it intentionally.

- [ ] **Step 20.4: Commit final state**

```bash
git add -A
git commit -m "chore(personal-website): complete Material Web to shadcn-vue migration"
```

---

## Self-Review Checklist

- [x] Every Material Web (`md-*`) component found in the audit has a migration step (Tasks 9-16), including three files (`footer.astro`, `links.astro`, `layouts/blog.astro`, `experiences/index.astro`) missed by the original spec's audit and caught while reading real source during plan-writing.
- [x] Token engine avoids duplicating `theme.ts`'s HCT logic — `theme-provider.astro` keeps reusing it narrowly for the `<meta theme-color>` computation, since `lit/md3-lit` still depends on those exports (confirmed via grep) and the spec requires leaving `md3-lit` untouched.
- [x] `[data-scheme]` (not `[data-theme]`) is used throughout, matching the attribute name the codebase already uses in `theme-provider.astro` and `settings.astro` today — the spec's own text said `data-theme`, corrected here after reading the actual code.
- [x] reka-ui component APIs (DropdownMenu*, Tabs*) verified against reka-ui's own documentation before being written into the plan, not guessed.
- [x] The `--md-sys-color-*` → resolved-`backgroundColor` fix (Tasks 9 and 11) is called out explicitly, since a literal custom-property read would silently break once colors are relative-color-syntax-derived instead of literal hex.
- [x] Blog demo components (`weather-forecast`, `web-llm`) are explicitly flagged rather than silently left half-broken by the `@material/web` removal in Task 18 — Task 20 catches and resolves the resulting build failure.
- [x] No placeholders — every step has complete, real code.
