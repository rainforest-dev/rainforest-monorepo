# Personal Website: Material Web → shadcn Migration

**Date:** 2026-07-10
**Approach:** Full-site component + token migration, scoped by an existing claude.ai design doc (corrected on icons and font hosting)
**Scope:** `apps/personal-website` (all pages/components) + a new shared token layer in `libs/rainforest-ui`

---

## Context

`apps/personal-website` (rainforest.tools) currently themes itself via Material Design 3: `libs/rainforest-ui`'s `tailwindcss/md3.ts` Tailwind plugin runs `@material/material-color-utilities`'s HCT algorithm against a single seed color at build time, emitting `--md-sys-color-*` CSS variables consumed by Material Web (`md-*`) custom elements. Material Web is unmaintained, and the design system needs to move off it.

The user already produced a target design system on claude.ai (shared project `b6041f7f-6f56-4c79-bb21-a8f8555108ea`), reverse-engineered from this monorepo. It specifies: shadcn/ui (React) + shadcn-vue replacing `@material/web`; a single dynamic OKLCH seed color via native CSS relative-color syntax; Iconify replacing `md-icon`/Material Symbols; Lora/JetBrains Mono typography (unchanged from today). This spec adopts that design doc as the source of truth, with two corrections made after auditing the actual codebase (see "Corrections to the claude.ai design doc" below).

**What stays the same:** fonts (Lora + JetBrains Mono, still via Google Fonts CDN `<link>` tags — no self-hosting), i18n (en/zh), content collections, Vercel SSR adapter, PWA config, overall page layout/branding, the "one seed color re-tints everything" feature.

**What changes:** every Material Web component, the theming engine, and the icon system.

---

## Codebase audit findings (informing this design)

- **Zero working React islands exist today.** No `.tsx` files in `apps/personal-website`. The React wrappers in `components/md3.ts` (ChipSet, FilterChip, OutlinedTextField, SelectOption, OutlinedSelect) and `components/ai-button.ts` are dead exports — nothing imports them.
- **Every real interactive island is Vue**, mounted via `@astrojs/vue`: `Nav`, `SourceColor` (seed-color/image picker), `ColorSystem` (settings page), `ThemeColorModifier`, `fab.vue`, `language-picker.vue`. `contact-form.astro` manipulates `md-outlined-text-field` elements directly via DOM APIs, not through a framework.
- **Most icons today are not Iconify** — they're Google's Material Symbols ligature font, loaded via a dynamic Google Fonts URL in `layouts/head.astro` (`arrow_back`, `close`, `menu`, `mail`, etc. as ligature text inside `<md-icon>`). Only 6 files use `iconify-icon` today (a partial migration already in progress).
- **`@material/material-color-utilities` is used in more places than just theming**: `rainforest-ui`'s `utils/theme.ts`, `tailwindcss/md3.ts`, and `lit/md3-lit/index.ts`, plus `personal-website`'s `source-color.vue` and `theme-provider.astro`. Only the theme/scheme-generation half (`themeFromSourceColor`, `getSchemeProperties`) is being retired — `sourceColorFromImageBytes` (photo → dominant color) is kept and rewired to feed the new `--seed` variable directly.
- Fonts (`Lora`) are loaded via Google Fonts CDN `<link>` today, not self-hosted.

---

## Corrections to the claude.ai design doc

The design doc was generated without repo access to confirm two things; both are corrected here based on what actually exists:

