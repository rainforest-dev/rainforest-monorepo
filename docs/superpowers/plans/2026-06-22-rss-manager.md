# rss-manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only web dashboard that surfaces the Obsidian RSS registry files (`RSS-Source-Registry.md`, `RSS-Topic-Registry.md`) as a browsable, searchable UI with feed URL validation.

**Architecture:** Astro SSR app (`@astrojs/node` standalone) with server-side registry parsing (reads markdown files via `VAULT_PATH` env var) and React islands for the interactive table and validator. No database — the markdown registry files are the source of truth. No writes back to Obsidian (the vault is mounted read-only).

**Tech Stack:** Astro 5, `@astrojs/node`, `@simplewebauthn/browser`, React islands, Tailwind CSS 4, Vitest (pure-function registry parser tests), pnpm, Nx

**Spec:** `docs/superpowers/specs/2026-06-22-personal-tools-monorepo-design.md` §4 (rss-manager)

**Prerequisite:** PR #6 (`feat(rss): RSS curation + discovery system v1`) must be merged to the Obsidian vault main branch before this app can read registry data in production. Dev/test uses the worktree files directly.

---

## File Map

```
apps/rss-manager/
  src/
    pages/
      index.astro              ← shell with three tabs: Sources / Topics / Validate
      api/
        sources.ts             ← GET: parsed source registry as JSON
        topics.ts              ← GET: parsed topic registry as JSON
        validate.ts            ← POST: { url } → { valid, title?, itemCount?, error? }
    components/
      SourceTable.tsx          ← React island: filterable sources table
      TopicList.tsx            ← React island: topic list with status badges
      FeedValidator.tsx        ← React island: URL input + fetch-and-validate
    lib/
      registry.ts              ← line-by-line markdown parser + path resolver
      feedCheck.ts             ← server-side feed URL fetch + content check
    env.d.ts
  astro.config.mjs
  package.json
  tsconfig.json
  Dockerfile
```

---

## Environment Variables

```
# In dev: set VAULT_PATH to the _system/ directory directly
# Example: VAULT_PATH="/Users/rainforest/Library/Mobile.../rainforest-obsidian/_system"
#
# In Docker: VAULT_PATH=/vault (container path, matches volume mount target)
# Docker compose mounts: ${VAULT_REGISTRY_PATH}:/vault:ro
# where VAULT_REGISTRY_PATH in host .env is the _system/ directory on the host

VAULT_PATH=/vault                # container env (set explicitly in compose)
# VAULT_REGISTRY_PATH=           # host .env only — path to obsidian/_system on the host machine
```

---

## Registry File Format (actual)

The parser must handle this exact format from `_system/RSS-Source-Registry.md`:

```markdown
## Active Sources            ← status section (## heading)
### Frontend & Web           ← category subsection (### heading)
- [x] **Astro** #domain/frontend #tech/astro
  https://astro.build/rss.xml

## Needs Verification
- [ ] **TkDodo's Blog** #tech/tanstack #tech/react
  https://tkdodo.eu/blog/rss.xml · for topic: TanStack ecosystem
  **What**: ...

## Proposed Sources
- [ ] **The GitHub Blog** #devops #domain/frontend
  https://github.blog/feed/ · for topic: Build tooling · _2026-06-17_ · proposed by rss-discover
  Evidence: ...
```

And `_system/RSS-Topic-Registry.md`:

```markdown
## Active
- [x] **AI agents & tools** #domain/ai #tech/claude-code
  Agents, LLMs, MCP ecosystem, Claude Code

## Proposed
## Declined
```

---

### Task 1: Scaffold the Astro SSR app

**Files:**
- Create: `apps/rss-manager/package.json`
- Create: `apps/rss-manager/astro.config.mjs`
- Create: `apps/rss-manager/tsconfig.json`
- Create: `apps/rss-manager/src/env.d.ts`

- [ ] **Step 1: Create `apps/rss-manager/package.json`**

