# Reading Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rank unread Readwise documents against personal context (profile MCP technologies, wiki page maturity, active RSS topic coverage) and render the result as a sortable Reading Queue tab in `apps/rss-manager`.

**Architecture:** A vault skill does all the joining and writes one artifact, `_system/reading-queue.json`. `rss-manager` reads that file through its existing `VAULT_PATH` mount and renders it. The app gains no credentials, no network calls, and no new mounts. Tier assignment lives in the skill because it needs MCP and wiki access; within-tier sorting lives in the app because it is numeric comparison over data already in the artifact.

**Tech Stack:** Astro 6 (SSR, `@astrojs/node`), React 19 islands, Tailwind 4, Vitest 3 (node environment), plus a markdown skill with an embedded Python scoring script in the Obsidian vault.

**Spec:** `docs/superpowers/specs/2026-08-11-reading-queue-design.md`

---

## Two repositories

This plan spans two repos. Tasks 1–6 are in the **public** monorepo; Task 7 is in the **private** vault.

| Tasks | Repo                            | Path                                                                          |
| ----- | ------------------------------- | ----------------------------------------------------------------------------- |
| 1–6   | `rainforest-monorepo` (PUBLIC)  | current worktree                                                              |
| 7     | `rainforest-obsidian` (private) | `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/rainforest-obsidian` |

**Privacy rule, non-negotiable:** the fixture committed in Task 1 goes into the public repo. Every title, URL, and id in it must be invented. Never paste real Readwise documents into the monorepo. Real reading data lives only in `_system/reading-queue.json` inside the private vault.

---

## File Structure

| File                                                          | Responsibility                                                                            |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `apps/rss-manager/src/lib/fixtures/reading-queue.sample.json` | The contract. Synthetic. Cited by the skill as its output shape.                          |
| `apps/rss-manager/src/lib/readingQueue.ts`                    | **Browser-safe.** Types, `parseReadingQueue`, `sortQueue`, `SORT_MODES`. No node imports. |
| `apps/rss-manager/src/lib/readingQueueFile.ts`                | **Server-only.** `readReadingQueue()` — the only thing that touches `node:fs`.            |
| `apps/rss-manager/src/lib/readingQueue.test.ts`               | Covers both modules                                                                       |
| `apps/rss-manager/src/pages/api/reading-queue.ts`             | `GET` endpoint, same shape as `api/sources.ts`                                            |
| `apps/rss-manager/src/components/ReadingQueue.tsx`            | React island: sort controls, Queue panel, Stale panel                                     |
| `apps/rss-manager/src/pages/index.astro`                      | Register the `queue` tab                                                                  |
| `<vault>/ai-resources/claude-skills/reading-queue/SKILL.md`   | The skill                                                                                 |

**Why the module is split in two.** `ReadingQueue.tsx` runs with `client:load`, so everything it imports is bundled for the browser. `registry.ts` imports `node:fs` at module top level — importing it, or anything importing it, from an island would pull filesystem code into the client bundle. This is why `SourceTable.tsx` re-declares its own local `Source` type instead of importing from `registry.ts`.

Duplicating the types the same way is not an option here, because the _comparators_ must be shared: they are tested in `lib` and executed in the component, and a copy in the component would be untestable and would drift. So the file IO is isolated in `readingQueueFile.ts` and everything pure stays in `readingQueue.ts`.

`vitest.config.ts` uses `environment: 'node'` with `include: ['src/**/*.test.ts']` — `.tsx` files do not match that glob and there is no jsdom, so **anything placed in the component cannot be tested.** Keep the component to fetch, render, and calling the exported comparators.

---

## Task 1: The contract fixture and the parser

**Files:**

- Create: `apps/rss-manager/src/lib/fixtures/reading-queue.sample.json`
- Create: `apps/rss-manager/src/lib/readingQueue.ts`
- Test: `apps/rss-manager/src/lib/readingQueue.test.ts`

- [ ] **Step 1: Create the synthetic fixture**

Every id is `fixture-*`, every domain is a reserved example domain. The four queue items are built so that each sort mode in Task 3 produces a _different_ order — that is what makes the comparator tests meaningful.

Create `apps/rss-manager/src/lib/fixtures/reading-queue.sample.json`:

