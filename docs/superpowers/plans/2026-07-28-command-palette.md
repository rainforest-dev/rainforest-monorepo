# ⌘K Command Palette (E) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A command palette that is useful to everyone and better with on-device AI — deterministic search always, natural-language querying as an upgrade — while collapsing the duplicated tool catalog behind `rainforest.tools/mcp` into one definition.

**Architecture:** One Zod-first `ProfileTool[]` catalog. Three consumers derive from it: the MCP server (wraps `run` in a content envelope), the palette and WebMCP (JSON Schema via `zod/v4`'s `toJSONSchema`, `execute: run`), and `llms.txt` (name + description). The model only ever _selects_ a tool; the answer strip's sentence comes from `summarise()` over the tool's real result.

**Tech Stack:** TypeScript 6, Vue 3.5, Astro 7, Vitest 4 (jsdom), `zod@3.25.76` (v4 API via the `zod/v4` subpath), `@modelcontextprotocol/sdk`.

**Spec:** [2026-07-28-command-palette-design.md](../specs/2026-07-28-command-palette-design.md)

**Depends on:** E0 (merged, `7a170a7`) — `src/utils/ai/` provides `detectCapability`, `enableModel`, `selectTool`, `acquire`, `registerAgentTools`, `AiCapability.vue`, `useLanguageModel`, and the `ToolDescriptor` type.

---

## Before you start: what is actually live

`src/mcp/profile.ts` serves **production** at `rainforest.tools/mcp`. It registers six tools, every one with the identical handler shape:

```ts
async (args) => ({
  content: [{ type: 'text', text: JSON.stringify(await fn(args)) }],
});
```

| Tool                   | Params                            |
| ---------------------- | --------------------------------- |
| `get_profile_summary`  | `lang`                            |
| `get_work_experience`  | `technology`, `lang`              |
| `get_education`        | `lang`                            |
| `get_projects`         | `technology`, `lang`              |
| `get_skills`           | `lang`                            |
| `search_by_technology` | `query` (required string), `lang` |

**A seventh tool exists outside this file.** `handler.ts` composes `registerProfileMcp` with `registerPortfolioMcp` from `@rainforest-dev/personal-portfolio/mcp`, which contributes `get_case_study`. That library is deliberately decoupled (no `astro:content` dependency) and already has its own single-source `PORTFOLIO_MCP_TOOLS`. **Leave it alone.** But pin it in the characterisation test, because a refactor that silently drops it would look fine on the site.

## File Structure

| File                                                            | Responsibility                                                          |
| --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `apps/personal-website/src/mcp/catalog.ts`                      | **New.** The single `ProfileTool[]` definition + `toToolDescriptors()`. |
| `apps/personal-website/src/mcp/catalog.test.ts`                 | **New.** Characterisation + derivation tests.                           |
| `apps/personal-website/src/mcp/profile.ts`                      | **Modified.** Becomes a thin adapter over the catalog.                  |
| `apps/personal-website/src/utils/search.ts`                     | **New.** Pure, synchronous scored matcher. No AI import.                |
| `apps/personal-website/src/utils/search.test.ts`                | **New.**                                                                |
| `apps/personal-website/src/components/shell/CommandPalette.vue` | **New.** The palette.                                                   |
| `apps/personal-website/src/layouts/index.astro`                 | **Modified.** Mounts the palette.                                       |

---

### Task 1: Characterisation tests — pin the live MCP surface BEFORE touching it

Nothing in this task changes behaviour. Its whole purpose is to make the next two tasks provably safe.

**Files:**

- Create: `apps/personal-website/src/mcp/catalog.test.ts`

- [ ] **Step 1: Write the test**

```typescript
import { describe, expect, it } from 'vitest';

import { MCP_TOOLS } from './handler';

/**
 * Characterisation, not specification: this records what the live server at
 * rainforest.tools/mcp advertises TODAY, so the catalog refactor in Tasks 2–3 is provably
 * behaviour-preserving. A remote MCP client breaking is invisible from the site itself, so
 * "it still looks fine" is not evidence.
 *
 * If a change to this list is intended, update it deliberately — do not "fix" it to make a
 * refactor pass.
 */
describe('MCP tool surface (characterisation)', () => {
  it('advertises exactly these tools', () => {
    expect(MCP_TOOLS.map((t) => t.name).sort()).toEqual([
      'get_case_study',
      'get_education',
      'get_profile_summary',
      'get_projects',
      'get_skills',
      'get_work_experience',
      'search_by_technology',
    ]);
  });

  it('keeps get_case_study, which comes from the portfolio library, not profile.ts', () => {
    // The refactor only touches profile.ts. If this disappears, the composition in
    // handler.ts was broken rather than the catalog.
    expect(MCP_TOOLS.find((t) => t.name === 'get_case_study')).toBeDefined();
  });

  it('gives every tool a non-empty description', () => {
    for (const tool of MCP_TOOLS) {
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run it — it must PASS immediately**

Run: `pnpm nx test personal-website --skip-nx-cache`
Expected: PASS. This is the one task in the plan whose test passes on first write — it describes existing behaviour. **If it fails, stop and report**: the surface is not what this plan assumed and Task 2 is unsafe.

- [ ] **Step 3: Commit**

```bash
git add apps/personal-website/src/mcp/catalog.test.ts
git commit -m "test(mcp): pin the live tool surface before refactoring the catalog"
```

---

### Task 2: The catalog

**Files:**

- Create: `apps/personal-website/src/mcp/catalog.ts`

- [ ] **Step 1: Write the catalog**

```typescript
import {
  getEducation,
  getProfileSummary,
  getProjects,
  getSkills,
  getWorkExperience,
  searchByTechnology,
} from '@rainforest-dev/personal-data';
import type { ToolDescriptor } from '@utils/ai';
import { tags } from '@utils/constants';
import type { SkillTag } from '@types';
import { z } from 'zod';
// zod@3.25 ships the v4 implementation under this subpath. `z.toJSONSchema` does not exist on
// the v3 namespace, and this is what lets one Zod definition also feed responseConstraint and
// WebMCP without adding a dependency.
import { z as z4 } from 'zod/v4';

const langSchema = z.enum(['en', 'zh']).optional();
const technologySchema = z
  .enum(tags.skills as unknown as [SkillTag, ...SkillTag[]])
  .optional();

/**
 * One tool, defined once.
 *
 * `run` returns plain data — no MCP envelope, no formatting — so every consumer can shape it
 * for itself. `summarise` is what lets the palette show a sentence without a model writing one:
 * it composes from `run`'s actual result, so the strip cannot state something untrue.
 */
export interface ProfileTool {
  name: string;
  description: string;
  /** Zod raw shape, which is what the MCP SDK's registerTool expects. */
  params: z.ZodRawShape;
  run: (args: Record<string, never>) => Promise<unknown>;
  /** One line for the answer strip, or null when there is nothing worth saying. */
  summarise: (result: never, args: Record<string, never>) => string | null;
}

const count = (value: unknown): number =>
  Array.isArray(value) ? value.length : 0;
const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export const PROFILE_TOOLS: ProfileTool[] = [
  {
    name: 'get_profile_summary',
    description: 'Professional profile overview: counts and top technologies',
    params: { lang: langSchema },
    run: ({ lang }) => getProfileSummary({ lang }),
    summarise: (result: { experienceCount: number; projectCount: number }) =>
      `${plural(result.experienceCount, 'role', 'roles')} and ${plural(result.projectCount, 'project', 'projects')} on record.`,
  },
  {
    name: 'get_work_experience',
    description: 'Work history, optionally filtered by technology',
    params: { technology: technologySchema, lang: langSchema },
    run: ({ technology, lang }) => getWorkExperience({ technology, lang }),
    summarise: (result: unknown[], { technology }) =>
      technology
        ? `${technology} appears in ${plural(count(result), 'role', 'roles')}.`
        : `${plural(count(result), 'role', 'roles')} on record.`,
  },
  {
    name: 'get_education',
    description: 'Academic background',
    params: { lang: langSchema },
    run: ({ lang }) => getEducation({ lang }),
    summarise: (result: unknown[]) =>
      `${plural(count(result), 'qualification', 'qualifications')} on record.`,
  },
  {
    name: 'get_projects',
    description: 'Portfolio projects, optionally filtered by technology',
    params: { technology: technologySchema, lang: langSchema },
    run: ({ technology, lang }) => getProjects({ technology, lang }),
    summarise: (result: unknown[], { technology }) =>
      technology
        ? `${technology} appears in ${plural(count(result), 'project', 'projects')}.`
        : `${plural(count(result), 'project', 'projects')} on record.`,
  },
  {
    name: 'get_skills',
    description: 'Technical skills inventory',
    params: { lang: langSchema },
    run: ({ lang }) => getSkills({ lang }),
    summarise: (result: unknown[]) =>
      `${plural(count(result), 'skill', 'skills')} listed.`,
  },
  {
    name: 'search_by_technology',
    description:
      'Substring-match a technology name across all experiences and projects',
    params: { query: z.string(), lang: langSchema },
    run: ({ query, lang }) => searchByTechnology(query, { lang }),
    summarise: (
      result: { experiences: unknown[]; projects: unknown[] },
      { query },
    ) => {
      const total = count(result.experiences) + count(result.projects);
      return total === 0
        ? `No records mention ${query}.`
        : `${query} appears in ${plural(count(result.experiences), 'role', 'roles')} and ${plural(count(result.projects), 'project', 'projects')}.`;
    },
  },
];

/**
 * Adapter for the palette and WebMCP: JSON Schema instead of Zod, plain data instead of an
 * MCP envelope. `inputSchema` is the same shape `selectTool()` passes as `responseConstraint`
 * and the same shape WebMCP's `registerTool()` expects.
 */
export function toToolDescriptors(): ToolDescriptor[] {
  return PROFILE_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: z4.toJSONSchema(z4.object(tool.params as never)) as Record<
      string,
      unknown
    >,
    execute: tool.run as ToolDescriptor['execute'],
  }));
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm nx build personal-website --skip-nx-cache`
Expected: `0 errors`. Always pass `--skip-nx-cache` — a cache hit reports success without re-running, which has already masked a real failure in this project.

- [ ] **Step 3: Commit**

```bash
git add apps/personal-website/src/mcp/catalog.ts
git commit -m "feat(mcp): single Zod-first tool catalog with palette adapter"
```

---

### Task 3: `profile.ts` becomes an adapter

The risky task. Task 1's test is the safety net.

**Files:**

- Modify: `apps/personal-website/src/mcp/profile.ts`

- [ ] **Step 1: Replace the six `server.registerTool` calls with one loop**

Delete the six individual registrations and the now-unused `profileSummaryTool`/`workExperienceTool`/`educationTool`/`projectsTool`/`skillsTool`/`searchTool` consts, and derive `PROFILE_MCP_TOOLS` from the catalog:

```typescript
import { PROFILE_TOOLS } from './catalog';

