# Personal MCP App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/personal-mcp`, a minimal Hono service wrapping `mcp-handler`, that will become the sole thing serving `mcp.rainforest.tools` once deployed and cut over (cutover is a separate plan).

**Architecture:** A single Hono app (`src/index.ts`) mounts the `mcp-handler`-produced Streamable HTTP handler at the project root (`/`) — this project serves nothing else, so there's no need for the `/api/mcp` sub-path or the host-conditional rewrite the previous (rejected) design relied on. Tools/resources (`src/tools.ts`) are ported from `apps/personal-website/src/pages/api/mcp.ts`, now importing profile data from `@rainforest-dev/personal-data` (built in the companion `2026-07-07-personal-data-library.md` plan — **that plan must be complete before starting this one**).

**Tech Stack:** Hono, `mcp-handler`, `@modelcontextprotocol/sdk`, `@hono/node-server` (local dev only), Zod, Vitest (via `Hono.request()` in-memory testing, no real server needed).

---

## Part 1: Design reference

See `docs/superpowers/specs/2026-07-07-personal-mcp-split-design.md` §5 and §7 (steps 2). Vercel has first-class Hono support confirmed via its own docs: a file at `index`/`app`/`server` (root or `src/`) that `export default`s the Hono app instance is auto-detected and deployed as Vercel Functions — no `vercel.json`, no manual runtime config needed for this app.

**Prerequisite:** `libs/personal-data` must exist and export `getEducation`, `getExperienceById`, `getProfileSummary`, `getProjectById`, `getProjects`, `getSkillById`, `getSkills`, `getWorkExperience`, `searchByTechnology`, `skillTags`, and the `SkillTag` type (see `2026-07-07-personal-data-library.md`). Verify this before starting:

```bash
cd /Users/rainforest/Repositories/rainforest-monorepo && npx nx build personal-data
```
Expected: succeeds.

---

## Part 2: Tasks

### Task 1: Scaffold `apps/personal-mcp`

**Files:**
- Create: `apps/personal-mcp/package.json`
- Create: `apps/personal-mcp/tsconfig.json`
- Create: `apps/personal-mcp/vitest.config.ts`
- Create: `apps/personal-mcp/src/index.ts` (placeholder, filled in Task 3)

- [ ] **Step 1: Create `apps/personal-mcp/package.json`**

```json
{
  "name": "@rainforest-dev/personal-mcp",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/serve.ts"
  },
  "nx": {
    "targets": {
      "dev": { "dependsOn": ["^build"] }
    }
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "@rainforest-dev/personal-data": "workspace:*",
    "hono": "^4.6.0",
    "mcp-handler": "^1.1.0",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@hono/node-server": "^1.13.0",
    "@types/node": "catalog:",
    "tsx": "^4.19.0",
    "typescript": "catalog:",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 2: Create `apps/personal-mcp/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "rootDir": "src",
    "outDir": "dist",
    "target": "ESNext",
    "moduleResolution": "bundler",
    "module": "ESNext",
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"]
}
```

- [ ] **Step 3: Create `apps/personal-mcp/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create a placeholder `apps/personal-mcp/src/index.ts`**

```typescript
import { Hono } from 'hono';

const app = new Hono();
app.get('/healthz', (c) => c.text('ok'));

export default app;
```

- [ ] **Step 5: Install dependencies**

Run: `cd /Users/rainforest/Repositories/rainforest-monorepo && pnpm install`
Expected: no errors; `apps/personal-mcp/node_modules/@rainforest-dev/personal-data` symlinks to `libs/personal-data`.

- [ ] **Step 6: Verify Nx recognizes the new project and the placeholder test target runs**