```json
{
  "generated": "2026-01-15",
  "cutoffMonths": 12,
  "counts": { "scanned": 9, "queued": 4, "stale": 3 },
  "queue": [
    {
      "rank": 1,
      "tier": 1,
      "id": "fixture-0001",
      "title": "Half-Read Guide to Widget Testing",
      "readerUrl": "https://read.readwise.io/read/fixture-0001",
      "sourceUrl": "https://example.com/widget-testing",
      "siteName": "example.com",
      "tags": ["tech/widget"],
      "why": "35% read, opened recently — cheap finish",
      "sort": {
        "profileRank": 1,
        "wikiSources": 8,
        "readingMinutes": 20,
        "savedDaysAgo": 5,
        "progress": 0.35
      }
    },
    {
      "rank": 2,
      "tier": 2,
      "id": "fixture-0002",
      "title": "Widget Framework 4.2 Release Notes",
      "readerUrl": "https://read.readwise.io/read/fixture-0002",
      "sourceUrl": "https://example.com/widget-4-2",
      "siteName": "example.com",
      "tags": ["tech/widget"],
      "why": "profile-prioritized · mature wiki page · no active topic feeding it",
      "sort": {
        "profileRank": 0,
        "wikiSources": 12,
        "readingMinutes": 9,
        "savedDaysAgo": 30,
        "progress": 0
      }
    },
    {
      "rank": 3,
      "tier": 3,
      "id": "fixture-0003",
      "title": "An Introduction to Sprocket Design",
      "readerUrl": "https://read.readwise.io/read/fixture-0003",
      "sourceUrl": "https://example.org/sprocket-intro",
      "siteName": "example.org",
      "tags": ["design-system"],
      "why": "stub wiki page — one source from being useful",
      "sort": {
        "profileRank": 2,
        "wikiSources": 1,
        "readingMinutes": 4,
        "savedDaysAgo": 120,
        "progress": 0
      }
    },
    {
      "rank": 4,
      "tier": 4,
      "id": "fixture-0004",
      "title": "Quarterly Gadget Industry Roundup",
      "readerUrl": "https://read.readwise.io/read/fixture-0004",
      "sourceUrl": "https://example.net/gadget-roundup",
      "siteName": "example.net",
      "tags": ["domain/gadget"],
      "why": "active topic already covered by a mature page",
      "sort": {
        "profileRank": 2,
        "wikiSources": 30,
        "readingMinutes": 45,
        "savedDaysAgo": 2,
        "progress": 0
      }
    }
  ],
  "stale": [
    {
      "id": "fixture-0005",
      "title": "Finished but Never Filed",
      "reason": "done-unfiled",
      "savedAt": "2025-11-02",
      "readerUrl": "https://read.readwise.io/read/fixture-0005"
    },
    {
      "id": "fixture-0006",
      "title": "Saved in 2023 and Never Opened",
      "reason": "never-opened-stale",
      "savedAt": "2023-04-18",
      "readerUrl": "https://read.readwise.io/read/fixture-0006"
    },
    {
      "id": "fixture-0007",
      "title": "Deferred to Later and Forgotten",
      "reason": "deferred-dead",
      "savedAt": "2025-06-01",
      "readerUrl": "https://read.readwise.io/read/fixture-0007"
    }
  ]
}
```

- [ ] **Step 2: Write the failing test**

`resolveJsonModule` is `false` in `tsconfig.base.json`, so the fixture cannot be imported — read it with `readFileSync`. Existing tests import source modules with a `.js` extension; match that.

Create `apps/rss-manager/src/lib/readingQueue.test.ts`:

```typescript
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { parseReadingQueue } from './readingQueue.js';

const FIXTURE = readFileSync(
  new URL('./fixtures/reading-queue.sample.json', import.meta.url),
  'utf-8',
);

describe('parseReadingQueue', () => {
  it('parses the sample fixture', () => {
    const result = parseReadingQueue(FIXTURE);
    expect(result.generated).toBe('2026-01-15');
    expect(result.cutoffMonths).toBe(12);
    expect(result.counts).toEqual({ scanned: 9, queued: 4, stale: 3 });
    expect(result.queue).toHaveLength(4);
    expect(result.stale).toHaveLength(3);
  });

  it('preserves queue item fields', () => {
    const [first] = parseReadingQueue(FIXTURE).queue;
    expect(first.id).toBe('fixture-0001');
    expect(first.tier).toBe(1);
    expect(first.readerUrl).toBe('https://read.readwise.io/read/fixture-0001');
    expect(first.tags).toEqual(['tech/widget']);
    expect(first.sort.readingMinutes).toBe(20);
    expect(first.sort.progress).toBeCloseTo(0.35);
  });

  it('preserves stale item reasons', () => {
    const reasons = parseReadingQueue(FIXTURE).stale.map((s) => s.reason);
    expect(reasons).toEqual([
      'done-unfiled',
      'never-opened-stale',
      'deferred-dead',
    ]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:

```bash
pnpm nx test rss-manager -- src/lib/readingQueue.test.ts
```

Expected: FAIL — `Failed to resolve import "./readingQueue.js"`.

- [ ] **Step 4: Write the implementation**

Create `apps/rss-manager/src/lib/readingQueue.ts`. **This file must not import `node:fs` or `./registry.js`** — it is bundled into the browser by the island in Task 5. File IO lands in a separate module in Task 2.

```typescript
const STALE_REASONS = [
  'done-unfiled',
  'never-opened-stale',
  'deferred-dead',
  'abandoned',
  'duplicate',
  'malformed',
] as const;

export type StaleReason = (typeof STALE_REASONS)[number];

export type QueueSort = {
  profileRank: number;
  wikiSources: number;
  readingMinutes: number;
  savedDaysAgo: number;
  progress: number;
};

export type QueueItem = {
  rank: number;
  tier: number;
  id: string;
  title: string;
  readerUrl: string;
  sourceUrl: string;
  siteName: string;
  tags: string[];
  why: string;
  sort: QueueSort;
};

export type StaleItem = {
  id: string;
  title: string;
  reason: StaleReason;
  savedAt: string;
  readerUrl: string;
};

export type ReadingQueue = {
  generated: string;
  cutoffMonths: number;
  counts: { scanned: number; queued: number; stale: number };
  queue: QueueItem[];
  stale: StaleItem[];
};

function fail(path: string, expected: string): never {
  throw new Error(`reading-queue.json: ${path} — expected ${expected}`);
}

function asObject(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    fail(path, 'an object');
  return value as Record<string, unknown>;
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'an array');
  return value;
}

function asString(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, 'a string');
  return value;
}

function asNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) fail(path, 'a number');
  return value;
}