// Derived, not repeated. This list previously duplicated every name and description by hand
// alongside the registrations below; llms.txt.ts reads it via handler.ts's composed MCP_TOOLS.
export const PROFILE_MCP_TOOLS = PROFILE_TOOLS.map(({ name, description }) => ({
  name,
  description,
})) as ReadonlyArray<{ name: string; description: string }>;
```

and inside `registerProfileMcp`, replace the six blocks with:

```typescript
for (const tool of PROFILE_TOOLS) {
  server.registerTool(
    tool.name,
    { description: tool.description, inputSchema: tool.params },
    // The envelope is the MCP surface's concern, not the catalog's — `run` returns plain data.
    async (args) => ({
      content: [
        { type: 'text', text: JSON.stringify(await tool.run(args as never)) },
      ],
    }),
  );
}
```

Leave the resource registrations (`profile://experience/{+id}` etc.) exactly as they are — this task is tools only.

- [ ] **Step 2: Run the characterisation test — it must STILL pass**

Run: `pnpm nx test personal-website --skip-nx-cache`
Expected: PASS, including Task 1's three tests unchanged. **If the tool-surface test fails, the refactor changed the public surface — revert rather than editing the test.**

- [ ] **Step 3: Verify the endpoint still answers**

```bash
pnpm nx dev personal-website
```

