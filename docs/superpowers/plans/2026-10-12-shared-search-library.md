# Shared Search Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract one shared search stack (`@rainforest-dev/search` plus web-ai additions) from personal-memories and adopt it in memories, calibre, rss-manager and the personal website.

**Architecture:** `@rainforest-dev/search` has a pure root entry (text folding, matchers, ranking, fusion, hashes, reuse planning, index header, embedding contract) and a `./node` entry (index files, Ollama clients). `@rainforest-dev/web-ai` gains a framework-free AI controller and a Standard-Schema query parser. Each product keeps its own env mapping, copy and UI.

**Tech Stack:** TypeScript 6, Vite library mode with `vite-plugin-dts`, Vitest 4, Playwright, Nx 23 inferred targets, pnpm 11 workspaces, zod 4.6.5 (`astro/zod` in memories), Chrome Prompt API.

**Spec:** `docs/superpowers/specs/2026-10-12-shared-search-library-design.md`

## Global Constraints

- Execution runs through the `rainforest-core:loop` dispatcher: one task below is one task note and one PR. A run is capped at 40 turns and USD 10. A task that runs out of turns continues in its next run from the branch and the Tuning log.
- Every PR branches from `origin/main`. A task starts only after the PR of the task before it has merged.
- Run work through Nx only: `pnpm nx <target> <project>`. Project names: `search`, `web-ai`, `personal-memories`, `personal-memories-e2e`, `personal-calibre`, `personal-calibre-e2e`, `@rainforest-monorepo/rss-manager`, `rss-manager-e2e`, `personal-website`.
- Workspace dependencies are `"workspace:*"`. Run `pnpm install` after editing any `package.json`, and `pnpm nx sync` after adding a project reference.
- Never run memories ingest against real data, and never read or write `~/.local/share/memories`. A full re-embed may be running on the Mac mini.
- No `Refs:` trailer. No real names anywhere in code, tests, fixtures, PRs or screenshots. memories fixtures use `alice` / `bob` (`Alice` / `Bob`).
- Imports: inside `libs/*`, relative and extensionless (as in `libs/mcp-kit`). In apps, `@/…` across directories and `./file.ts` within one. `apps/personal-memories/src/cli` and `src/lib/ingest` use relative `../` paths because plain `node` runs them.
- The root entry of `@rainforest-dev/search` never imports a `node:` module.
- Comments: none, except one line naming an external constraint or a lint-suppression reason. Before each commit run `git diff -U0 --cached | grep -E '^\+\s*(//|/\*|\*|#)'` and delete any hit that is not on that list.
- Commits: conventional, scoped to the project (`search`, `web-ai`, `personal-memories`, …), ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never disable GPG signing.
- Before every PR: `pnpm format:check`, plus `pnpm nx run-many -t lint test typecheck build -p <touched projects>`.
- Before writing Playwright tests, read the `playwright-best-practices` skill. Browser runs use Playwright's Chromium in new-headless mode, never a headed browser.

## Review Focus

1. **memories index files already on disk.** This includes rows marked `retry` and a buffer read at an unaligned offset. Expected: they read back unchanged after the migration, with no re-embed. Test: the committed format fixture and the unaligned-buffer case (Task 1, Steps 7–8).
2. **A Prompt API answer naming an unknown person or source.** Expected: those values are dropped and the rest of the answer is used. It must not fall back to the local parser. Test: the existing `toSearchQuery` case "accepts a well-formed answer and drops what does not fit" stays green after the zod swap (Task 3, Step 9).
3. **The memories CLI under plain node after the swap.** Expected: it resolves `@rainforest-dev/search` from `dist`. Test: run it with `MEMORIES_DATA_DIR` unset, expecting exit code 2 and no `ERR_MODULE_NOT_FOUND` (Task 2, Step 9).
4. **calibre queried while its index is half built, or while Ollama is down.** Expected: results are exactly the lexical order, with `semantic: 'off'` and a reason, and the next sync resumes embedding. Test: Task 4 acceptance criteria 3 and 4.
5. **A one-character website query** (`a`, `資`). Expected: no vocabulary lookup, so neighbours do not flood the palette. Lookup starts at two characters, the same threshold as expansions. Test: Task 8 acceptance criterion 4.

## Task map (one loop task note each)

| #   | Task                                                      | Projects                               | Depends on |
| --- | --------------------------------------------------------- | -------------------------------------- | ---------- |
| 1   | `libs/search`: core and `./node`                          | search                                 | —          |
| 2   | memories adopts `libs/search`                             | personal-memories                      | 1          |
| 3   | web-ai controller and query parser; memories prompt-parse | web-ai, personal-memories              | 2          |
| 4   | calibre: `searchBookIds`, indexing, search route          | personal-calibre                       | 1          |
| 5   | calibre: list page, MCP `list_books`, e2e                 | personal-calibre, personal-calibre-e2e | 4          |
| 6   | rss-manager: shared lexical                               | rss-manager, rss-manager-e2e           | 1          |
| 7   | website W1: shared lexical, controller, guards            | personal-website, web-ai               | 3          |
| 8   | website W1.5: offline semantic neighbours                 | personal-website                       | 7          |
| 9   | website W2: in-browser embedding spike report             | personal-website (docs only)           | 8          |

The order the user chose is memories, then calibre, rss-manager and the website. Tasks 4 and 6 depend only on Task 1, but they still wait for Task 3 so the order holds.

---

### Task 1: `libs/search`, core and `./node`

**Files:**

- Create: `libs/search/package.json`, `libs/search/vite.config.ts`, `libs/search/tsconfig.json`, `libs/search/tsconfig.lib.json`, `libs/search/tsconfig.spec.json`, `libs/search/eslint.config.js`
- Create: `libs/search/src/index.ts`, `src/text.ts`, `src/match.ts`, `src/lexical.ts`, `src/vector.ts`, `src/rrf.ts`, `src/hash.ts`, `src/reuse.ts`, `src/index-header.ts`, `src/embed.ts`
- Create: `libs/search/src/node.ts`, `src/node/index-files.ts`, `src/node/ollama-embed.ts`, `src/node/ollama-chat.ts`, `src/node/concept-embedder.ts`
- Create: `libs/search/src/node/fixtures/docs.json`, `libs/search/src/node/fixtures/vectors.text.bin` (generated in Step 7)
- Test: a `*.test.ts` next to each source file
- Modify: `tsconfig.json` (root reference, via `pnpm nx sync`)

**Interfaces:**

- Consumes: nothing.
- Produces, from `@rainforest-dev/search`:
  - `fold(s: string): string`, `trimEdges(token: string): string`, `queryTerms(text: string): string[]`, `whitespaceTerms(text: string): string[]`
  - `matchesAllTerms(fields: readonly string[], terms: readonly string[]): boolean`
  - `tieredMatch(query: string, record: Tiered): number` with `Tiered = { title: string; keywords: readonly string[]; expanded?: readonly string[] | undefined }`
  - `ngramSimilarity(query: string, target: string): number`
  - `lexicalRank<D>(docs: readonly D[], terms: readonly string[], config: LexicalConfig<D>): string[]` with `LexicalConfig<D> = { id(d: D): string; text(d: D): string; facets?: readonly Facet<D>[]; tieBreak?(a: D, b: D): number }` and `Facet<D> = { values(d: D): readonly string[]; match: 'exact' | 'substring' }`
  - `topK(vectors: Float32Array, dims: number, query: Float32Array, k: number, allow?: (row: number) => boolean): { row: number; score: number }[]`
  - `semanticIds(input: { hits: readonly ScoredId[]; minScore: number; k: number }): string[]` with `ScoredId = { id: string; score: number }`
  - `rrf(rankings: readonly (readonly string[])[], k?: number): Map<string, number>`
  - `fnv1a(text: string): string`, `fnv1aBytes(bytes: Uint8Array): string`
  - `planReuse(previous: readonly Reusable[], current: readonly Keyed[]): { reuse: Map<number, number>; missing: number[] }` with `Keyed = { id: string; hash: string }` and `Reusable = Keyed & { retry?: boolean | undefined }`
  - `IndexHeader = { model: string; dims: number; docs: { id: string; contentHash: string; retry?: true }[] }`, `isIndexHeader(value: unknown): value is IndexHeader`, `vectorBytes(header: IndexHeader): number`
  - `EmbedKind`, `EmbedInput`, `Embedder`, `EmbedFailure`, `EmbedError`, `QUERY_EMBED_TIMEOUT_MS = 800`, `BREAKER_MS = 30_000`, `Breaker`, `breaker(ms?)`, `embedQuery(embedder, text, timeoutMs?)`, `withQueryPriority(embedder)`
- Produces, from `@rainforest-dev/search/node`:
  - `IndexFiles = { header: IndexHeader; vectors: Float32Array }`, `IndexFileNames = { header: string; vectors: string }`, `DEFAULT_INDEX_FILES`, `readIndexFiles(dir, names?)`, `writeIndexFiles(dir, header, vectors, names?)`
  - `DEFAULT_EMBED_MODEL`, `EMBED_MODELS`, `ollamaEmbedder(options?)`
  - `OllamaSetupError` (`reason: 'unreachable' | 'no-model' | 'missing-model'`, `models: readonly string[]`), `assertModel(url, model, fetch?)`, `OllamaHttpError` (`status: number`), `ollamaChat(options): Promise<string>`
  - `conceptEmbedder(concepts: readonly (readonly string[])[], model?: string): Embedder`

- [ ] **Step 1: Scaffold the project**

The `nx-generate` skill is the first choice if it is installed. Otherwise copy `libs/mcp-kit`'s layout, which is what the generator produced for that lib. Create `libs/search/package.json`:

```json
{
  "name": "@rainforest-dev/search",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.cjs"
    },
    "./node": {
      "types": "./dist/node.d.ts",
      "import": "./dist/node.js",
      "default": "./dist/node.cjs"
    }
  },
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "typings": "./dist/index.d.ts",
  "files": ["dist", "!**/*.tsbuildinfo"],
  "nx": {
    "sourceRoot": "libs/search/src",
    "name": "search"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "vite-plugin-dts": "^4.5.4"
  }
}
```

Create `libs/search/vite.config.ts`:

```ts
import * as path from 'path';
import dts from 'vite-plugin-dts';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/search',
  plugins: [
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
    }),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    lib: {
      entry: { index: 'src/index.ts', node: 'src/node.ts' },
      fileName: (format: string, entryName: string) =>
        `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
      formats: ['es', 'cjs'],
    },
    ssr: true,
  },
  test: {
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/search',
      provider: 'v8',
    },
  },
});
```

Copy `libs/mcp-kit/tsconfig.json`, `tsconfig.lib.json` and `tsconfig.spec.json` unchanged into `libs/search/`. Create `libs/search/eslint.config.js`:

```js
import baseConfig from '../../eslint.config.js';

export default [
  ...baseConfig,
  {
    files: ['src/**/*.ts'],
    ignores: ['src/node.ts', 'src/node/**', 'src/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*'],
              message:
                'The root entry runs in browsers; node: imports belong in src/node.',
            },
          ],
        },
      ],
    },
  },
];
```

Create empty `src/index.ts` and `src/node.ts`, then run:

```bash
pnpm install
pnpm nx sync
pnpm nx show project search --json | node -e "process.stdin.on('data',d=>console.log(Object.keys(JSON.parse(d).targets).sort().join(' ')))"
```

Expected: the list includes `build lint test typecheck`.

- [ ] **Step 2: Text helpers, test first**

Create `src/text.test.ts`. The `queryTerms` cases are copied from `apps/personal-memories/src/lib/search/terms.test.ts`; copy that file's `describe` blocks in, changing only the import. Then add:

```ts
import { describe, expect, it } from 'vitest';