```json
{
  "name": "@rainforest-monorepo/rss-manager",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "astro dev --port 3002 --host 0.0.0.0",
    "build": "astro check && astro build",
    "preview": "astro preview --port 3002"
  },
  "nx": {
    "targets": {
      "dev": { "dependsOn": ["^build"] },
      "build": { "dependsOn": ["^build"], "cache": true }
    }
  },
  "dependencies": {
    "@astrojs/node": "^9.1.3",
    "@astrojs/react": "^4.3.0",
    "@tailwindcss/vite": "catalog:",
    "astro": "^5.10.2",
    "react": "catalog:",
    "react-dom": "catalog:",
    "tailwindcss": "catalog:"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "typescript": "catalog:",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 2: Create `apps/rss-manager/astro.config.mjs`**

```js
// @ts-check
import react from '@astrojs/react';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  vite: { plugins: [tailwindcss()] },
  integrations: [react()],
});
```

- [ ] **Step 3: Create `apps/rss-manager/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "allowJs": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `apps/rss-manager/src/env.d.ts`**

```typescript
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
```

- [ ] **Step 5: Create `apps/rss-manager/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 6: Install and verify**

```bash
cd ~/Repositories/rainforest-monorepo
pnpm install --filter @rainforest-monorepo/rss-manager
pnpm nx show project rss-manager
```

Expected: prints project info with `dev`, `build` targets.

- [ ] **Step 7: Commit**

```bash
git add apps/rss-manager/
git commit -m "feat(rss-manager): scaffold Astro SSR app"
```

---

### Task 2: Registry parser

**Files:**
- Create: `apps/rss-manager/src/lib/registry.ts`
- Create: `apps/rss-manager/src/lib/registry.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/rss-manager/src/lib/registry.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseSources, parseTopics } from './registry.js';

const SOURCES_FIXTURE = `---
type: source-registry
updated: 2026-06-17
---

# RSS Source Registry

## Active Sources

### Frontend & Web

- [x] **Astro** #domain/frontend #tech/astro
  https://astro.build/rss.xml

- [x] **CSS-Tricks** #domain/frontend #tech/css
  https://css-tricks.com/feed/

### Tech News & Industry

- [x] **The Verge** #domain/frontend #domain/ai
  https://www.theverge.com/rss/index.xml

## Needs Verification

- [ ] **TkDodo's Blog** #tech/tanstack #tech/react
  https://tkdodo.eu/blog/rss.xml · for topic: TanStack ecosystem
  **What**: Deep dives into React patterns.

## Proposed Sources

- [ ] **The GitHub Blog** #devops #domain/frontend
  https://github.blog/feed/ · for topic: Build tooling · _2026-06-17_ · proposed by rss-discover
  Evidence: Low-frequency.

## No RSS Found

- [ ] **Claude Code Changelog** #tech/claude-code #domain/ai
  website: https://claude.ai/changelog · _2026-06-17_

## Retired
`;

const TOPICS_FIXTURE = `---
type: topic-registry
updated: 2026-06-17
---

# RSS Topic Registry

## Active

- [x] **AI agents & tools** #domain/ai #tech/claude-code
  Agents, LLMs, MCP ecosystem, Claude Code

- [x] **Frontend / React ecosystem** #domain/frontend #tech/react
  React, hooks, patterns — primary stack

## Proposed

- [ ] **Home automation** #devops
  HA and smart home tools

## Declined
`;

describe('parseSources', () => {
  it('returns all sources', () => {
    const sources = parseSources(SOURCES_FIXTURE);
    expect(sources).toHaveLength(6);
  });

  it('marks active sources correctly', () => {
    const sources = parseSources(SOURCES_FIXTURE);
    const active = sources.filter((s) => s.status === 'active');
    expect(active).toHaveLength(3);
    expect(active[0].name).toBe('Astro');
    expect(active[0].tags).toContain('domain/frontend');
    expect(active[0].tags).toContain('tech/astro');
    expect(active[0].url).toBe('https://astro.build/rss.xml');
    expect(active[0].category).toBe('Frontend & Web');
  });

  it('marks pending sources correctly', () => {
    const sources = parseSources(SOURCES_FIXTURE);
    const pending = sources.filter((s) => s.status === 'pending');
    expect(pending).toHaveLength(1);
    expect(pending[0].name).toBe("TkDodo's Blog");
    expect(pending[0].url).toBe('https://tkdodo.eu/blog/rss.xml');
  });

  it('marks proposed sources correctly', () => {
    const sources = parseSources(SOURCES_FIXTURE);
    const proposed = sources.filter((s) => s.status === 'proposed');
    expect(proposed).toHaveLength(1);
    expect(proposed[0].url).toBe('https://github.blog/feed/');
  });

  it('marks no-rss sources correctly', () => {
    const sources = parseSources(SOURCES_FIXTURE);
    const noRss = sources.filter((s) => s.status === 'no-rss');
    expect(noRss).toHaveLength(1);
  });
});