Run: `cd /Users/rainforest/Repositories/rainforest-monorepo && npx nx show project personal-mcp`
Expected: prints project info with an inferred `test` target (from `@nx/vitest`, matching `apps/rss-manager`'s `vitest.config.ts` pattern).

Run: `cd /Users/rainforest/Repositories/rainforest-monorepo && npx nx test personal-mcp`
Expected: "No test files found" or similar (no `*.test.ts` files yet) — not a failure, just nothing to run.

- [ ] **Step 7: Commit**

```bash
cd /Users/rainforest/Repositories/rainforest-monorepo
git add apps/personal-mcp package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(personal-mcp): scaffold empty Hono app

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Port the tools/resources

**Files:**
- Create: `apps/personal-mcp/src/tools.ts`
- Test: `apps/personal-mcp/src/tools.test.ts`

Ported from `apps/personal-website/src/pages/api/mcp.ts`'s `createMcpHandler` initializer callback — same six tools, same three resources, same descriptions and schemas. Only the imports change (`@rainforest-dev/personal-data` instead of the app-local `../../mcp/profile-data`, and the `skill` resource now uses `getSkillById` from the library instead of `astro:content`'s `getEntry`).

- [ ] **Step 1: Write the failing test**

This test exercises `registerTools` against a real in-memory `McpServer`, calling each tool and checking its JSON-RPC response shape — no HTTP layer involved yet (that's Task 3).

```typescript
// apps/personal-mcp/src/tools.test.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';

import { registerTools } from './tools';

async function callTool(name: string, args: Record<string, unknown> = {}) {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerTools(server);
  const result = await (server as unknown as {
    server: { _registeredTools: Record<string, { callback: (args: unknown) => Promise<unknown> }> };
  }).server._registeredTools[name].callback(args);
  return result as { content: Array<{ type: string; text: string }> };
}

describe('registerTools', () => {
  it('get_profile_summary returns counts and top technologies', async () => {
    const result = await callTool('get_profile_summary', { lang: 'en' });
    const summary = JSON.parse(result.content[0].text);
    expect(summary.experienceCount).toBeGreaterThan(0);
  });

  it('get_work_experience filters by technology', async () => {
    const result = await callTool('get_work_experience', { technology: 'auth0', lang: 'en' });
    const jobs = JSON.parse(result.content[0].text);
    expect(jobs.some((j: { id: string }) => j.id === 'en/6')).toBe(true);
  });

  it('get_education returns entries', async () => {
    const result = await callTool('get_education', { lang: 'en' });
    const education = JSON.parse(result.content[0].text);
    expect(Array.isArray(education)).toBe(true);
  });

  it('get_projects filters by technology', async () => {
    const result = await callTool('get_projects', { technology: 'nextjs', lang: 'en' });
    const projects = JSON.parse(result.content[0].text);
    expect(projects.some((p: { id: string }) => p.id === 'en/opencgt')).toBe(true);
  });

  it('get_skills returns entries', async () => {
    const result = await callTool('get_skills', { lang: 'en' });
    const skills = JSON.parse(result.content[0].text);
    expect(skills.some((s: { id: string }) => s.id === 'en/ts')).toBe(true);
  });

  it('search_by_technology matches across experiences and projects', async () => {
    const result = await callTool('search_by_technology', { query: 'next', lang: 'en' });
    const { projects } = JSON.parse(result.content[0].text);
    expect(projects.some((p: { id: string }) => p.id === 'en/opencgt')).toBe(true);
  });
});
```

*Note on the test helper:* reaching into `server._registeredTools` is a pragmatic way to unit-test each tool's callback in isolation without spinning up a transport. Task 3's tests exercise the same tools through the real HTTP/JSON-RPC surface (`tools/call`), which is the stronger, more realistic check — this test is a fast first pass while writing `tools.ts`, not the only test coverage for this behavior.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/rainforest/Repositories/rainforest-monorepo && npx nx test personal-mcp`
Expected: FAIL — `Cannot find module './tools'`

- [ ] **Step 3: Write `apps/personal-mcp/src/tools.ts`**

```typescript
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getEducation,
  getExperienceById,
  getProfileSummary,
  getProjectById,
  getProjects,
  getSkillById,
  getSkills,
  getWorkExperience,
  searchByTechnology,
  skillTags,
  type SkillTag,
} from '@rainforest-dev/personal-data';
import { z } from 'zod';

const langSchema = z.enum(['en', 'zh']).optional();
// Derived from the same skillTags vocabulary the content schemas use, rather than a
// plain z.string() — this makes the parsed value a real SkillTag, not just a string.
const technologySchema = z.enum(skillTags as unknown as [SkillTag, ...SkillTag[]]).optional();

export function registerTools(server: McpServer) {
  server.registerTool(
    'get_profile_summary',
    {
      description: 'Professional profile overview: counts and top technologies',
      inputSchema: { lang: langSchema },
    },
    async ({ lang }) => ({
      content: [{ type: 'text', text: JSON.stringify(await getProfileSummary({ lang })) }],
    }),
  );

  server.registerTool(
    'get_work_experience',
    {
      description: 'Work history, optionally filtered by technology',
      inputSchema: { technology: technologySchema, lang: langSchema },
    },
    async ({ technology, lang }) => ({
      content: [{ type: 'text', text: JSON.stringify(await getWorkExperience({ technology, lang })) }],
    }),
  );

  server.registerTool(
    'get_education',
    { description: 'Academic background', inputSchema: { lang: langSchema } },
    async ({ lang }) => ({
      content: [{ type: 'text', text: JSON.stringify(await getEducation({ lang })) }],
    }),
  );

  server.registerTool(
    'get_projects',
    {
      description: 'Portfolio projects, optionally filtered by technology',
      inputSchema: { technology: technologySchema, lang: langSchema },
    },
    async ({ technology, lang }) => ({
      content: [{ type: 'text', text: JSON.stringify(await getProjects({ technology, lang })) }],
    }),
  );

  server.registerTool(
    'get_skills',
    { description: 'Technical skills inventory', inputSchema: { lang: langSchema } },
    async ({ lang }) => ({
      content: [{ type: 'text', text: JSON.stringify(await getSkills({ lang })) }],
    }),
  );

  server.registerTool(
    'search_by_technology',
    {
      description: 'Substring-match a technology name across all experiences and projects',
      inputSchema: { query: z.string(), lang: langSchema },
    },
    async ({ query, lang }) => ({
      content: [{ type: 'text', text: JSON.stringify(await searchByTechnology(query, { lang })) }],
    }),
  );

  // `{+id}` (RFC 6570 reserved expansion) is required, not `{id}` — ids contain
  // slashes (e.g. `en/6`), and plain `{id}` expansion only matches one path segment.
  server.registerResource(
    'experience',
    new ResourceTemplate('profile://experience/{+id}', { list: undefined }),
    { title: 'Work/Education Experience', mimeType: 'application/json' },
    async (uri, { id }) => {
      const experience = await getExperienceById(id as string);
      if (!experience) throw new Error(`Experience not found: ${id}`);
      return { contents: [{ uri: uri.href, text: JSON.stringify(experience) }] };
    },
  );

  server.registerResource(
    'project',
    new ResourceTemplate('profile://project/{+id}', { list: undefined }),
    { title: 'Project', mimeType: 'application/json' },
    async (uri, { id }) => {
      const project = await getProjectById(id as string);
      if (!project) throw new Error(`Project not found: ${id}`);
      return { contents: [{ uri: uri.href, text: JSON.stringify(project) }] };
    },
  );

  server.registerResource(
    'skill',
    new ResourceTemplate('profile://skill/{+id}', { list: undefined }),
    { title: 'Skill', mimeType: 'application/json' },
    async (uri, { id }) => {
      const skill = await getSkillById(id as string);
      if (!skill) throw new Error(`Skill not found: ${id}`);
      return { contents: [{ uri: uri.href, text: JSON.stringify(skill) }] };
    },
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/rainforest/Repositories/rainforest-monorepo && npx nx test personal-mcp`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
cd /Users/rainforest/Repositories/rainforest-monorepo
git add apps/personal-mcp/src/tools.ts apps/personal-mcp/src/tools.test.ts
git commit -m "$(cat <<'EOF'
feat(personal-mcp): port MCP tool/resource registrations

Same six tools and three resources as apps/personal-website's original
/api/mcp route, now sourced from @rainforest-dev/personal-data. The
skill resource uses the library's getSkillById instead of astro:content's
getEntry, since this app has no Astro runtime at all.

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Wire the Hono app + mcp-handler

**Files:**
- Modify: `apps/personal-mcp/src/index.ts`
- Test: `apps/personal-mcp/src/index.test.ts`

- [ ] **Step 1: Write the failing test**

This is the realistic end-to-end test: real HTTP requests through Hono's in-memory `app.request()`, real JSON-RPC payloads, exercising the actual transport — no server process needed.

```typescript
// apps/personal-mcp/src/index.test.ts
import { describe, expect, it } from 'vitest';

import app from './index';

async function jsonRpc(body: Record<string, unknown>) {
  const res = await app.request('/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  // Streamable HTTP responses are SSE-framed ("event: message\ndata: {...}\n\n") —
  // extract the JSON payload from the "data:" line.
  const dataLine = text.split('\n').find((line) => line.startsWith('data:'));
  return { status: res.status, body: dataLine ? JSON.parse(dataLine.slice('data:'.length)) : undefined };
}

describe('personal-mcp HTTP surface', () => {
  it('GET /healthz responds ok', async () => {
    const res = await app.request('/healthz');
    expect(await res.text()).toBe('ok');
  });

  it('tools/list returns all six registered tools', async () => {
    const { status, body } = await jsonRpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(status).toBe(200);
    const names = body.result.tools.map((t: { name: string }) => t.name);
    expect(names).toEqual([
      'get_profile_summary',
      'get_work_experience',
      'get_education',
      'get_projects',
      'get_skills',
      'search_by_technology',
    ]);
  });

  it('tools/call get_work_experience returns resolved data over real HTTP', async () => {
    const { body } = await jsonRpc({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'get_work_experience', arguments: { technology: 'auth0', lang: 'en' } },
    });
    const jobs = JSON.parse(body.result.content[0].text);
    expect(jobs.some((j: { id: string }) => j.id === 'en/6')).toBe(true);
  });

  it('a GET request to the MCP endpoint is rejected (POST-only transport)', async () => {
    const res = await app.request('/', {
      method: 'GET',
      headers: { Accept: 'application/json, text/event-stream' },
    });
    expect(res.status).toBe(405);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/rainforest/Repositories/rainforest-monorepo && npx nx test personal-mcp`
Expected: FAIL — `tools/list` returns nothing (index.ts placeholder has no MCP wiring yet), or the request 404s.

- [ ] **Step 3: Write `apps/personal-mcp/src/index.ts`**

```typescript
import { createMcpHandler } from 'mcp-handler';
import { Hono } from 'hono';

import { registerTools } from './tools';

const app = new Hono();

// Root-level endpoint, not /api/mcp — this project serves *only* mcp.rainforest.tools,
// so there's no other content on this domain competing for the root path, and no
// domain-conditional rewrite is needed the way the old colocated design required.
const mcpHandler = createMcpHandler(registerTools, {}, {
  streamableHttpEndpoint: '/',
  disableSse: true,
});

app.post('/', (c) => mcpHandler(c.req.raw));
app.get('/healthz', (c) => c.text('ok'));

export default app;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/rainforest/Repositories/rainforest-monorepo && npx nx test personal-mcp`
Expected: PASS (all tests from Tasks 2 and 3)

- [ ] **Step 5: Commit**

```bash
cd /Users/rainforest/Repositories/rainforest-monorepo
git add apps/personal-mcp/src/index.ts apps/personal-mcp/src/index.test.ts
git commit -m "$(cat <<'EOF'
feat(personal-mcp): wire Hono app to mcp-handler at project root

Stateless, POST-only Streamable HTTP (disableSse: true) — same rationale
as the original design's transport choice. Endpoint lives at the project
root since this app serves nothing else.

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Local dev server + manual verification

**Files:**
- Create: `apps/personal-mcp/src/serve.ts`

- [ ] **Step 1: Write `apps/personal-mcp/src/serve.ts`**

```typescript
import { serve } from '@hono/node-server';

import app from './index';

const port = 3005;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`personal-mcp listening on http://localhost:${info.port}`);
});
```

- [ ] **Step 2: Start the dev server**

Run (background): `cd /Users/rainforest/Repositories/rainforest-monorepo/apps/personal-mcp && npx tsx src/serve.ts`
Expected: prints `personal-mcp listening on http://localhost:3005`