import { fold, queryTerms, trimEdges, whitespaceTerms } from './text';

describe('fold', () => {
  it('applies NFKC and lowercases', () => {
    expect(fold('ＶＵＥ　Ａｓｔｒｏ')).toBe('vue astro');
  });
});

describe('whitespaceTerms', () => {
  it('folds, splits, dedupes and keeps edge punctuation', () => {
    expect(whitespaceTerms('  C++  c++ Ｒｕｓｔ ')).toEqual(['c++', 'rust']);
  });

  it('returns nothing for blank input', () => {
    expect(whitespaceTerms('   ')).toEqual([]);
  });
});

describe('trimEdges', () => {
  it('strips punctuation and symbols at both ends only', () => {
    expect(trimEdges('「台南」')).toBe('台南');
    expect(trimEdges('a.b')).toBe('a.b');
  });
});
```

Run: `pnpm nx test search -- src/text.test.ts`. Expected: FAIL, cannot resolve `./text`.

Create `src/text.ts`:

```ts
const EDGE = /^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu;

export const fold = (s: string) => s.normalize('NFKC').toLowerCase();

export const trimEdges = (token: string) => token.replace(EDGE, '');

export function queryTerms(text: string): string[] {
  const terms = fold(text).split(/\s+/u).map(trimEdges).filter(Boolean);
  return [...new Set(terms)];
}

export function whitespaceTerms(text: string): string[] {
  return [...new Set(fold(text).split(/\s+/u).filter(Boolean))];
}
```

Run the test again. Expected: PASS.

- [ ] **Step 3: Matchers, test first**

Create `src/match.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { matchesAllTerms, ngramSimilarity, tieredMatch } from './match';

describe('matchesAllTerms', () => {
  it('needs every term in some field, after folding', () => {
    expect(matchesAllTerms(['Hacker News', 'tech'], ['hacker', 'TECH'])).toBe(
      true,
    );
    expect(matchesAllTerms(['Hacker News'], ['hacker', 'rust'])).toBe(false);
  });

  it('matches everything when there are no terms', () => {
    expect(matchesAllTerms(['x'], [])).toBe(true);
  });

  it('matches full-width input', () => {
    expect(matchesAllTerms(['Rust Blog'], ['ｒｕｓｔ'])).toBe(true);
  });
});

describe('tieredMatch', () => {
  const r = {
    title: 'PostgreSQL',
    keywords: ['database', 'relational'],
    expanded: ['資料庫'],
  };

  it('keeps the website tiers', () => {
    expect(tieredMatch('', r)).toBe(1);
    expect(tieredMatch('postgresql', r)).toBe(100);
    expect(tieredMatch('Postgre', r)).toBe(75);
    expect(tieredMatch('gres', r)).toBe(50);
    expect(tieredMatch('Relational', r)).toBe(30);
    expect(tieredMatch('data', r)).toBe(15);
    expect(tieredMatch('資料', r)).toBe(5);
    expect(tieredMatch('資', r)).toBe(0);
    expect(tieredMatch('mongo', r)).toBe(0);
  });

  it('folds full-width input', () => {
    expect(tieredMatch('ＰｏｓｔｇｒｅＳＱＬ', r)).toBe(100);
  });
});

describe('ngramSimilarity', () => {
  it('measures query coverage by bigrams and trigrams', () => {
    expect(ngramSimilarity('三體', '三體 II')).toBe(1);
    expect(ngramSimilarity('ab', 'xyz')).toBe(0);
    expect(ngramSimilarity('a', 'cat')).toBe(1);
  });
});
```

Run: `pnpm nx test search -- src/match.test.ts`. Expected: FAIL, cannot resolve `./match`.

Create `src/match.ts`. `ngramSimilarity` is copied verbatim from `apps/personal-calibre/src/app/api/books/search/route.ts`:

```ts
import { fold } from './text';

export function matchesAllTerms(
  fields: readonly string[],
  terms: readonly string[],
): boolean {
  const folded = fields.map(fold);
  return terms.every((term) => {
    const t = fold(term);
    return folded.some((field) => field.includes(t));
  });
}

export type Tiered = {
  title: string;
  keywords: readonly string[];
  expanded?: readonly string[] | undefined;
};

export function tieredMatch(
  query: string,
  { title, keywords, expanded = [] }: Tiered,
): number {
  const q = fold(query).trim();
  if (!q) return 1;
  const t = fold(title);
  if (t === q) return 100;
  if (t.startsWith(q)) return 75;
  if (t.includes(q)) return 50;
  const k = keywords.map(fold);
  if (k.some((word) => word === q)) return 30;
  if (k.some((word) => word.includes(q))) return 15;
  if (q.length >= 2 && expanded.some((word) => fold(word).includes(q)))
    return 5;
  return 0;
}

export function ngramSimilarity(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  const grams = new Set<string>();
  for (let i = 0; i < q.length - 1; i++) {
    grams.add(q.slice(i, i + 2));
    if (i < q.length - 2) grams.add(q.slice(i, i + 3));
  }
  if (grams.size === 0) return t.includes(q) ? 1 : 0;
  let hits = 0;
  for (const g of grams) if (t.includes(g)) hits++;
  return hits / grams.size;
}
```

Run the test again. Expected: PASS.

- [ ] **Step 4: `lexicalRank`, test first**

Create `src/lexical.test.ts`. It replays memories' `lexical.test.ts` through a config equal to memories' own:

```ts
import { describe, expect, it } from 'vitest';

import { type LexicalConfig, lexicalRank } from './lexical';

type Doc = {
  id: string;
  day: string;
  text: string;
  people: string[];
  places: string[];
};

const doc = (
  id: string,
  day: string,
  text: string,
  extra: Partial<Doc> = {},
): Doc => ({
  id,
  day,
  text,
  people: [],
  places: [],
  ...extra,
});

const CONFIG: LexicalConfig<Doc> = {
  id: (d) => d.id,
  text: (d) => d.text,
  facets: [
    { values: (d) => d.people, match: 'exact' },
    { values: (d) => d.places, match: 'substring' },
  ],
  tieBreak: (a, b) => b.day.localeCompare(a.day) || a.id.localeCompare(b.id),
};

const docs = [
  doc('a', '2025-11-01', '09:00 Bob：台南的牛肉麵'),
  doc('b', '2025-11-02', '10:00 Alice：麵 麵 麵'),
  doc('c', '2025-11-03', '11:00 Bob：台北'),
  doc('d', '2025-11-04', 'labels: Ramen', { places: ['台南'] }),
  doc('e', '2025-11-05', 'hello', { people: ['bob'] }),
];

describe('lexicalRank', () => {
  it('requires every term', () => {
    expect(lexicalRank(docs, ['台南', '麵'], CONFIG)).toEqual(['a']);
  });

  it('ranks facet hits first, then text hits, then the tie-break', () => {
    expect(lexicalRank(docs, ['台南'], CONFIG)).toEqual(['d', 'a']);
    expect(lexicalRank(docs, ['麵'], CONFIG)).toEqual(['b', 'a']);
  });

  it('matches an exact facet but not a partial one', () => {
    expect(lexicalRank(docs, ['bob'], CONFIG)).toEqual(['e', 'c', 'a']);
    expect(lexicalRank(docs, ['bo'], CONFIG)).toEqual(['c', 'a']);
  });

  it('returns nothing for no usable terms', () => {
    expect(lexicalRank(docs, ['', ''], CONFIG)).toEqual([]);
  });

  it('keeps input order without a tie-break', () => {
    const plain = { id: CONFIG.id, text: CONFIG.text };
    expect(
      lexicalRank([doc('x', '1', 'a'), doc('y', '2', 'a')], ['a'], plain),
    ).toEqual(['x', 'y']);
  });
});
```

Also copy every `it` in `apps/personal-memories/src/lib/search/lexical.test.ts` into this file, adapted to `doc(...)` above and `lexicalRank(docs, terms, CONFIG)`. Their expected arrays stay unchanged.

Run: `pnpm nx test search -- src/lexical.test.ts`. Expected: FAIL, cannot resolve `./lexical`.

Create `src/lexical.ts`:

```ts
import { fold } from './text';

export type Facet<D> = {
  values(doc: D): readonly string[];
  match: 'exact' | 'substring';
};

export type LexicalConfig<D> = {
  id(doc: D): string;
  text(doc: D): string;
  facets?: readonly Facet<D>[];
  tieBreak?(a: D, b: D): number;
};

const count = (haystack: string, needle: string) => {
  let n = 0;
  for (
    let i = haystack.indexOf(needle);
    i !== -1;
    i = haystack.indexOf(needle, i + needle.length)
  )
    n++;
  return n;
};

export function lexicalRank<D>(
  docs: readonly D[],
  terms: readonly string[],
  config: LexicalConfig<D>,
): string[] {
  const folded = terms.map(fold).filter(Boolean);
  if (folded.length === 0) return [];
  const facets = config.facets ?? [];
  const scored: { doc: D; facets: number; hits: number }[] = [];
  for (const doc of docs) {
    const text = fold(config.text(doc));
    const values = facets.map((f) => ({
      match: f.match,
      values: f.values(doc).map(fold),
    }));
    let facetHits = 0;
    let hits = 0;
    let all = true;
    for (const term of folded) {
      const inFacet = values.some(({ match, values: vs }) =>
        match === 'exact'
          ? vs.includes(term)
          : vs.some((v) => v.includes(term)),
      );
      const inText = count(text, term);
      if (!inFacet && inText === 0) {
        all = false;
        break;
      }
      if (inFacet) facetHits++;
      hits += inText;
    }
    if (all) scored.push({ doc, facets: facetHits, hits });
  }
  return scored
    .sort(
      (x, y) =>
        y.facets - x.facets ||
        y.hits - x.hits ||
        (config.tieBreak?.(x.doc, y.doc) ?? 0),
    )
    .map((s) => config.id(s.doc));
}
```

Run the test again. Expected: PASS.

- [ ] **Step 5: Vectors, fusion and hashes, test first**

Copy `apps/personal-memories/src/lib/search/vector.test.ts` to `src/vector.test.ts` and `rrf.test.ts` to `src/rrf.test.ts`, changing only the imports (`./vector`, `./rrf`). Append to `src/vector.test.ts`:

```ts
import { semanticIds } from './vector';

describe('semanticIds', () => {
  it('drops hits under the floor, sorts by score then id, and truncates', () => {
    const hits = [
      { id: 'b', score: 0.9 },
      { id: 'a', score: 0.9 },
      { id: 'c', score: 0.5 },
      { id: 'd', score: 0.8 },
    ];
    expect(semanticIds({ hits, minScore: 0.6, k: 2 })).toEqual(['a', 'b']);
    expect(semanticIds({ hits, minScore: 0.6, k: 10 })).toEqual([
      'a',
      'b',
      'd',
    ]);
  });
});
```

Create `src/hash.test.ts`. The expected strings pin memories' on-disk format:

```ts
import { describe, expect, it } from 'vitest';

import { fnv1a, fnv1aBytes } from './hash';