function asStringArray(value: unknown, path: string): string[] {
  return asArray(value, path).map((v, i) => asString(v, `${path}[${i}]`));
}

function asStaleReason(value: unknown, path: string): StaleReason {
  const text = asString(value, path);
  if (!(STALE_REASONS as readonly string[]).includes(text))
    fail(path, `one of ${STALE_REASONS.join(' | ')}`);
  return text as StaleReason;
}

function parseSort(value: unknown, path: string): QueueSort {
  const raw = asObject(value, path);
  return {
    profileRank: asNumber(raw.profileRank, `${path}.profileRank`),
    wikiSources: asNumber(raw.wikiSources, `${path}.wikiSources`),
    readingMinutes: asNumber(raw.readingMinutes, `${path}.readingMinutes`),
    savedDaysAgo: asNumber(raw.savedDaysAgo, `${path}.savedDaysAgo`),
    progress: asNumber(raw.progress, `${path}.progress`),
  };
}

function parseQueueItem(value: unknown, path: string): QueueItem {
  const raw = asObject(value, path);
  return {
    rank: asNumber(raw.rank, `${path}.rank`),
    tier: asNumber(raw.tier, `${path}.tier`),
    id: asString(raw.id, `${path}.id`),
    title: asString(raw.title, `${path}.title`),
    readerUrl: asString(raw.readerUrl, `${path}.readerUrl`),
    sourceUrl: asString(raw.sourceUrl, `${path}.sourceUrl`),
    siteName: asString(raw.siteName, `${path}.siteName`),
    tags: asStringArray(raw.tags, `${path}.tags`),
    why: asString(raw.why, `${path}.why`),
    sort: parseSort(raw.sort, `${path}.sort`),
  };
}

function parseStaleItem(value: unknown, path: string): StaleItem {
  const raw = asObject(value, path);
  return {
    id: asString(raw.id, `${path}.id`),
    title: asString(raw.title, `${path}.title`),
    reason: asStaleReason(raw.reason, `${path}.reason`),
    savedAt: asString(raw.savedAt, `${path}.savedAt`),
    readerUrl: asString(raw.readerUrl, `${path}.readerUrl`),
  };
}