1. **Icons.** The doc says "Iconify replaces `md-icon`/Material Symbols" for everything. Corrected: **`lucide-vue-next`** (bundled at build time, consistent stroke widths, no runtime fetch — matches shadcn-vue's own convention) replaces Material Symbols for all UI glyphs (menu, close, arrow-up, mail, chat, etc). `iconify-icon` is kept, narrowly, only for colored brand/tech-stack logos (`logos:vue`, `logos:react`, `logos:astro-icon`, etc. in the skills section) — a low-risk use since each logo renders once per tech rather than mixing icon sets within one UI surface.
2. **Fonts.** The doc's caveat suggested self-hosting Lora/JetBrains Mono as woff2. Corrected: keep the existing Google Fonts CDN `<link>` approach — explicitly declined, not an oversight.

---

## Architecture

### Token engine (replaces `md3.ts`)

A new shared CSS token layer in `libs/rainforest-ui` (structurally where `md3.ts` lives today, but plain CSS — there's no JS algorithm to run anymore):

- One `--seed` custom property (default `oklch(0.715 0.076 196)`, ≈ `#66b2b2`, the existing teal default — unchanged).
- Every shadcn-convention variable derived via CSS relative-color syntax: `--primary: oklch(from var(--seed) L C h)` (with fixed per-role L/C/H offsets tuned for contrast), covering `--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring` (+ matching `*-foreground` roles).
- Light/dark via `prefers-color-scheme`, overridable via `[data-theme="light"|"dark"]` — same mechanism `theme-provider.astro` already uses, just against the new variable names.
- `@supports not (color: oklch(from red l c h))` fallback block resolves a static pre-computed teal theme, for engines without relative-color-syntax support (pre-Safari 26).
- `sourceColorFromImageBytes` stays in `rainforest-ui`, now feeding `--seed` directly (its output ARGB is converted to an OKLCH/hex string and written to the same cookie-persisted store `theme-provider.astro` already reads).
- `theme-provider.astro` keeps its current shape (SSR-inlined `<style>`, cookie-read seed, `<meta name="theme-color">`) — only the variable-name mapping table changes.
- `themeFromSourceColor`, `getSchemeProperties`, `schemePropertiesToCssInJs`, and the `md3.ts` Tailwind plugin are deleted. `lit/md3-lit` is left alone (not part of `personal-website`'s import graph, out of scope).

### Component stack

- **shadcn-vue** (reka-ui primitives): the primary system, since every real island is Vue today. New `apps/personal-website/components.json` (mirroring `personal-calibre`'s: `class-variance-authority`, `tailwind-merge`, added to the pnpm catalog so both apps share versions). Components live at `src/components/ui` as plain `.vue` SFCs (shadcn-vue's copy-in convention, not an npm package).
- **shadcn/ui (React)**: wired up per the design doc (`@astrojs/react` stays, a parallel `src/components/ui-react` or equivalent alias configured) but no component is force-built here — nothing currently needs it.
- **Icons**: `lucide-vue-next` added as a dependency for UI glyphs; `iconify-icon` kept, scope narrowed to brand/tech logos only. The Material Symbols Google Fonts `<link>` + icon-name whitelist logic in `layouts/head.astro` is deleted.

### Component migration map

| Current (Material Web) | Files | New (shadcn-vue) |
|---|---|---|
| `md-filled-button`, `md-outlined-button` | `three-columns.astro`, `contact-form.astro` | `Button` (`variant="default"/"outline"`) |
| `md-icon-button` + `md-icon` | `nav.vue`, `language-picker.vue`, `fab.vue`, `blog/index.astro` | `Button` `variant="ghost"` `size="icon"` + `lucide-vue-next` icon inside |
| `md-fab` | `fab.vue` | No Radix/reka-ui equivalent — kept as a small custom component, restyled with the new tokens |
| `md-menu` + `md-menu-item` | `language-picker.vue`, `fab.vue`, `source-color.vue` | `DropdownMenu` |
| `md-outlined-text-field` | `contact-form.astro`, webgpu demo | `Input` / `Textarea` |
| `md-outlined-select` + `md-select-option` | dead `md3.ts` React wrappers (unused — delete) | n/a, delete |
| `md-chip-set` + `md-filter-chip` | `blog/post.astro` tag filters | `Badge` / `ToggleGroup` |
| `md-tabs` + `md-primary-tab` | `color-system.vue` (settings page) | `Tabs` |
| `md-ai-button` (custom, `ai-button.ts`, unused) | none | delete |

### RWD hardening

Tailwind's standard breakpoints (sm/md/lg/xl), verified per page against `conductor/product-guidelines.md`'s existing contract ("adapt to mobile/tablet/desktop, no horizontal scroll"). No known bug list exists, so verification is a full pass rather than targeted fixes — every page checked at mobile/tablet/desktop via the preview tools as part of the implementation plan's testing step. Particular attention: `nav.vue`'s mobile menu (needs a real mobile pattern, not a repurposed `md-menu`), the `three-columns.astro` ↔ `one-column.astro` hero breakpoint, `blog/post.astro` code blocks/KaTeX math (must scroll inside their own container, never the page), and `resume/ats-friendly.astro` (responsive **and** print-friendly).

---

## Out of scope

Fonts (loading mechanism unchanged), i18n, content collections, Vercel SSR adapter, PWA config, `rainforest-ui`'s `lit/md3-lit` module and other Lit exports not touched by this migration, the claude.ai design doc's voice/content/copywriting guidelines (informative, not implemented as code in this pass).

---

## Testing

- `pnpm nx build personal-website` and `pnpm nx dev personal-website` must succeed after each major step (token layer, then component-by-component).
- Manual verification per page via the preview tools: visual check (light + dark, since both derive from the same seed), responsive check (mobile/tablet/desktop), and a seed-color change re-tinting the whole page live (the signature feature, must not regress).
- No automated visual regression suite exists for this app today; none is being added as part of this migration (out of scope — flagging, not deciding, in case a follow-up wants one).