describe('fnv1a', () => {
  it('matches the memories content hash, zero-padded to 8 hex digits', () => {
    expect(fnv1a('')).toBe('811c9dc5');
    expect(fnv1a('a')).toBe('e40c292c');
    expect(fnv1a('台南')).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('fnv1aBytes', () => {
  it('prefixes the byte length and does not pad', () => {
    expect(fnv1aBytes(new Uint8Array())).toBe('0:811c9dc5');
    expect(fnv1aBytes(new Uint8Array([97]))).toBe('1:e40c292c');
  });
});
```

Run: `pnpm nx test search -- src/vector.test.ts src/rrf.test.ts src/hash.test.ts`. Expected: FAIL, unresolved modules.

Create `src/vector.ts` by copying `topK` verbatim from `apps/personal-memories/src/lib/search/vector.ts`, then appending:

```ts
export type ScoredId = { id: string; score: number };

export function semanticIds({
  hits,
  minScore,
  k,
}: {
  hits: readonly ScoredId[];
  minScore: number;
  k: number;
}): string[] {
  return hits
    .filter((h) => h.score >= minScore)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, k)
    .map((h) => h.id);
}
```

Create `src/rrf.ts` by copying `apps/personal-memories/src/lib/search/rrf.ts` verbatim. Create `src/hash.ts`:

```ts
export function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function fnv1aBytes(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i] ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return `${bytes.length}:${(hash >>> 0).toString(16)}`;
}
```

Run the tests again. Expected: PASS. If `fnv1a('a')` differs, the expected value in the test is wrong, not the function. Recompute it with memories' `contentHash('a')` (`node -e "import('./apps/personal-memories/src/lib/search/text.ts').then(m=>console.log(m.contentHash('a')))"`) and use that value.

- [ ] **Step 6: `planReuse` and the index header, test first**

Create `src/reuse.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { planReuse } from './reuse';

describe('planReuse', () => {
  it('reuses rows whose id and hash both match', () => {
    const plan = planReuse(
      [
        { id: 'a', hash: '1' },
        { id: 'b', hash: '2' },
        { id: 'c', hash: '3', retry: true },
      ],
      [
        { id: 'b', hash: '2' },
        { id: 'a', hash: 'changed' },
        { id: 'c', hash: '3' },
        { id: 'd', hash: '4' },
      ],
    );
    expect([...plan.reuse]).toEqual([[0, 1]]);
    expect(plan.missing).toEqual([1, 2, 3]);
  });

  it('plans everything as missing without a previous run', () => {
    expect(planReuse([], [{ id: 'a', hash: '1' }]).missing).toEqual([0]);
  });
});
```

Create `src/index-header.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { isIndexHeader, vectorBytes } from './index-header';

describe('isIndexHeader', () => {
  it('accepts the docs.json shape', () => {
    expect(
      isIndexHeader({
        model: 'm',
        dims: 2,
        docs: [{ id: 'a', contentHash: '1', retry: true }],
      }),
    ).toBe(true);
  });

  it('rejects zero dims, a missing hash or a non-object', () => {
    expect(isIndexHeader({ model: 'm', dims: 0, docs: [] })).toBe(false);
    expect(isIndexHeader({ model: 'm', dims: 2, docs: [{ id: 'a' }] })).toBe(
      false,
    );
    expect(isIndexHeader(null)).toBe(false);
  });
});

describe('vectorBytes', () => {
  it('is docs × dims × 4', () => {
    expect(
      vectorBytes({
        model: 'm',
        dims: 3,
        docs: [
          { id: 'a', contentHash: '1' },
          { id: 'b', contentHash: '2' },
        ],
      }),
    ).toBe(24);
  });
});
```

Run: `pnpm nx test search -- src/reuse.test.ts src/index-header.test.ts`. Expected: FAIL.

Create `src/reuse.ts`:

```ts
export type Keyed = { id: string; hash: string };
export type Reusable = Keyed & { retry?: boolean | undefined };

export function planReuse(
  previous: readonly Reusable[],
  current: readonly Keyed[],
): { reuse: Map<number, number>; missing: number[] } {
  const rowOf = new Map(
    previous.flatMap((p, i) =>
      p.retry ? [] : [[`${p.id}\u0000${p.hash}`, i] as const],
    ),
  );
  const reuse = new Map<number, number>();
  const missing: number[] = [];
  current.forEach((c, i) => {
    const row = rowOf.get(`${c.id}\u0000${c.hash}`);
    if (row === undefined) missing.push(i);
    else reuse.set(i, row);
  });
  return { reuse, missing };
}
```

Create `src/index-header.ts`:

```ts
export type IndexHeader = {
  model: string;
  dims: number;
  docs: { id: string; contentHash: string; retry?: true }[];
};

export function isIndexHeader(value: unknown): value is IndexHeader {
  const h = value as Partial<IndexHeader> | null;
  return (
    typeof h?.model === 'string' &&
    typeof h.dims === 'number' &&
    h.dims > 0 &&
    Array.isArray(h.docs) &&
    h.docs.every(
      (d) => typeof d?.id === 'string' && typeof d.contentHash === 'string',
    )
  );
}

export const vectorBytes = (header: IndexHeader) =>
  header.docs.length * header.dims * Float32Array.BYTES_PER_ELEMENT;
```

Run the tests again. Expected: PASS.

- [ ] **Step 7: Capture today's memories file format as a fixture**

Run from the repository root. This writes to a temporary directory only:

```bash
mkdir -p libs/search/src/node/fixtures
node --input-type=module -e "
import { writeSearchFiles } from './apps/personal-memories/src/lib/server/search-files.ts';
import { cp, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = await mkdtemp(join(tmpdir(), 'search-fixture-'));
await writeSearchFiles(root, { model: 'fixture-model', dims: 3, docs: [{ id: 'chat:a', contentHash: '0badf00d' }, { id: 'photo:b', contentHash: '1234abcd', retry: true }] }, new Float32Array([0.5, -1, 2, 0.25, 0, -0.75]));
await cp(join(root, 'search'), 'libs/search/src/node/fixtures', { recursive: true });
"
ls -l libs/search/src/node/fixtures
```

Expected: `docs.json` and a 24-byte `vectors.text.bin`.

- [ ] **Step 8: Index files, test first**

Create `src/node/index-files.test.ts`:

```ts
import { mkdtemp, readFile, rm, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import type { IndexHeader } from '../index-header';
import { readIndexFiles, writeIndexFiles } from './index-files';

const FIXTURE = fileURLToPath(new URL('./fixtures', import.meta.url));
const HEADER: IndexHeader = {
  model: 'fixture-model',
  dims: 3,
  docs: [
    { id: 'chat:a', contentHash: '0badf00d' },
    { id: 'photo:b', contentHash: '1234abcd', retry: true },
  ],
};
const VECTORS = new Float32Array([0.5, -1, 2, 0.25, 0, -0.75]);

let dir: string | undefined;
afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = undefined;
});

describe('index files', () => {
  it('reads files written by memories today', async () => {
    const files = await readIndexFiles(FIXTURE);
    expect(files?.header).toEqual(HEADER);
    expect(Array.from(files?.vectors ?? [])).toEqual(Array.from(VECTORS));
  });

  it('writes byte-identical files', async () => {
    dir = await mkdtemp(join(tmpdir(), 'search-index-'));
    await writeIndexFiles(dir, HEADER, VECTORS);
    for (const name of ['docs.json', 'vectors.text.bin'])
      expect(await readFile(join(dir, name))).toEqual(
        await readFile(join(FIXTURE, name)),
      );
  });

  it('treats missing, truncated or mismatched files as no index', async () => {
    dir = await mkdtemp(join(tmpdir(), 'search-index-'));
    expect(await readIndexFiles(dir)).toBeUndefined();
    await writeIndexFiles(dir, HEADER, VECTORS);
    await truncate(join(dir, 'vectors.text.bin'), 12);
    expect(await readIndexFiles(dir)).toBeUndefined();
    await writeIndexFiles(dir, HEADER, VECTORS);
    await writeFile(join(dir, 'vectors.text.bin'), new Uint8Array(24));
    expect(await readIndexFiles(dir)).toBeUndefined();
  });

  it('honours custom file names', async () => {
    dir = await mkdtemp(join(tmpdir(), 'search-index-'));
    const names = { header: 'h.json', vectors: 'v.bin' };
    await writeIndexFiles(dir, HEADER, VECTORS, names);
    expect((await readIndexFiles(dir, names))?.header).toEqual(HEADER);
  });
});
```

Also copy every remaining `it` from `apps/personal-memories/src/lib/server/search-files.test.ts` and `search-files-load.test.ts` that exercises reading or writing (not `reuseVectors`), pointing them at `readIndexFiles(dir)` / `writeIndexFiles(dir, …)` with `dir` as the search directory itself. That includes the unaligned-buffer case if one exists. If none exists, add this:

```ts
it('realigns a buffer read at an odd offset', async () => {
  dir = await mkdtemp(join(tmpdir(), 'search-index-'));
  await writeIndexFiles(dir, HEADER, VECTORS);
  const files = await readIndexFiles(dir);
  expect((files?.vectors.byteOffset ?? 1) % 4).toBe(0);
});
```

Run: `pnpm nx test search -- src/node/index-files.test.ts`. Expected: FAIL, cannot resolve `./index-files`.

Create `src/node/index-files.ts`:

```ts
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { fnv1aBytes } from '../hash';
import { type IndexHeader, isIndexHeader, vectorBytes } from '../index-header';

export type IndexFiles = { header: IndexHeader; vectors: Float32Array };
export type IndexFileNames = { header: string; vectors: string };

export const DEFAULT_INDEX_FILES: IndexFileNames = {
  header: 'docs.json',
  vectors: 'vectors.text.bin',
};

export async function readIndexFiles(
  dir: string,
  names: IndexFileNames = DEFAULT_INDEX_FILES,
): Promise<IndexFiles | undefined> {
  try {
    const [json, bytes] = await Promise.all([
      readFile(join(dir, names.header), 'utf8'),
      readFile(join(dir, names.vectors)),
    ]);
    const file = JSON.parse(json) as unknown;
    if (!isIndexHeader(file)) return undefined;
    const { vectorsHash, ...header } = file as IndexHeader & {
      vectorsHash?: string;
    };
    if (bytes.byteLength !== vectorBytes(header)) return undefined;
    if (vectorsHash !== fnv1aBytes(bytes)) return undefined;
    const aligned =
      bytes.byteOffset % Float32Array.BYTES_PER_ELEMENT === 0
        ? bytes
        : Uint8Array.from(bytes);
    return {
      header,
      vectors: new Float32Array(
        aligned.buffer,
        aligned.byteOffset,
        aligned.byteLength / Float32Array.BYTES_PER_ELEMENT,
      ),
    };
  } catch {
    return undefined;
  }
}

async function writeAtomic(path: string, data: string | Uint8Array) {
  await writeFile(`${path}.tmp`, data);
  await rename(`${path}.tmp`, path);
}

export async function writeIndexFiles(
  dir: string,
  header: IndexHeader,
  vectors: Float32Array,
  names: IndexFileNames = DEFAULT_INDEX_FILES,
): Promise<void> {
  await mkdir(dir, { recursive: true });
  const bytes = new Uint8Array(
    vectors.buffer,
    vectors.byteOffset,
    vectors.byteLength,
  );
  await writeAtomic(join(dir, names.vectors), bytes);
  await writeAtomic(
    join(dir, names.header),
    JSON.stringify({ ...header, vectorsHash: fnv1aBytes(bytes) }),
  );
}
```

Run the test again. Expected: PASS. A failing byte-identity case means the JSON key order or hash format drifted from `search-files.ts`. Fix the code, never the fixture.

- [ ] **Step 9: Embedding contract, test first**

Create `src/embed.test.ts`. Copy the `withQueryPriority` cases from `apps/personal-memories/src/lib/server/embed.test.ts` and the breaker and query-timeout cases from `search-index.test.ts`, re-pointed at `./embed`. Add:

```ts
import { describe, expect, it, vi } from 'vitest';

import { breaker, type Embedder, EmbedError, embedQuery } from './embed';

const embedder = (embed: Embedder['embed'], dims = 2): Embedder => ({
  model: 'm',
  dims,
  minScore: 0,
  images: false,
  embed,
});

describe('embedQuery', () => {
  it('returns a valid vector', async () => {
    const v = await embedQuery(
      embedder(async () => [Float32Array.from([1, 0])]),
      'q',
    );
    expect(Array.from(v)).toEqual([1, 0]);
  });

  it('rejects a wrong-length or non-finite vector as a model mismatch', async () => {
    await expect(
      embedQuery(
        embedder(async () => [Float32Array.from([1])]),
        'q',
      ),
    ).rejects.toMatchObject({ reason: 'model-mismatch' });
    await expect(
      embedQuery(
        embedder(async () => [Float32Array.from([NaN, 1])]),
        'q',
      ),
    ).rejects.toMatchObject({ reason: 'model-mismatch' });
  });

  it('times out and aborts the call', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const pending = embedQuery(
      embedder((_t, _k, s) => {
        signal = s;
        return new Promise(() => undefined);
      }),
      'q',
      100,
    );
    const assertion = expect(pending).rejects.toBeInstanceOf(EmbedError);
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(signal?.aborted).toBe(true);
    vi.useRealTimers();
  });
});

describe('breaker', () => {
  it('stays open for its window after a trip', () => {
    const gate = breaker(1000);
    expect(gate.open(0)).toBe(false);
    gate.trip(0);
    expect(gate.open(999)).toBe(true);
    expect(gate.open(1000)).toBe(false);
  });
});
```

Run: `pnpm nx test search -- src/embed.test.ts`. Expected: FAIL.

Create `src/embed.ts`. `EmbedError`, `Embedder`, `withQueryPriority` and the types are copied verbatim from `apps/personal-memories/src/lib/server/embed.ts`. `Breaker`, `breaker`, `QUERY_EMBED_TIMEOUT_MS` and `BREAKER_MS` are copied from `search-index.ts`. `embedQuery` is `search-index.ts`'s private function with a timeout parameter:

```ts
export type EmbedKind = 'query' | 'document';

export type EmbedInput = string | { text: string; image: string };

export type Embedder = {
  model: string;
  dims: number;
  minScore: number;
  images: boolean;
  embed(
    texts: readonly EmbedInput[],
    kind: EmbedKind,
    signal?: AbortSignal,
  ): Promise<Float32Array[]>;
};

export type EmbedFailure =
  'ollama-unreachable' | 'timeout' | 'model-mismatch' | 'image-unreadable';

export class EmbedError extends Error {
  readonly reason: EmbedFailure;

  constructor(reason: EmbedFailure, message: string) {
    super(message);
    this.reason = reason;
  }
}

export const QUERY_EMBED_TIMEOUT_MS = 800;
export const BREAKER_MS = 30_000;

export type Breaker = {
  open(now: number): boolean;
  trip(now: number): void;
};

export function breaker(ms = BREAKER_MS): Breaker {
  let until = 0;
  return {
    open: (now) => now < until,
    trip: (now) => {
      until = now + ms;
    },
  };
}

export async function embedQuery(
  embedder: Embedder,
  text: string,
  timeoutMs = QUERY_EMBED_TIMEOUT_MS,
): Promise<Float32Array> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new EmbedError('timeout', 'query embedding timed out'));
    }, timeoutMs);
  });
  try {
    const [vector] = await Promise.race([
      embedder.embed([text], 'query', controller.signal),
      timeout,
    ]);
    if (
      !vector ||
      vector.length !== embedder.dims ||
      !vector.every((v) => Number.isFinite(v))
    )
      throw new EmbedError('model-mismatch', 'bad query vector');
    return vector;
  } finally {
    clearTimeout(timer);
  }
}
```

Then paste `withQueryPriority` verbatim from memories' `embed.ts`. Run the test again. Expected: PASS.

- [ ] **Step 10: Ollama embedder and concept embedder, test first**

Copy `apps/personal-memories/src/lib/server/embed.test.ts` to `src/node/ollama-embed.test.ts`. Keep the `ollamaEmbedder` cases (fetch stubs, prefixes, image reading, every `EmbedError` reason, model table floors). Drop `embedderFromEnv` and `withQueryPriority`, which are covered elsewhere. Replace `fakeEmbedder()` with `conceptEmbedder([['麵', 'ramen'], ['貓', 'cat']])`. Re-point imports at `./ollama-embed`, `./concept-embedder` and `../embed`. Pass `url: 'http://ollama.test'` wherever a case relied on the default URL. Add:

```ts
it('defaults to localhost and reads no environment', async () => {
  const fetch = vi.fn(async () =>
    Response.json({ embeddings: [Array(768).fill(0.1)] }),
  ) as unknown as typeof globalThis.fetch;
  vi.stubEnv('MEMORIES_OLLAMA_URL', 'http://elsewhere.test');
  await ollamaEmbedder({ fetch }).embed(['x'], 'query');
  expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe(
    'http://localhost:11434/api/embed',
  );
  vi.unstubAllEnvs();
});
```

Run: `pnpm nx test search -- src/node/ollama-embed.test.ts`. Expected: FAIL.

Create `src/node/ollama-embed.ts` from memories' `embed.ts` lines covering `DEFAULT_EMBED_MODEL`, `MODELS` (exported as `EMBED_MODELS`), `PREFIX`, `ollamaInput`, `isAbort` and `ollamaEmbedder`. Import `Embedder`, `EmbedError`, `EmbedInput` and `EmbedKind` from `'../embed'`. Change the `url` default to `'http://localhost:11434'`, with no `process.env` read. Create `src/node/concept-embedder.ts`:

```ts
import type { Embedder } from '../embed';

