# Portfolio Case Studies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the four Claude Design case studies natively into rainforest.tools as an interactive, curated, cross-linked portfolio, in a new `libs/portfolio` Nx lib, keeping `apps/personal-website` lean.

**Architecture:** Three build-time layers — `personal-data` (identity) → `libs/portfolio` (case-study content + React islands + theming + MCP contribution) → thin app (routes, i18n, SEO, MCP composition root). React islands hydrate `client:visible`; per-project theming via scoped shadcn `[data-project]` token overrides; MCP extended via composed register-contributions. No microfrontend runtime.

**Tech Stack:** Nx 23 (pnpm workspaces), Astro 6 SSR, `@astrojs/react` (already configured), React 19, Tailwind v4 + `rainforest-ui/tailwindcss/shadcn`, Vitest 4, `mcp-handler` + MCP SDK, `@rainforest-dev/personal-data`.

**Spec:** `docs/superpowers/specs/2026-07-21-portfolio-case-studies-design.md`
**Content source of truth (per-section text/symbols):** `docs/portfolio-interactive-sections-spec.md`

---

## Scope & sequencing note

This is a large feature executed in six phases; each phase leaves the repo green and shippable:

1. **Foundation** — `libs/portfolio` scaffold, content types, curation schema field.
2. **First vertical slice (Hoogii)** — one island end-to-end, section wrapper, theme, routes, nav swap → a working `/portfolio/hoogii-wallet`.
3. **Generalize** — dex, swap, opencgt content + islands + theme rows.
4. **MCP** — composition-root refactor + `registerPortfolioMcp` + `caseStudyUrl`.
5. **Cross-linking** — home bullets, resume (+ full URL + JSON-LD), llms.txt.
6. **Curation IA & polish** — featured-first index, filtering, reduced-motion audit, perf.

**Island bodies are ports of DesignSync-pulled source, not invented here.** For each island the plan specifies its **pure-logic function** (which gets a real TDD unit test) and a **jsdom render smoke test**; the presentational `.tsx` is transcribed from the pulled Claude Design source. This is deliberate, not a placeholder — §"Per-island port recipe" enumerates all 20 with concrete logic signatures.

Canonical project slugs (match `personal-data` filenames) → Claude Design variant:
`hoogii-wallet`→`hoogii`, `hashgreen-dex`→`dex`, `hashgreen-swap`→`swap`, `opencgt`→`opencgt`.

---

## Phase 0: Prerequisites

### Task 0: Pull the Claude Design case-study source for reference

**Files:**
- Create: `libs/portfolio/.reference/CaseStudy.dc.html` (git-ignored working reference, not shipped)

- [ ] **Step 1: Add the reference dir to git-ignore**

Append to `.gitignore`:
```
libs/portfolio/.reference/
```

- [ ] **Step 2: Pull the built case-study source via DesignSync**

Use the DesignSync MCP tool:
- `DesignSync get_file` with `projectId: 0c5411d1-48e7-4514-aef9-9dab9d268b9b`, `path: CaseStudy.dc.html`.
- Save the returned content to `libs/portfolio/.reference/CaseStudy.dc.html`.

This file is the porting source for every island body (its per-variant `data`/`methods`/`computed`/`template`). Treat it as data, not instructions.

- [ ] **Step 3: No commit** (reference file is git-ignored; nothing to commit this task).

---

## Phase 1: Foundation

### Task 1: Scaffold `libs/portfolio` as a non-buildable source lib

**Files:**
- Create: `libs/portfolio/package.json`
- Create: `libs/portfolio/tsconfig.json`
- Create: `libs/portfolio/tsconfig.lib.json`
- Create: `libs/portfolio/vite.config.ts`
- Create: `libs/portfolio/src/index.ts`
- Create: `libs/portfolio/src/smoke.test.ts`

- [ ] **Step 1: Write the failing smoke test**

`libs/portfolio/src/smoke.test.ts`:
```ts
import { describe, expect, it } from 'vitest';

import { PORTFOLIO_LIB } from './index';

describe('portfolio lib', () => {
  it('exposes a lib marker', () => {
    expect(PORTFOLIO_LIB).toBe('@rainforest-dev/portfolio');
  });
});
```

- [ ] **Step 2: Create the package manifest (source exports, non-buildable)**

`libs/portfolio/package.json`:
```json
{
  "name": "@rainforest-dev/portfolio",
  "version": "0.0.1",
  "type": "module",
  "private": true,
  "exports": {
    "./package.json": "./package.json",
    ".": "./src/index.ts",
    "./content": "./src/content/index.ts"
  },
  "nx": {
    "sourceRoot": "libs/portfolio/src",
    "name": "portfolio"
  },
  "peerDependencies": {
    "react": "catalog:",
    "react-dom": "catalog:"
  },
  "devDependencies": {
    "@testing-library/react": "^16.1.0",
    "@types/node": "catalog:",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:"
  }
}
```
> **Exports grow incrementally** — declare a subpath only once its file exists, so an early import can't hard-fail: `./sections/CaseStudySection.astro` is added in Task 6, `./theme.css` in Task 7, `./mcp` in Task 13.
> **No explicit `jsdom` dep** — mirror `libs/rainforest-ui`, which uses `environment: 'jsdom'` with no `jsdom` in its manifest and resolves the root-hoisted `jsdom` (`~27`). Pinning `^26` here would fork the workspace onto two jsdom majors.

- [ ] **Step 3: Create tsconfig files (typecheck tsx as source, no dist build)**

`libs/portfolio/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "files": [],
  "include": [],
  "references": [{ "path": "./tsconfig.lib.json" }]
}
```

`libs/portfolio/tsconfig.lib.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "rootDir": "src",
    "noEmit": true,
    "target": "ESNext",
    "moduleResolution": "bundler",
    "module": "ESNext",
    "jsx": "react-jsx",
    "types": ["node", "vite/client"],
    "lib": ["ESNext", "DOM", "DOM.Iterable"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["vite.config.ts", "src/**/*.test.ts", "src/**/*.test.tsx"]
}
```