describe('parseTopics', () => {
  it('returns all topics', () => {
    const topics = parseTopics(TOPICS_FIXTURE);
    expect(topics).toHaveLength(3);
  });

  it('parses active topics correctly', () => {
    const topics = parseTopics(TOPICS_FIXTURE);
    const active = topics.filter((t) => t.status === 'active');
    expect(active).toHaveLength(2);
    expect(active[0].name).toBe('AI agents & tools');
    expect(active[0].tags).toContain('domain/ai');
    expect(active[0].description).toBe('Agents, LLMs, MCP ecosystem, Claude Code');
  });

  it('parses proposed topics correctly', () => {
    const topics = parseTopics(TOPICS_FIXTURE);
    const proposed = topics.filter((t) => t.status === 'proposed');
    expect(proposed).toHaveLength(1);
    expect(proposed[0].name).toBe('Home automation');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
pnpm nx test rss-manager
```

Expected: FAIL — `Cannot find module './registry.js'`

- [ ] **Step 3: Implement `apps/rss-manager/src/lib/registry.ts`**

```typescript
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Source = {
  name: string;
  url: string;
  tags: string[];
  status: 'active' | 'pending' | 'proposed' | 'no-rss' | 'retired';
  category: string;
};

export type Topic = {
  name: string;
  tags: string[];
  description: string;
  status: 'active' | 'proposed' | 'declined';
};

function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match ? match[1] : content;
}

function extractTags(text: string): string[] {
  return [...text.matchAll(/#([\w/.-]+)/g)].map((m) => m[1]);
}

function extractUrl(line: string): string {
  const match = line.trim().match(/^(https?:\/\/[^\s·]+)/);
  return match ? match[1] : '';
}

export function parseSources(content: string): Source[] {
  const body = stripFrontmatter(content);
  const sources: Source[] = [];

  let section = '';
  let category = '';
  const lines = body.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('## ')) {
      section = line.slice(3).trim();
      category = '';
      continue;
    }

    if (line.startsWith('### ')) {
      category = line.slice(4).trim();
      continue;
    }

    // Skip comment lines
    if (line.trim().startsWith('<!--')) continue;

    // Item line: - [x] **Name** #tag1 #tag2
    const itemMatch = line.match(/^- \[([ x])\] \*\*(.+?)\*\*(.*)/);
    if (!itemMatch) continue;

    const checked = itemMatch[1] === 'x';
    const name = itemMatch[2];
    const tagsText = itemMatch[3];
    const tags = extractTags(tagsText);

    // Look ahead for URL on the next non-empty line
    let url = '';
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j++;
    if (j < lines.length) {
      const nextLine = lines[j].trim();
      if (nextLine.startsWith('http')) {
        url = extractUrl(nextLine);
        i = j;
      } else if (nextLine.startsWith('website:')) {
        const urlMatch = nextLine.match(/https?:\/\/[^\s·]+/);
        url = urlMatch ? urlMatch[0] : '';
        i = j;
      }
    }

    let status: Source['status'] = 'pending';
    if (section === 'Active Sources') status = checked ? 'active' : 'pending';
    else if (section === 'Needs Verification') status = 'pending';
    else if (section === 'Proposed Sources') status = 'proposed';
    else if (section === 'No RSS Found') status = 'no-rss';
    else if (section === 'Retired') status = 'retired';

    sources.push({ name, url, tags, status, category });
  }

  return sources;
}

export function parseTopics(content: string): Topic[] {
  const body = stripFrontmatter(content);
  const topics: Topic[] = [];

  let section = '';
  const lines = body.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('## ')) {
      section = line.slice(3).trim();
      continue;
    }

    if (line.trim().startsWith('<!--')) continue;

    const itemMatch = line.match(/^- \[([ x])\] \*\*(.+?)\*\*(.*)/);
    if (!itemMatch) continue;

    const name = itemMatch[2];
    const tagsText = itemMatch[3];
    const tags = extractTags(tagsText);

    // Description is on the next non-empty line (if it doesn't start with - or #)
    let description = '';
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j++;
    if (j < lines.length) {
      const nextLine = lines[j].trim();
      if (nextLine && !nextLine.startsWith('-') && !nextLine.startsWith('#')) {
        description = nextLine;
        i = j;
      }
    }

    let status: Topic['status'] = 'proposed';
    if (section === 'Active') status = 'active';
    else if (section === 'Proposed') status = 'proposed';
    else if (section === 'Declined') status = 'declined';

    topics.push({ name, tags, description, status });
  }

  return topics;
}

// Resolve path to a registry file.
// VAULT_PATH must point directly to the _system/ dir (not the vault root).
// Dev: set VAULT_PATH=<vault>/_system. Docker: VAULT_PATH=/vault (mount target).
export function registryFilePath(filename: string): string {
  const base = process.env.VAULT_PATH ?? '/vault';
  return join(base, filename);
}

export function readSources(): Source[] {
  const path = registryFilePath('RSS-Source-Registry.md');
  return parseSources(readFileSync(path, 'utf-8'));
}

export function readTopics(): Topic[] {
  const path = registryFilePath('RSS-Topic-Registry.md');
  return parseTopics(readFileSync(path, 'utf-8'));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm nx test rss-manager
```

Expected: PASS — 8 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/rss-manager/src/lib/registry.ts apps/rss-manager/src/lib/registry.test.ts apps/rss-manager/vitest.config.ts
git commit -m "feat(rss-manager): add registry markdown parser"
```

---

### Task 3: Feed URL checker

**Files:**
- Create: `apps/rss-manager/src/lib/feedCheck.ts`
- Create: `apps/rss-manager/src/lib/feedCheck.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/rss-manager/src/lib/feedCheck.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { detectFeedFormat, extractFeedMeta } from './feedCheck.js';

const RSS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Astro Blog</title>
    <item><title>Post 1</title></item>
    <item><title>Post 2</title></item>
    <item><title>Post 3</title></item>
  </channel>
</rss>`;

const ATOM_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Web.dev</title>
  <entry><title>Entry 1</title></entry>
  <entry><title>Entry 2</title></entry>
</feed>`;

const HTML_FIXTURE = `<!DOCTYPE html><html><head><title>Not a feed</title></head></html>`;

describe('detectFeedFormat', () => {
  it('detects RSS', () => expect(detectFeedFormat(RSS_FIXTURE)).toBe('rss'));
  it('detects Atom', () => expect(detectFeedFormat(ATOM_FIXTURE)).toBe('atom'));
  it('returns null for HTML', () => expect(detectFeedFormat(HTML_FIXTURE)).toBeNull());
});

describe('extractFeedMeta', () => {
  it('extracts title and item count from RSS', () => {
    const meta = extractFeedMeta(RSS_FIXTURE, 'rss');
    expect(meta.title).toBe('Astro Blog');
    expect(meta.itemCount).toBe(3);
  });

  it('extracts title and entry count from Atom', () => {
    const meta = extractFeedMeta(ATOM_FIXTURE, 'atom');
    expect(meta.title).toBe('Web.dev');
    expect(meta.itemCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
pnpm nx test rss-manager
```

Expected: FAIL — `Cannot find module './feedCheck.js'`

- [ ] **Step 3: Implement `apps/rss-manager/src/lib/feedCheck.ts`**

```typescript
export type FeedFormat = 'rss' | 'atom';

export type FeedMeta = {
  title: string;
  itemCount: number;
};

export type FeedCheckResult = {
  valid: boolean;
  format?: FeedFormat;
  title?: string;
  itemCount?: number;
  error?: string;
};

export function detectFeedFormat(content: string): FeedFormat | null {
  const trimmed = content.trimStart();
  if (/<rss[\s>]/i.test(trimmed)) return 'rss';
  if (/<feed[\s>]/i.test(trimmed)) return 'atom';
  return null;
}

export function extractFeedMeta(content: string, format: FeedFormat): FeedMeta {
  const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  const itemTag = format === 'rss' ? '<item' : '<entry';
  const itemCount = (content.match(new RegExp(itemTag, 'gi')) ?? []).length;

  return { title, itemCount };
}

export async function checkFeedUrl(url: string): Promise<FeedCheckResult> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'rss-manager/1.0 feed-validator' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return { valid: false, error: `HTTP ${res.status}` };
    }

    const text = await res.text();
    const format = detectFeedFormat(text);

    if (!format) {
      return { valid: false, error: 'Not a valid RSS or Atom feed' };
    }

    const meta = extractFeedMeta(text, format);
    return { valid: true, format, ...meta };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: message };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm nx test rss-manager
```

Expected: PASS — 13 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/rss-manager/src/lib/feedCheck.ts apps/rss-manager/src/lib/feedCheck.test.ts
git commit -m "feat(rss-manager): add feed URL checker"
```

---

### Task 4: API routes

**Files:**
- Create: `apps/rss-manager/src/pages/api/sources.ts`
- Create: `apps/rss-manager/src/pages/api/topics.ts`
- Create: `apps/rss-manager/src/pages/api/validate.ts`

- [ ] **Step 1: Create `apps/rss-manager/src/pages/api/sources.ts`**

```typescript
import type { APIRoute } from 'astro';
import { readSources } from '../../lib/registry.js';

export const GET: APIRoute = () => {
  try {
    const sources = readSources();
    return Response.json(sources);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
```

- [ ] **Step 2: Create `apps/rss-manager/src/pages/api/topics.ts`**

```typescript
import type { APIRoute } from 'astro';
import { readTopics } from '../../lib/registry.js';

export const GET: APIRoute = () => {
  try {
    const topics = readTopics();
    return Response.json(topics);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
```

- [ ] **Step 3: Create `apps/rss-manager/src/pages/api/validate.ts`**

```typescript
import type { APIRoute } from 'astro';
import { checkFeedUrl } from '../../lib/feedCheck.js';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { url } = (await request.json()) as { url: string };
    if (!url || !url.startsWith('http')) {
      return Response.json({ valid: false, error: 'Invalid URL' }, { status: 400 });
    }
    const result = await checkFeedUrl(url);
    return Response.json(result);
  } catch (err) {
    return Response.json({ valid: false, error: String(err) }, { status: 500 });
  }
};
```

- [ ] **Step 4: Smoke-test with the real vault files**

```bash
VAULT_PATH="/Users/rainforest/Library/Mobile Documents/iCloud~md~obsidian/Documents/rainforest-obsidian/_system" \
pnpm nx dev rss-manager &

curl -s http://localhost:3002/api/sources | python3 -m json.tool | head -30
# Expected: JSON array of source objects with name, url, tags, status, category

curl -s http://localhost:3002/api/topics | python3 -m json.tool | head -20
# Expected: JSON array of topic objects

curl -s -X POST http://localhost:3002/api/validate \
  -H "Content-Type: application/json" \
  -d '{"url":"https://astro.build/rss.xml"}' | python3 -m json.tool
# Expected: { "valid": true, "format": "rss", "title": "...", "itemCount": ... }

kill %1
```

- [ ] **Step 5: Commit**

```bash
git add apps/rss-manager/src/pages/api/
git commit -m "feat(rss-manager): add sources, topics, and validate API routes"
```

---

### Task 5: React islands

**Files:**
- Create: `apps/rss-manager/src/components/SourceTable.tsx`
- Create: `apps/rss-manager/src/components/TopicList.tsx`
- Create: `apps/rss-manager/src/components/FeedValidator.tsx`

- [ ] **Step 1: Create `apps/rss-manager/src/components/SourceTable.tsx`**

```tsx
import { useEffect, useState } from 'react';

type Source = {
  name: string;
  url: string;
  tags: string[];
  status: 'active' | 'pending' | 'proposed' | 'no-rss' | 'retired';
  category: string;
};

const STATUS_COLORS: Record<Source['status'], string> = {
  active: 'bg-green-900 text-green-300',
  pending: 'bg-yellow-900 text-yellow-300',
  proposed: 'bg-blue-900 text-blue-300',
  'no-rss': 'bg-gray-800 text-gray-400',
  retired: 'bg-red-900 text-red-400',
};

export default function SourceTable() {
  const [sources, setSources] = useState<Source[]>([]);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/sources')
      .then((r) => r.json())
      .then((data) => { setSources(data); setLoading(false); });
  }, []);

  const filtered = sources.filter((s) => {
    const matchesText =
      !filter ||
      s.name.toLowerCase().includes(filter.toLowerCase()) ||
      s.tags.some((t) => t.includes(filter.toLowerCase())) ||
      s.category.toLowerCase().includes(filter.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesText && matchesStatus;
  });

  const counts = sources.reduce(
    (acc, s) => ({ ...acc, [s.status]: (acc[s.status] ?? 0) + 1 }),
    {} as Record<string, number>,
  );

  if (loading) return <p className="text-gray-400 py-8 text-center">Loading sources…</p>;

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'active', 'pending', 'proposed', 'no-rss'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              statusFilter === s
                ? 'bg-violet-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {s === 'all' ? `All (${sources.length})` : `${s} (${counts[s] ?? 0})`}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="search"
        placeholder="Filter by name, tag, or category…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-violet-500"
      />

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-800">
              <th className="py-2 pr-4 font-medium">Source</th>
              <th className="py-2 pr-4 font-medium">Category</th>
              <th className="py-2 pr-4 font-medium">Tags</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.name} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="py-2 pr-4">
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-400 hover:underline"
                    >
                      {s.name}
                    </a>
                  ) : (
                    <span className="text-gray-300">{s.name}</span>
                  )}
                </td>
                <td className="py-2 pr-4 text-gray-400">{s.category || '—'}</td>
                <td className="py-2 pr-4">
                  <div className="flex flex-wrap gap-1">
                    {s.tags.map((t) => (
                      <span key={t} className="px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded text-xs">
                        #{t}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[s.status]}`}>
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-gray-500 text-center py-8">No sources match the current filter.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/rss-manager/src/components/TopicList.tsx`**

```tsx
import { useEffect, useState } from 'react';

type Topic = {
  name: string;
  tags: string[];
  description: string;
  status: 'active' | 'proposed' | 'declined';
};

const STATUS_COLORS: Record<Topic['status'], string> = {
  active: 'bg-green-900 text-green-300',
  proposed: 'bg-blue-900 text-blue-300',
  declined: 'bg-gray-800 text-gray-500',
};

export default function TopicList() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/topics')
      .then((r) => r.json())
      .then((data) => { setTopics(data); setLoading(false); });
  }, []);

  if (loading) return <p className="text-gray-400 py-8 text-center">Loading topics…</p>;

  const byStatus = (status: Topic['status']) => topics.filter((t) => t.status === status);

  return (
    <div className="space-y-6">
      {(['active', 'proposed', 'declined'] as const).map((status) => {
        const group = byStatus(status);
        if (group.length === 0) return null;
        return (
          <div key={status}>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {status} ({group.length})
            </h3>
            <div className="space-y-2">
              {group.map((t) => (
                <div key={t.name} className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg">
                  <span className={`mt-0.5 px-2 py-0.5 rounded text-xs shrink-0 ${STATUS_COLORS[status]}`}>
                    {status}
                  </span>
                  <div>
                    <p className="text-gray-200 font-medium">{t.name}</p>
                    {t.description && <p className="text-gray-400 text-sm">{t.description}</p>}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {t.tags.map((tag) => (
                        <span key={tag} className="text-xs text-gray-500">#{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Create `apps/rss-manager/src/components/FeedValidator.tsx`**

```tsx
import { useState } from 'react';

type FeedResult = {
  valid: boolean;
  format?: string;
  title?: string;
  itemCount?: number;
  error?: string;
};

export default function FeedValidator() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<FeedResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function validate() {
    if (!url) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      setResult(await res.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <div className="flex gap-2">
        <input
          type="url"
          placeholder="https://example.com/rss.xml"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && validate()}
          className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-violet-500"
        />
        <button
          onClick={validate}
          disabled={!url || loading}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors"
        >
          {loading ? 'Checking…' : 'Validate'}
        </button>
      </div>

      {result && (
        <div className={`p-4 rounded-lg ${result.valid ? 'bg-green-900/30 border border-green-800' : 'bg-red-900/30 border border-red-800'}`}>
          {result.valid ? (
            <div className="space-y-1 text-sm">
              <p className="text-green-300 font-medium">✓ Valid {result.format?.toUpperCase()} feed</p>
              {result.title && <p className="text-gray-300">Title: {result.title}</p>}
              {result.itemCount !== undefined && (
                <p className="text-gray-400">{result.itemCount} item{result.itemCount !== 1 ? 's' : ''} found</p>
              )}
            </div>
          ) : (
            <p className="text-red-300 text-sm">✗ {result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/rss-manager/src/components/
git commit -m "feat(rss-manager): add SourceTable, TopicList, and FeedValidator components"
```

---

### Task 6: Main page shell

**Files:**
- Create: `apps/rss-manager/src/pages/index.astro`

- [ ] **Step 1: Create `apps/rss-manager/src/pages/index.astro`**

```astro
---
import SourceTable from '../components/SourceTable.tsx';
import TopicList from '../components/TopicList.tsx';
import FeedValidator from '../components/FeedValidator.tsx';

const tab = (Astro.url.searchParams.get('tab') ?? 'sources') as 'sources' | 'topics' | 'validate';
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>RSS Manager — Rainforest Tools</title>
    <style>
      body { background: #0f1117; color: #e2e4ed; font-family: system-ui, sans-serif; }
    </style>
  </head>
  <body class="min-h-screen">
    <div class="max-w-5xl mx-auto px-6 py-8">
      <header class="mb-8">
        <h1 class="text-2xl font-semibold text-gray-100">RSS Manager</h1>
        <p class="text-gray-500 text-sm mt-1">Browse and validate your Readwise RSS feeds.</p>
      </header>

      <!-- Tabs -->
      <nav class="flex gap-1 mb-6 border-b border-gray-800">
        {(['sources', 'topics', 'validate'] as const).map((t) => (
          <a
            href={`?tab=${t}`}
            class={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-violet-500 text-violet-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </a>
        ))}
      </nav>

      <!-- Tab content -->
      {tab === 'sources' && <SourceTable client:load />}
      {tab === 'topics' && <TopicList client:load />}
      {tab === 'validate' && <FeedValidator client:load />}
    </div>
  </body>
</html>
```

- [ ] **Step 2: End-to-end smoke test**

```bash
VAULT_PATH="/Users/rainforest/Library/Mobile Documents/iCloud~md~obsidian/Documents/rainforest-obsidian/_system" \
pnpm nx dev rss-manager &

# Open http://localhost:3002 and check:
# - Sources tab shows a filtered table with ~17+ sources
# - Topics tab shows active and proposed topics
# - Validate tab accepts a URL and returns feed info
# Try: https://astro.build/rss.xml → should return valid RSS

kill %1
```

- [ ] **Step 3: Commit**

```bash
git add apps/rss-manager/src/pages/index.astro
git commit -m "feat(rss-manager): add main page shell with tabbed navigation"
```

---

### Task 7: Dockerfile

**Files:**
- Create: `apps/rss-manager/Dockerfile`

- [ ] **Step 1: Create `apps/rss-manager/Dockerfile`**

```dockerfile
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/rss-manager/package.json apps/rss-manager/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --filter @rainforest-monorepo/rss-manager... --frozen-lockfile

COPY apps/rss-manager apps/rss-manager
RUN pnpm --filter @rainforest-monorepo/rss-manager run build

# Runtime image
FROM node:22-alpine AS runtime
WORKDIR /app

COPY --from=base /app/apps/rss-manager/dist ./dist
COPY --from=base /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3002
EXPOSE 3002

CMD ["node", "./dist/server/entry.mjs"]
```

- [ ] **Step 2: Verify Docker build**

```bash
cd ~/Repositories/rainforest-monorepo
docker build -f apps/rss-manager/Dockerfile -t rss-manager:local .
```

Expected: image builds successfully.

- [ ] **Step 3: Smoke test Docker image**

```bash
docker run --rm -p 3002:3002 \
  -e VAULT_PATH=/vault \
  -v "/Users/rainforest/Library/Mobile Documents/iCloud~md~obsidian/Documents/rainforest-obsidian/_system:/vault:ro" \
  rss-manager:local &

sleep 3
curl -s http://localhost:3002/api/sources | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d)} sources')"
# Expected: N sources (should match the count in your vault's RSS-Source-Registry.md)

docker stop $(docker ps -q --filter ancestor=rss-manager:local)
```

- [ ] **Step 4: Commit**

```bash
git add apps/rss-manager/Dockerfile
git commit -m "feat(rss-manager): add Dockerfile"
```

---

## Self-Review Checklist (do not skip)

After all tasks complete:

- [ ] `pnpm nx test rss-manager` — all 13 tests pass
- [ ] `/api/sources` returns all sources from the real vault file with correct status classification
- [ ] `/api/topics` returns all topics with correct status
- [ ] `/api/validate` returns `{ valid: true, format, title, itemCount }` for a real RSS URL
- [ ] Sources tab shows filterable table with status filter chips
- [ ] Topics tab shows topics grouped by status
- [ ] Validate tab fetches and displays result inline
- [ ] Docker smoke test passes with vault volume mount
- [ ] `VAULT_PATH` unset falls back to `/vault` (correct for Docker)