Then in another shell:

```bash
curl -s -X POST http://localhost:4321/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | head -c 600
```

Expected: a JSON-RPC result listing all seven tools, `get_case_study` among them. Stop the dev server afterwards.

- [ ] **Step 4: Commit**

```bash
git add apps/personal-website/src/mcp/profile.ts
git commit -m "refactor(mcp): register tools from the shared catalog"
```

---

### Task 4: Deterministic search

**Files:**

- Create: `apps/personal-website/src/utils/search.ts`
- Create: `apps/personal-website/src/utils/search.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, it } from 'vitest';

import { scoreMatch, type Searchable } from './search';
import { searchRecords } from './search';

const RECORDS: Searchable[] = [
  {
    id: 'p/opencgt',
    kind: 'project',
    title: 'OpenCGT',
    keywords: ['nextjs', 'auth0'],
    href: '/portfolio/opencgt',
  },
  {
    id: 'p/dex',
    kind: 'project',
    title: 'Hashgreen DEX',
    keywords: ['nextjs'],
    href: '/portfolio/hashgreen-dex',
  },
  {
    id: 's/ts',
    kind: 'skill',
    title: 'TypeScript',
    keywords: [],
    href: '/#skills',
  },
];

describe('scoreMatch', () => {
  it('ranks a title prefix above a mid-word hit', () => {
    expect(scoreMatch('Hash', 'Hashgreen DEX', [])).toBeGreaterThan(
      scoreMatch('green', 'Hashgreen DEX', []),
    );
  });

  it('scores keyword hits below title hits', () => {
    expect(scoreMatch('auth0', 'OpenCGT', ['auth0'])).toBeLessThan(
      scoreMatch('OpenCGT', 'OpenCGT', ['auth0']),
    );
  });

  it('is case-insensitive', () => {
    expect(scoreMatch('typescript', 'TypeScript', [])).toBeGreaterThan(0);
  });

  it('returns 0 when nothing matches', () => {
    expect(scoreMatch('rust', 'OpenCGT', ['auth0'])).toBe(0);
  });
});

describe('searchRecords', () => {
  it('returns only matches, best first', () => {
    const hits = searchRecords('nextjs', RECORDS);
    expect(hits.map((h) => h.id)).toEqual(['p/opencgt', 'p/dex']);
  });

  it('returns everything for an empty query, so the palette opens populated', () => {
    expect(searchRecords('', RECORDS)).toHaveLength(RECORDS.length);
  });

  it('is stable for equal scores', () => {
    const once = searchRecords('nextjs', RECORDS).map((h) => h.id);
    const twice = searchRecords('nextjs', RECORDS).map((h) => h.id);
    expect(once).toEqual(twice);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm nx test personal-website --skip-nx-cache`