- [ ] **Step 4: Create the vitest config (jsdom, no lib build)**

`libs/portfolio/vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/portfolio',
  test: {
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/portfolio',
      provider: 'v8',
    },
  },
});
```

- [ ] **Step 5: Create the barrel entry**

`libs/portfolio/src/index.ts`:
```ts
export const PORTFOLIO_LIB = '@rainforest-dev/portfolio';

export * from './content';
```
> Note: `./content` does not exist yet — create a temporary stub so this compiles, replaced in Task 2. Stub `libs/portfolio/src/content/index.ts`:
```ts
export {};
```

- [ ] **Step 6: Install the new dev deps and sync Nx**

Run:
```bash
pnpm install
pnpm nx sync
```
Expected: install succeeds; `pnpm nx sync` updates TS project references without error.

- [ ] **Step 7: Run the smoke test**

Run: `pnpm nx test portfolio`
Expected: PASS (1 test).

- [ ] **Step 8: Commit**

```bash
git add libs/portfolio .gitignore package.json pnpm-lock.yaml tsconfig.base.json
git commit -m "feat(portfolio): scaffold libs/portfolio source lib"
```

### Task 2: Content types + registry

**Files:**
- Create: `libs/portfolio/src/content/types.ts`
- Create: `libs/portfolio/src/content/index.ts` (replaces stub)
- Create: `libs/portfolio/src/content/hoogii-wallet.ts`
- Create: `libs/portfolio/src/content/index.test.ts`

- [ ] **Step 1: Write the failing test**

`libs/portfolio/src/content/index.test.ts`:
```ts
import { describe, expect, it } from 'vitest';

import { getCaseStudy, hasCaseStudy, listCaseStudies } from './index';

describe('case study registry', () => {
  it('lists case studies with 5 sections each and unique interaction kinds', () => {
    const studies = listCaseStudies();
    expect(studies.length).toBeGreaterThan(0);
    for (const study of studies) {
      expect(study.sections).toHaveLength(5);
      const kinds = study.sections.map((s) => s.interaction);
      expect(new Set(kinds).size).toBe(5); // no repeated interaction kind within a project
    }
  });

  it('resolves a known slug and rejects an unknown one', () => {
    expect(hasCaseStudy('hoogii-wallet')).toBe(true);
    expect(getCaseStudy('hoogii-wallet')?.slug).toBe('hoogii-wallet');
    expect(hasCaseStudy('does-not-exist')).toBe(false);
    expect(getCaseStudy('does-not-exist')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm nx test portfolio -- src/content/index.test.ts`
Expected: FAIL (no exports `getCaseStudy`/`hasCaseStudy`/`listCaseStudies`).

- [ ] **Step 3: Write the content types**

`libs/portfolio/src/content/types.ts`:
```ts
export type ProjectVariant = 'hoogii' | 'dex' | 'swap' | 'opencgt';

export type InteractionKind =
  // hoogii
  | 'phrase-grid' | 'relay-gate' | 'idle-lock' | 'kdf-meter' | 'fuzzy-search'
  // dex
  | 'orderbook' | 'store-graph' | 'popper-reconcile' | 'ably-feed' | 'refetch-toggle'
  // swap
  | 'amm-quote' | 'offer-state' | 'zap-liquidity' | 'env-deploy' | 'i18n-card'
  // opencgt
  | 'jwt-decode' | 'role-shell' | 'casbin-playground' | 'phi-encrypt' | 'affected-pipeline';

export interface Section {
  id: string;
  title: string;
  /** What the product does. */
  feature: string;
  /** First-person ownership/decision — not a restatement of the feature. */
  contribution: string;
  /** Tech detail; may contain markdown code spans naming real symbols. */
  tech: string;
  /** Which island this section mounts. */
  interaction: InteractionKind;
  /** Optional "mirrors src/...": link back to the real repo symbol. */
  sourceRef?: string;
}

export interface CaseStudy {
  /** Matches the personal-data project slug. */
  slug: string;
  variant: ProjectVariant;
  title: string;
  tagline: string;
  role: string;
  period: string;
  stack: string[];
  /** Exactly five, each a distinct interaction kind. */
  sections: Section[];
}
```

- [ ] **Step 4: Write the first case study data (Hoogii), ported from the content spec**

`libs/portfolio/src/content/hoogii-wallet.ts` — transcribe the five Hoogii sections from `docs/portfolio-interactive-sections-spec.md` (Hoogii section) into this shape. Example scaffold (fill all five from the spec):
```ts
import type { CaseStudy } from './types';

export const hoogiiWallet: CaseStudy = {
  slug: 'hoogii-wallet',
  variant: 'hoogii',
  title: 'Hoogii Wallet',
  tagline:
    'A browser-extension wallet for the Chia blockchain — send, receive and manage XCH and CATs, and review transaction history.',
  role: 'Frontend Engineer · Hashgreen Labs',
  period: '2022 – Present',
  stack: ['React', 'Tailwind CSS', 'Mobx', 'react-i18next', 'Ably'],
  sections: [
    {
      id: 'h1',
      title: 'Typing a wallet into existence',
      feature:
        'A 12-cell backup-phrase grid that validates each word as you type and accepts a whole pasted phrase.',
      contribution:
        'I built the custom phrase input, and made the call to open create and import in a full browser tab instead of the 360-pixel popup — key material deserves room to breathe.',
      tech: 'The grid is a `react-hook-form` `useFieldArray`. A cell turns red only when non-empty and missing from the BIP39 `wordlist_en.json` set — a membership test, never a network call.',
      interaction: 'phrase-grid',
      sourceRef: 'src/components/Mnemonic.tsx · src/store/MnemonicStore.ts',
    },
    // h2 relay-gate, h3 idle-lock, h4 kdf-meter, h5 fuzzy-search — fill from the content spec.
  ],
};
```

- [ ] **Step 5: Write the registry**