export function conceptEmbedder(
  concepts: readonly (readonly string[])[],
  model = 'fake',
): Embedder {
  return {
    model,
    dims: concepts.length,
    minScore: 0.01,
    images: true,
    async embed(texts) {
      return texts.map((item) => {
        const text = typeof item === 'string' ? item : item.text;
        const folded = text.normalize('NFKC').toLowerCase();
        return Float32Array.from(
          concepts.map((words) =>
            words.some((w) => folded.includes(w)) ? 1 : 0,
          ),
        );
      });
    },
  };
}
```

Run the test again. Expected: PASS.

- [ ] **Step 11: Ollama chat and model check, test first**

Create `src/node/ollama-chat.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import {
  assertModel,
  ollamaChat,
  OllamaHttpError,
  OllamaSetupError,
} from './ollama-chat';

const URL = 'http://ollama.test';
const tags = (names: string[]) =>
  vi.fn(async () =>
    Response.json({ models: names.map((name) => ({ name })) }),
  ) as unknown as typeof fetch;

describe('assertModel', () => {
  it('passes when the model is listed', async () => {
    await expect(
      assertModel(URL, 'qwen3:8b', tags(['qwen3:8b'])),
    ).resolves.toBeUndefined();
  });

  it('names what is available when the model is missing or not given', async () => {
    await expect(assertModel(URL, 'x', tags(['a', 'b']))).rejects.toMatchObject(
      { reason: 'missing-model', models: ['a', 'b'] },
    );
    await expect(
      assertModel(URL, undefined, tags(['a'])),
    ).rejects.toMatchObject({ reason: 'no-model', models: ['a'] });
  });

  it('reports an unreachable server', async () => {
    const down = vi.fn(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    await expect(assertModel(URL, 'x', down)).rejects.toBeInstanceOf(
      OllamaSetupError,
    );
    await expect(assertModel(URL, 'x', down)).rejects.toMatchObject({
      reason: 'unreachable',
    });
  });
});

describe('ollamaChat', () => {
  it('sends a non-streaming request and returns the message content', async () => {
    const fetch = vi.fn(async () =>
      Response.json({ message: { content: '{"terms":[]}' } }),
    ) as unknown as typeof globalThis.fetch;
    const format = { type: 'object' };
    const out = await ollamaChat({
      url: URL,
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }],
      format,
      fetch,
    });
    expect(out).toBe('{"terms":[]}');
    const [target, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(target).toBe(`${URL}/api/chat`);
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      model: 'm',
      stream: false,
      think: false,
      options: { temperature: 0 },
      format,
      messages: [{ role: 'user', content: 'hi' }],
    });
  });

  it('throws the HTTP status on a failed response', async () => {
    const fetch = vi.fn(
      async () => new Response('no', { status: 500 }),
    ) as unknown as typeof globalThis.fetch;
    await expect(
      ollamaChat({ url: URL, model: 'm', messages: [], fetch }),
    ).rejects.toEqual(new OllamaHttpError(500));
  });
});
```

Run: `pnpm nx test search -- src/node/ollama-chat.test.ts`. Expected: FAIL.

Create `src/node/ollama-chat.ts`:

```ts
export type OllamaSetupFailure = 'unreachable' | 'no-model' | 'missing-model';

export class OllamaSetupError extends Error {
  readonly reason: OllamaSetupFailure;
  readonly models: readonly string[];

  constructor(
    reason: OllamaSetupFailure,
    models: readonly string[],
    message: string,
  ) {
    super(message);
    this.reason = reason;
    this.models = models;
  }
}