Expected: FAIL — cannot resolve `./search`.

- [ ] **Step 3: Implement**

```typescript
export interface Searchable {
  id: string;
  kind: 'experience' | 'project' | 'skill' | 'post';
  title: string;
  keywords: string[];
  href: string;
}

/**
 * Scored substring matching, deliberately not a fuzzy-search library. The whole corpus is a few
 * hundred rows — roughly seven roles, four projects, fifteen skills and a handful of posts — so
 * a dependency would cost more than it buys, and this stays synchronous and trivially testable.
 *
 * Higher is better; 0 means no match.
 */
export function scoreMatch(
  query: string,
  title: string,
  keywords: string[],
): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;

  const t = title.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 75;
  if (t.includes(q)) return 50;
  if (keywords.some((k) => k.toLowerCase() === q)) return 30;
  if (keywords.some((k) => k.toLowerCase().includes(q))) return 15;
  return 0;
}

/** Matching records, best first. An empty query returns everything so the palette opens populated. */
export function searchRecords<T extends Searchable>(
  query: string,
  records: T[],
): T[] {
  return (
    records
      .map((record) => ({
        record,
        score: scoreMatch(query, record.title, record.keywords),
      }))
      .filter(({ score }) => score > 0)
      // Array.prototype.sort is stable, so equal scores keep their input order rather than
      // shuffling between renders.
      .sort((a, b) => b.score - a.score)
      .map(({ record }) => record)
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm nx test personal-website --skip-nx-cache`
Expected: PASS.

- [ ] **Step 5: Lint, format, commit**

```bash
pnpm nx lint personal-website --fix
pnpm prettier --write apps/personal-website/src/utils/search.ts apps/personal-website/src/utils/search.test.ts
git add apps/personal-website/src/utils/search.ts apps/personal-website/src/utils/search.test.ts
git commit -m "feat(search): scored matcher for the command palette"
```

Formatting is now a CI gate (`format:check`), and lint does not catch it — `eslint-config-prettier` disables the stylistic rules. Run Prettier on every file you touch, in every task from here on.

---

### Task 5: The palette, search only

No AI yet. Prove the palette works for everyone before layering anything on it.

**Files:**