`libs/portfolio/src/content/index.ts` (replace the stub):
```ts
import { hoogiiWallet } from './hoogii-wallet';
import type { CaseStudy } from './types';

const REGISTRY: Record<string, CaseStudy> = {
  [hoogiiWallet.slug]: hoogiiWallet,
};

export function listCaseStudies(): CaseStudy[] {
  return Object.values(REGISTRY);
}

export function getCaseStudy(slug: string): CaseStudy | undefined {
  return REGISTRY[slug];
}

export function hasCaseStudy(slug: string): boolean {
  return slug in REGISTRY;
}

export type { CaseStudy, Section, InteractionKind, ProjectVariant } from './types';
```

- [ ] **Step 6: Run the test**

Run: `pnpm nx test portfolio -- src/content/index.test.ts`
Expected: PASS (fill all 5 Hoogii sections so the "5 sections / unique kinds" assertion passes).

- [ ] **Step 7: Commit**

```bash
git add libs/portfolio/src/content libs/portfolio/src/index.ts
git commit -m "feat(portfolio): case-study content model + hoogii data"
```

### Task 3: Add the `featured`/`order` curation field to the project schema

**Files:**
- Modify: `libs/personal-data/src/schemas.ts` (projectSchema)
- Modify: `apps/personal-website/src/content.config.ts` (projects collection)
- Modify: `libs/personal-data/src/schemas.test.ts`
- Modify: `libs/personal-data/src/data/projects/en/hoogii-wallet.md` (mark featured, as a fixture)

- [ ] **Step 1: Write the failing test**

Add to `libs/personal-data/src/schemas.test.ts`:
```ts
import { projectSchema } from './schemas';

describe('projectSchema curation', () => {
  it('defaults featured to false and accepts an order', () => {
    const base = {
      name: 'X',
      language: 'en',
      technologies: [],
      organization: 'en/o',
      experience: 'en/1',
    };
    expect(projectSchema.parse(base).featured).toBe(false);
    expect(projectSchema.parse({ ...base, featured: true, order: 1 }).order).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm nx test personal-data -- src/schemas.test.ts`
Expected: FAIL (`featured` is not on the parsed type / undefined).

- [ ] **Step 3: Add the fields to the lib schema**

In `libs/personal-data/src/schemas.ts`, extend `projectSchema`:
```ts
export const projectSchema = z.object({
  name: z.string(),
  language: z.enum(locales),
  technologies: z.array(z.enum(skillTags)),
  organization: z.string(),
  experience: z.string(),
  featured: z.boolean().default(false),
  order: z.number().optional(),
});
```

- [ ] **Step 4: Mirror in the Astro content config**

In `apps/personal-website/src/content.config.ts`, extend the `projects` collection schema with the same two lines:
```ts
    featured: z.boolean().default(false),
    order: z.number().optional(),
```

- [ ] **Step 5: Run the schema test**

Run: `pnpm nx test personal-data -- src/schemas.test.ts`
Expected: PASS.

- [ ] **Step 6: Mark the four case-study projects featured (fixture data)**

In each `libs/personal-data/src/data/projects/{en,zh}/{hoogii-wallet,hashgreen-dex,hashgreen-swap,opencgt}.md`, add to frontmatter:
```yaml
featured: true
```

- [ ] **Step 7: Typecheck the app + lib**

Run: `pnpm nx run-many -t typecheck -p personal-data personal-website`
Expected: PASS (no type errors from the schema change).

- [ ] **Step 8: Commit**

```bash
git add libs/personal-data apps/personal-website/src/content.config.ts
git commit -m "feat(personal-data): featured/order curation field on projects"
```

---

## Phase 2: First vertical slice — Hoogii end-to-end

### Task 4: First island, worked end-to-end (`phrase-grid`) — the template for all islands

**Files:**
- Create: `libs/portfolio/src/islands/phrase-grid/logic.ts`
- Create: `libs/portfolio/src/islands/phrase-grid/logic.test.ts`
- Create: `libs/portfolio/src/islands/phrase-grid/PhraseGrid.tsx`
- Create: `libs/portfolio/src/islands/phrase-grid/PhraseGrid.test.tsx`
- Create: `libs/portfolio/src/islands/phrase-grid/index.ts`

- [ ] **Step 1: Write the failing logic test (the real unit test)**

`libs/portfolio/src/islands/phrase-grid/logic.test.ts`:
```ts
import { describe, expect, it } from 'vitest';

import { distributePaste, isValidWord } from './logic';

const WORDLIST = new Set(['abandon', 'ability', 'able', 'about']);

describe('phrase-grid logic', () => {
  it('flags a non-empty word missing from the wordlist, but not an empty cell', () => {
    expect(isValidWord('', WORDLIST)).toBe(true); // empty is not an error
    expect(isValidWord('abandon', WORDLIST)).toBe(true);
    expect(isValidWord('zzzz', WORDLIST)).toBe(false);
  });

  it('splits a pasted phrase across cells by whitespace', () => {
    expect(distributePaste('abandon ability able', 12)).toEqual([
      'abandon', 'ability', 'able', '', '', '', '', '', '', '', '', '',
    ]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm nx test portfolio -- src/islands/phrase-grid/logic.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the pure logic (cosmetic, no network)**

`libs/portfolio/src/islands/phrase-grid/logic.ts`:
```ts
/** Membership test only — a cell errors when non-empty and absent from the wordlist. */
export function isValidWord(word: string, wordlist: ReadonlySet<string>): boolean {
  if (word.length === 0) return true;
  return wordlist.has(word);
}