- [ ] **Step 3: Manually verify tools/list over real HTTP**

Run:
```bash
curl -s -X POST http://localhost:3005/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
Expected: SSE-framed response containing all six tool definitions (same shape as the `tools/list` test in Task 3).

- [ ] **Step 4: Manually verify a tool call**

Run:
```bash
curl -s -X POST http://localhost:3005/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_profile_summary","arguments":{}}}'
```
Expected: SSE-framed response with `experienceCount`, `projectCount`, `skillCount`, `topTechnologies` populated with real data.

- [ ] **Step 5: Manually verify a resource read**

Run:
```bash
curl -s -X POST http://localhost:3005/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"resources/read","params":{"uri":"profile://experience/en/6"}}'
```
Expected: SSE-framed response with the CodeGreen experience, `organization.name: "CodeGreen"`, `technologies` including `auth0`.

- [ ] **Step 6: Stop the dev server**

Kill the `tsx` process started in Step 2.

- [ ] **Step 7: Commit**

```bash
cd /Users/rainforest/Repositories/rainforest-monorepo
git add apps/personal-mcp/src/serve.ts
git commit -m "$(cat <<'EOF'
feat(personal-mcp): add local dev server entrypoint

Uses @hono/node-server directly rather than the Vercel CLI, since
`vercel dev` requires an interactive OAuth login this environment
can't complete. This script is dev-only — Vercel's own Hono framework
detection builds src/index.ts's default export directly in production,
untouched by this file.

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Part 3: Definition of done

- [ ] `npx nx test personal-mcp` passes (tools unit tests + full HTTP surface tests).
- [ ] Local `curl` verification against `http://localhost:3005/` (Task 4) confirms `tools/list`, a `tools/call`, and a `resources/read` all return correct, real data.
- [ ] `apps/personal-mcp` is **not yet deployed** — deployment, domain move, and `apps/personal-website` cleanup are handled by the follow-up cutover plan (`2026-07-07-personal-mcp-cutover.md`, to be written once this plan and the library plan are both done).