- Create: `apps/personal-website/src/components/shell/CommandPalette.vue`

- [ ] **Step 1: Write the component**

```vue
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

import { searchRecords, type Searchable } from '@utils/search';

const props = defineProps<{ records: Searchable[] }>();

const open = ref(false);
const query = ref('');
const selected = ref(0);

const results = computed(() => searchRecords(query.value, props.records));

/**
 * Rows, not modes. Row 0 will become an "Ask" row once AI is wired in Task 6; keeping the
 * activation rule as "activate the selected row" means Enter never changes meaning — only the
 * contents of the list do.
 */
const rows = computed(() => results.value);

function onKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    open.value = !open.value;
    return;
  }
  if (!open.value) return;

  if (event.key === 'Escape') {
    open.value = false;
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    selected.value = Math.min(selected.value + 1, rows.value.length - 1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    selected.value = Math.max(selected.value - 1, 0);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    activate(selected.value);
  }
}

function activate(index: number) {
  const row = rows.value[index];
  if (row) window.location.href = row.href;
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24"
  >
    <div
      class="bg-card w-full max-w-xl rounded-lg border shadow-lg"
      role="dialog"
      aria-modal="true"
    >
      <input
        v-model="query"
        class="w-full border-b bg-transparent px-4 py-3 outline-none"
        placeholder="Search experience, projects, skills…"
        aria-label="Search"
        autofocus
        @input="selected = 0"
      />
      <ul class="max-h-80 overflow-y-auto py-1" role="listbox">
        <li
          v-for="(row, index) in rows"
          :key="row.id"
          :aria-selected="index === selected"
          role="option"
          class="cursor-pointer px-4 py-2"
          :class="index === selected ? 'bg-muted' : ''"
          @click="activate(index)"
          @mouseenter="selected = index"
        >
          <span class="text-muted-foreground mr-2 text-xs uppercase">{{
            row.kind
          }}</span>
          {{ row.title }}
        </li>
        <li v-if="rows.length === 0" class="text-muted-foreground px-4 py-2">
          No matches
        </li>
      </ul>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm nx build personal-website --skip-nx-cache`
Expected: `0 errors`.

- [ ] **Step 3: Format and commit**

```bash
pnpm prettier --write apps/personal-website/src/components/shell/CommandPalette.vue
git add apps/personal-website/src/components/shell/CommandPalette.vue
git commit -m "feat(palette): ⌘K search over profile records"
```

---

### Task 6: Mount it, and verify in a real browser

**Files:**

- Modify: `apps/personal-website/src/layouts/index.astro`

- [ ] **Step 1: Build the record list and mount**

In the layout's frontmatter, assemble `Searchable[]` from `getWorkExperience`, `getProjects`, `getSkills` and the blog collection for the current locale, then render:

```astro
<CommandPalette client:idle records={records} />
```

`client:idle` rather than `client:load`: the palette is keyboard-triggered, so it does not need to hydrate before the page is interactive.

- [ ] **Step 2: Verify in the browser — not just the build**

```bash
pnpm nx dev personal-website
```

Check all of these by hand:

- `⌘K` opens; `Escape` closes
- Typing filters; `↑↓` moves the highlight; `↵` navigates to the highlighted record
- The page has no console errors
- It works on `/zh` as well as `/`

- [ ] **Step 3: Format and commit**

```bash
pnpm prettier --write apps/personal-website/src/layouts/index.astro
git add apps/personal-website/src/layouts/index.astro
git commit -m "feat(palette): mount ⌘K in the site layout"
```

---

### Task 7: The AI upgrade

Only now does the model appear. Everything above must already work without it.

**Files:**

- Modify: `apps/personal-website/src/components/shell/CommandPalette.vue`

- [ ] **Step 1: Add the ask row and the answer strip**

Add to the script block:

