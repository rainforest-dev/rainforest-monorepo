# Memories Content Search Implementation Plan

> **Status: done (2026-10-04).** All six slices shipped:
>
> 1. shared Prompt API core in `libs/web-ai` (#458);
> 2. pure search core (#459);
> 3. the search index built at ingest (#461);
> 4. content search in the jump box (#462);
> 5. opt-in Prompt API query parsing (#464);
> 6. day notes in search (#466).
>
> Follow-ups: #465 builds `web-ai` into the image, which #464 had broken. #467 loads the vectors
> without copying them. Spec: #440; this plan: #457.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Find a day in personal-memories by what happened in it — messages, day notes and photo
metadata, across languages — from the existing 「跳至日期」 box, with an opt-in Prompt API query
parser.

**Architecture:** Ingest turns timeline events into search documents and writes their
`embeddinggemma` vectors next to `timeline.json`. The Astro server keeps documents and vectors in
memory, ranks a query lexically and by cosine similarity, merges the two with RRF and groups the
result by day. The browser turns the raw query into a structured `SearchQuery` with the local
parser, or with the Chrome Prompt API when the owner switches it on, through a new
framework-free `libs/web-ai`.

**Tech Stack:** Astro 6 (SSR, node adapter), React 19 islands, `@rainforest-dev/rainforest-react`
(shadcn on Base UI), `astro/zod` (zod 4), `@tanstack/react-query` 5 (new in memories), Vitest 4,
Playwright, Ollama `/api/embed` with `embeddinggemma`, Chrome Prompt API
(`@types/dom-chromium-ai` 0.0.17).

**Spec:** `docs/superpowers/specs/2026-10-01-memories-content-search-design.md`

## Global Constraints

- The repository is public. Code, tests, fixtures, commit messages, PR bodies and screenshots use
  fixture names only (Alice, Bob, Carol, Dana). Every task ends with the privacy grep from the
  owner's task notes over `apps/personal-memories` and `apps/personal-memories-e2e`; it must
  print nothing. Never read or copy real memories data.
- Commits are signed (`commit.gpgsign=true`, pinentry-mac). If signing fails, stop and report;
  never pass `--no-gpg-sign` or `-c commit.gpgsign=false`.
- Commit trailers: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and the session's
  `Claude-Session:` line. PR bodies end with the Claude Code line and the session link.
- Imports follow CLAUDE.md `### Imports`: `@/` alias through barrels across directories, `./file`
  within one; `src/cli` and `src/lib/ingest` keep relative paths; server-only code lives under
  `lib/server`; Astro islands are imported by file.
- Comments follow the allow-list: public-API docstrings in `libs/web-ai`, one-line external
  constraints, lint-suppression reasons, `TODO(<ticket>)`. Run
  `git diff -U0 | grep -E '^\+\s*(//|/\*|\*|#)'` before each commit.
- Zod comes from `astro/zod` in the app; `libs/web-ai` has no zod dependency.
- No synchronous fs in the request path (#449): server code uses `node:fs/promises`.
- Values from the spec, verbatim: `embeddinggemma`, 768 dimensions; `MEMORIES_OLLAMA_URL`
  defaults to `http://localhost:11434` (the homelab sets `http://host.docker.internal:11434`);
  query embedding timeout 800 ms; circuit breaker 30 s; client debounce 250 ms; a query starts
  after one CJK character or two Latin letters; at most 20 days per response; RRF
  `score = Σ 1 / (60 + rank)`; chat chunks close after a 10-minute gap, 40 messages or 1,500
  characters; Prompt API fallback after 1.5 s; switch key `memories:prompt-parse`, off by default.
- Prompt API: Chrome 148 web API; `measureContextUsage`, `contextUsage`, `contextWindow`; no
  `temperature`/`topK` on the web; supported languages en, ja, es, de, fr.
- Each slice is one PR, a draft, with visual evidence when it changes what renders, from the
  running dev server on fixture data.

## Review Focus

1. **A query that is only a person** (「Bob」): `text` is empty after the parser takes the name.
   Expected: Bob's days, newest first, not an empty list and not every day. Pinned in Task 2.4
   (`localParser`) and Task 4.1 (`runSearch` with empty text).
2. **Full-width spaces and trailing punctuation** (「台南　麵！」, typed with a Chinese IME):
   expected to match like 「台南 麵」. Pinned in Task 2.1 (`queryTerms`).
3. **Ollama answering with the wrong vector length, `NaN`, or an HTML error page**: expected
   lexical results and `reason: 'model-mismatch'` or `'ollama-unreachable'`, never a 500. Pinned
   in Task 3.3 (`embed.ts`) and Task 4.1.
4. **A pasted paragraph as the query** (thousands of characters): expected the first 200
   characters to be used, no oversized URL, no 500. Pinned in Task 4.2 (`/search.json` schema)
   and Task 4.4 (client clamp).
5. **Typing through an IME**: expected no request while composition is in progress, one request
   after it ends. Pinned in Task 4.4 (`shouldSearch`).

## File Structure

```
libs/web-ai/                                   new library (slice 1)
  package.json, tsconfig*.json, vite.config.ts copied from libs/personal-data's shape
  src/index.ts          public API
  src/probe.ts          withProbeTimeout (moved from the website)
  src/types.ts          AiState, ToolDescriptor (moved)
  src/language-model.ts detectCapability/enableModel/selectTool/acquire (moved, + language options)
  src/*.test.ts         moved tests + language tests

apps/personal-website/src/utils/ai/
  language-model.ts, probe.ts, types.ts        deleted (moved)
  index.ts                                     re-exports from @rainforest-dev/web-ai
  use-language-model.ts                        imports from @rainforest-dev/web-ai

apps/personal-memories/src/
  lib/search/                                  pure, client-safe (slice 2)
    index.ts            barrel
    query.ts            SearchQuery, SEARCH_QUERY_JSON_SCHEMA, localParser
    terms.ts            queryTerms
    lexical.ts          lexicalRank
    vector.ts           topK, cosine helpers
    rrf.ts              rrf
    docs.ts             SearchDoc type, chunkChats, photoDoc, noteDoc, contentHash (slice 3)
  lib/server/
    embed.ts            Ollama embedder, fake embedder, circuit breaker (slice 3)
    search-files.ts     read/write docs.json + vectors.text.bin (slice 3)
    search-index.ts     getSearchIndex, runSearch (slice 4)
    note-vectors.ts     background note embedding (slice 6)
  lib/ingest/photos.ts  keeps labels, OCR, venues, place, persons (slice 3)
  cli/ingest.ts         writes the search files (slice 3)
  pages/search.json.ts  (slice 4)
  components/chrome/
    useContentSearch.ts  TanStack Query hook (slice 4)
    ContentResults.tsx   「內容」 group (slice 4)
    usePromptParse.ts    switch state, probe, parser choice (slice 5)
    AiParseSwitch.tsx    switch + status line (slice 5)
    DateJump.tsx         wires the above
    AppBar.tsx           QueryClientProvider (slice 4)
```

---

## Slice 1 — `libs/web-ai` (one PR)

### Task 1.1: Create the library and move the Prompt API core

**Files:**

- Create: `libs/web-ai/package.json`, `libs/web-ai/tsconfig.json`, `libs/web-ai/tsconfig.lib.json`,
  `libs/web-ai/vite.config.ts`, `libs/web-ai/src/index.ts`
- Move (with `git mv`): `apps/personal-website/src/utils/ai/{probe,types,language-model}.ts` and
  `language-model.test.ts` → `libs/web-ai/src/`
- Modify: `apps/personal-website/src/utils/ai/index.ts`,
  `apps/personal-website/src/utils/ai/use-language-model.ts`, any other website file importing
  the moved modules (find them with
  `grep -rn "ai/language-model\|ai/probe\|ai/types\|from './language-model'\|from './probe'\|from './types'" apps/personal-website/src`),
  `apps/personal-website/package.json`

**Interfaces:**

- Produces: package `@rainforest-dev/web-ai` exporting `AiState`, `ToolDescriptor`,
  `PROBE_TIMEOUT_MS`, `withProbeTimeout`, `detectCapability`, `enableModel`, `selectTool`,
  `destroy`, `acquire`, `RUN_TIMEOUT_MS`, `__resetForTests`. Signatures unchanged in this task.

- [ ] **Step 1: Scaffold with the Nx generator.** Invoke the `nx-generate` skill first (CLAUDE.md
      requires it for scaffolding) and generate a buildable Vite TS library at `libs/web-ai` named
      `web-ai`, importPath `@rainforest-dev/web-ai`, test runner Vitest with `jsdom`. Then align
      `package.json` `exports`, `files`, `type` and `nx` fields with `libs/personal-data/package.json`
      (single `.` entry). Add `"@types/dom-chromium-ai": "0.0.17"` to its `devDependencies`, and
      `"types": ["dom-chromium-ai"]` (or the triple-slash the website uses today — copy whichever
      `apps/personal-website` uses) so `LanguageModel` type-checks.
- [ ] **Step 2: Move the files** with `git mv` so history follows them. Fix the moved files'
      relative imports (`./probe`, `./types` stay relative inside `libs/*`).
- [ ] **Step 3: Write `libs/web-ai/src/index.ts`:**

```ts
export * from './language-model';
export * from './probe';
export * from './types';
```

- [ ] **Step 4: Point the website at the library.** Add
      `"@rainforest-dev/web-ai": "workspace:*"` to `apps/personal-website/package.json`
      dependencies, bump its `@types/dom-chromium-ai` to `0.0.17`, run `pnpm install`, and replace
      the moved exports in `apps/personal-website/src/utils/ai/index.ts` with
      `export { … } from '@rainforest-dev/web-ai';` keeping every name the file exported before.
      Update `use-language-model.ts` and any other importer to import from
      `@rainforest-dev/web-ai`.
- [ ] **Step 5: Run.** `pnpm nx sync`, then
      `pnpm nx run-many -t lint test typecheck build -p web-ai personal-website`. Expected: all pass;
      the moved `language-model.test.ts` passes from its new home. Type errors from 0.0.17 renames
      (`measureInputUsage`, `inputUsage`, `inputQuota`) are fixed by switching to
      `measureContextUsage`, `contextUsage`, `contextWindow`.
- [ ] **Step 6: Verify in dev, not only build** (CLAUDE.md: a green `astro build` says nothing
      about `astro dev`). Run `pnpm nx dev personal-website`, open `/` and the edge-AI blog demo
      page, open the ⌘K palette; expected: no console errors, the AI capability control renders as
      before.
- [ ] **Step 7: Commit.**

```bash
git add libs/web-ai apps/personal-website pnpm-lock.yaml tsconfig.base.json
git commit -m "refactor(web-ai): move the Prompt API core out of personal-website"
```

### Task 1.2: Language-aware probe and session

**Files:**

- Modify: `libs/web-ai/src/language-model.ts`, `libs/web-ai/src/index.ts`
- Test: `libs/web-ai/src/language-model.test.ts`

**Interfaces:**

- Consumes: Task 1.1 exports.
- Produces:
  - `type LanguageOptions = { input: string[]; output: string[] }`
  - `detectCapability(languages?: LanguageOptions): Promise<AiState>` — passes
    `{ expectedInputs: [{ type: 'text', languages: input }], expectedOutputs: [{ type: 'text', languages: output }] }`
    to `LanguageModel.availability()` when given; unchanged without it.
  - `enableModel(onProgress?, languages?: LanguageOptions): Promise<void>` — passes the same
    options to `LanguageModel.create()`; if a session exists with different languages it is
    destroyed and recreated.
  - `selectTool<T>(query, schema, opts?: { signal?: AbortSignal; languages?: LanguageOptions }): Promise<T>`

- [ ] **Step 1: Write the failing tests** in `language-model.test.ts`, using the stub pattern the
      file already uses for `LanguageModel`:

```ts
it('probes availability with the requested languages', async () => {
  const availability = vi.fn().mockResolvedValue('unavailable');
  vi.stubGlobal('LanguageModel', { availability, create: vi.fn() });
  await expect(
    detectCapability({ input: ['en', 'zh'], output: ['en'] }),
  ).resolves.toEqual({ kind: 'unavailable' });
  expect(availability).toHaveBeenCalledWith({
    expectedInputs: [{ type: 'text', languages: ['en', 'zh'] }],
    expectedOutputs: [{ type: 'text', languages: ['en'] }],
  });
});

it('recreates the session when the languages change', async () => {
  const destroyA = vi.fn();
  const create = vi
    .fn()
    .mockResolvedValueOnce({ prompt: vi.fn(), destroy: destroyA })
    .mockResolvedValueOnce({ prompt: vi.fn(), destroy: vi.fn() });
  vi.stubGlobal('LanguageModel', {
    availability: vi.fn().mockResolvedValue('available'),
    create,
  });
  await enableModel(undefined, { input: ['en'], output: ['en'] });
  await enableModel(undefined, { input: ['en', 'ja'], output: ['en'] });
  expect(destroyA).toHaveBeenCalledOnce();
  expect(create).toHaveBeenLastCalledWith(
    expect.objectContaining({
      expectedInputs: [{ type: 'text', languages: ['en', 'ja'] }],
    }),
  );
});

it('reports unsupported where LanguageModel is undefined', async () => {
  vi.stubGlobal('LanguageModel', undefined);
  await expect(
    detectCapability({ input: ['en'], output: ['en'] }),
  ).resolves.toEqual({ kind: 'unsupported' });
});
```

- [ ] **Step 2: Run** `pnpm nx test web-ai`. Expected: the first two FAIL (options not passed).
- [ ] **Step 3: Implement.** Add near the top of `language-model.ts`:

```ts
export type LanguageOptions = { input: string[]; output: string[] };

const expected = (languages?: LanguageOptions) =>
  languages
    ? {
        expectedInputs: [{ type: 'text' as const, languages: languages.input }],
        expectedOutputs: [
          { type: 'text' as const, languages: languages.output },
        ],
      }
    : {};

const sameLanguages = (a?: LanguageOptions, b?: LanguageOptions) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

let sessionLanguages: LanguageOptions | undefined;
```

In `detectCapability(languages?)` call
`LanguageModel.availability(expected(languages))`. In `enableModel(onProgress, languages?)`:
if `session` exists and `!sameLanguages(sessionLanguages, languages)`, call `destroy()` first;
pass `{ ...expected(languages), monitor… }` to `create()`; set `sessionLanguages = languages`
after success. Clear `sessionLanguages` in `destroy()` and `__resetForTests()`. Thread
`opts.languages` from `selectTool` into `ensureSession` → `enableModel(undefined, languages)`.
Export `LanguageOptions` from `index.ts`.

- [ ] **Step 4: Run** `pnpm nx run-many -t lint test typecheck -p web-ai personal-website`.
      Expected: PASS; the website's behaviour is unchanged because it passes no languages.
- [ ] **Step 5: Commit** `feat(web-ai): probe and open sessions for the query's languages`.
- [ ] **Step 6: PR.** Title `refactor(web-ai): share the Prompt API core with memories`. Visual
      evidence: not applicable (no rendered change; dev-server check from Task 1.1 Step 6 recorded in
      the body). Message the coordinator when CI is green.

---

## Slice 2 — `lib/search` pure core (one PR)

All files under `apps/personal-memories/src/lib/search/` are pure and client-safe. `lib/index.ts`
does not re-export them; consumers import `@/lib/search`. Inside `lib/search`, never import the
ancestor barrel `@/lib`: import the file itself (`@/lib/natural-date.ts`, `@/lib/people.ts`,
`@/lib/weeks.ts`), per CLAUDE.md `### Imports`. `import type` from `@/lib/server` (a sibling
directory) is fine.

### Task 2.1: `queryTerms`

**Files:** Create `lib/search/terms.ts`, `lib/search/terms.test.ts`

**Interfaces:** Produces `queryTerms(text: string): string[]` — lower-cased, NFKC-normalised
terms split on any whitespace (including U+3000), trailing/leading punctuation stripped, empties
dropped, duplicates removed.

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest';

import { queryTerms } from './terms.ts';

describe('queryTerms', () => {
  it('splits on any whitespace, including the ideographic space', () => {
    expect(queryTerms('台南 麵')).toEqual(['台南', '麵']);
    expect(queryTerms('台南　麵')).toEqual(['台南', '麵']);
  });

  it('drops punctuation at the edges and normalises width and case', () => {
    expect(queryTerms('拉麵！')).toEqual(['拉麵']);
    expect(queryTerms('ＲＡＭＥＮ, noodle?')).toEqual(['ramen', 'noodle']);
  });

  it('returns nothing for blank or punctuation-only input', () => {
    expect(queryTerms('   ')).toEqual([]);
    expect(queryTerms('！？')).toEqual([]);
  });

  it('removes duplicates', () => {
    expect(queryTerms('麵 麵')).toEqual(['麵']);
  });
});
```

- [ ] **Step 2: Run** `pnpm nx test personal-memories -- src/lib/search/terms.test.ts` → FAIL.
- [ ] **Step 3: Implement**

```ts
const EDGE = /^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu;

export function queryTerms(text: string): string[] {
  const terms = text
    .normalize('NFKC')
    .toLowerCase()
    .split(/\s+/u)
    .map((t) => t.replace(EDGE, ''))
    .filter(Boolean);
  return [...new Set(terms)];
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(personal-memories): split search queries into terms`.

### Task 2.2: `lexicalRank`

**Files:** Create `lib/search/docs.ts` (type only in this task), `lib/search/lexical.ts`,
`lib/search/lexical.test.ts`

**Interfaces:**

- Produces in `docs.ts`:

```ts
import type { TimelineSource } from '@/lib/server';

export type SearchDocKind = 'chat' | 'photo' | 'note';

export type SearchDoc = {
  id: string;
  day: string;
  kind: SearchDocKind;
  source: TimelineSource | 'note';
  text: string;
  snippet: string;
  people: string[];
  places: string[];
  eventIds: string[];
  contentHash: string;
};
```

(`import type` from `@/lib/server` is type-only, so it does not pull server code into the
client bundle and does not count as an import cycle.)

- Produces in `lexical.ts`: `lexicalRank(docs: readonly SearchDoc[], terms: readonly string[]): string[]`
  — ids of docs where every term is a substring of `text.normalize('NFKC').toLowerCase()` or of a
  facet (`people` ids, `places`, lower-cased); ordered by facet hits desc, then number of term
  occurrences desc, then `day` desc, then `id`. Empty `terms` returns `[]`.

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest';

import type { SearchDoc } from './docs.ts';
import { lexicalRank } from './lexical.ts';

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
  contentHash: id,
  ...extra,
});

describe('lexicalRank', () => {
  const docs = [
    doc('a', '2025-11-01', '09:00 Bob：台南的牛肉麵'),
    doc('b', '2025-11-02', '10:00 Alice：麵 麵 麵'),
    doc('c', '2025-11-03', '11:00 Bob：台北'),
    doc('d', '2025-11-04', 'labels: Ramen', {
      kind: 'photo',
      source: 'photo',
      places: ['台南'],
    }),
  ];

  it('requires every term', () => {
    expect(lexicalRank(docs, ['台南', '麵'])).toEqual(['a']);
  });

  it('matches facets as well as text, and ranks facet hits first', () => {
    expect(lexicalRank(docs, ['台南'])).toEqual(['d', 'a']);
  });

  it('orders by occurrences, then newest day', () => {
    expect(lexicalRank(docs, ['麵'])).toEqual(['b', 'a']);
  });

  it('is case and width insensitive', () => {
    expect(lexicalRank(docs, ['ramen'])).toEqual(['d']);
  });

  it('returns nothing without terms', () => {
    expect(lexicalRank(docs, [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

```ts
import type { SearchDoc } from './docs.ts';

const fold = (s: string) => s.normalize('NFKC').toLowerCase();

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

export function lexicalRank(
  docs: readonly SearchDoc[],
  terms: readonly string[],
): string[] {
  if (terms.length === 0) return [];
  const scored: { doc: SearchDoc; facets: number; hits: number }[] = [];
  for (const doc of docs) {
    const text = fold(doc.text);
    const facets = [...doc.people, ...doc.places].map(fold);
    let facetHits = 0;
    let hits = 0;
    let all = true;
    for (const term of terms) {
      const inFacet = facets.some((f) => f.includes(term));
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
        y.doc.day.localeCompare(x.doc.day) ||
        x.doc.id.localeCompare(y.doc.id),
    )
    .map((s) => s.doc.id);
}
```

- [ ] **Step 4: Run** → PASS (run prettier). **Step 5: Commit** `feat(personal-memories): rank search docs by every query term`.

### Task 2.3: `topK` and `rrf`

**Files:** Create `lib/search/vector.ts`, `lib/search/rrf.ts`, and their tests.

**Interfaces:**

- `topK(vectors: Float32Array, dims: number, query: Float32Array, k: number, allow?: (row: number) => boolean): { row: number; score: number }[]`
  — cosine similarity (rows and query need not be normalised), highest first, ties by lower row;
  rows where `allow` returns false are skipped; a zero-norm query returns `[]`.
- `rrf(rankings: readonly (readonly string[])[], k = 60): Map<string, number>` — `Σ 1/(k + rank)`
  with 1-based ranks.

- [ ] **Step 1: Failing tests**

```ts
// vector.test.ts
import { describe, expect, it } from 'vitest';
import { topK } from './vector.ts';

const rows = new Float32Array([1, 0, 0, 1, 1, 1, 0, 0]); // 4 rows × 2 dims; row 3 is zero

describe('topK', () => {
  it('ranks by cosine, highest first, ties by row', () => {
    expect(
      topK(rows, 2, new Float32Array([1, 0]), 2).map((r) => r.row),
    ).toEqual([0, 2]);
    expect(topK(rows, 2, new Float32Array([1, 1]), 1)[0]?.row).toBe(2);
  });
  it('skips rows the filter rejects and zero rows', () => {
    expect(
      topK(rows, 2, new Float32Array([1, 0]), 4, (r) => r !== 0).map(
        (r) => r.row,
      ),
    ).toEqual([2, 1]);
  });
  it('returns nothing for a zero query', () => {
    expect(topK(rows, 2, new Float32Array([0, 0]), 4)).toEqual([]);
  });
});

// rrf.test.ts
import { describe, expect, it } from 'vitest';
import { rrf } from './rrf.ts';

describe('rrf', () => {
  it('rewards a doc that ranks in both lists', () => {
    const s = rrf([
      ['a', 'b'],
      ['b', 'c'],
    ]);
    expect([...s].sort((x, y) => y[1] - x[1])[0]?.[0]).toBe('b');
    expect(s.get('a')).toBeCloseTo(1 / 61);
    expect(s.get('b')).toBeCloseTo(1 / 62 + 1 / 61);
  });
  it('handles one list and empty lists', () => {
    expect([...rrf([['a']]).keys()]).toEqual(['a']);
    expect(rrf([[], []]).size).toBe(0);
  });
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

```ts
// vector.ts
export function topK(
  vectors: Float32Array,
  dims: number,
  query: Float32Array,
  k: number,
  allow: (row: number) => boolean = () => true,
): { row: number; score: number }[] {
  let qn = 0;
  for (let d = 0; d < dims; d++) qn += (query[d] ?? 0) ** 2;
  if (qn === 0) return [];
  const out: { row: number; score: number }[] = [];
  const count = Math.floor(vectors.length / dims);
  for (let row = 0; row < count; row++) {
    if (!allow(row)) continue;
    let dot = 0;
    let rn = 0;
    for (let d = 0; d < dims; d++) {
      const v = vectors[row * dims + d] ?? 0;
      dot += v * (query[d] ?? 0);
      rn += v * v;
    }
    if (rn === 0) continue;
    out.push({ row, score: dot / Math.sqrt(qn * rn) });
  }
  return out.sort((a, b) => b.score - a.score || a.row - b.row).slice(0, k);
}

// rrf.ts
export function rrf(
  rankings: readonly (readonly string[])[],
  k = 60,
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const ranking of rankings)
    ranking.forEach((id, i) =>
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + i + 1)),
    );
  return scores;
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(personal-memories): add cosine top-k and rank fusion`.

### Task 2.4: `SearchQuery` and `localParser`

**Files:** Create `lib/search/query.ts`, `lib/search/query.test.ts`, `lib/search/index.ts`

**Interfaces:**

- Consumes: `parseDateQuery(raw, today): DateRange | undefined` from `@/lib/natural-date.ts`
  (#427); `Person` from `@/lib/people.ts` (#439); `TimelineSource` type from `@/lib/server`.
- Produces:

```ts
export type SearchQuery = {
  text: string;
  range?: { start: string; end: string };
  people?: string[];
  sources?: TimelineSource[];
};

export const SEARCH_QUERY_JSON_SCHEMA: Record<string, unknown>; // used by slice 5
export function localParser(
  raw: string,
  today: string,
  people: readonly Person[],
): SearchQuery;
```

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest';

import type { Person } from '@/lib/people.ts';

import { localParser } from './query.ts';

const PEOPLE: Person[] = [
  { id: 'bob', name: 'Bob', aliases: { line: ['Bobby'] } },
  { id: 'dana', name: 'Dana', aliases: {} },
];
const TODAY = '2026-10-01';

describe('localParser', () => {
  it('takes a leading date phrase as the range and leaves the rest as text', () => {
    expect(localParser('去年中秋 吃麵', TODAY, PEOPLE)).toEqual({
      text: '吃麵',
      range: { start: '2025-10-06', end: '2025-10-06' },
    });
  });

  it('takes a known name or alias as a person and drops 說的', () => {
    expect(localParser('Bob 說的拉麵', TODAY, PEOPLE)).toEqual({
      text: '拉麵',
      people: ['bob'],
    });
    expect(localParser('Bobby 拉麵', TODAY, PEOPLE)).toEqual({
      text: '拉麵',
      people: ['bob'],
    });
  });

  it('accepts a person on their own, leaving empty text', () => {
    expect(localParser('Bob', TODAY, PEOPLE)).toEqual({
      text: '',
      people: ['bob'],
    });
  });

  it('keeps everything as text when nothing is recognised', () => {
    expect(localParser('吃麵那天', TODAY, PEOPLE)).toEqual({
      text: '吃麵那天',
    });
  });

  it('accepts a date phrase on its own', () => {
    expect(localParser('上個月', TODAY, PEOPLE)).toEqual({
      text: '',
      range: { start: '2026-09-01', end: '2026-09-30' },
    });
  });
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Tokenise on whitespace; take the longest prefix of tokens (joined
      without spaces) that `parseDateQuery` accepts as the range; remove tokens that equal a person's
      `name` or any alias on any source (case-insensitive), collecting ids; strip a leading or
      trailing `說的`/`的` from the remaining text; join the rest with one space.

```ts
import { z } from 'astro/zod';

import { parseDateQuery } from '@/lib/natural-date.ts';
import type { Person } from '@/lib/people.ts';
import type { TimelineSource } from '@/lib/server';

export type SearchQuery = {
  text: string;
  range?: { start: string; end: string };
  people?: string[];
  sources?: TimelineSource[];
};

export const searchQuerySchema = z.object({
  text: z.string().max(200),
  range: z.object({ start: z.iso.date(), end: z.iso.date() }).optional(),
  people: z.array(z.string()).optional(),
  sources: z.array(z.enum(['line', 'slack', 'photo'])).optional(),
});

export const SEARCH_QUERY_JSON_SCHEMA = z.toJSONSchema(searchQuerySchema);

const FILLER = /^(說的|的)|(說的|的)$/g;

function personId(
  token: string,
  people: readonly Person[],
): string | undefined {
  const t = token.toLowerCase();
  return people.find(
    (p) =>
      p.name.toLowerCase() === t ||
      Object.values(p.aliases).some((list) =>
        list?.some((a) => a.toLowerCase() === t),
      ),
  )?.id;
}

export function localParser(
  raw: string,
  today: string,
  people: readonly Person[],
): SearchQuery {
  const tokens = raw.trim().split(/\s+/u).filter(Boolean);
  const query: SearchQuery = { text: '' };
  let start = 0;
  for (let end = tokens.length; end > 0; end--) {
    const range = parseDateQuery(tokens.slice(0, end).join(''), today);
    if (range) {
      query.range = range;
      start = end;
      break;
    }
  }
  const ids: string[] = [];
  const rest: string[] = [];
  for (const token of tokens.slice(start)) {
    const id = personId(token, people);
    if (id) {
      if (!ids.includes(id)) ids.push(id);
    } else rest.push(token);
  }
  if (ids.length) query.people = ids;
  query.text = rest.join(' ').replace(FILLER, '').trim();
  return query;
}
```

`lib/search/index.ts`:

```ts
export * from './docs.ts';
export * from './lexical.ts';
export * from './query.ts';
export * from './rrf.ts';
export * from './terms.ts';
export * from './vector.ts';
```

Check `z.iso.date()` and `z.toJSONSchema` exist in the resolved `astro/zod` (zod 4):
`node -e "import('astro/zod').then(m=>console.log(typeof m.z.toJSONSchema, typeof m.z.iso.date))"`
from `apps/personal-memories`. If either is missing, use `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`
and a hand-written JSON schema object with the same shape.

- [ ] **Step 4: Run** `pnpm nx run-many -t lint test typecheck -p personal-memories` → PASS.
- [ ] **Step 5: Commit** `feat(personal-memories): parse search queries into date, people and text`.
- [ ] **Step 6: PR** `feat(personal-memories): pure search core`. Visual evidence: not
      applicable (no UI). Message the coordinator when CI is green.

---

## Slice 3 — documents, embeddings and ingest (one PR)

### Task 3.1: Keep the Photos search metadata on photo events

**Files:**

- Modify: `src/lib/server/timeline.ts` (add `PhotoMeta`), `src/lib/ingest/photos.ts`,
  `src/lib/ingest/__fixtures__/photos.ts`
- Test: `src/lib/ingest/photos.test.ts`

**Interfaces:**

- Produces in `timeline.ts`:

```ts
export type PhotoMeta = {
  labels?: string[];
  text?: string[];
  venues?: string[];
  place?: string;
  persons?: string[];
};
```

and `PhotoSignals` gains `meta?: PhotoMeta`. Empty arrays and empty strings are omitted.

- Shapes from osxphotos 0.77.2 (checked 2026-10-04, keys and types only): `search_info.labels`,
  `search_info.detected_text`, `search_info.venues` are `string[]`; `place` is
  `{ name: string, … }`; `persons` is `string[]`.

- [ ] **Step 1: Failing test** — add a fixture item with
      `search_info: { labels: ['Ramen', 'Food'], detected_text: ['MENU'], venues: ['Noodle Bar'] }`,
      `place: { name: 'Tainan' }`, `persons: ['Bob']`, and assert the event's
      `photo.meta` equals `{ labels: ['Ramen', 'Food'], text: ['MENU'], venues: ['Noodle Bar'], place: 'Tainan', persons: ['Bob'] }`;
      assert an item without those fields has no `meta`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — extend `OsxPhoto` with
      `search_info?: { labels?: string[] | null; detected_text?: string[] | null; venues?: string[] | null } | null`
      and `place?: { name?: string | null } | null`; build `meta` with a helper that drops empties;
      set `photo.meta` only when non-empty. Add the same fields to the fixture's first photo so later
      slices can search it (`labels: ['Ramen']`).
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(personal-memories): keep Photos labels, text, venues and place`.

### Task 3.2: Search documents

**Files:** Modify `src/lib/search/docs.ts`; Test `src/lib/search/docs.test.ts`

**Interfaces:**

- Consumes: `SearchDoc` (Task 2.2), `TimelineEvent` (type, `@/lib/server`), `Person`, `nameOf`,
  `personOf` from `@/lib/people.ts`, `taipeiTime` from `@/lib/weeks.ts`.
- Produces:

```ts
export const CHUNK_GAP_MS = 10 * 60 * 1000;
export const CHUNK_MAX_MESSAGES = 40;
export const CHUNK_MAX_CHARS = 1500;
export function contentHash(text: string): string; // FNV-1a hex, stable
export function chatDocs(
  events: readonly TimelineEvent[],
  people: readonly Person[],
): SearchDoc[];
export function photoDocs(
  events: readonly TimelineEvent[],
  people: readonly Person[],
): SearchDoc[];
export function noteDoc(
  date: string,
  body: string,
  annotations: readonly { body: string }[],
): SearchDoc | undefined;
export function buildSearchDocs(
  events: readonly TimelineEvent[],
  people: readonly Person[],
): SearchDoc[];
```

Chat doc: `id` = `chat:<first event id>`; `day` from the first event's `at`; `source` the
events' source; each line `HH:MM <display name>：<text>`; `snippet` = the longest line's text
part (≤ 80 chars); `people` = ids of configured authors; chunk key = source, plus `event.chat`
when present (Task 3.5). Photo doc: `id` = `photo:<event id>`; text
`labels: …｜文字: …｜場所: …｜地點: …｜人物: …｜相簿: …` with absent parts left out; `people` =
ids resolved from `meta.persons` via the `photo` aliases; `places` = `[meta.place]` plus
`meta.venues`. Note doc: `id` = `note:<date>`; text = body plus annotation bodies; `undefined`
when empty.

- [ ] **Step 1: Failing tests** covering: two messages 9 minutes apart share a chunk, 11 minutes
      apart do not; the 41st message and the message that would pass 1,500 characters start new
      chunks; a different source starts a new chunk; display names come from people
      (`Bobby` on LINE → `Bob`); photo text order and omission of absent parts; `contentHash` stable
      for equal text and different for different text; `noteDoc` returns undefined for blank notes.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** with the constants above and
      `taipeiTime` from `@/lib/weeks.ts` for `HH:MM`. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(personal-memories): turn chats, photos and notes into search docs`.

### Task 3.3: Embedder

**Files:** Create `src/lib/server/embed.ts`, `src/lib/server/embed.test.ts`; export from
`src/lib/server/index.ts`.

**Interfaces:**

```ts
export type Embedder = {
  model: string;
  dims: number;
  embed(texts: string[], kind: 'query' | 'document', signal?: AbortSignal): Promise<Float32Array[]>;
};
export class EmbedError extends Error {
  constructor(readonly reason: 'ollama-unreachable' | 'timeout' | 'model-mismatch', message: string);
}
export function ollamaEmbedder(opts?: { url?: string; model?: string; dims?: number; fetch?: typeof fetch }): Embedder;
export function fakeEmbedder(): Embedder;       // deterministic concept vectors for tests and e2e
export function embedderFromEnv(env?: Record<string, string | undefined>): Embedder;
```

- `url` default `process.env['MEMORIES_OLLAMA_URL'] ?? 'http://localhost:11434'`; model
  `embeddinggemma`; dims 768.
- Prefixes: query `task: search result | query: ${text}`, document
  `title: none | text: ${text}`. **Verify first**: read the EmbeddingGemma model card (Ollama
  library page or the Hugging Face card) and confirm both strings; record the source in the PR
  body. If they differ, use the card's strings.
- POST `${url}/api/embed` with `{ model, input }`; a network error or non-2xx →
  `EmbedError('ollama-unreachable')`; non-JSON body → `'ollama-unreachable'`; any vector whose
  length ≠ `dims` or containing a non-finite number → `'model-mismatch'`.
- `fakeEmbedder()`: dims 8; dimension `i` is 1 when the folded text contains any word of
  concept `i`: `[['麵','ramen','noodle'],['海','beach','sea'],['貓','cat'],['咖啡','coffee'],['生日','birthday','cake'],['雨','rain'],['車','car','train'],['書','book']]`;
  otherwise 0. `embedderFromEnv` returns it when `MEMORIES_EMBED === 'fake'`.

- [ ] **Step 1: Failing tests** with an injected `fetch`: sends the prefixed input; maps a
      rejected fetch and a 502 to `ollama-unreachable`; maps an HTML body to `ollama-unreachable`; maps
      a 767-length vector and a `NaN` to `model-mismatch`; `fakeEmbedder` gives 「吃麵」 and
      `labels: Ramen` the same non-zero dimension.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(personal-memories): embed text through Ollama, with a fake for tests`.

### Task 3.4: Search files

**Files:** Create `src/lib/server/search-files.ts`, `src/lib/server/search-files.test.ts`

**Interfaces:**

```ts
export type SearchFileHeader = {
  model: string;
  dims: number;
  docs: { id: string; contentHash: string }[];
};
export const searchDir = (root: string) => join(root, 'search');
export async function readSearchFiles(
  root: string,
): Promise<{ header: SearchFileHeader; vectors: Float32Array } | undefined>;
export async function writeSearchFiles(
  root: string,
  header: SearchFileHeader,
  vectors: Float32Array,
): Promise<void>;
export function reuseVectors(
  previous: { header: SearchFileHeader; vectors: Float32Array } | undefined,
  docs: readonly { id: string; contentHash: string }[],
  model: string,
  dims: number,
): { vectors: Float32Array; missing: number[] }; // rows still to embed
```

Little-endian float32, `docs.length × dims`, written atomically (write `*.tmp`, then `rename`).
`readSearchFiles` returns `undefined` when either file is missing or the byte length is not
`docs.length × dims × 4`. `reuseVectors` copies a previous row only when id, hash, model and dims
all match.

- [ ] **Steps:** failing tests (round trip; truncated vector file → undefined; reuse copies only
      matching rows and lists the rest) → FAIL → implement with `node:fs/promises` → PASS → commit
      `feat(personal-memories): store search vectors next to the timeline`.

### Task 3.5: Ingest writes the index; chat id check

**Files:** Modify `src/cli/ingest.ts`, `src/cli/ingest.test.ts` (create if absent),
`src/lib/ingest/line.ts`, `src/lib/ingest/slack.ts`, `src/lib/server/timeline.ts`, `README.md`

- [ ] **Step 1: Chat id check (time-boxed to one step).** `ingest` already parses LINE one file at
      a time and Slack one channel directory at a time. If adding an optional `chat?: string` to
      `TimelineEvent` (LINE: file name without extension; Slack: channel directory name) touches only
      the two parsers and `makeEvent`, add it, include it in the chunk key in `chatDocs`, and add a
      test that two chats in the same minutes produce two chunks. If it needs more than that, skip it
      and say so in the PR body; the spec accepts shared chunks.
- [ ] **Step 2: Failing test** for a new exported `buildIndex(root, timeline, embedder, log)`:
      with the fixture timeline and `fakeEmbedder`, it writes `search/docs.json` and
      `search/vectors.text.bin`; a second run with nothing changed embeds zero docs (assert the
      embedder spy was not called); it logs `photos: no labels in N photos — re-export with osxphotos 0.77.2`
      when every photo event lacks `meta.labels` and there is at least one photo.
- [ ] **Step 3: Implement** `buildIndex`: `buildSearchDocs` with `loadPeople(root)` people →
      `readSearchFiles` → `reuseVectors` → embed missing rows in batches of 64 with `kind: 'document'`
      → `writeSearchFiles`. Call it from the CLI after `timeline.json` is written, with
      `embedderFromEnv()`. If embedding throws `EmbedError`, log
      `search: embeddings skipped (<reason>); lexical search still works` and keep the previous files.
      Relative imports only (`src/cli` runs under plain `node`).
- [ ] **Step 4: README.** In the Photos section, pin the export command exactly as the spec
      writes it:

```bash
uvx osxphotos@0.77.2 query --json \
  --library "$HOME/Pictures/Photos Library.photoslibrary" \
  --from-date <the start date of the current export> \
  >| "$MEMORIES_DATA_DIR/photos/index.json"
```

and add a "Search index" paragraph: what `search/` holds, that ingest needs
`MEMORIES_OLLAMA_URL` reachable, and that it only re-embeds changed docs.

- [ ] **Step 5: Run** `pnpm nx run-many -t lint test typecheck -p personal-memories` and
      `node apps/personal-memories/src/cli/fixture.ts <tmp>` with `MEMORIES_EMBED=fake`; expected: the
      log shows the search line and `<tmp>/search/` holds both files.
- [ ] **Step 6: Commit** `feat(personal-memories): write the search index during ingest`.
- [ ] **Step 7: PR** `feat(personal-memories): build the content search index at ingest`. The body
      repeats the osxphotos command above and says the owner must re-export before photo search is
      useful. Visual evidence: not applicable (no UI). Message the coordinator when CI is green.

---

## Slice 4 — `/search.json` and the 「內容」 group (one PR)

### Task 4.1: `runSearch`

**Files:** Create `src/lib/server/search-index.ts`, `src/lib/server/search-index.test.ts`

**Interfaces:**

```ts
export type SearchResult = {
  kind: 'content';
  date: string;
  score: number;
  snippet: string;
  source: SearchDoc['source'];
};
export type SearchResponse = {
  results: SearchResult[];
  semantic: 'on' | 'off';
  reason?: 'ollama-unreachable' | 'timeout' | 'model-mismatch' | 'no-index';
  stale?: number;
};
export type SearchIndex = {
  docs: SearchDoc[];
  rowOf: Map<string, number>;
  vectors?: Float32Array;
  model?: string;
  dims?: number;
  stale: number;
};
export function makeIndex(
  docs: SearchDoc[],
  files?: { header: SearchFileHeader; vectors: Float32Array },
): SearchIndex;
export async function runSearch(
  index: SearchIndex,
  query: SearchQuery,
  embedder: Embedder,
  breaker: Breaker,
): Promise<SearchResponse>;
export type Breaker = { open(now: number): boolean; trip(now: number): void };
export function breaker(ms = 30_000): Breaker;
```

Behaviour:

- Filter docs by `range` (inclusive), `people` (any id in `doc.people`), `sources`.
- `terms = queryTerms(query.text)`. With no terms: if `people` or `range` filtered the docs,
  return those docs' days newest first (snippet from the first doc of each day), `semantic: 'off'`
  without a reason; otherwise return `[]`.
- Lexical: `lexicalRank(filtered, terms)`.
- Semantic: skipped with `reason: 'no-index'` when `index.vectors` is absent; with
  `'model-mismatch'` when `index.model`/`dims` differ from the embedder's; skipped while the
  breaker is open (`'timeout'`). Otherwise embed `[query.text]` as `'query'` with an 800 ms
  `AbortSignal.timeout`; on `EmbedError` use its reason, on timeout use `'timeout'` and trip the
  breaker; else `topK` over rows whose doc passed the filter and whose hash is current, k = 50.
- Fuse with `rrf([lexical, semanticIds])`, group by `day` keeping each day's best doc, sort by
  score desc then day desc, take 20.
- `makeIndex` sets `stale` to the number of docs whose id is in the file but with a different
  hash, plus docs absent from the file.

- [ ] **Step 1: Failing tests** with `fakeEmbedder()` and hand-built docs: cross-language hit
      (「吃麵」 finds a photo doc `labels: Ramen` with no lexical match); a doc matching both ways
      outranks one matching one way; `no-index`, `model-mismatch` (index dims 4 vs embedder 8),
      `ollama-unreachable` (embedder throwing `EmbedError`), a NaN vector (embedder returning it →
      `model-mismatch`), and `timeout` (embedder that never resolves; use fake timers) each still
      return the lexical results with the right `reason`; after a timeout the breaker skips the
      embedder for 30 s; **empty text with `people: ['bob']` returns Bob's days newest first**;
      results cap at 20 and group by day; `stale` counts changed docs.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(personal-memories): rank, fuse and group content search results`.

### Task 4.2: `/search.json`

**Files:** Modify `src/lib/server/search-index.ts` (add `getSearchIndex`); Create
`src/pages/search.json.ts`; Test `src/lib/server/search-route.test.ts`

**Interfaces:**

- `getSearchIndex(): Promise<SearchIndex | undefined>` — builds docs from `getTimeline()` and
  `getPeople()`, loads `readSearchFiles(dataDir())`, caches by the vector file's `mtimeMs`
  (`stat` from `node:fs/promises`), rebuilds when the timeline object changes.
- `export async function handleSearch(url: URL, deps: { index: () => Promise<SearchIndex | undefined>; embedder: Embedder; breaker: Breaker }): Promise<Response>`
  — parses `q`, `from`, `to`, `people`, `sources` with `searchQuerySchema` after mapping
  `q` → `text`, `from`/`to` → `range`, comma lists → arrays; **`q` longer than 200 characters →
  400**; invalid dates → 400; no timeline → `200 { results: [], semantic: 'off', reason: 'no-index' }`.
  `Cache-Control: private, no-cache` like `days.json.ts`.

- [ ] **Steps:** failing tests for 400 on a 201-character `q`, 400 on `from=2025-13-01`, the
      no-timeline response, and a happy path → FAIL → implement `handleSearch` and the page
      (`export const GET: APIRoute = ({ url }) => handleSearch(url, { index: getSearchIndex, embedder, breaker })`
      with module-level `embedderFromEnv()` and `breaker()`) → PASS → commit
      `feat(personal-memories): serve content search at /search.json`.

### Task 4.3: Fixture content for search

**Files:** Modify `src/cli/fixture.ts`

- [ ] Add a LINE day `2025-11-04` with `Bob\t台南的拉麵好好吃` and `Alice\t下次再去`, and make the
      fixture's first photo carry `search_info.labels: ['Ramen']` (Task 3.1). Run the fixture writer
      with `MEMORIES_EMBED=fake` so it also writes `search/`. Update any e2e test that counts days or
      events and breaks; record each such change in the commit body.
- [ ] Commit `test(personal-memories): add searchable fixture content`.

### Task 4.4: The 「內容」 group

**Files:**

- Modify: `apps/personal-memories/package.json` (add `@tanstack/react-query` at the latest 5.x),
  `src/components/chrome/AppBar.tsx` (wrap in `QueryClientProvider` with one module-level
  `QueryClient`), `src/components/chrome/DateJump.tsx`
- Create: `src/pages/people.json.ts`, `src/components/chrome/useContentSearch.ts`,
  `src/components/chrome/ContentResults.tsx`,
  `src/components/chrome/content-search.ts` (pure helpers), `src/components/chrome/content-search.test.ts`

**Interfaces:**

```ts
// content-search.ts (pure)
export const MAX_QUERY = 200;
export function shouldSearch(text: string, composing: boolean): boolean; // false while composing; ≥1 CJK char or ≥2 Latin letters
export function searchUrl(q: SearchQuery): string; // '/search.json?q=…&from=…&to=…&people=…'
// useContentSearch.ts
export function useContentSearch(
  query: SearchQuery | undefined,
  composing: boolean,
): {
  results: SearchResult[];
  semantic: 'on' | 'off';
  reason?: SearchResponse['reason'];
  loading: boolean;
  error: boolean;
};
```

`useContentSearch` debounces the query by 250 ms, clamps `text` to `MAX_QUERY`, and uses
`useQuery({ queryKey: ['search', url], queryFn: ({ signal }) => fetch(url, { signal }).then(…), enabled: shouldSearch(…), staleTime: 60_000 })`.
`DateJump` parses the input with `localParser(query, today, people)`. People come from a new
`src/pages/people.json.ts` returning `publicPeople(getPeople())` (never emails), fetched with
`useQuery({ queryKey: ['people'], staleTime: Infinity })`; `days.json` keeps its shape because an
e2e test reads it directly. `DateJump` then renders `<ContentResults>` after the date groups: one `CommandGroup heading="內容"`,
each item `dayHeading(date)` plus the snippet in `text-muted-foreground`, `onSelect → onGo(date, false)`.
When `semantic === 'off'` with a reason, one line above the group:
「語意搜尋暫時無法使用，只顯示字面相符的結果」.

- [ ] **Step 1: Failing unit tests** for `shouldSearch` (`'麵'` true, `'a'` false, `'ab'` true,
      anything while composing false) and `searchUrl` (encodes CJK, omits absent parts, clamps to 200).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the helpers, the hook, the component and the
      wiring. Pass `composing` from the input's `onCompositionStart/End`.
- [ ] **Step 4: E2E** in `apps/personal-memories-e2e/src/search.spec.ts`, with the e2e web server
      env gaining `MEMORIES_EMBED: 'fake'` in `playwright.config.ts`:
  - 「拉麵」 shows a 「內容」 item for 2025-11-04 with 台南的拉麵 in its snippet; Enter goes to
    `/day/2025-11-04`.
  - 「吃麵」 also finds 2025-11-01 (the photo labelled `Ramen`), through the fake embedder.
  - 「2025 聖誕節」 still shows the date fallback (no regression from #427).
  - 「Bob」 lists days with Bob's LINE and Slack messages.
  - With `page.route('**/search.json*', …)` fulfilling
    `{ results: [...], semantic: 'off', reason: 'ollama-unreachable' }`, the degradation line shows.
- [ ] **Step 5: Run** `pnpm nx run-many -t lint test typecheck -p personal-memories personal-memories-e2e`
      and `pnpm nx e2e personal-memories-e2e` → PASS.
- [ ] **Step 6: Commit** `feat(personal-memories): show content results in the jump box`.
- [ ] **Step 7: PR** `feat(personal-memories): content search in the jump box`. Visual evidence,
      after-only (new feature), desktop and 390 px: the jump box with 「拉麵」, with 「吃麵」 (photo hit),
      and the degradation line. Also note in the body that the homelab needs
      `MEMORIES_OLLAMA_URL=http://host.docker.internal:11434` in the Terraform module (other repo);
      tell the coordinator. Message the coordinator when CI is green.

---

## Slice 5 — the AI parsing switch (one PR)

### Task 5.1: Parser choice

**Files:** Add `"@rainforest-dev/web-ai": "workspace:*"` to `apps/personal-memories/package.json`;
create `src/components/chrome/prompt-parse.ts`, `prompt-parse.test.ts`, `usePromptParse.ts`

**Interfaces:**

```ts
// prompt-parse.ts (pure)
export const PROMPT_PARSE_KEY = 'memories:prompt-parse';
export const PROMPT_TIMEOUT_MS = 1500;
export const queryLanguage = (raw: string): 'zh' | 'en';      // CJK → zh
export type ParseStatus =
  | { kind: 'off' }
  | { kind: 'unsupported-browser' }
  | { kind: 'unsupported-language'; lang: 'zh' | 'en' }
  | { kind: 'downloading'; progress: number }
  | { kind: 'ai' }
  | { kind: 'ai-timeout' };
export const statusText: (s: ParseStatus) => string;
export function readSwitch(storage: Pick<Storage, 'getItem'> | undefined): boolean;   // try/catch → false
export async function parseWithFallback(
  raw: string, today: string, people: readonly Person[],
  ai: ((raw: string, signal: AbortSignal) => Promise<unknown>) | undefined,
): Promise<{ query: SearchQuery; status: 'ai' | 'ai-timeout' | 'local' }>;
```

`statusText`: `unsupported-browser` → 「這個瀏覽器沒有內建 AI 模型，使用內建解析」;
`unsupported-language` with `zh` → 「AI 模型還不支援中文，這次用內建解析」;
`downloading` → 「下載 AI 模型 N%」; `ai` → 「AI 解析」; `ai-timeout` → 「AI 解析逾時，改用內建解析」.
`parseWithFallback` aborts the AI call after `PROMPT_TIMEOUT_MS`, validates its output with
`searchQuerySchema.safeParse`, and returns `localParser`'s result on timeout, rejection or
invalid output.

`usePromptParse(raw)` reads the switch with `readSwitch(globalThis.localStorage)`, writes it on
toggle (wrapped in try/catch), probes
`detectCapability({ input: ['en', lang], output: ['en'] })` from `@rainforest-dev/web-ai` for the
query's language, calls `enableModel(onProgress, languages)` from the switch's click handler
only (the user gesture), and when status is `available` passes
`(raw, signal) => selectTool(prompt(raw, today), SEARCH_QUERY_JSON_SCHEMA, { signal, languages })`
to `parseWithFallback`. The English system prompt names the fields and says to keep `text` to the
words that are not a date or a person. Calls `acquire()` while on and releases on toggle-off and
unmount.

- [ ] **Step 1: Failing tests** for `queryLanguage`, `readSwitch` (throwing storage → false;
      `'1'` → true), `statusText` for each kind, and `parseWithFallback` (AI result used when valid;
      invalid output → local; never-resolving AI with fake timers → local after 1.5 s with
      `ai-timeout`; no AI → local).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(personal-memories): choose between AI and built-in query parsing`.

### Task 5.2: The switch

**Files:** Create `src/components/chrome/AiParseSwitch.tsx`; Modify `DateJump.tsx`

- [ ] **Step 1: Implement.** A footer row in the dialog: rainforest-react `Switch` labelled
      「AI 解析查詢（實驗）」 and, under it, `text-muted-foreground text-xs` status text from
      `statusText`. Disabled with the unsupported-browser text when `LanguageModel` is undefined.
      `DateJump` uses `usePromptParse(query)`'s `SearchQuery` instead of calling `localParser`
      directly.
- [ ] **Step 2: E2E** in `search.spec.ts`:
  - Real Chromium (no `LanguageModel`): the switch is disabled and the status reads
    「這個瀏覽器沒有內建 AI 模型，使用內建解析」; 「拉麵」 still finds 2025-11-04.
  - With `page.addInitScript` defining a stub `LanguageModel` whose `availability` returns
    `'available'` for `['en','en']` and `'unavailable'` when `zh` is requested, and whose
    `prompt` returns `JSON.stringify({ text: 'ramen' })`: switching on, typing `ramen please`
    shows 「AI 解析」; typing 「拉麵」 shows 「AI 模型還不支援中文，這次用內建解析」; reloading keeps
    the switch on (per-browser persistence).
  - A stub whose `prompt` never resolves shows 「AI 解析逾時，改用內建解析」 and still returns
    results.
- [ ] **Step 3: Run** all checks → PASS. **Step 4: Commit**
      `feat(personal-memories): add the opt-in AI parsing switch`.
- [ ] **Step 5: PR** `feat(personal-memories): opt-in Prompt API query parsing`. Visual evidence,
      after-only: the switch off, on with 「AI 模型還不支援中文」 on a Chinese query, and on with
      「AI 解析」 on an English query using the stub (say in the caption that the model is stubbed,
      since Playwright's Chromium has no built-in model). Message the coordinator when CI is green.

---

## Slice 6 — notes in search (one PR)

### Task 6.1: Background note vectors

**Files:** Create `src/lib/server/note-vectors.ts`, `note-vectors.test.ts`; Modify
`src/lib/server/search-index.ts`, `src/actions/index.ts`

**Interfaces:**

```ts
export type NoteVectors = {
  docs(): SearchDoc[];
  vector(id: string): Float32Array | undefined;
  refresh(date: string): Promise<void>; // re-embed one note after a save
  start(): Promise<void>; // embed every note, in the background
};
export function noteVectors(
  store: NotesStore | undefined,
  embedder: Embedder,
): NoteVectors;
export function getNoteVectors(): NoteVectors; // process singleton; start() kicked off once, not awaited
```

`start()` reads `store.dates()` and each note through `store.read`, builds `noteDoc`, embeds in
batches of 16 as `'document'`, and keeps vectors in a `Map` keyed by doc id with the
`contentHash` they were built from; a failed batch leaves those notes lexical-only. `refresh`
re-reads one date and re-embeds only when the hash changed. `runSearch` takes note docs and
their vectors alongside the index (extend `SearchIndex` with an optional
`extra: { docs: SearchDoc[]; vector(id): Float32Array | undefined }`). `saveNote` calls
`getNoteVectors().refresh(date)` without awaiting it after a successful write.

- [ ] **Step 1: Failing tests** with an in-memory `NotesStore` stub and `fakeEmbedder`: notes
      become searchable after `start()`; a failing embedder leaves them lexically searchable;
      `refresh` re-embeds a changed note and not an unchanged one; `runSearch` returns a note day for
      「拉麵」.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** with async fs only. **Step 4: Run** → PASS.
- [ ] **Step 5: E2E**: write 「今天吃了拉麵」 in the 2025-10-31 note through the panel, open the jump
      box, type 「拉麵」, and expect 2025-10-31 in the 「內容」 group (poll; the refresh is
      asynchronous).
- [ ] **Step 6: Commit** `feat(personal-memories): search day notes`.
- [ ] **Step 7: PR** `feat(personal-memories): include day notes in content search`. Visual
      evidence, after-only: the jump box showing a note hit. Message the coordinator when CI is green.

---

## Self-review record

- Spec coverage: decisions 1–10, Data (SearchDoc, files, photos metadata and command, prompts),
  Query flow, Query parsing and the switch, Failure handling table (every row has a test in Task
  4.1 or 6.1), Testing (unit, fake embedder, e2e scenarios, privacy guard) and the six slices
  each map to the tasks above.
- Deviation to confirm with the coordinator: the spec names TanStack Query; memories had no data
  library, so Task 4.4 adds `@tanstack/react-query` and a `QueryClientProvider` in `AppBar`.
- Type names used across tasks: `SearchDoc`, `SearchQuery`, `searchQuerySchema`,
  `SEARCH_QUERY_JSON_SCHEMA`, `Embedder`, `EmbedError`, `SearchFileHeader`, `SearchIndex`,
  `SearchResponse`, `Breaker`, `NoteVectors`, `LanguageOptions`.