export class OllamaHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Ollama returned HTTP ${status}`);
    this.status = status;
  }
}

export async function assertModel(
  url: string,
  model: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  let models: string[];
  try {
    const res = await fetchImpl(`${url}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    models = ((await res.json()) as { models: { name: string }[] }).models.map(
      (m) => m.name,
    );
  } catch (error) {
    throw new OllamaSetupError(
      'unreachable',
      [],
      error instanceof Error ? error.message : String(error),
    );
  }
  if (!model) throw new OllamaSetupError('no-model', models, 'no model given');
  if (!models.includes(model))
    throw new OllamaSetupError(
      'missing-model',
      models,
      `${model} is not available`,
    );
}

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export async function ollamaChat({
  url,
  model,
  messages,
  format,
  think = false,
  temperature = 0,
  fetch: fetchImpl = fetch,
}: {
  url: string;
  model: string;
  messages: readonly ChatMessage[];
  format?: Record<string, unknown>;
  think?: boolean;
  temperature?: number;
  fetch?: typeof fetch;
}): Promise<string> {
  const res = await fetchImpl(`${url}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      think,
      options: { temperature },
      ...(format ? { format } : {}),
      messages,
    }),
  });
  if (!res.ok) throw new OllamaHttpError(res.status);
  const { message } = (await res.json()) as { message: { content: string } };
  return message.content;
}
```

Run the test again. Expected: PASS.

- [ ] **Step 12: Barrels, build and lint**

`src/index.ts`:

```ts
export * from './embed';
export * from './hash';
export * from './index-header';
export * from './lexical';
export * from './match';
export * from './reuse';
export * from './rrf';
export * from './text';
export * from './vector';
```

`src/node.ts`:

```ts
export * from './node/concept-embedder';
export * from './node/index-files';
export * from './node/ollama-chat';
export * from './node/ollama-embed';
```

Run:

```bash
pnpm nx run-many -t lint test typecheck build -p search
ls libs/search/dist
grep -l "node:" libs/search/dist/index.js || echo "root entry is node-free"
```

Expected: all targets pass; `dist` has `index.js`, `index.cjs`, `index.d.ts`, `node.js`, `node.cjs`, `node.d.ts`; the last line prints `root entry is node-free`. Then check that the lint rule bites by adding `import 'node:fs';` to `src/text.ts`, running `pnpm nx lint search` (expected: FAIL, no-restricted-imports), and reverting.

- [ ] **Step 13: Commit and open the PR**

```bash
pnpm format:check
git add libs/search tsconfig.json pnpm-lock.yaml
git commit -m "feat(search): shared search core and node entry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Open the PR with the `rainforest-core:create-pr` skill. The change is not visual; say so in the body.

---

### Task 2: memories adopts `libs/search`

**Files:**

- Create: `apps/personal-memories/src/lib/server/search-golden.test.ts` (and its `__snapshots__`)
- Modify: `apps/personal-memories/package.json`
- Modify: `apps/personal-memories/src/lib/search/{index,lexical,text,query}.ts`
- Delete: `apps/personal-memories/src/lib/search/{terms,rrf,vector}.ts` and `{terms,rrf,vector}.test.ts` (their cases now live in `libs/search`)
- Modify: `apps/personal-memories/src/lib/server/{search-files,embed,search-index}.ts`

**Interfaces:**

- Consumes: everything Task 1 produces.
- Produces: no new exports. Every existing export of `@/lib/search` and `@/lib/server` keeps its name and type.

- [ ] **Step 1: Golden test, written against today's code**

Create `apps/personal-memories/src/lib/server/search-golden.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { SearchDoc, SearchQuery } from '@/lib/search';

import { type Embedder, EmbedError, fakeEmbedder } from './embed.ts';
import { breaker, makeIndex, runSearch } from './search-index.ts';

const doc = (
  id: string,
  day: string,
  text: string,
  extra: Partial<SearchDoc> = {},
): SearchDoc => ({
  id,
  day,
  kind: 'chat',
  source: 'line',
  text,
  snippet: text,
  people: [],
  places: [],
  eventIds: [id],
  contentHash: `h-${id}`,
  ...extra,
});

const DOCS = [
  doc('ramen-chat', '2025-11-04', '09:00 Bob：台南的拉麵好好吃', {
    people: ['bob'],
  }),
  doc('photo', '2025-11-01', 'labels: Ramen', {
    kind: 'photo',
    source: 'photo',
    places: ['台南'],
  }),
  doc('rain', '2025-11-02', '10:00 Alice：下雨了'),
  doc('bob-other', '2025-11-03', '11:00 Bob：早安', { people: ['bob'] }),
  doc('cat', '2025-11-03', '12:00 Alice：貓貓 coffee', {
    source: 'slack',
    people: ['alice'],
  }),
  doc('note:2025-11-05', '2025-11-05', '生日 cake', {
    kind: 'note',
    source: 'note',
  }),
];

const indexed = async (
  embedder: Embedder = fakeEmbedder(),
  model = embedder.model,
) => {
  const vectors = new Float32Array(DOCS.length * embedder.dims);
  const out = await embedder.embed(
    DOCS.map((d) => d.text),
    'document',
  );
  out.forEach((v, i) => vectors.set(v, i * embedder.dims));
  return makeIndex(DOCS, {
    header: {
      model,
      dims: embedder.dims,
      docs: DOCS.map(({ id, contentHash }) => ({ id, contentHash })),
    },
    vectors,
  });
};

const failing = (error: unknown): Embedder => ({
  ...fakeEmbedder(),
  embed: async () => {
    throw error;
  },
});

const CASES: [string, SearchQuery][] = [
  ['cross-language semantic', { text: '吃麵' }],
  ['lexical and semantic', { text: '拉麵' }],
  ['place facet', { text: '台南' }],
  ['person filter', { text: '早安', people: ['bob'] }],
  ['people only', { text: '', people: ['bob'] }],
  ['range', { text: '雨', range: { start: '2025-11-02', end: '2025-11-03' } }],
  ['source filter', { text: 'ramen', sources: ['photo'] }],
  ['note text', { text: 'cake' }],
  ['no match', { text: 'xyzzy' }],
  ['empty', { text: '' }],
];

describe('runSearch golden', () => {
  it.each(CASES)('%s', async (_, query) => {
    expect(
      await runSearch(await indexed(), query, fakeEmbedder(), breaker()),
    ).toMatchSnapshot();
  });

  it('falls back to lexical when the embedder is unreachable', async () => {
    const res = await runSearch(
      await indexed(),
      { text: '拉麵' },
      failing(new EmbedError('ollama-unreachable', 'down')),
      breaker(),
    );
    expect(res).toMatchSnapshot();
  });

  it('falls back on a model mismatch', async () => {
    const res = await runSearch(
      await indexed(fakeEmbedder(), 'other-model'),
      { text: '拉麵' },
      fakeEmbedder(),
      breaker(),
    );
    expect(res).toMatchSnapshot();
  });

  it('skips semantic while the breaker is open', async () => {
    const gate = breaker();
    gate.trip(Date.now());
    expect(
      await runSearch(await indexed(), { text: '拉麵' }, fakeEmbedder(), gate),
    ).toMatchSnapshot();
  });
});
```

Run: `pnpm nx test personal-memories -- src/lib/server/search-golden.test.ts`. Expected: PASS, writing a new snapshot file. Commit the test and its snapshot on their own:

```bash
git add apps/personal-memories/src/lib/server/search-golden.test.ts apps/personal-memories/src/lib/server/__snapshots__
git commit -m "test(personal-memories): pin search output before the shared-library move

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Add the dependency**

In `apps/personal-memories/package.json` `dependencies`, add `"@rainforest-dev/search": "workspace:*"` in alphabetical position. Run `pnpm install` and `pnpm nx sync`.

- [ ] **Step 3: Swap the core in `lib/search`**

`apps/personal-memories/src/lib/search/lexical.ts`:

```ts
import {
  type LexicalConfig,
  lexicalRank as rank,
} from '@rainforest-dev/search';

import type { SearchDoc } from './docs.ts';

const CONFIG: LexicalConfig<SearchDoc> = {
  id: (doc) => doc.id,
  text: (doc) => doc.text,
  facets: [
    { values: (doc) => doc.people, match: 'exact' },
    { values: (doc) => doc.places, match: 'substring' },
  ],
  tieBreak: (a, b) => b.day.localeCompare(a.day) || a.id.localeCompare(b.id),
};

export const lexicalRank = (
  docs: readonly SearchDoc[],
  terms: readonly string[],
): string[] => rank(docs, terms, CONFIG);
```

`apps/personal-memories/src/lib/search/text.ts`:

```ts
export { fnv1a as contentHash } from '@rainforest-dev/search';

const SNIPPET_CHARS = 80;

export const clipSnippet = (s: string) =>
  Array.from(s).slice(0, SNIPPET_CHARS).join('');
```

`apps/personal-memories/src/lib/search/index.ts`:

```ts
export { queryTerms, rrf, topK, trimEdges } from '@rainforest-dev/search';

export * from './docs.ts';
export * from './lexical.ts';
export * from './query.ts';
export * from './text.ts';
```

In `query.ts`, replace `import { trimEdges } from './terms.ts';` with `import { trimEdges } from '@rainforest-dev/search';`. Delete `terms.ts`, `rrf.ts`, `vector.ts`, `terms.test.ts`, `rrf.test.ts` and `vector.test.ts`.

Run: `pnpm nx test personal-memories`. Expected: PASS, golden snapshots unchanged. On a snapshot diff, stop and fix the code. Never update the snapshot (`-u` is not allowed in this task). Commit `refactor(personal-memories): rank and fuse with the shared search core`.

- [ ] **Step 4: Swap index files in `search-files.ts`**

Replace the body of `apps/personal-memories/src/lib/server/search-files.ts`:

```ts
import { join } from 'node:path';

import { type IndexHeader, planReuse } from '@rainforest-dev/search';
import {
  type IndexFiles,
  readIndexFiles,
  writeIndexFiles,
} from '@rainforest-dev/search/node';

export type SearchFileHeader = IndexHeader;
export type SearchFiles = IndexFiles;

export const searchDir = (root: string) => join(root, 'search');

export const readSearchFiles = (root: string) =>
  readIndexFiles(searchDir(root));

export const writeSearchFiles = (
  root: string,
  header: SearchFileHeader,
  vectors: Float32Array,
) => writeIndexFiles(searchDir(root), header, vectors);

export function reuseVectors(
  previous: SearchFiles | undefined,
  docs: readonly { id: string; contentHash: string }[],
  model: string,
  dims: number,
): { vectors: Float32Array; missing: number[] } {
  const vectors = new Float32Array(docs.length * dims);
  if (
    !previous ||
    previous.header.model !== model ||
    previous.header.dims !== dims
  )
    return { vectors, missing: docs.map((_, i) => i) };
  const { reuse, missing } = planReuse(
    previous.header.docs.map((d) => ({
      id: d.id,
      hash: d.contentHash,
      retry: d.retry,
    })),
    docs.map((d) => ({ id: d.id, hash: d.contentHash })),
  );
  for (const [i, row] of reuse)
    vectors.set(
      previous.vectors.subarray(row * dims, (row + 1) * dims),
      i * dims,
    );
  return { vectors, missing };
}
```

Run: `pnpm nx test personal-memories -- src/lib/server/search-files.test.ts src/lib/server/search-files-load.test.ts`. Expected: PASS, with both test files unmodified.

- [ ] **Step 5: Swap the embedder in `embed.ts`**

Replace `apps/personal-memories/src/lib/server/embed.ts`:

```ts
import { type Embedder, withQueryPriority } from '@rainforest-dev/search';
import {
  conceptEmbedder,
  ollamaEmbedder as sharedOllamaEmbedder,
} from '@rainforest-dev/search/node';

export {
  type EmbedFailure,
  type EmbedInput,
  type EmbedKind,
  type Embedder,
  EmbedError,
  withQueryPriority,
} from '@rainforest-dev/search';
export { DEFAULT_EMBED_MODEL } from '@rainforest-dev/search/node';

const DEFAULT_URL = 'http://localhost:11434';

export const ollamaEmbedder = (
  options: Parameters<typeof sharedOllamaEmbedder>[0] = {},
): Embedder =>
  sharedOllamaEmbedder({
    url: process.env['MEMORIES_OLLAMA_URL'] ?? DEFAULT_URL,
    ...options,
  });

const CONCEPTS = [
  ['麵', 'ramen', 'noodle'],
  ['海', 'beach', 'sea'],
  ['貓', 'cat'],
  ['咖啡', 'coffee'],
  ['生日', 'birthday', 'cake'],
  ['雨', 'rain'],
  ['車', 'car', 'train'],
  ['書', 'book'],
];

export const fakeEmbedder = (): Embedder => conceptEmbedder(CONCEPTS);

export const embedderFromEnv = (
  env: Record<string, string | undefined> = process.env,
): Embedder =>
  env['MEMORIES_EMBED'] === 'fake'
    ? fakeEmbedder()
    : ollamaEmbedder({
        ...(env['MEMORIES_OLLAMA_URL']
          ? { url: env['MEMORIES_OLLAMA_URL'] }
          : {}),
        ...(env['MEMORIES_EMBED_MODEL']
          ? { model: env['MEMORIES_EMBED_MODEL'] }
          : {}),
      });

let shared: ReturnType<typeof withQueryPriority> | undefined;

export const sharedEmbedders = () =>
  (shared ??= withQueryPriority(embedderFromEnv()));
```

Run: `pnpm nx test personal-memories -- src/lib/server/embed.test.ts`. Expected: PASS with `embed.test.ts` unmodified. If a case fails because `options.url` is `undefined` in an explicit `{ url: undefined }` call, change the wrapper to `url: options.url ?? process.env['MEMORIES_OLLAMA_URL'] ?? DEFAULT_URL` and keep the test unmodified.

- [ ] **Step 6: Swap the semantic tail in `search-index.ts`**

In `apps/personal-memories/src/lib/server/search-index.ts`:

- Delete the local `QUERY_EMBED_TIMEOUT_MS`, `BREAKER_MS`, `Breaker`, `breaker` and `embedQuery`, and add:

```ts
import {
  type Breaker,
  EmbedError,
  embedQuery,
  semanticIds,
} from '@rainforest-dev/search';

export {
  BREAKER_MS,
  type Breaker,
  breaker,
  QUERY_EMBED_TIMEOUT_MS,
} from '@rainforest-dev/search';
```

- Keep `import { type Embedder, type EmbedFailure } from './embed.ts';`, and drop `EmbedError` from that import because it now comes from the library.
- Replace the `return { ids: [...] }` at the end of `semanticRank` with:

```ts
return {
  ids: semanticIds({
    hits: [...fileHits, ...noteHits],
    minScore: embedder.minScore,
    k: SEMANTIC_K,
  }),
};
```

Run: `pnpm nx run-many -t test typecheck lint -p personal-memories`. Expected: PASS, golden snapshots unchanged.

- [ ] **Step 7: e2e and artifact smoke**

```bash
pnpm nx e2e personal-memories-e2e
pnpm nx smoke-artifact personal-memories
```

Expected: both pass. Both use fixture data and never the real data directory.

- [ ] **Step 8: Commit the swap**

```bash
git add apps/personal-memories pnpm-lock.yaml tsconfig.json
git commit -m "refactor(personal-memories): read the index and embed through libs/search

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Plain-node check**

```bash
pnpm nx build search
cd apps/personal-memories && env -u MEMORIES_DATA_DIR node src/cli/ingest.ts; echo "exit=$?"; cd -
```

Expected: `MEMORIES_DATA_DIR is not set; point it at the data root outside the repository.` and `exit=2`. `ERR_MODULE_NOT_FOUND` is a failure. This command never reaches any data.

- [ ] **Step 10: Open the PR**

Open the PR with the `rainforest-core:create-pr` skill. The body must state "no behaviour change", list the golden snapshot, and give the plain-node check output. The change is not visual.

---

### Task 3: web-ai controller and query parser; memories prompt-parse

**Files:**

- Create: `libs/web-ai/src/ai-controller.ts`, `src/query-parse.ts`, `src/query-language.ts`, `src/parse-status.ts`, `src/opt-in.ts`, with a `*.test.ts` for each
- Modify: `libs/web-ai/src/index.ts`
- Modify: `apps/personal-memories/src/components/chrome/prompt-parse.ts`, `usePromptParse.ts`
- Create: `apps/personal-memories/src/components/chrome/prompt-schema.ts`, `prompt-schema.test.ts`

**Interfaces:**

- Consumes: `acquire`, `detectCapability`, `enableModel`, `selectTool`, `LanguageOptions` and `AiState` from web-ai's existing modules.
- Produces, from `@rainforest-dev/web-ai`:
  - `createAiController(): AiController` with `getState(): AiState`, `subscribe(listener: () => void): () => void`, `refresh(languages?): Promise<AiState>`, `enable(languages?): Promise<void>`, `run<T>(prompt: string, schema: Record<string, unknown>, opts?: { signal?: AbortSignal; languages?: LanguageOptions }): Promise<T>`, `retain(): () => void`
  - `ParserSchema<T>`, `jsonSchemaOf(schema): Record<string, unknown>`, `PROMPT_TIMEOUT_MS = 1500`, `createQueryParser<T, Ctx>(config): QueryParser<T, Ctx>`, `ParseOutcome<T> = { value: T; status: 'ai' | 'ai-timeout' | 'local' }`, `AiCall = (jsonSchema: Record<string, unknown>, signal: AbortSignal) => Promise<unknown>`
  - `QueryLanguage`, `queryLanguage(raw)`, `languagesFor(lang: string): LanguageOptions`
  - `ParseStatus`, `statusFor(input)`
  - `optInSwitch(key: string): { read(storage); write(storage, on) }`

Steps 1–6 are test-first, one module per step, in this order: `query-language`, `opt-in`, `parse-status`, `query-parse`, `ai-controller`, barrel.

- [ ] **Step 1: `query-language`.** Move `queryLanguage`, `QueryLanguage` and `languagesFor` from `prompt-parse.ts`, with `languagesFor(lang: string): LanguageOptions` returning `{ input: [...new Set(['en', lang])], output: ['en'] }`. Their tests move from `prompt-parse.test.ts` (`describe('queryLanguage')`, `describe('languagesFor')`) to `query-language.test.ts`. Run `pnpm nx test web-ai -- src/query-language.test.ts`: fail, implement, pass.

- [ ] **Step 2: `opt-in`.** Test first:

```ts
import { describe, expect, it } from 'vitest';

import { optInSwitch } from './opt-in';

describe('optInSwitch', () => {
  const sw = optInSwitch('k');

  it('is on only for a stored 1', () => {
    localStorage.setItem('k', '1');
    expect(sw.read(localStorage)).toBe(true);
    localStorage.setItem('k', 'true');
    expect(sw.read(localStorage)).toBe(false);
  });

  it('writes and clears, and survives blocked storage', () => {
    sw.write(localStorage, true);
    expect(localStorage.getItem('k')).toBe('1');
    sw.write(localStorage, false);
    expect(localStorage.getItem('k')).toBeNull();
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(sw.read(blocked)).toBe(false);
    expect(() => sw.write(blocked, true)).not.toThrow();
  });
});
```

Implementation:

```ts
export function optInSwitch(key: string) {
  return {
    read(storage: Pick<Storage, 'getItem'> | undefined): boolean {
      try {
        return storage?.getItem(key) === '1';
      } catch {
        return false;
      }
    },
    write(
      storage: Pick<Storage, 'setItem' | 'removeItem'> | undefined,
      on: boolean,
    ): void {
      try {
        if (on) storage?.setItem(key, '1');
        else storage?.removeItem(key);
      } catch {
        return;
      }
    },
  };
}
```

- [ ] **Step 3: `parse-status`.** Move `ParseStatus` and `statusFor` verbatim from `prompt-parse.ts`, with `QueryLanguage` widened to `string` in `ParseStatus['unsupported-language'].lang` and in `statusFor`'s `lang`. Move the `describe('statusFor')` tests with them. Fail, implement, pass.

- [ ] **Step 4: `query-parse`.** Test first:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createQueryParser,
  jsonSchemaOf,
  type ParserSchema,
  PROMPT_TIMEOUT_MS,
} from './query-parse';

type Q = { text: string };

const schema: ParserSchema<Q> = {
  '~standard': {
    validate: (v) =>
      typeof (v as Q | null)?.text === 'string'
        ? { value: { text: (v as Q).text.trim() } }
        : { issues: [{ message: 'bad' }] },
    jsonSchema: {
      input: () => ({
        $schema: 'x',
        type: 'object',
        properties: { text: { type: 'string' } },
      }),
    },
  },
};

const parser = createQueryParser<Q, { n: number }>({
  schema: () => schema,
  sanitize: (out) => out,
  local: (raw, ctx) => ({ text: `local:${raw}:${ctx.n}` }),
});

afterEach(() => vi.useRealTimers());

describe('jsonSchemaOf', () => {
  it('drops the $schema key', () => {
    expect(jsonSchemaOf(schema)).toEqual({
      type: 'object',
      properties: { text: { type: 'string' } },
    });
  });
});

describe('createQueryParser', () => {
  it('uses a valid AI answer', async () => {
    expect(
      await parser.parse('x', { n: 1 }, async () => ({ text: ' ai ' })),
    ).toEqual({ value: { text: 'ai' }, status: 'ai' });
  });

  it('falls back locally without AI, on an invalid answer and on a rejection', async () => {
    expect(await parser.parse('x', { n: 1 }, undefined)).toEqual({
      value: { text: 'local:x:1' },
      status: 'local',
    });
    expect((await parser.parse('x', { n: 1 }, async () => ({}))).status).toBe(
      'local',
    );
    expect(
      (
        await parser.parse('x', { n: 1 }, async () => {
          throw new Error('no');
        })
      ).status,
    ).toBe('local');
  });

  it('passes the JSON Schema to the AI call', async () => {
    const ai = vi.fn(async () => ({ text: 'a' }));
    await parser.parse('x', { n: 1 }, ai);
    expect(ai.mock.calls[0]?.[0]).toEqual({
      type: 'object',
      properties: { text: { type: 'string' } },
    });
  });

  it('times out, aborts the call and falls back', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const pending = parser.parse('x', { n: 1 }, (_s, inner) => {
      signal = inner;
      return new Promise(() => undefined);
    });
    await vi.advanceTimersByTimeAsync(PROMPT_TIMEOUT_MS);
    expect(await pending).toEqual({
      value: { text: 'local:x:1' },
      status: 'ai-timeout',
    });
    expect(signal?.aborted).toBe(true);
  });

  it('aborts the AI call when the caller aborts', async () => {
    const outer = new AbortController();
    let signal: AbortSignal | undefined;
    const pending = parser.parse(
      'x',
      { n: 1 },
      (_s, inner) => {
        signal = inner;
        return new Promise((_, reject) =>
          inner.addEventListener('abort', () => reject(new Error('aborted'))),
        );
      },
      outer.signal,
    );
    outer.abort();
    expect((await pending).status).toBe('local');
    expect(signal?.aborted).toBe(true);
  });
});
```

Implementation:

```ts
type Validated<T> =
  | { readonly value: T; readonly issues?: undefined }
  | { readonly issues: readonly unknown[] };

export type ParserSchema<T> = {
  readonly '~standard': {
    readonly validate: (value: unknown) => Validated<T> | Promise<Validated<T>>;
    readonly jsonSchema: {
      readonly input: (options: {
        readonly target: string;
      }) => Record<string, unknown>;
    };
  };
};

export type ParseOutcome<T> = {
  value: T;
  status: 'ai' | 'ai-timeout' | 'local';
};

export type AiCall = (
  jsonSchema: Record<string, unknown>,
  signal: AbortSignal,
) => Promise<unknown>;

export const PROMPT_TIMEOUT_MS = 1500;

export function jsonSchemaOf(
  schema: ParserSchema<unknown>,
): Record<string, unknown> {
  const { $schema: _, ...rest } = schema['~standard'].jsonSchema.input({
    target: 'draft-2020-12',
  });
  return rest;
}

const TIMEOUT = Symbol('timeout');

export type QueryParser<T, Ctx> = {
  jsonSchema(ctx: Ctx): Record<string, unknown>;
  parse(
    raw: string,
    ctx: Ctx,
    ai: AiCall | undefined,
    signal?: AbortSignal,
  ): Promise<ParseOutcome<T>>;
};

export function createQueryParser<T, Ctx>(config: {
  schema(ctx: Ctx): ParserSchema<T>;
  sanitize?(output: unknown, ctx: Ctx): unknown;
  local(raw: string, ctx: Ctx): T;
  timeoutMs?: number;
}): QueryParser<T, Ctx> {
  const timeoutMs = config.timeoutMs ?? PROMPT_TIMEOUT_MS;
  const jsonSchema = (ctx: Ctx) =>
    jsonSchemaOf(config.schema(ctx) as ParserSchema<unknown>);
  return {
    jsonSchema,
    async parse(raw, ctx, ai, signal) {
      const local = () => config.local(raw, ctx);
      if (!ai) return { value: local(), status: 'local' };
      const controller = new AbortController();
      signal?.addEventListener('abort', () => controller.abort(), {
        once: true,
      });
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<typeof TIMEOUT>((resolve) => {
        timer = setTimeout(() => {
          controller.abort();
          resolve(TIMEOUT);
        }, timeoutMs);
      });
      try {
        const answer = await Promise.race([
          ai(jsonSchema(ctx), controller.signal),
          timeout,
        ]);
        if (answer === TIMEOUT) return { value: local(), status: 'ai-timeout' };
        const cleaned = config.sanitize ? config.sanitize(answer, ctx) : answer;
        const result = await config.schema(ctx)['~standard'].validate(cleaned);
        return result.issues
          ? { value: local(), status: 'local' }
          : { value: result.value, status: 'ai' };
      } catch {
        return { value: local(), status: 'local' };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
```

- [ ] **Step 5: `ai-controller`.** Test first, stubbing `LanguageModel` the way `language-model.test.ts` does (copy its `stubLanguageModel` helper and `afterEach`):

```ts
describe('createAiController', () => {
  it('reports capability and notifies subscribers', async () => {
    stubLanguageModel('available');
    const ai = createAiController();
    const seen: string[] = [];
    ai.subscribe(() => seen.push(ai.getState().kind));
    expect(ai.getState()).toEqual({ kind: 'unsupported' });
    await ai.refresh();
    expect(ai.getState()).toEqual({ kind: 'ready' });
    expect(seen).toEqual(['ready']);
  });

  it('reports download progress during enable, then ready', async () => {
    stubLanguageModel('downloadable');
    const create = vi.fn(async (opts: { monitor(m: EventTarget): void }) => {
      const target = new EventTarget();
      opts.monitor(target);
      target.dispatchEvent(
        Object.assign(new Event('downloadprogress'), { loaded: 1, total: 2 }),
      );
      return { prompt: vi.fn(), destroy: vi.fn() };
    });
    (
      globalThis as unknown as { LanguageModel: { create: unknown } }
    ).LanguageModel.create = create;
    const ai = createAiController();
    const seen: unknown[] = [];
    ai.subscribe(() => seen.push(ai.getState()));
    await ai.enable();
    expect(seen).toEqual([
      { kind: 'downloading', progress: 0 },
      { kind: 'downloading', progress: 0.5 },
      { kind: 'ready' },
    ]);
  });

  it('refreshes state and rethrows when a run fails', async () => {
    stubLanguageModel('available');
    const ai = createAiController();
    const refresh = vi.spyOn(ai, 'refresh');
    await expect(ai.run('p', {})).rejects.toBeDefined();
    expect(refresh).toHaveBeenCalled();
  });

  it('retains the shared session until released', () => {
    const ai = createAiController();
    const release = ai.retain();
    expect(typeof release).toBe('function');
    release();
    release();
  });
});
```

Implementation:

```ts
import {
  acquire,
  detectCapability,
  enableModel,
  type LanguageOptions,
  selectTool,
} from './language-model';
import type { AiState } from './types';

export type AiController = {
  getState(): AiState;
  subscribe(listener: () => void): () => void;
  refresh(languages?: LanguageOptions): Promise<AiState>;
  enable(languages?: LanguageOptions): Promise<void>;
  run<T>(
    prompt: string,
    schema: Record<string, unknown>,
    opts?: { signal?: AbortSignal; languages?: LanguageOptions },
  ): Promise<T>;
  retain(): () => void;
};

export function createAiController(): AiController {
  let state: AiState = { kind: 'unsupported' };
  const listeners = new Set<() => void>();
  const set = (next: AiState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  const controller: AiController = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async refresh(languages) {
      set(await detectCapability(languages));
      return state;
    },
    async enable(languages) {
      set({ kind: 'downloading', progress: 0 });
      try {
        await enableModel(
          (progress) => set({ kind: 'downloading', progress }),
          languages,
        );
        set({ kind: 'ready' });
      } catch (error) {
        await controller.refresh(languages);
        throw error;
      }
    },
    async run(prompt, schema, opts = {}) {
      try {
        return await selectTool(prompt, schema, opts);
      } catch (error) {
        await controller.refresh(opts.languages);
        throw error;
      }
    },
    retain: acquire,
  };
  return controller;
}
```

If the progress test sees a duplicate `{ downloading, 0 }`, the stub's event fired before `enable` set state. Keep the implementation and adjust only the stub's dispatch timing.

- [ ] **Step 6: Barrel, build, commit.** Append to `libs/web-ai/src/index.ts`, keeping exports sorted for `simple-import-sort`:

```ts
export * from './ai-controller';
export * from './opt-in';
export * from './parse-status';
export * from './query-language';
export * from './query-parse';
```

Run `pnpm nx run-many -t lint test typecheck build -p web-ai` (expected PASS) and commit `feat(web-ai): AI controller and query parser`.

- [ ] **Step 7: memories prompt-parse, step 1 (hand-written schema kept).** In `prompt-parse.ts`:
  - Delete `queryLanguage`, `QueryLanguage`, `languagesFor`, `ParseStatus` and `statusFor`, and re-export them from `@rainforest-dev/web-ai`, so `export { languagesFor, type ParseStatus, type QueryLanguage, queryLanguage, statusFor } from '@rainforest-dev/web-ai';` keeps every import site working.
  - `readSwitch` and `writeSwitch` become `const PROMPT_SWITCH = optInSwitch(PROMPT_PARSE_KEY); export const readSwitch = PROMPT_SWITCH.read; export const writeSwitch = PROMPT_SWITCH.write;`.
  - `parseWithFallback` keeps its signature and delegates:

```ts
const handWritten = (people: readonly Person[]): ParserSchema<SearchQuery> => ({
  '~standard': {
    validate: (value) => {
      const query = toSearchQuery(value, people);
      return query ? { value: query } : { issues: [{ message: 'invalid' }] };
    },
    jsonSchema: { input: () => promptSchema(people) },
  },
});

const parser = createQueryParser<
  SearchQuery,
  { today: string; people: readonly Person[] }
>({
  schema: ({ people }) => handWritten(people),
  local: (raw, { today, people }) => localParser(raw, today, people),
  timeoutMs: PROMPT_TIMEOUT_MS,
});

export async function parseWithFallback(
  raw: string,
  today: string,
  people: readonly Person[],
  ai: AiParse | undefined,
  signal?: AbortSignal,
): Promise<ParseResult> {
  const { value, status } = await parser.parse(
    raw,
    { today, people },
    ai ? (_schema, inner) => ai(raw, inner) : undefined,
    signal,
  );
  return { query: value, status };
}
```

Run `pnpm nx test personal-memories -- src/components/chrome/prompt-parse.test.ts` with the test file unmodified, except for the `describe` blocks that Steps 1 and 3 moved to web-ai. Expected: PASS. Commit `refactor(personal-memories): parse queries through the web-ai parser`.

- [ ] **Step 8: memories `usePromptParse` on the controller.** Replace the direct `acquire`, `detectCapability`, `enableModel` and `selectTool` imports:

```ts
const [ai] = useState(createAiController);
const aiState = useSyncExternalStore(ai.subscribe, ai.getState, ai.getState);
useEffect(
  () => (on && supported ? ai.retain() : undefined),
  [ai, on, supported],
);
```

- The capability query's `queryFn` becomes `() => ai.refresh(languagesFor(lang))`.
- The parse query's AI argument becomes `(text, inner) => ai.run(buildPrompt(text, today, people), promptSchema(people), { signal: inner, languages: languagesFor(lang) })`.
- In `toggle`, the download path becomes `await ai.enable(languages).catch(() => undefined)`, guarded by a local `enabling` state.
- `progress` becomes `enabling && aiState.kind === 'downloading' ? aiState.progress : undefined`.
- Everything else in the hook stays as it is.

Run `pnpm nx run-many -t test typecheck lint -p personal-memories` and `pnpm nx e2e personal-memories-e2e`. Expected: PASS. Then run the dev server (`pnpm nx dev personal-memories`) with `MEMORIES_DATA_DIR` pointing at the e2e fixture data. In Chromium with the Prompt API available, switch AI parsing on and confirm one zh and one en query report `AI 解析`. Without the Prompt API, record in the PR that only the fallback path was checked. Commit `refactor(personal-memories): drive prompt parsing from the AI controller`.

- [ ] **Step 9: memories prompt-parse, step 2 (zod schema).** Create `apps/personal-memories/src/components/chrome/prompt-schema.ts`:

```ts
import { z } from 'astro/zod';

import type { Person } from '@/lib/people.ts';
import type { SearchQuery } from '@/lib/search';

const MAX_TEXT = 200;
const SOURCES = ['line', 'slack', 'photo'] as const;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const day = z
  .string()
  .regex(DAY)
  .refine((s) => DATE.test(s));

export function promptQuerySchema(people: readonly Person[]) {
  const ids = people.map((p) => p.id);
  return z.object({
    text: z
      .string()
      .transform((t) => Array.from(t.trim()).slice(0, MAX_TEXT).join('')),
    range: z
      .object({ start: day, end: day })
      .refine((r) => r.start <= r.end)
      .optional(),
    ...(ids.length
      ? { people: z.array(z.enum(ids as [string, ...string[]])).optional() }
      : {}),
    sources: z.array(z.enum(SOURCES)).optional(),
  });
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function sanitizeAnswer(
  output: unknown,
  people: readonly Person[],
): unknown {
  if (!isRecord(output)) return output;
  const ids = new Set(people.map((p) => p.id));
  const keep = <T>(list: unknown, ok: (v: unknown) => v is T) =>
    Array.isArray(list) ? list.filter(ok) : [];
  const picked = keep(
    output['people'],
    (v): v is string => typeof v === 'string' && ids.has(v),
  );
  const sources = keep(output['sources'], (v): v is string =>
    (SOURCES as readonly unknown[]).includes(v),
  );
  const { people: _p, sources: _s, ...rest } = output;
  return {
    ...rest,
    ...(picked.length ? { people: picked } : {}),
    ...(sources.length ? { sources } : {}),
  };
}

export const toQuery = (
  output: unknown,
  people: readonly Person[],
): SearchQuery | undefined => {
  const parsed = promptQuerySchema(people).safeParse(
    sanitizeAnswer(output, people),
  );
  return parsed.success ? (parsed.data as SearchQuery) : undefined;
};
```

Create `prompt-schema.test.ts`. It pins the generated JSON Schema to today's hand-written one before anything switches:

```ts
import { jsonSchemaOf } from '@rainforest-dev/web-ai';
import { describe, expect, it } from 'vitest';

import type { Person } from '@/lib/people.ts';

import { promptSchema, toSearchQuery } from './prompt-parse.ts';
import { promptQuerySchema, toQuery } from './prompt-schema.ts';

const people = [
  { id: 'alice', name: 'Alice', aliases: {} },
  { id: 'bob', name: 'Bob', aliases: { line: ['Bobby'] } },
] as unknown as Person[];

describe('promptQuerySchema', () => {
  it('generates the same JSON Schema as the hand-written one', () => {
    expect(jsonSchemaOf(promptQuerySchema(people))).toEqual(
      promptSchema(people),
    );
    expect(jsonSchemaOf(promptQuerySchema([]))).toEqual(promptSchema([]));
  });

  it('validates like toSearchQuery', () => {
    const answers: unknown[] = [
      { text: ' 拉麵 ' },
      { text: 'x'.repeat(300) },
      { text: 'a', people: ['bob', 'carol'], sources: ['line', 'fax'] },
      { text: 'a', range: { start: '2025-11-01', end: '2025-11-30' } },
      { text: 'a', range: { start: '2025-11-30', end: '2025-11-01' } },
      { text: 'a', range: { start: '2025-13-01', end: '2025-13-02' } },
      { text: 'a', range: null },
      { text: 1 },
      null,
      { text: 'a', people: 'bob' },
      { text: 'a', extra: true },
    ];
    for (const answer of answers)
      expect(toQuery(answer, people)).toEqual(toSearchQuery(answer, people));
  });
});
```

Run `pnpm nx test personal-memories -- src/components/chrome/prompt-schema.test.ts`.

- **If both tests pass:** first move the hand-written `promptSchema` and `toSearchQuery` bodies into `prompt-schema.test.ts` as `legacyPromptSchema` and `legacyToSearchQuery`, and point both assertions at them, so the old behaviour stays the oracle. Then in `prompt-parse.ts`, make `promptSchema = (people) => jsonSchemaOf(promptQuerySchema(people))` and `toSearchQuery = toQuery`, delete `handWritten`, and build `parser` with `schema: ({ people }) => promptQuerySchema(people)` and `sanitize: (out, { people }) => sanitizeAnswer(out, people)`.
- **If the JSON Schema test fails and cannot be made equal** by adjusting `promptQuerySchema` (for example, `refine` leaking into the output): keep the hand-written `promptSchema`, pass it through `createQueryParser`'s schema wrapper as `jsonSchema.input`, and use `toQuery` for validation only. Record this in the PR and in the task's Tuning log.

Run `pnpm nx run-many -t test typecheck lint -p personal-memories` and `pnpm nx e2e personal-memories-e2e`. Expected: PASS. Repeat the Step 8 Chromium check. Commit `refactor(personal-memories): derive the prompt schema from zod`.

- [ ] **Step 10: Open the PR** with the `rainforest-core:create-pr` skill. Include before/after screenshots of the AI-parse switch and status line from the running app against fixture data, using `rainforest-core:capture-evidence` and `rainforest-core:attach-pr-media`. The UI should look identical, so the evidence shows that nothing changed.

---

### Tasks 4–9

These tasks build on library code that exists only after Tasks 1–3 merge. A run of each task note therefore starts by writing and committing its own step-level plan to `docs/superpowers/plans/2026-10-12-shared-search-<task>.md`, in this file's format, against the merged APIs. It then implements that plan. The acceptance criteria below are the contract. Every criterion names its verification.

#### Task 4: calibre `searchBookIds`, indexing and search route

- Add `"@rainforest-dev/search": "workspace:*"` to `apps/personal-calibre/package.json`.
- `lib/server/search/` (behind the `lib/server` barrel):
  - `env.ts` maps `CALIBRE_OLLAMA_URL`, `CALIBRE_EMBED_MODEL` and `CALIBRE_EMBED=fake` to an `Embedder | undefined`. `fake` uses `conceptEmbedder` with book-title concepts.
  - `docs.ts` builds the per-book text: title, authors, series, tags, and `comments` with HTML stripped and clipped to 1,000 characters. `contentHash` is `fnv1a`.
  - `index.ts` embeds missing rows in the background after `syncBooksFts` sees a new `last_modified`, through the background half of `withQueryPriority`, and writes with `writeIndexFiles(<app data dir>/search)`. Partial progress is written as memories' `buildIndex` does.
  - `query.ts` exports `searchBookIds(q): Promise<{ ids: number[]; semantic: 'on' | 'off'; reason?: string }>`.
- `app/api/books/search/route.ts` returns the first 20 of `searchBookIds`, plus `semantic` and `reason`.
- Acceptance:
  1. With no `CALIBRE_OLLAMA_URL`, every existing search test passes unmodified, and the response is today's plus `semantic: 'off'` (Vitest).
  2. With `CALIBRE_EMBED=fake`, a query sharing no characters with a title finds it through a concept (Vitest).
  3. With the embedder throwing `ollama-unreachable`, or timing out, or behind an open breaker, `ids` equals the lexical-only order exactly (Vitest).
  4. An index interrupted after one batch is resumed by the next sync without re-embedding the finished rows. Assert the embed call count (Vitest, temp directory).
  5. `pnpm nx run-many -t lint test typecheck build -p personal-calibre` and `pnpm nx smoke-artifact personal-calibre` pass.

#### Task 5: calibre list page, MCP `list_books`, e2e

- `buildBookConditions` uses `inArray(books.id, (await searchBookIds(q)).ids)` for queries of three or more characters, and today's `LIKE` below that. The list page passes its current sort explicitly.
- MCP `list_books`: with `query` and no `sortBy`, results follow relevance order. With `sortBy`, the matched books are sorted by that field. `groupBy` groups the matched books. Output adds `semantic` and `reason?`. The description is updated as the spec words it.
- Acceptance:
  1. The MCP tool test asserts relevance order without `sortBy`, field order with `sortBy`, `total` equal to the match count, and `semantic: 'off'` plus lexical-only order when the embedder fails (Vitest).
  2. The list page's order for a query is unchanged from today on the e2e fixture library (Playwright).
  3. calibre-e2e runs with `CALIBRE_EMBED=fake` and covers a semantic hit in the search box, plus the lexical fallback when the fake embedder is switched to fail (Playwright).
  4. The search box, the list page and MCP return the same book ids for the same three-or-more-character query (Vitest across the three entry points).
  5. Lint, test, typecheck, build, e2e and smoke-artifact pass. The PR has a screenshot of a semantic hit in the search box.

#### Task 6: rss-manager shared lexical

- `matchesSearch` and `matchesTopicSearch` use `whitespaceTerms(q)` and `matchesAllTerms(fields, terms)`.
- Acceptance:
  1. A table test of single-word queries, run against the old functions before the change and the new ones after, returns identical booleans. Include punctuation edges such as `c++` and `.net` (Vitest).
  2. `rust blog` matches a source named "Rust Blog" and also one named "Blog about Rust". Full-width `ｒｕｓｔ` matches (Vitest).
  3. rss-manager-e2e adds a multi-word desk search (Playwright).
  4. `pnpm nx run-many -t lint test typecheck build -p @rainforest-monorepo/rss-manager` and `pnpm nx smoke-artifact @rainforest-monorepo/rss-manager` pass.

#### Task 7: website W1 and guards

- `utils/search.ts` `scoreMatch` delegates to `tieredMatch`. `planExpansion` uses `planReuse` with `hashRecord`. `scripts/expand-search-keywords.ts` uses `assertModel` and `ollamaChat`, keeping its messages and env names. `utils/ai/use-language-model.ts` runs on `createAiController`. MCP `search_by_technology` uses `fold`.
- Guards:
  - `apps/personal-website/eslint.config.js` adds `no-restricted-imports` for `@rainforest-dev/search/node` on `src/**`. It has to repeat the root `../*` pattern in the same rule, because flat config replaces the rule rather than merging it.
  - A `build-output.test.ts` under `apps/personal-website/scripts/` scans the build output for the spec's patterns. It runs in CI after `build`, through a `check-output` target with `dependsOn: ["build"]`.
- Acceptance:
  1. Every existing `search.test.ts`, `search-expansions.test.ts` and freshness test passes unmodified. `search-expansions.json` is untouched (Vitest).
  2. Importing `@rainforest-dev/search/node` from any `src` file fails lint. Prove it once in the PR by temporarily adding the import (lint output).
  3. The output scan passes on a real build and fails when a fixture file containing `http://localhost:11434` is placed in the output directory (Vitest).
  4. `CommandPalette.test.ts` passes, and the palette works on a running `pnpm nx dev personal-website` (Playwright headless check of ⌘K results).
  5. `pnpm nx run-many -t lint test typecheck build -p personal-website` and `pnpm format:check` pass.

#### Task 8: website W1.5 offline semantic neighbours

- `scripts/build-search-neighbours.ts`:
  - Reads `OLLAMA_URL` and `OLLAMA_EMBED_MODEL` (default `embeddinggemma-2:440m-bf16-text-vision`).
  - Embeds records and the vocabulary through `ollamaEmbedder`, caching vectors in a gitignored `apps/personal-website/.cache/search-vectors/` through `readIndexFiles` / `writeIndexFiles` and `planReuse`.
  - Writes `src/data/search-neighbours.json` with `model`, `floor`, per-record hashes, a vocabulary hash, and `terms`.
- A `search-neighbours-freshness.test.ts` mirrors the expansions freshness test. A `search-neighbours.ts` runtime does the vocabulary lookup and the RRF fusion with `tieredMatch`, and `searchRecords` uses it.
- Calibrate the floor on the 30-query set from Task 9's design: the lowest score that keeps every hand-labelled neighbour in a sample of 20 terms. Write both into the PR.
- Acceptance:
  1. With Ollama unreachable, the script exits non-zero with the `assertModel` message, and the loop run stops as blocked (manual).
  2. The freshness test fails after a record's keywords change and passes after regeneration (Vitest).
  3. "資料庫" returns at least one record that neither lists the word nor has it in expansions (Vitest on the committed artifact).
  4. A one-character query performs no vocabulary lookup. Results equal `tieredMatch` plus expansions alone (Vitest).
  5. `search-neighbours.json` is under 100 KB, the guards from Task 7 still pass, and lint, test, typecheck and build pass.

#### Task 9: website W2 spike report

- Throwaway benchmark code lives outside the repository or in a scratch branch that is never merged. Candidates and gates are as in the spec. Document vectors come from transformers.js in Node, and queries from Playwright Chromium new-headless with WebGPU (WASM fallback recorded separately).
- Acceptance:
  1. `docs/superpowers/specs/2026-10-12-shared-search-w2-spike-report.md` reports each candidate's download size, p50 first and warm query latency, and the hit counts on the 30-query set against the W1 plus W1.5 baseline. It includes the query set and the method, and gives a clear adopt or reject decision on each gate.
  2. A draft blog post outline is in `apps/personal-website`'s blog content as a draft that does not publish. Its frontmatter makes it unpublished, in the format the blog collection already uses.
  3. No benchmark code is merged. `git diff --stat origin/main` lists only the two documents.