```typescript
import { useLanguageModel } from '@utils/ai';
import { PROFILE_TOOLS, toToolDescriptors } from '@mcp/catalog';

const props = defineProps<{ records: Searchable[]; lang: 'en' | 'zh' }>();

const { state, enable, selectTool } = useLanguageModel();
const answer = ref<string | null>(null);
const asking = ref(false);

// No answer strip in zh: E0 pins model output to English because non-English replies are
// unreliable, and English prose above Chinese records reads as a bug rather than a decision.
const canAsk = computed(
  () => props.lang === 'en' && state.value.kind === 'ready',
);

/** Row 0 is the ask row when asking is possible; otherwise the list is results alone. */
const rows = computed(() =>
  canAsk.value && query.value.trim()
    ? [
        {
          id: '__ask__',
          kind: 'ask' as const,
          title: `Ask: "${query.value}"`,
          keywords: [],
          href: '',
        },
        ...results.value,
      ]
    : results.value,
);

const SELECTION_SCHEMA = {
  type: 'object',
  required: ['tool'],
  additionalProperties: false,
  properties: {
    tool: { type: 'string', enum: PROFILE_TOOLS.map((t) => t.name) },
    technology: { type: 'string' },
    query: { type: 'string' },
  },
};

async function ask() {
  asking.value = true;
  answer.value = null;
  try {
    const choice = await selectTool<{
      tool: string;
      technology?: string;
      query?: string;
    }>(query.value, SELECTION_SCHEMA);
    if (!choice) return; // selectTool already degraded state; the list still works
    const tool = PROFILE_TOOLS.find((t) => t.name === choice.tool);
    if (!tool) return;
    const args = {
      technology: choice.technology,
      query: choice.query,
      lang: props.lang,
    };
    const result = await tool.run(args as never);
    // The sentence comes from the real result, never from the model.
    answer.value = tool.summarise(result as never, args as never);
  } finally {
    asking.value = false;
  }
}
```

and change `activate` so the ask row asks:

```typescript
function activate(index: number) {
  const row = rows.value[index];
  if (!row) return;
  if (row.id === '__ask__') void ask();
  else window.location.href = row.href;
}
```

In the template, render the strip above the list when `answer` is set, and an enable button when `state.kind === 'downloadable'` — a real click, which is what the gesture requirement needs.

**Never use `v-html` for `answer`.** It is derived from your own data today, but the rule is that model-adjacent output is rendered as text.

- [ ] **Step 2: Verify in the browser**

Run `pnpm nx dev personal-website`, then check:

- With no model: typing still filters, `↵` opens the top result, no ask row appears
- On `/zh`: no ask row even when the model is ready
- With the model enabled: `↵` on a fresh query fills the strip; the records below it match the claim

- [ ] **Step 3: Full gates, format, commit**

```bash
pnpm nx test personal-website --skip-nx-cache
pnpm nx build personal-website --skip-nx-cache
pnpm nx lint personal-website
pnpm format:check
pnpm prettier --write apps/personal-website/src/components/shell/CommandPalette.vue
git add apps/personal-website/src/components/shell/CommandPalette.vue
git commit -m "feat(palette): on-device AI selects a tool; the strip is templated"
```

---

### Task 8: Register the catalog with WebMCP

One line, and it completes "one catalog, three surfaces".

**Files:**

- Modify: `apps/personal-website/src/components/shell/CommandPalette.vue`

- [ ] **Step 1: Register on mount, dispose on unmount**

```typescript
import { registerAgentTools } from '@utils/ai';

// No-ops in every shipping browser today — document.modelContext exists in none of them
// (verified 2026-07-28: Chrome 150, Edge 150, Chromium 148). Wired now because the descriptors
// already exist and the dispose handle makes it leak-free.
const registration = registerAgentTools(toToolDescriptors());
onUnmounted(registration.dispose);
```

- [ ] **Step 2: Verify nothing regressed**

Run: `pnpm nx test personal-website --skip-nx-cache` and `pnpm nx build personal-website --skip-nx-cache`
Expected: all pass. In the browser, confirm the palette still opens — a mistake here would throw on mount.

- [ ] **Step 3: Format and commit**

```bash
pnpm prettier --write apps/personal-website/src/components/shell/CommandPalette.vue
git add apps/personal-website/src/components/shell/CommandPalette.vue
git commit -m "feat(palette): expose the tool catalog to agents via WebMCP"
```

---

## Definition of done

- Task 1's characterisation test still passes **unmodified** — the refactor preserved the live MCP surface, including `get_case_study` from the portfolio library.
- `pnpm nx test`, `nx build`, `nx lint` and `pnpm format:check` all clean.
- ⌘K works with no model at all, in both locales.
- With the model enabled in `en`, `↵` on a query fills the strip from real records.
- No `v-html` anywhere near model-adjacent output.

## Next

**D** — the blog demos and the recorded fallback, which can only be captured once this works.