export function parseReadingQueue(content: string): ReadingQueue {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('reading-queue.json: not valid JSON');
  }

  const raw = asObject(parsed, 'root');
  const counts = asObject(raw.counts, 'counts');

  return {
    generated: asString(raw.generated, 'generated'),
    cutoffMonths: asNumber(raw.cutoffMonths, 'cutoffMonths'),
    counts: {
      scanned: asNumber(counts.scanned, 'counts.scanned'),
      queued: asNumber(counts.queued, 'counts.queued'),
      stale: asNumber(counts.stale, 'counts.stale'),
    },
    queue: asArray(raw.queue, 'queue').map((v, i) =>
      parseQueueItem(v, `queue[${i}]`),
    ),
    stale: asArray(raw.stale, 'stale').map((v, i) =>
      parseStaleItem(v, `stale[${i}]`),
    ),
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
pnpm nx test rss-manager -- src/lib/readingQueue.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/rss-manager/src/lib/readingQueue.ts apps/rss-manager/src/lib/readingQueue.test.ts apps/rss-manager/src/lib/fixtures/reading-queue.sample.json
git commit -m "feat(rss-manager): parse the reading-queue artifact

The synthetic fixture is the contract between the skill that writes
reading-queue.json and the app that renders it. It is covered by the parser
test, so a drift in the skill's output shape fails CI rather than silently
rendering nothing."
```

---

## Task 2: Malformed input and missing file

The spec calls out that `readSources()` throws when its file is absent and surfaces as a 500. `readReadingQueue()` must distinguish "not generated yet" from a real failure.

**Files:**

- Create: `apps/rss-manager/src/lib/readingQueueFile.ts`
- Test: `apps/rss-manager/src/lib/readingQueue.test.ts`

`readReadingQueue()` goes in its own module because it imports `node:fs`. Keeping it out of `readingQueue.ts` is what lets the island in Task 5 import the comparators without dragging filesystem code into the browser bundle.

- [ ] **Step 1: Write the failing tests**

Append to `apps/rss-manager/src/lib/readingQueue.test.ts`, adding a second import line below the existing one:

```typescript
import { readReadingQueue } from './readingQueueFile.js';
```

```typescript
describe('parseReadingQueue — malformed input', () => {
  it('rejects invalid JSON with a clear message', () => {
    expect(() => parseReadingQueue('{not json')).toThrow(
      'reading-queue.json: not valid JSON',
    );
  });

  it('names the offending path when a field has the wrong type', () => {
    const bad = JSON.stringify({
      generated: '2026-01-15',
      cutoffMonths: 12,
      counts: { scanned: 1, queued: 1, stale: 0 },
      queue: [{ rank: 'first' }],
      stale: [],
    });
    expect(() => parseReadingQueue(bad)).toThrow('queue[0].rank');
  });

  it('rejects an unknown stale reason', () => {
    const bad = JSON.stringify({
      generated: '2026-01-15',
      cutoffMonths: 12,
      counts: { scanned: 1, queued: 0, stale: 1 },
      queue: [],
      stale: [
        {
          id: 'x',
          title: 'x',
          reason: 'bored-of-it',
          savedAt: '2025-01-01',
          readerUrl: 'https://read.readwise.io/read/x',
        },
      ],
    });
    expect(() => parseReadingQueue(bad)).toThrow('stale[0].reason');
  });
});

describe('readReadingQueue', () => {
  it('returns null when the artifact has not been generated', () => {
    process.env.VAULT_PATH = '/nonexistent-vault-path-for-test';
    expect(readReadingQueue()).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm nx test rss-manager -- src/lib/readingQueue.test.ts
```

Expected: the three `parseReadingQueue` malformed tests PASS already (the guards from Task 1 handle them); the `readReadingQueue` test FAILS with `Failed to resolve import "./readingQueueFile.js"`.

- [ ] **Step 3: Implement `readReadingQueue`**

Create `apps/rss-manager/src/lib/readingQueueFile.ts`:

```typescript
import { readFileSync } from 'node:fs';

import { parseReadingQueue, type ReadingQueue } from './readingQueue.js';
import { registryFilePath } from './registry.js';

/**
 * Returns null when the artifact has not been generated yet — that is an empty
 * state, not an error. Any other read failure (permissions, a directory in its
 * place) still throws.
 *
 * Server-only: this module imports node:fs, so never import it from a React
 * island.
 */
export function readReadingQueue(): ReadingQueue | null {
  const path = registryFilePath('reading-queue.json');
  let raw: string;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
  return parseReadingQueue(raw);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm nx test rss-manager -- src/lib/readingQueue.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/rss-manager/src/lib/readingQueueFile.ts apps/rss-manager/src/lib/readingQueue.test.ts
git commit -m "feat(rss-manager): treat a missing reading queue as an empty state

Only ENOENT returns null; a permissions error still throws. readSources()
throws on a missing file and surfaces as a 500, which is wrong for an
artifact that legitimately does not exist until the skill has run once.

File IO lives in its own module so the React island can import the
comparators without pulling node:fs into the browser bundle."
```

---

## Task 3: Sort comparators

**Files:**

- Modify: `apps/rss-manager/src/lib/readingQueue.ts`
- Test: `apps/rss-manager/src/lib/readingQueue.test.ts`

The fixture is built so all four modes yield distinct orders:

| Mode       | Key                        | Expected order         |
| ---------- | -------------------------- | ---------------------- |
| `default`  | `rank`                     | 0001, 0002, 0003, 0004 |
| `shortest` | `readingMinutes` 20/9/4/45 | 0003, 0002, 0001, 0004 |
| `newest`   | `savedDaysAgo` 5/30/120/2  | 0004, 0001, 0002, 0003 |
| `thinnest` | `wikiSources` 8/12/1/30    | 0003, 0001, 0002, 0004 |

- [ ] **Step 1: Write the failing tests**

Append to `apps/rss-manager/src/lib/readingQueue.test.ts`, and extend the first import to `import { parseReadingQueue, sortQueue } from './readingQueue.js';` (leave the `readingQueueFile.js` import from Task 2 alone):

```typescript
describe('sortQueue', () => {
  const queue = parseReadingQueue(FIXTURE).queue;
  const ids = (mode: Parameters<typeof sortQueue>[1]) =>
    sortQueue(queue, mode).map((i) => i.id);

  it('defaults to the rank the skill assigned', () => {
    expect(ids('default')).toEqual([
      'fixture-0001',
      'fixture-0002',
      'fixture-0003',
      'fixture-0004',
    ]);
  });

  it('sorts shortest first by reading minutes', () => {
    expect(ids('shortest')).toEqual([
      'fixture-0003',
      'fixture-0002',
      'fixture-0001',
      'fixture-0004',
    ]);
  });

  it('sorts newest first by days since saved', () => {
    expect(ids('newest')).toEqual([
      'fixture-0004',
      'fixture-0001',
      'fixture-0002',
      'fixture-0003',
    ]);
  });

  it('sorts thinnest wiki page first', () => {
    expect(ids('thinnest')).toEqual([
      'fixture-0003',
      'fixture-0001',
      'fixture-0002',
      'fixture-0004',
    ]);
  });

  it('does not mutate the input array', () => {
    const before = queue.map((i) => i.id);
    sortQueue(queue, 'shortest');
    expect(queue.map((i) => i.id)).toEqual(before);
  });

  it('breaks ties by rank so ordering is deterministic', () => {
    const tied = [
      { ...queue[1], id: 'b', rank: 9 },
      { ...queue[1], id: 'a', rank: 2 },
    ];
    expect(sortQueue(tied, 'shortest').map((i) => i.id)).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm nx test rss-manager -- src/lib/readingQueue.test.ts
```

Expected: FAIL — `sortQueue is not a function`.

- [ ] **Step 3: Implement the comparators**

Append to `apps/rss-manager/src/lib/readingQueue.ts`:

```typescript
export type SortMode = 'default' | 'shortest' | 'newest' | 'thinnest';

export const SORT_MODES: { mode: SortMode; label: string }[] = [
  { mode: 'default', label: 'Default' },
  { mode: 'shortest', label: 'Shortest first' },
  { mode: 'newest', label: 'Newest first' },
  { mode: 'thinnest', label: 'Thinnest wiki page' },
];

const SORT_KEYS: Record<
  Exclude<SortMode, 'default'>,
  (item: QueueItem) => number
> = {
  shortest: (item) => item.sort.readingMinutes,
  newest: (item) => item.sort.savedDaysAgo,
  thinnest: (item) => item.sort.wikiSources,
};

/** Returns a new array; ties break by rank so the order is always stable. */
export function sortQueue(items: QueueItem[], mode: SortMode): QueueItem[] {
  const sorted = [...items];
  if (mode === 'default') return sorted.sort((a, b) => a.rank - b.rank);
  const key = SORT_KEYS[mode];
  return sorted.sort((a, b) => key(a) - key(b) || a.rank - b.rank);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm nx test rss-manager -- src/lib/readingQueue.test.ts
```

Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/rss-manager/src/lib/readingQueue.ts apps/rss-manager/src/lib/readingQueue.test.ts
git commit -m "feat(rss-manager): add reading queue sort comparators

Sorting lives in the app rather than baked into the artifact: it is numeric
comparison over data already present, so changing the order should not mean
re-running a multi-second join across three systems."
```

---

## Task 4: API route

**Files:**

- Create: `apps/rss-manager/src/pages/api/reading-queue.ts`

- [ ] **Step 1: Write the route**

Mirrors `api/sources.ts`, with one difference: a null return is a 200 carrying an explicit empty state, not a 404 or 500. The client needs to distinguish "never generated" from "request failed" to show the right prompt.

Create `apps/rss-manager/src/pages/api/reading-queue.ts`:

```typescript
import type { APIRoute } from 'astro';

import { readReadingQueue } from '../../lib/readingQueueFile.js';

export const GET: APIRoute = () => {
  try {
    const queue = readReadingQueue();
    if (queue === null) return Response.json({ generated: null });
    return Response.json(queue);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
```

- [ ] **Step 2: Verify it typechecks**

```bash
pnpm nx build rss-manager
```

Expected: `astro check` reports 0 errors, then the build completes.

- [ ] **Step 3: Commit**

```bash
git add apps/rss-manager/src/pages/api/reading-queue.ts
git commit -m "feat(rss-manager): serve the reading queue artifact

A missing artifact returns 200 with generated:null so the client can tell
'not generated yet' apart from a failed request."
```

---

## Task 5: Reading Queue tab

**Files:**

- Create: `apps/rss-manager/src/components/ReadingQueue.tsx`
- Modify: `apps/rss-manager/src/pages/index.astro:7-12` and `:34` and `:50-52`

- [ ] **Step 1: Write the component**

Follows `SourceTable.tsx` conventions: `useEffect` + `fetch`, loading and error strings, the same dark Tailwind palette. Default mode groups by tier with section headers; any other mode flattens to one list with the tier as a badge.

Create `apps/rss-manager/src/components/ReadingQueue.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';

import {
  type QueueItem,
  type ReadingQueue as ReadingQueueData,
  type SortMode,
  SORT_MODES,
  type StaleItem,
  sortQueue,
} from '../lib/readingQueue.js';

const TIER_LABELS: Record<number, string> = {
  1: 'Finish what you started',
  2: 'Blind spot in your stack',
  3: 'Wiki leverage',
  4: 'Covered interest',
};

const STALE_LABELS: Record<StaleItem['reason'], string> = {
  'done-unfiled': 'Read but never archived',
  'never-opened-stale': 'Never opened, over 12 months old',
  'deferred-dead': 'Deferred to Later and never opened',
  abandoned: 'Abandoned part-way',
  duplicate: 'Duplicate of another saved item',
  malformed: 'Malformed title',
};

type Payload = ReadingQueueData | { generated: null };

function QueueRow({ item }: { item: QueueItem }) {
  return (
    <li className="border-b border-gray-800 py-3 last:border-b-0">
      <div className="flex items-baseline justify-between gap-4">
        <a
          href={item.readerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-violet-400 hover:underline"
        >
          {item.title}
        </a>
        <span className="shrink-0 text-xs text-gray-500">
          {item.siteName} · {item.sort.readingMinutes} min
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-400">{item.why}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {item.tags.map((tag) => (
          <span key={tag} className="text-xs text-gray-500">
            #{tag}
          </span>
        ))}
        {item.sort.progress > 0 && (
          <span className="text-xs text-gray-500">
            {Math.round(item.sort.progress * 100)}% read
          </span>
        )}
      </div>
    </li>
  );
}

export default function ReadingQueue() {
  const [data, setData] = useState<Payload | null>(null);
  const [mode, setMode] = useState<SortMode>('default');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/reading-queue')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((payload: Payload) => setData(payload))
      .catch(() => setError('Failed to load the reading queue.'));
  }, []);

  const queue = data && data.generated !== null ? data.queue : [];
  const sorted = useMemo(() => sortQueue(queue, mode), [queue, mode]);

  if (error) return <p className="py-8 text-center text-red-400">{error}</p>;
  if (!data)
    return <p className="py-8 text-center text-gray-400">Loading queue…</p>;

  if (data.generated === null)
    return (
      <div className="py-12 text-center">
        <p className="text-gray-400">
          No reading queue has been generated yet.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Run the <code className="text-violet-400">reading-queue</code> skill
          to build one.
        </p>
      </div>
    );

  const tiers = [...new Set(sorted.map((i) => i.tier))].sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {data.counts.queued} queued · {data.counts.stale} stale ·{' '}
          {data.counts.scanned} scanned · generated {data.generated}
        </p>
        <div className="flex flex-wrap gap-1">
          {SORT_MODES.map(({ mode: m, label }) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                mode === m
                  ? 'bg-violet-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'default' ? (
        tiers.map((tier) => (
          <section key={tier}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
              {TIER_LABELS[tier] ?? `Tier ${tier}`}
            </h3>
            <ul>
              {sorted
                .filter((i) => i.tier === tier)
                .map((item) => (
                  <QueueRow key={item.id} item={item} />
                ))}
            </ul>
          </section>
        ))
      ) : (
        <ul>
          {sorted.map((item) => (
            <QueueRow key={item.id} item={item} />
          ))}
        </ul>
      )}

      {data.stale.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Stale ({data.stale.length})
          </h3>
          <p className="mb-3 text-xs text-gray-600">
            Read-only. Archive these in Readwise yourself — this app never
            writes to Reader.
          </p>
          <ul className="space-y-1">
            {data.stale.map((item) => (
              <li key={item.id} className="flex items-baseline gap-3 text-sm">
                <span className="shrink-0 rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                  {STALE_LABELS[item.reason]}
                </span>
                <a
                  href={item.readerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-violet-400 hover:underline"
                >
                  {item.title}
                </a>
                <span className="ml-auto shrink-0 text-xs text-gray-600">
                  {item.savedAt}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Register the tab**

In `apps/rss-manager/src/pages/index.astro`, make three edits.

Add the import after line 4:

```astro
import ReadingQueue from '../components/ReadingQueue.tsx';
```

Replace line 7:

```astro
const VALID_TABS = ['sources', 'topics', 'validate', 'queue'] as const;
```

Replace line 34:

```astro
(['sources', 'topics', 'validate', 'queue'] as const).map((t) => (
```

Add after line 52:

```astro
{tab === 'queue' && <ReadingQueue client:load />}
```

- [ ] **Step 3: Verify it builds and lints**

```bash
pnpm nx build rss-manager && pnpm nx lint rss-manager
```

Expected: `astro check` 0 errors, build completes, lint clean. `noUnusedLocals` is on — if lint flags an unused import, remove it rather than disabling the rule.

- [ ] **Step 4: Verify no filesystem code reached the client bundle**

The island imports `readingQueue.ts`; if that module ever grows a `node:fs` import, Vite will either fail the build or ship a polyfill. Check the emitted client assets:

```bash
grep -rl "node:fs\|readFileSync" apps/rss-manager/dist/client/ 2>/dev/null && echo "LEAK — filesystem code in the client bundle" || echo "clean"
```

Expected: `clean`. If it reports a leak, the component is importing `readingQueueFile.ts` or `registry.ts` — move the offending import to the server side rather than adding a Vite polyfill.

- [ ] **Step 5: Commit**

```bash
git add apps/rss-manager/src/components/ReadingQueue.tsx apps/rss-manager/src/pages/index.astro
git commit -m "feat(rss-manager): add the Reading Queue tab

Default mode groups by tier; the other three modes flatten to one list. The
stale panel is read-only and links back to Reader — the app never writes to
Readwise."
```

---

## Task 6: Verify in a running dev server

`CLAUDE.md` records two bugs that a green `astro build` could not see. A build is not verification.

**Files:** none — this task only runs and observes.

- [ ] **Step 1: Point VAULT_PATH at the fixture directory**

The dev server needs a directory containing `reading-queue.json`. Use the fixture so no real reading data is involved:

```bash
mkdir -p /tmp/rss-manager-dev-vault && cp apps/rss-manager/src/lib/fixtures/reading-queue.sample.json /tmp/rss-manager-dev-vault/reading-queue.json
```

- [ ] **Step 2: Start the dev server**

Use the Browser pane, never a raw shell. Create `.claude/launch.json` if absent:

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "rss-manager",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["nx", "dev", "rss-manager"],
      "port": 3002
    }
  ]
}
```

Then `preview_start` with `{name: "rss-manager"}`, and set `VAULT_PATH=/tmp/rss-manager-dev-vault` in the environment the server runs under.

- [ ] **Step 3: Load the tab and check for runtime errors**

Navigate to `http://localhost:3002/?tab=queue`. Then:

- `read_console_messages` — expected: no errors
- `read_page` — expected: the four fixture titles, the four sort buttons, the three stale rows

- [ ] **Step 4: Exercise every sort mode**

Click each of the four sort buttons and `read_page` after each. Confirm the orders match the table in Task 3. Default must show tier headings; the other three must not.

- [ ] **Step 5: Verify the empty state**

```bash
rm /tmp/rss-manager-dev-vault/reading-queue.json
```

Reload `?tab=queue`. Expected: "No reading queue has been generated yet", **not** an error and not a 500.

- [ ] **Step 6: Screenshot and commit any fixes**

Take a screenshot for the record. If steps 3–5 surfaced defects, fix them, re-run `pnpm nx test rss-manager`, and commit. If nothing broke, there is nothing to commit.

---

## Task 7: The `reading-queue` skill

**Different repository.** All paths below are relative to the private vault:

```
~/Library/Mobile Documents/iCloud~md~obsidian/Documents/rainforest-obsidian
```

**Files:**

- Create: `ai-resources/claude-skills/reading-queue/SKILL.md`

- [ ] **Step 1: Confirm you are in the vault repo**

```bash
cd ~/Library/Mobile\ Documents/iCloud~md~obsidian/Documents/rainforest-obsidian && git remote get-url origin
```

Expected: a URL ending `rainforest-obsidian.git`. If it ends `rainforest-monorepo.git`, stop — you are in the wrong repo and would commit reading data to a public repository.

- [ ] **Step 2: Write the skill**

Create `ai-resources/claude-skills/reading-queue/SKILL.md`:

````markdown
---
name: reading-queue
description: Use when the user asks what to read next, wants their Readwise inbox triaged, asks to find stale or rotting saved articles, or wants the reading queue in rss-manager refreshed. Ranks unread Reader documents against the profile MCP, wiki page maturity and active RSS topics, then writes _system/reading-queue.json for the rss-manager Queue tab.
---

# `reading-queue` — Personal Reading Queue

Ranks everything unread in Readwise Reader against personal context and writes a single
artifact the `rss-manager` app renders.

## Non-negotiable

**This skill never writes to Readwise.** No archiving, no tagging, no moving between
locations, no metadata edits. Reader is read-only here. The only write is
`_system/reading-queue.json` in this vault. If the user asks for documents to be
archived, tell them the stale list is in the rss-manager Queue tab with links, and that
archiving is theirs to do in Reader.

## Step 1 — Load personal context

Read, in this order:

1. **Profile MCP** — `get_profile_summary` and `get_skills`. Build a map of
   technology → `prioritized` | `listed`. A skill whose `tags` include `prioritized`
   ranks above one that does not.
2. **Active RSS topics** — `_system/RSS-Topic-Registry.md`, `## Active` section. Collect
   every `#hashtag`. This is the covered-tag set.
3. **Source registry** — `_system/RSS-Source-Registry.md`. Build `site_name` → tags, used
   to resolve untagged documents.
4. **Wiki pages** — for each candidate tag, resolve to `notes/wiki/pages/<slug>.md` using
   the SCHEMA rule (replace `/` with `-`, lowercase). Read `wiki_status` from frontmatter
   and count the non-blank lines under `## Sources`.

Read `notes/wiki/SCHEMA.md` first — the wiki contract requires it before any wiki
operation.

## Step 2 — Fetch unread documents

```
reader_list_documents(location="new",   limit=100, response_fields=[...])
reader_list_documents(location="later", limit=100, response_fields=[...])
```

`response_fields`: `["title", "url", "source_url", "site_name", "tags", "category",
"reading_progress", "first_opened_at", "saved_at", "reading_time", "location"]`

Paginate with `page_cursor` until exhausted. Do **not** fetch `location="feed"` — feed
items are not yet saved and are not candidates.

## Step 3 — Classify stale items

Apply in order. First match wins; a stale item is never also a queue candidate.

| Reason               | Rule                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `malformed`          | Empty title, or title longer than 200 characters                                                  |
| `duplicate`          | Same `source_url` as another unread document — keep the highest `reading_progress`, mark the rest |
| `done-unfiled`       | `reading_progress >= 0.65`                                                                        |
| `never-opened-stale` | `first_opened_at` is null AND `saved_at` more than **12 months** ago                              |
| `deferred-dead`      | `location == "later"` AND `first_opened_at` is null AND `saved_at` more than 3 months ago         |
| `abandoned`          | `0.05 <= reading_progress < 0.65` AND `first_opened_at` more than 6 months ago                    |

Everything else is a candidate.

## Step 4 — Resolve tags for candidates

Most documents are untagged. Fall through:

1. Reader `tags` when non-empty — these already use the vault taxonomy
2. `site_name` matched against the Source Registry → that source's `#hashtags`
3. Title and summary matched against profile technology names and wiki page slugs

Step 3 is the only place you exercise judgment. Record the resolved tags; everything
after this is mechanical.

## Step 5 — Score

Run this script. It is deterministic on purpose — prose scoring would give a different
order every run, and the user could never tell whether the queue changed because their
reading changed or because the model rolled differently.

```python
import json, os

VAULT = os.path.expanduser(
    "~/Library/Mobile Documents/iCloud~md~obsidian/Documents/rainforest-obsidian"
)

# Written by the agent in step 4: one dict per candidate with keys
#   id, title, reader_url, source_url, site_name, tags, progress,
#   reading_minutes, saved_days_ago, opened_days_ago, profile, wiki_status,
#   wiki_sources, topic_covered
CANDIDATES = json.load(open("/tmp/reading-queue-candidates.json"))
STALE = json.load(open("/tmp/reading-queue-stale.json"))

PROFILE_RANK = {"prioritized": 0, "listed": 1, None: 2}


def assign_tier(c):
    if 0.30 <= c["progress"] < 0.65 and (c["opened_days_ago"] or 9999) < 180:
        return 1                                    # finish what you started
    if c["profile"] and not c["topic_covered"]:
        return 2                                    # blind spot in your stack
    if c["wiki_status"] in ("stub", "growing"):
        return 3                                    # wiki leverage
    if c["topic_covered"]:
        return 4                                    # covered interest
    return 5                                        # excluded


def within_tier_key(c):
    # Personal context first; length only as a tie-break.
    return (PROFILE_RANK[c["profile"]], c["wiki_sources"], c["reading_minutes"])


def why(c, tier):
    bits = []
    if c["profile"] == "prioritized":
        bits.append("profile-prioritized")
    elif c["profile"] == "listed":
        bits.append("in your stack")
    if c["wiki_status"]:
        bits.append(f"{c['wiki_status']} wiki page ({c['wiki_sources']} sources)")
    if c["profile"] and not c["topic_covered"]:
        bits.append("no active topic feeding it")
    if tier == 1:
        bits.insert(0, f"{round(c['progress'] * 100)}% read")
    return " · ".join(bits) or "matches an active topic"


ranked = sorted(
    ((assign_tier(c), c) for c in CANDIDATES),
    key=lambda tc: (tc[0], within_tier_key(tc[1])),
)
ranked = [(t, c) for t, c in ranked if t < 5]

queue = []
for i, (tier, c) in enumerate(ranked, start=1):
    queue.append({
        "rank": i,
        "tier": tier,
        "id": c["id"],
        "title": c["title"],
        "readerUrl": c["reader_url"],
        "sourceUrl": c["source_url"],
        "siteName": c["site_name"],
        "tags": c["tags"],
        "why": why(c, tier),
        "sort": {
            "profileRank": PROFILE_RANK[c["profile"]],
            "wikiSources": c["wiki_sources"],
            "readingMinutes": c["reading_minutes"],
            "savedDaysAgo": c["saved_days_ago"],
            "progress": c["progress"],
        },
    })

artifact = {
    "generated": TODAY,          # replace with the real date before running
    "cutoffMonths": 12,
    "counts": {
        "scanned": len(CANDIDATES) + len(STALE),
        "queued": len(queue),
        "stale": len(STALE),
    },
    "queue": queue,
    "stale": STALE,
}

out = os.path.join(VAULT, "_system/reading-queue.json")
with open(out, "w", encoding="utf-8") as f:
    json.dump(artifact, f, indent=2, ensure_ascii=False)

print(f"{len(queue)} queued, {len(STALE)} stale → {out}")
```

Replace `TODAY` with the actual date string before running.

## Output contract

The artifact shape is fixed by a test in the monorepo. The canonical example is:

`apps/rss-manager/src/lib/fixtures/reading-queue.sample.json`

If you change the shape here, that fixture and
`apps/rss-manager/src/lib/readingQueue.ts` must change with it, or the app's parser test
fails. That test is the contract — this prose is not.

## Step 6 — Report

Tell the user:

- how many documents were scanned, queued, and marked stale
- the stale breakdown by reason
- the top 3 of the queue with their `why` sentences
- that the full ordered list is in the rss-manager **Queue** tab

Then stop. Do not offer to archive anything in Readwise.

## Notes

- If the Readwise MCP is unavailable, say so and stop. No browser fallback.
- If the profile MCP is unavailable, stop — without it there is no tier 2 and the
  ranking loses its point.
- The queue is regenerated wholesale each run. It is not merged with the previous one.
````

- [ ] **Step 3: Verify the skill is discoverable**

```bash
ls ai-resources/claude-skills/reading-queue/SKILL.md && head -4 ai-resources/claude-skills/reading-queue/SKILL.md
```

Expected: the file exists and the frontmatter has `name: reading-queue`.

- [ ] **Step 4: Commit in the vault repo**

```bash
git add ai-resources/claude-skills/reading-queue/SKILL.md
git commit -m "feat(skills): add reading-queue

Ranks unread Reader documents against the profile MCP, wiki page maturity and
active RSS topics, then writes _system/reading-queue.json for the rss-manager
Queue tab. Reads Readwise; never writes to it.

The output shape is pinned by a parser test in the monorepo rather than by
this file's prose — rss-discover documented an rss-manager UI that was never
built, because nothing could fail when the two drifted apart."
```

- [ ] **Step 5: First real run**

Invoke the skill. Expected: `_system/reading-queue.json` is created, roughly 324 documents scanned, and the counts split into queued and stale. Then point the dev server's `VAULT_PATH` at the real `_system/` directory and confirm the Queue tab renders live data.

`_system/reading-queue.json` is committed to the **private** vault repo only. Confirm with `git status` that it never appears in the monorepo.

---

## Self-Review

**Spec coverage:**

| Spec section                           | Task                                        |
| -------------------------------------- | ------------------------------------------- |
| Artifact shape                         | 1 (fixture + parser)                        |
| Missing-file empty state               | 2, 5, 6                                     |
| Staleness rules, 12-month cutoff       | 7 step 3                                    |
| Tag resolution chain                   | 7 step 4                                    |
| Hybrid execution, deterministic script | 7 step 5                                    |
| Tiers                                  | 7 step 5 (`assign_tier`)                    |
| Default within-tier key                | 7 step 5 (`within_tier_key`)                |
| Sorting in the app, four modes         | 3, 5                                        |
| Tab, two panels, Reader deep links     | 5                                           |
| Hand-rolled guard, no zod              | 1                                           |
| Comparators in lib, not component      | 1, 3, 5                                     |
| Synthetic fixture, privacy             | 1, 7 step 1                                 |
| Contract testing                       | 1, 7 output contract section                |
| Manual dev verification                | 6                                           |
| No Readwise writes                     | 7 non-negotiable section                    |
| No scheduled run                       | not implemented — correct, it is a non-goal |

The three Follow-up items in the spec are deliberately absent: they are scoped to later plans.

**Type consistency:** `QueueItem`, `StaleItem`, `ReadingQueue`, `QueueSort`, `SortMode`, `StaleReason`, `parseReadingQueue`, `sortQueue` and `SORT_MODES` are defined in Tasks 1 and 3 in `readingQueue.ts`; `readReadingQueue` is defined in Task 2 in `readingQueueFile.ts`. Import sites match: the component (Task 5) and the tests take the pure module; the API route (Task 4) and the `readReadingQueue` test take the file module. The JSON keys in the Task 1 fixture, the Task 1 parser, and the Task 7 script all match: `profileRank`, `wikiSources`, `readingMinutes`, `savedDaysAgo`, `progress`.

**Module boundary:** caught during self-review — the first draft had the island importing a module that imports `node:fs`, which would have pulled filesystem code into the browser bundle. Split into `readingQueue.ts` (pure, browser-safe) and `readingQueueFile.ts` (server-only), with a grep check in Task 5 step 4 to catch a regression.