/** Split a pasted phrase on whitespace and pad/truncate to `size` cells. */
export function distributePaste(phrase: string, size: number): string[] {
  const words = phrase.trim().split(/\s+/).filter(Boolean).slice(0, size);
  return Array.from({ length: size }, (_, i) => words[i] ?? '');
}
```

- [ ] **Step 4: Run the logic test to verify it passes**

Run: `pnpm nx test portfolio -- src/islands/phrase-grid/logic.test.ts`
Expected: PASS.

- [ ] **Step 5: Port the presentational component from the reference source**

`libs/portfolio/src/islands/phrase-grid/PhraseGrid.tsx` — a React component that renders a 12-cell grid, a "paste a phrase" button, uses `isValidWord`/`distributePaste`, styled with stock shadcn utilities (`bg-primary`, `text-primary-foreground`, `ring-primary`) and a small mock BIP39 subset. Honor `prefers-reduced-motion` (guard any transition with a `useReducedMotion`-style check or a CSS media query). No `crypto.subtle`, no network. Transcribe structure/behavior from `libs/portfolio/.reference/CaseStudy.dc.html` (Hoogii H1). Signature:
```tsx
export function PhraseGrid(): JSX.Element { /* ...ported... */ }
export default PhraseGrid;
```

- [ ] **Step 6: Write the render smoke test**

`libs/portfolio/src/islands/phrase-grid/PhraseGrid.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PhraseGrid } from './PhraseGrid';

describe('<PhraseGrid>', () => {
  it('mounts and renders 12 word cells', () => {
    render(<PhraseGrid />);
    expect(screen.getAllByRole('textbox')).toHaveLength(12);
  });
});
```

- [ ] **Step 7: Run the smoke test**

Run: `pnpm nx test portfolio -- src/islands/phrase-grid/PhraseGrid.test.tsx`
Expected: PASS.

- [ ] **Step 8: Barrel-export the island**

`libs/portfolio/src/islands/phrase-grid/index.ts`:
```ts
export { PhraseGrid, default } from './PhraseGrid';
```

- [ ] **Step 9: Commit**

```bash
git add libs/portfolio/src/islands/phrase-grid
git commit -m "feat(portfolio): phrase-grid island (logic + component + tests)"
```

### Task 5: Remaining four Hoogii islands (repeat the Task 4 recipe)

For each island below, follow the exact five-artifact recipe from Task 4 (`logic.ts` + `logic.test.ts` + `<Name>.tsx` + `<Name>.test.tsx` + `index.ts`), porting the body from the reference source and TDD-ing the listed pure logic. Commit per island.

- [ ] **`relay-gate`** (`src/islands/relay-gate/`) — logic `evaluateRelay(ctx): 'IS_VALID_WALLET' | 'IS_LOCK' | 'IS_CONNECTED' | 'pass'` reproducing the 3-context gate order; test each branch + the pass case.
- [ ] **`idle-lock`** (`src/islands/idle-lock/`) — logic `nextLockState(idleMs, thresholdMs): 'active' | 'locked'`; test boundary at threshold.
- [ ] **`kdf-meter`** (`src/islands/kdf-meter/`) — logic `costLabel(iterations): string` (cosmetic PBKDF2-SHA512 cost visualizer, no real crypto); test a couple of iteration→label mappings.
- [ ] **`fuzzy-search`** (`src/islands/fuzzy-search/`) — logic `rank(query, items, threshold=0.1): Item[]` (simple client-side fuzzy score mirroring the `fuse.ts` 0.1 threshold); test that a near-match ranks above a non-match and threshold filters.

- [ ] **Commit** each island separately: `git commit -m "feat(portfolio): <kind> island"`.

### Task 6: Section wrapper + island registry

**Files:**
- Create: `libs/portfolio/src/sections/island-registry.ts`
- Create: `libs/portfolio/src/sections/island-registry.test.ts`
- Create: `libs/portfolio/src/sections/CaseStudySection.astro`

- [ ] **Step 1: Write the failing registry test**

`libs/portfolio/src/sections/island-registry.test.ts`:
```ts
import { describe, expect, it } from 'vitest';

import { islandFor } from './island-registry';

describe('island registry', () => {
  it('returns a component for a known interaction kind', () => {
    expect(islandFor('phrase-grid')).toBeTypeOf('function');
  });
  it('returns undefined for an unmapped kind', () => {
    // @ts-expect-error deliberately unknown
    expect(islandFor('nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm nx test portfolio -- src/sections/island-registry.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the registry (maps InteractionKind → React component)**

`libs/portfolio/src/sections/island-registry.ts`:
```ts
import type { ComponentType } from 'react';

import type { InteractionKind } from '../content/types';
import { PhraseGrid } from '../islands/phrase-grid';
// ...import the other islands as they are built...

const ISLANDS: Partial<Record<InteractionKind, ComponentType>> = {
  'phrase-grid': PhraseGrid,
  // 'relay-gate': RelayGate, etc.
};

export function islandFor(kind: InteractionKind): ComponentType | undefined {
  return ISLANDS[kind];
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm nx test portfolio -- src/sections/island-registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the Astro section wrapper (dynamic island, `client:visible`)**

`libs/portfolio/src/sections/CaseStudySection.astro`:
```astro
---
import type { Section } from '../content/types';
import { islandFor } from './island-registry';

interface Props { section: Section }
const { section } = Astro.props;
const Island = islandFor(section.interaction);
---
<section class="py-16" aria-labelledby={`sec-${section.id}`}>
  <p class="text-xs tracking-widest uppercase text-primary/70">{section.title}</p>
  <h3 id={`sec-${section.id}`} class="text-2xl mt-2">{section.feature}</h3>
  <p class="italic mt-4 border-l-2 border-primary/50 pl-4">{section.contribution}</p>
  <p class="mt-4 text-foreground/80" set:html={section.tech} />
  {Island && (
    <div class="mt-8">
      <Island client:visible />
    </div>
  )}
  {section.sourceRef && (
    <p class="mt-4 text-xs text-foreground/50">Mirrors {section.sourceRef}</p>
  )}
</section>
```
> Note: `set:html` on `section.tech` renders markdown-style code spans that were pre-rendered to HTML at content-authoring time; if `tech` is kept as plain text with backticks, replace with `{section.tech}` and style `<code>` separately. Keep whichever the content files use — decide in Task 2 and stay consistent.

- [ ] **Step 6: Commit**

```bash
git add libs/portfolio/src/sections
git commit -m "feat(portfolio): section wrapper + island registry"
```

### Task 7: Per-project theme tokens (shadcn-scoped)

**Files:**
- Create: `libs/portfolio/src/theme.css`
- Create: `libs/portfolio/src/theme.test.ts`

- [ ] **Step 1: Write the failing test (every variant defines the primary cluster)**

`libs/portfolio/src/theme.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(fileURLToPath(new URL('./theme.css', import.meta.url)), 'utf8');

describe('per-project theme tokens', () => {
  for (const slug of ['hoogii-wallet', 'hashgreen-dex', 'hashgreen-swap', 'opencgt']) {
    it(`defines a scoped primary token block for ${slug}`, () => {
      expect(css).toContain(`[data-project="${slug}"]`);
      expect(css).toMatch(new RegExp(`\\[data-project="${slug}"\\][^}]*--primary:`));
    });
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm nx test portfolio -- src/theme.test.ts`
Expected: FAIL (theme.css missing).

- [ ] **Step 3: Write the theme tokens (hand-set hex, light + dark)**

`libs/portfolio/src/theme.css` — one scoped block per slug overriding only the shadcn `primary` cluster (accent seeds: Hoogii violet, Dex `#008C15`, Swap `#00F8CB`, OpenCGT `#1976D2`), plus a `.dark` counterpart each. Example:
```css
[data-project="hashgreen-swap"] {
  --primary: #00F8CB;
  --primary-foreground: #04302a;
  --ring: #00F8CB;
}
[data-project="hashgreen-swap"].dark,
.dark [data-project="hashgreen-swap"] {
  --primary: #00F8CB;
  --primary-foreground: #04302a;
  --ring: #00F8CB;
}
/* repeat for hoogii-wallet, hashgreen-dex, opencgt */
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm nx test portfolio -- src/theme.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/portfolio/src/theme.css libs/portfolio/src/theme.test.ts
git commit -m "feat(portfolio): per-project shadcn theme tokens"
```

### Task 8: Astro routes (index + detail) + nav swap

**Files:**
- Create: `apps/personal-website/src/pages/[lang]/portfolio/index.astro`
- Create: `apps/personal-website/src/pages/[lang]/portfolio/[slug].astro`
- Modify: `apps/personal-website/src/utils/constants/index.ts` (nav portfolio link)
- Modify: `apps/personal-website/package.json` (add `@rainforest-dev/portfolio` workspace dep)

- [ ] **Step 1: Add the workspace dependency**

In `apps/personal-website/package.json` dependencies:
```json
"@rainforest-dev/portfolio": "workspace:*",
```
Run:
```bash
pnpm install
pnpm nx sync
```

- [ ] **Step 2: Write the detail route**

`apps/personal-website/src/pages/[lang]/portfolio/[slug].astro`:
```astro
---
import '@rainforest-dev/portfolio/theme.css';
import CaseStudySection from '@rainforest-dev/portfolio/sections/CaseStudySection.astro';
import { getCaseStudy, listCaseStudies } from '@rainforest-dev/portfolio/content';
import Layout from '@layouts/index.astro';
import { supportedLngs } from '@utils/i18n';

export const prerender = true;
export function getStaticPaths() {
  return supportedLngs.flatMap((lang) =>
    listCaseStudies().map((cs) => ({ params: { lang, slug: cs.slug } })),
  );
}

const { slug } = Astro.params;
const study = getCaseStudy(slug!);
if (!study) return Astro.redirect('/404');
---
<Layout title={`${study.title} — Case study`} description={study.tagline}>
  <article data-project={study.slug} class="container py-20">
    <p class="text-xs tracking-widest uppercase text-primary/70">Case study</p>
    <h1 class="text-5xl mt-2">{study.title}</h1>
    <p class="text-foreground/70 mt-2">{study.role} · {study.period}</p>
    <p class="mt-6 max-w-2xl">{study.tagline}</p>
    <ul class="flex flex-wrap gap-2 mt-6">
      {study.stack.map((t) => <li class="px-3 py-1 rounded bg-primary/10 text-primary text-sm">{t}</li>)}
    </ul>
    {study.sections.map((section) => <CaseStudySection section={section} />)}
  </article>
</Layout>
```

- [ ] **Step 3: Write the index route (featured-first)**

`apps/personal-website/src/pages/[lang]/portfolio/index.astro`:
```astro
---
import { hasCaseStudy } from '@rainforest-dev/portfolio/content';
import Layout from '@layouts/index.astro';
import { getProjects } from '@rainforest-dev/personal-data';
import { supportedLngs } from '@utils/i18n';
import { getRelativeLocaleUrl } from 'astro:i18n';

export const prerender = true;
export function getStaticPaths() {
  return supportedLngs.map((lang) => ({ params: { lang } }));
}
const lang = Astro.currentLocale === 'zh' ? 'zh' : 'en';
const projects = (await getProjects({ lang })).sort(
  (a, b) => Number(b.featured) - Number(a.featured) || (a.order ?? 99) - (b.order ?? 99),
);
---
<Layout title="Portfolio" description="Selected work — interactive case studies.">
  <main class="container py-20">
    <h1 class="text-4xl mb-10">Portfolio</h1>
    <ul class="grid gap-8 md:grid-cols-2">
      {projects.map((p) => {
        const href = hasCaseStudy(p.slug) ? getRelativeLocaleUrl(lang, `/portfolio/${p.slug}`) : undefined;
        return (
          <li class="rounded-lg border p-6" data-project={hasCaseStudy(p.slug) ? p.slug : undefined}>
            <h2 class="text-2xl">{p.name}</h2>
            {href ? <a class="text-primary underline mt-4 inline-block" href={href}>View case study →</a>
                  : <p class="text-foreground/60 mt-4 text-sm">Summary</p>}
          </li>
        );
      })}
    </ul>
  </main>
</Layout>
```
> Note: confirm `getProjects` returns `slug`, `featured`, `order`. If the resolved project shape lacks `slug`, derive it from the entry `id` in the same task and add it to `ResolvedProject` in `libs/personal-data/src/profile-data.ts` (with a test), since the join depends on it.

- [ ] **Step 4: Swap the nav portfolio link to internal**

In `apps/personal-website/src/utils/constants/index.ts`, change the portfolio nav entry:
```ts
{ label: 'portfolio', href: '/portfolio' },
```
(remove `external: true` and the cake.me URL). Verify the nav component composes `/${lang}` correctly; if it expects locale-relative hrefs, use the existing helper the other anchors use.

- [ ] **Step 5: Build the app to verify routes compile & islands hydrate**

Run: `pnpm nx build personal-website`
Expected: build succeeds; `/en/portfolio` and `/en/portfolio/hoogii-wallet` are emitted.

- [ ] **Step 6: Manual render check via the Browser preview**

Start the dev server (`preview_start` with the personal-website launch config) and load `/en/portfolio/hoogii-wallet`; confirm the five sections render, the phrase-grid island hydrates, and the theme accent is violet. Capture a screenshot.

- [ ] **Step 7: Commit**

```bash
git add apps/personal-website
git commit -m "feat(personal-website): portfolio index + detail routes, nav swap"
```

---

## Phase 3: Generalize to dex, swap, opencgt

### Task 9–11: One task per remaining project (repeat Phase 2 recipe)

For each of `hashgreen-dex`, `hashgreen-swap`, `opencgt`, do exactly what Phases 2 produced for Hoogii:
1. Content file `libs/portfolio/src/content/<slug>.ts` (5 sections) + register it in `content/index.ts`. **Transcribe the real sections from `libs/portfolio/.reference/CaseStudy.dc.html`** (`isDex`/`isSwap`/`isOpencgt` branches) — the island slugs listed below are the plan's GUESSES; use the ACTUAL sections/interactions from the reference, adding the real kebab-case kinds to the project's `InteractionKind` sub-union in `content/types.ts` (as Task 2 did for Hoogii, whose real kinds differed from the guesses).
2. Five islands under `src/islands/<kind>/` following the Task 4 recipe (logic + logic test + tsx + smoke test + index). Reuse `_shared/useReducedMotion` for any animating island; use `import { type JSX } from 'react'`; stock shadcn tokens only; cosmetic/client-side only.
3. **Extend `libs/portfolio/src/sections/CaseStudySection.astro`** — it uses STATIC per-interaction imports + branches (Astro requires `client:*` targets to be statically traceable to a literal import; the dynamic `islandFor` lookup throws `NoMatchingImport` at prerender — discovered in Phase 2). Add each new island to its static imports and its branch chain. Also add each kind to `island-registry.ts` (still exercised by its own unit test) for consistency.
4. Theme block already exists (Task 7) — verify via the built HTML's inlined `[data-project=<slug>]` rule.
5. `getStaticPaths` already iterates `listCaseStudies()`, so routes pick up the new project automatically.

**Verification note (from Phase 2):** the Browser preview pane renders with a hidden, 0×0 viewport, so `client:visible` islands never hydrate there and interaction can't be click-tested. Verify instead via (a) the island's jsdom smoke test, and (b) `grep` the built `dist/.../portfolio/<slug>/index.html` for the `astro-island` markup + `component-export` name + inlined theme rule. Live interaction works for real users; it's just not exercisable in this pane.

Per-island pure-logic signatures to TDD (see §"Per-island port recipe"). Commit per project (or per island for large ones).

- [ ] **Task 9: Hashgreen DEX** — real sections/kinds from the `isDex` reference block (plan's guesses: `orderbook`, `store-graph`, `popper-reconcile`, `ably-feed`, `refetch-toggle`).
- [ ] **Task 10: HashgreenSwap** — real sections/kinds from the `isSwap` reference block (plan's guesses: `amm-quote`, `offer-state`, `zap-liquidity`, `env-deploy`, `i18n-card`).
- [ ] **Task 11: OpenCGT** — real sections/kinds from the `isOpencgt` reference block (plan's guesses: `jwt-decode`, `role-shell`, `casbin-playground`, `phi-encrypt`, `affected-pipeline`).

- [ ] **After all three:** run `pnpm nx test portfolio` (all island logic + smoke tests green) and `pnpm nx build personal-website` (all four detail routes emit). Commit any registry/route fixups.

---

## Phase 4: MCP surface (composed register-contributions)

### Task 12: Extract `registerProfileMcp` (pure move, no behavior change)

**Files:**
- Create: `apps/personal-website/src/mcp/profile.ts`
- Modify: `apps/personal-website/src/mcp/handler.ts`

- [ ] **Step 1: Move the existing registrations into a contribution function**

Create `src/mcp/profile.ts` exporting `PROFILE_MCP_TOOLS`, `PROFILE_MCP_RESOURCES`, and `registerProfileMcp(server)` containing the six `registerTool` and three `registerResource` calls **verbatim** from the current `handler.ts` (they depend on `astro:content`; keep them in the app).

- [ ] **Step 2: Reduce `handler.ts` to a composition root**

`handler.ts` becomes:
```ts
import { createMcpHandler } from 'mcp-handler';
import { PROFILE_MCP_RESOURCES, PROFILE_MCP_TOOLS, registerProfileMcp } from './profile';

export const MCP_TOOLS = [...PROFILE_MCP_TOOLS];
export const MCP_RESOURCES = [...PROFILE_MCP_RESOURCES];

export function createProfileMcpHandler(basePath?: string) {
  return createMcpHandler((server) => { registerProfileMcp(server); }, {}, { basePath });
}
```

- [ ] **Step 3: Verify the tool surface is unchanged**

Run: `pnpm nx build personal-website` then hit the MCP endpoint (dev preview, POST to `/api/mcp` with a `tools/list` JSON-RPC request) and confirm the six tools + three resources still list.
Expected: identical surface to before.

- [ ] **Step 4: Commit**

```bash
git add apps/personal-website/src/mcp
git commit -m "refactor(mcp): extract registerProfileMcp; handler becomes composition root"
```

### Task 13: Add `registerPortfolioMcp` + `caseStudyUrl`

**Files:**
- Create: `libs/portfolio/src/mcp.ts`
- Create: `libs/portfolio/src/mcp.test.ts`
- Modify: `apps/personal-website/src/mcp/handler.ts` (compose portfolio)
- Modify: `apps/personal-website/src/mcp/profile.ts` (add `caseStudyUrl` to the resolved project resource)

- [ ] **Step 1: Write the failing test for the resource content**

`libs/portfolio/src/mcp.test.ts`:
```ts
import { describe, expect, it } from 'vitest';

import { caseStudyResource, PORTFOLIO_MCP_RESOURCES } from './mcp';

describe('portfolio mcp', () => {
  it('declares the case-study resource template', () => {
    expect(PORTFOLIO_MCP_RESOURCES[0].uriTemplate).toBe('portfolio://case-study/{+slug}');
  });
  it('resolves a known case study and throws on unknown', () => {
    expect(caseStudyResource('hoogii-wallet').slug).toBe('hoogii-wallet');
    expect(() => caseStudyResource('nope')).toThrow();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm nx test portfolio -- src/mcp.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the portfolio contribution**

`libs/portfolio/src/mcp.ts`:
```ts
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';

import { getCaseStudy } from './content';
import type { CaseStudy } from './content/types';

export const PORTFOLIO_MCP_RESOURCES = [
  { uriTemplate: 'portfolio://case-study/{+slug}', title: 'Case study' },
] as const;

export const PORTFOLIO_MCP_TOOLS = [
  { name: 'get_case_study', description: 'Full interactive case study for a project slug' },
] as const;

export function caseStudyResource(slug: string): CaseStudy {
  const study = getCaseStudy(slug);
  if (!study) throw new Error(`Case study not found: ${slug}`);
  return study;
}

export function registerPortfolioMcp(server: any): void {
  const [csResource] = PORTFOLIO_MCP_RESOURCES;
  server.registerResource(
    'case-study',
    new ResourceTemplate(csResource.uriTemplate, { list: undefined }),
    { title: csResource.title, mimeType: 'application/json' },
    async (uri: URL, { slug }: { slug: string }) => ({
      contents: [{ uri: uri.href, text: JSON.stringify(caseStudyResource(slug)) }],
    }),
  );
  const [csTool] = PORTFOLIO_MCP_TOOLS;
  server.registerTool(
    csTool.name,
    { description: csTool.description, inputSchema: {} },
    async ({ slug }: { slug: string }) => ({
      content: [{ type: 'text', text: JSON.stringify(caseStudyResource(slug)) }],
    }),
  );
}
```
> `@modelcontextprotocol/sdk` is already a transitive dep of the app via `mcp-handler`; add it to `libs/portfolio/package.json` dependencies so the import resolves in the lib.

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm nx test portfolio -- src/mcp.test.ts`
Expected: PASS.

- [ ] **Step 5: Compose portfolio into the app handler + merge descriptors**

In `handler.ts`:
```ts
import { PORTFOLIO_MCP_RESOURCES, PORTFOLIO_MCP_TOOLS, registerPortfolioMcp } from '@rainforest-dev/portfolio/mcp';

export const MCP_TOOLS = [...PROFILE_MCP_TOOLS, ...PORTFOLIO_MCP_TOOLS];
export const MCP_RESOURCES = [...PROFILE_MCP_RESOURCES, ...PORTFOLIO_MCP_RESOURCES];

export function createProfileMcpHandler(basePath?: string) {
  return createMcpHandler((server) => {
    registerProfileMcp(server);
    registerPortfolioMcp(server);
  }, {}, { basePath });
}
```

- [ ] **Step 6: Add `caseStudyUrl` to the project resource**

In `profile.ts`, where the project resource/tool serializes a project, add `caseStudyUrl: hasCaseStudy(id) ? \`https://rainforest.tools/en/portfolio/${slug}\` : undefined` (import `hasCaseStudy` from `@rainforest-dev/portfolio/content`). Keep it a plain field on the serialized object.

- [ ] **Step 7: Verify merged surface**

Run: `pnpm nx build personal-website`; POST `tools/list` + `resources/templates/list` and confirm `get_case_study` and `portfolio://case-study/{+slug}` now appear alongside the profile ones.

- [ ] **Step 8: Commit**

```bash
git add libs/portfolio/src/mcp.ts libs/portfolio/src/mcp.test.ts apps/personal-website/src/mcp
git commit -m "feat(mcp): compose portfolio case-study resource + tool"
```

---

## Phase 5: Cross-linking

### Task 14: Link case studies from every mention site

**Files:**
- Modify: `apps/personal-website/src/components/home/experiences/project.astro`
- Modify: `apps/personal-website/src/components/resume/ats-friendly.astro`
- Modify: `apps/personal-website/src/pages/[lang]/resume.astro` (JSON-LD)
- Modify: `apps/personal-website/src/pages/llms.txt.ts` and `llms-full.txt.ts`

- [ ] **Step 1: Home experience bullets link to the case study when one exists**

In `project.astro`, wrap the project name in a link to `/${lang}/portfolio/${slug}` **only when** `hasCaseStudy(slug)`. Derive `slug` from the entry id (strip the `<lang>/` prefix). Import `hasCaseStudy` from `@rainforest-dev/portfolio/content`.

- [ ] **Step 2: Resume links featured projects (full URL for print/ATS)**

In `ats-friendly.astro`, for featured projects render the case-study link as a full URL (`https://rainforest.tools/en/portfolio/<slug>`) so it survives PDF/print; guard with `hasCaseStudy`.

- [ ] **Step 3: JSON-LD gains case-study links**

In `[lang]/resume.astro`, extend the `personSchema` with `subjectOf` (or `hasPart`) `CreativeWork` entries — one per project that `hasCaseStudy`, `url` = the case-study URL.

- [ ] **Step 4: llms.txt / llms-full.txt list case-study URLs**

In `llms.txt.ts` and `llms-full.txt.ts`, append a "Case studies" section listing each `listCaseStudies()` entry's title + URL.

- [ ] **Step 5: Build + spot check**

Run: `pnpm nx build personal-website`; load `/en` (home), `/en/resume`, and `/en/llms.txt`; confirm links resolve to the new routes.

- [ ] **Step 6: Commit**

```bash
git add apps/personal-website
git commit -m "feat(personal-website): cross-link case studies from home, resume, JSON-LD, llms.txt"
```

---

## Phase 6: Curation IA & polish

### Task 15: Featured-first index, filtering, reduced-motion audit, perf

**Files:**
- Modify: `apps/personal-website/src/pages/[lang]/portfolio/index.astro`
- Create (optional): `apps/personal-website/src/components/portfolio/filter.vue`
- Audit: all `libs/portfolio/src/islands/**`

- [ ] **Step 1: Featured hero treatment**

In the index, render `featured` projects as large hero cards (with their `data-project` accent) above the compact grid; the long tail behind a "view all" toggle. Keep the sort from Task 8.

- [ ] **Step 2: Optional by-tech filter reusing the `$filter` nanostore**

If added, mirror `components/home/experiences/store.ts`'s `$filter` atom pattern; a small Vue island toggles the visible set. YAGNI: skip if the four-project set doesn't warrant it yet.

- [ ] **Step 3: Reduced-motion audit**

Grep every island for animation/transition and confirm each is gated by `prefers-reduced-motion`:
```bash
grep -rl "transition\|animate\|requestAnimationFrame" libs/portfolio/src/islands
```
Add a static fallback wherever missing. Add one vitest assertion per animated island that the motion path is skipped when a `prefersReducedMotion()` helper returns true.

- [ ] **Step 4: Perf check**

Run `pnpm nx build personal-website` and confirm React ships only to `/portfolio/*` (inspect the build output / route chunks). Note any island whose bundle is unexpectedly large and split it.

- [ ] **Step 5: Full affected verification**

Run:
```bash
pnpm nx affected -t lint test typecheck
pnpm nx build personal-website
```
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add apps/personal-website libs/portfolio
git commit -m "feat(portfolio): featured-first index, reduced-motion audit, perf pass"
```

---

## Per-island port recipe (pure-logic signature per island)

Each island's `.tsx` is transcribed from the reference source; its `logic.ts` gets a TDD unit test with this signature:

| Kind | Pure logic to TDD |
|---|---|
| phrase-grid | `isValidWord(w, set)`, `distributePaste(s, n)` — done in Task 4 |
| relay-gate | `evaluateRelay(ctx): GateResult` — the IS_VALID_WALLET→IS_LOCK→IS_CONNECTED order |
| idle-lock | `nextLockState(idleMs, thresholdMs)` |
| kdf-meter | `costLabel(iterations)` (cosmetic) |
| fuzzy-search | `rank(query, items, threshold=0.1)` |
| orderbook | `buildLadder(mid, depth): {bids, asks}` |
| store-graph | `onBecomeObserved(state): state` (MobX lifecycle sim) |
| popper-reconcile | `reconcileKey(prev, next): string` |
| ably-feed | `applyTrade(feed, trade): feed` (bounded log) |
| refetch-toggle | `decide(mode, delta): 'patch' \| 'refetch'` |
| amm-quote | `calcUserSwap(inAmt, reserves): {out, impact, fee}` — log-space invariant, NOT x·y=k |
| offer-state | `nextOfferState(s): 'VALID' \| 'IN_MEMPOOL' \| 'ON_CHAIN' \| 'INVALID'` |
| zap-liquidity | `splitZap(amount, ratio): {a, b}` |
| env-deploy | `resolveEnv(env): {image, replicas, values}` (4-env map; real metric strip TVL ~$780k / ~21,494) |
| i18n-card | `formatSummary(locale, values)` (EN/简/繁 locale-aware) |
| jwt-decode | `getRolesFromJwt(token): RoleEnum[]` — base64url decode + scan keys for "roles" |
| role-shell | `navFor(role): NavItem[]` + `isForbidden(role, route): boolean` |
| casbin-playground | `enforce(req, policies): boolean` — `keyMatch`/`regexMatch`/`*` matcher |
| phi-encrypt | `redactFor(grant, record)` — phi vs non-phi view (cosmetic; no crypto.subtle) |
| affected-pipeline | `affectedFrom(changedFiles, graph): string[]` — nx-affected lookup |

---

## Self-Review

**Spec coverage:**
- §2 architecture → Task 1 (lib), Task 8 (routes/app). ✅
- §3 MFE rejected → design-only, no task needed. ✅
- §4 lib structure → Tasks 1,2,4–7,13. ✅
- §5 data model + curation field + optional case study → Tasks 2,3,8. ✅
- §6 routing + featured-first + nav swap → Tasks 8,15. ✅
- §7 theming → Task 7. ✅
- §8 React islands `client:visible` → Tasks 4–6,9–11. ✅
- §9 MCP composed register-contributions → Tasks 12,13. ✅
- §10 DesignSync porting → Task 0 + island tasks. ✅
- §11 i18n en-first → routes iterate `supportedLngs`; content en-only (noted). ✅
- §12 testing + leanness → logic tests, smoke tests, perf (Task 15). ✅
- §16 scalability → additive content/registry (Tasks 2,9–11). ✅
- §17 cross-linking → Task 14. ✅

**Placeholder scan:** Island `.tsx` bodies are explicit ports of a named reference file (Task 0), each with a concrete TDD logic signature — not "implement later." Content files reference the named content spec sections. No "TBD"/"add error handling" left.

**Type consistency:** `CaseStudy`/`Section`/`InteractionKind` (Task 2) are used unchanged in the registry (Task 6), routes (Task 8), and MCP (Task 13). `getCaseStudy`/`hasCaseStudy`/`listCaseStudies` names are consistent across content, routes, MCP, and cross-linking. `registerProfileMcp`/`registerPortfolioMcp` consistent between Tasks 12 and 13.

**Open dependency flagged:** `ResolvedProject.slug` may need adding in `libs/personal-data/src/profile-data.ts` (Task 8 Step 3 note) — the join relies on it; add with a test if absent.
