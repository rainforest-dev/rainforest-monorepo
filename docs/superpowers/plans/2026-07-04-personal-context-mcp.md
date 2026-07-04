# Personal Context MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public, read-only, stateless MCP server at `mcp.rainforest.tools` exposing professional profile data (experiences, projects, skills) via Vercel's `mcp-handler` package.

**Architecture:** New Astro API route in `apps/personal-website` (already `output: 'server'`, deployed via `@astrojs/vercel`) reads the existing (currently unused) `organizations`/`experiences`/`projects`/`skills` content collections, resolves their `reference()` fields, and exposes them through 6 MCP tools + 3 MCP resources over stateless Streamable HTTP. No auth, no new infra.

**Tech Stack:** Astro content collections (`astro:content`), `mcp-handler`, `@modelcontextprotocol/sdk`, `zod`, Vitest (via `astro/config`'s `getViteConfig`).

**Spec:** `docs/superpowers/specs/2026-07-04-personal-context-mcp-design.md`

---

### Task 1: Vitest setup for `apps/personal-website`

**2026-07-05 revision:** the original version of this task used Astro's `getViteConfig` helper, on the assumption that it makes `astro:content` resolve live inside Vitest. It doesn't — this was tried and confirmed broken (Task 1's first implementer hit it; the controller then verified independently: even after a successful `astro build` that writes real data into `node_modules/.astro/data-store.json`, a Vitest process still sees every collection as empty). This is a known, unresolved gap in the wider Astro/Vitest ecosystem, not a local misconfiguration — see [withastro/astro#12836](https://github.com/withastro/astro/issues/12836) and [withastro/astro#7051](https://github.com/withastro/astro/issues/7051). The documented, ecosystem-standard fix is to **mock `astro:content` in tests** rather than resolve it live — see [Giorgiosaud: How to Mock astro:content in Vitest](https://www.giorgiosaud.io/notebook/how-to-mock-astro-content-in-vitest). This task (and Tasks 2-3) are rewritten around that fix. `profile-data.ts`'s implementation is unaffected — only how it's tested changes. Real, live content resolution is still verified, just later: Tasks 4-5's curl checks hit the actual running Astro dev server, which *does* populate content correctly outside of Vitest's process.

**Files:**
- Create: `apps/personal-website/vitest.config.ts`
- Create: `apps/personal-website/src/mcp/profile-data.fixtures.ts`
- Create: `apps/personal-website/src/mcp/smoke.test.ts`

- [ ] **Step 1: Add a plain vitest config (matches `apps/rss-manager`'s existing pattern — no Astro-specific plumbing needed once `astro:content` is mocked, not resolved live)**

```ts
// apps/personal-website/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 2: Add the shared fixture data used by every test in this plan**

```ts
// apps/personal-website/src/mcp/profile-data.fixtures.ts

export const organizationFixtures = [
  { id: 'en/codegreen', collection: 'organizations' as const, data: { name: 'CodeGreen', language: 'en', link: 'https://www.codegreen.org' } },
  { id: 'en/jubo', collection: 'organizations' as const, data: { name: 'Jubo', language: 'en' } },
  { id: 'en/master', collection: 'organizations' as const, data: { name: 'Master University', language: 'en' } },
];

export const experienceFixtures = [
  {
    id: 'en/6',
    collection: 'experiences' as const,
    data: {
      type: 'job' as const,
      language: 'en',
      organization: { collection: 'organizations' as const, id: 'en/codegreen' },
      position: 'Senior Frontend Engineer',
      startAt: new Date('2022-07-01'),
      endAt: new Date('2024-10-01'),
      technologies: [] as string[],
      projects: [{ collection: 'projects' as const, id: 'en/opencgt' }],
    },
    body: 'Worked at a startup from the ground up.',
  },
  {
    id: 'en/5',
    collection: 'experiences' as const,
    data: {
      type: 'job' as const,
      language: 'en',
      organization: { collection: 'organizations' as const, id: 'en/jubo' },
      position: 'Software Intern',
      startAt: new Date('2020-12-01'),
      endAt: new Date('2021-06-01'),
      technologies: ['react', 'flutter'],
      projects: [] as { collection: 'projects'; id: string }[],
    },
    body: 'Maintained long-term care applications.',
  },
  {
    id: 'en/2',
    collection: 'experiences' as const,
    data: {
      type: 'education' as const,
      language: 'en',
      organization: { collection: 'organizations' as const, id: 'en/master' },
      position: 'Master of Computer Science',
      startAt: new Date('2018-09-01'),
      endAt: new Date('2020-06-01'),
      technologies: [] as string[],
      projects: [] as { collection: 'projects'; id: string }[],
    },
    body: 'Graduate studies.',
  },
];

export const projectFixtures = [
  {
    id: 'en/opencgt',
    collection: 'projects' as const,
    data: {
      name: 'OpenCGT',
      language: 'en',
      technologies: ['nextjs', 'auth0', 'mui', 'playwright', 'vitest'],
      organization: { collection: 'organizations' as const, id: 'en/codegreen' },
      experience: { collection: 'experiences' as const, id: 'en/6' },
    },
    body: 'Led frontend development for a B2B product.',
  },
];

export const skillFixtures = [
  { id: 'en/ts', collection: 'skills' as const, data: { name: 'TypeScript', icon: 'typescript', tags: ['languages'] }, body: '' },
];

export const fixturesByCollection = {
  organizations: organizationFixtures,
  experiences: experienceFixtures,
  projects: projectFixtures,
  skills: skillFixtures,
};
```

- [ ] **Step 3: Write the smoke test that establishes the `astro:content` mocking pattern**

```ts
// apps/personal-website/src/mcp/smoke.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fixturesByCollection } from './profile-data.fixtures';

vi.mock('astro:content', () => ({
  getCollection: vi.fn(),
  getEntry: vi.fn(),
}));

import { getCollection, getEntry } from 'astro:content';

beforeEach(() => {
  vi.mocked(getCollection).mockImplementation(async (name: string, filter?: (e: unknown) => boolean) => {
    const entries = fixturesByCollection[name as keyof typeof fixturesByCollection] ?? [];
    return filter ? entries.filter(filter) : entries;
  });
  vi.mocked(getEntry).mockImplementation(async (a: unknown, b?: unknown) => {
    const [collection, id] = typeof a === 'string' ? [a, b as string] : [(a as { collection: string }).collection, (a as { id: string }).id];
    const entries = fixturesByCollection[collection as keyof typeof fixturesByCollection] ?? [];
    return entries.find((e) => e.id === id);
  });
});

describe('astro:content mocking harness', () => {
  it('returns fixture organizations through the mocked getCollection', async () => {
    const orgs = await getCollection('organizations');
    expect(orgs).toHaveLength(3);
  });

  it('resolves a single fixture entry through the mocked getEntry (reference-object form)', async () => {
    const org = await getEntry({ collection: 'organizations', id: 'en/codegreen' });
    expect(org?.data.name).toBe('CodeGreen');
  });

  it('resolves a single fixture entry through the mocked getEntry (two-arg form)', async () => {
    const org = await getEntry('organizations', 'en/codegreen');
    expect(org?.data.name).toBe('CodeGreen');
  });
});
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `cd apps/personal-website && npx vitest run src/mcp/smoke.test.ts`
Expected: PASS — 3 tests. This proves the mocking harness itself works, independent of the real Astro content-layer issue.

- [ ] **Step 5: Confirm Nx picks up the inferred test target**

Run: `npx nx test personal-website` (from repo root)
Expected: Same PASS result, run through Nx's `@nx/vitest` inferred target.

- [ ] **Step 6: Commit**

```bash
git add apps/personal-website/vitest.config.ts apps/personal-website/src/mcp/profile-data.fixtures.ts apps/personal-website/src/mcp/smoke.test.ts
git commit -m "test(personal-website): add vitest config and astro:content mocking harness"
```

---

### Task 2: Profile data access layer — experiences

**Files:**
- Create: `apps/personal-website/src/mcp/profile-data.ts`
- Create: `apps/personal-website/src/mcp/profile-data.test.ts`

- [ ] **Step 1: Write the failing test for `getWorkExperience`**

Uses the same `astro:content` mocking pattern established in Task 1's `smoke.test.ts` (see that task's revision note for why: live content resolution doesn't work inside Vitest, so every test in this file mocks `getCollection`/`getEntry` against fixture data instead).

```ts
// apps/personal-website/src/mcp/profile-data.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fixturesByCollection } from './profile-data.fixtures';

vi.mock('astro:content', () => ({
  getCollection: vi.fn(),
  getEntry: vi.fn(),
}));

import { getCollection, getEntry } from 'astro:content';
import { getWorkExperience } from './profile-data';

beforeEach(() => {
  vi.mocked(getCollection).mockImplementation(async (name: string, filter?: (e: unknown) => boolean) => {
    const entries = fixturesByCollection[name as keyof typeof fixturesByCollection] ?? [];
    return filter ? entries.filter(filter) : entries;
  });
  vi.mocked(getEntry).mockImplementation(async (a: unknown, b?: unknown) => {
    const [collection, id] = typeof a === 'string' ? [a, b as string] : [(a as { collection: string }).collection, (a as { id: string }).id];
    const entries = fixturesByCollection[collection as keyof typeof fixturesByCollection] ?? [];
    return entries.find((e) => e.id === id);
  });
});

describe('getWorkExperience', () => {
  it('returns only job-type entries for the given language', async () => {
    const jobs = await getWorkExperience({ lang: 'en' });
    expect(jobs.length).toBeGreaterThan(0);
    for (const job of jobs) {
      expect(job.language).toBe('en');
    }
    const codegreen = jobs.find((j) => j.id === 'en/6');
    expect(codegreen).toBeDefined();
    expect(codegreen?.position).toBe('Senior Frontend Engineer');
    expect(codegreen?.organization).toEqual({
      id: 'en/codegreen',
      name: 'CodeGreen',
      link: 'https://www.codegreen.org',
    });
    // en/6 declares no `technologies` field directly — this asserts it's merged
    // in from its linked projects (en/opencgt uses auth0), not left empty.
    expect(codegreen?.technologies).toContain('auth0');
  });

  it('filters by technology across the experience or its projects', async () => {
    const jobs = await getWorkExperience({ lang: 'en', technology: 'auth0' });
    // 'en/6' has no direct technologies field, but its project 'en/opencgt' uses auth0
    expect(jobs.some((j) => j.id === 'en/6')).toBe(true);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `cd apps/personal-website && npx vitest run src/mcp/profile-data.test.ts`
Expected: FAIL — `Failed to resolve import "./profile-data"`.

- [ ] **Step 3: Implement `profile-data.ts` — organization resolution + `getWorkExperience`**

```ts
// apps/personal-website/src/mcp/profile-data.ts
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import type { SkillTag } from '@types';

export interface ResolvedOrganization {
  id: string;
  name: string;
  link?: string;
}

export interface ResolvedExperience {
  id: string;
  type: 'job' | 'education';
  language: string;
  position: string;
  startAt: Date;
  endAt?: Date;
  technologies: SkillTag[];
  organization: ResolvedOrganization;
  content: string;
}

async function resolveOrganization(
  ref: CollectionEntry<'experiences'>['data']['organization'],
): Promise<ResolvedOrganization> {
  const org = await getEntry(ref);
  if (!org) throw new Error(`Organization not found: ${ref.id}`);
  return { id: org.id, name: org.data.name, link: org.data.link };
}

/**
 * Resolves an experience entry. `technologies` must be the already-merged set
 * (direct + linked projects') so the returned data stays consistent with
 * whatever technology filter was used to find this entry in the first place —
 * see `experienceTechnologies` below.
 */
async function resolveExperience(
  entry: CollectionEntry<'experiences'>,
  technologies: SkillTag[],
): Promise<ResolvedExperience> {
  return {
    id: entry.id,
    type: entry.data.type,
    language: entry.data.language,
    position: entry.data.position,
    startAt: entry.data.startAt,
    endAt: entry.data.endAt,
    technologies,
    organization: await resolveOrganization(entry.data.organization),
    content: entry.body ?? '',
  };
}

/** Technologies declared directly on the experience, plus technologies of any linked projects. */
async function experienceTechnologies(entry: CollectionEntry<'experiences'>): Promise<SkillTag[]> {
  const direct = entry.data.technologies ?? [];
  const projectRefs = entry.data.projects ?? [];
  const projects = await Promise.all(projectRefs.map((ref) => getEntry(ref)));
  const fromProjects = projects.flatMap((p) => p?.data.technologies ?? []);
  return Array.from(new Set([...direct, ...fromProjects]));
}

export async function getWorkExperience(
  options: { technology?: SkillTag; lang?: string } = {},
): Promise<ResolvedExperience[]> {
  const { technology, lang = 'en' } = options;
  const entries = await getCollection(
    'experiences',
    (entry) => entry.data.type === 'job' && entry.data.language === lang,
  );
  const withTech = await Promise.all(
    entries.map(async (entry) => ({
      entry,
      technologies: await experienceTechnologies(entry),
    })),
  );
  const filtered = technology
    ? withTech.filter(({ technologies }) => technologies.includes(technology))
    : withTech;
  return Promise.all(filtered.map(({ entry, technologies }) => resolveExperience(entry, technologies)));
}
```

- [ ] **Step 4: Run to confirm it passes**

Run: `cd apps/personal-website && npx vitest run src/mcp/profile-data.test.ts`
Expected: PASS — 2 tests. `codegreen` (`en/6`) has no directly-declared `technologies`, so this also confirms the merge: its resolved `technologies` array is non-empty (pulled from its linked projects).

- [ ] **Step 5: Commit**

```bash
git add apps/personal-website/src/mcp/profile-data.ts apps/personal-website/src/mcp/profile-data.test.ts
git commit -m "feat(personal-website): add getWorkExperience profile data accessor"
```

---

### Task 3: Profile data access layer — education, projects, skills, summary, search

**Files:**
- Modify: `apps/personal-website/src/mcp/profile-data.ts`
- Modify: `apps/personal-website/src/mcp/profile-data.test.ts`

- [ ] **Step 1: Add failing tests for the remaining accessors**

```ts
// append to apps/personal-website/src/mcp/profile-data.test.ts
import {
  getEducation,
  getProjects,
  getProfileSummary,
  getSkills,
  searchByTechnology,
} from './profile-data';

describe('getEducation', () => {
  it('returns only education-type entries', async () => {
    const education = await getEducation({ lang: 'en' });
    expect(education.length).toBeGreaterThan(0);
    for (const entry of education) {
      expect(entry.type).toBe('education');
    }
  });
});

describe('getProjects', () => {
  it('resolves organization and experience references', async () => {
    const projects = await getProjects({ lang: 'en' });
    const opencgt = projects.find((p) => p.id === 'en/opencgt');
    expect(opencgt).toBeDefined();
    expect(opencgt?.organization.id).toBe('en/codegreen');
    expect(opencgt?.experience).toBe('en/6');
    expect(opencgt?.technologies).toContain('auth0');
  });

  it('filters by technology', async () => {
    const projects = await getProjects({ lang: 'en', technology: 'playwright' });
    expect(projects.every((p) => p.technologies.includes('playwright'))).toBe(true);
    expect(projects.length).toBeGreaterThan(0);
  });
});

describe('getSkills', () => {
  it('returns skill entries with icon and tags', async () => {
    const skills = await getSkills({ lang: 'en' });
    const ts = skills.find((s) => s.id === 'en/ts');
    expect(ts).toBeDefined();
    expect(ts?.icon).toBe('typescript');
    expect(ts?.tags).toContain('languages');
  });
});

describe('getProfileSummary', () => {
  it('aggregates counts across collections', async () => {
    const summary = await getProfileSummary({ lang: 'en' });
    expect(summary.experienceCount).toBeGreaterThan(0);
    expect(summary.projectCount).toBeGreaterThan(0);
    expect(summary.skillCount).toBeGreaterThan(0);
    expect(summary.topTechnologies.length).toBeGreaterThan(0);
  });
});

describe('searchByTechnology', () => {
  it('substring-matches across experiences and projects', async () => {
    const results = await searchByTechnology('auth', { lang: 'en' });
    expect(results.experiences.some((e) => e.id === 'en/6')).toBe(true);
    expect(results.projects.some((p) => p.id === 'en/opencgt')).toBe(true);
  });

  it('returns empty results for a non-matching query', async () => {
    const results = await searchByTechnology('cobol', { lang: 'en' });
    expect(results.experiences).toHaveLength(0);
    expect(results.projects).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to confirm the new tests fail**

Run: `cd apps/personal-website && npx vitest run src/mcp/profile-data.test.ts`
Expected: FAIL — `getEducation`, `getProjects`, `getSkills`, `getProfileSummary`, `searchByTechnology` are not exported.

- [ ] **Step 3: Implement the remaining accessors**

```ts
// append to apps/personal-website/src/mcp/profile-data.ts

export async function getEducation(
  options: { lang?: string } = {},
): Promise<ResolvedExperience[]> {
  const { lang = 'en' } = options;
  const entries = await getCollection(
    'experiences',
    (entry) => entry.data.type === 'education' && entry.data.language === lang,
  );
  return Promise.all(
    entries.map(async (entry) => resolveExperience(entry, await experienceTechnologies(entry))),
  );
}

export interface ResolvedProject {
  id: string;
  name: string;
  language: string;
  technologies: SkillTag[];
  organization: ResolvedOrganization;
  experience: string;
  content: string;
}

async function resolveProject(entry: CollectionEntry<'projects'>): Promise<ResolvedProject> {
  return {
    id: entry.id,
    name: entry.data.name,
    language: entry.data.language,
    technologies: entry.data.technologies,
    organization: await resolveOrganization(entry.data.organization),
    experience: entry.data.experience.id,
    content: entry.body ?? '',
  };
}

export async function getProjects(
  options: { technology?: SkillTag; lang?: string } = {},
): Promise<ResolvedProject[]> {
  const { technology, lang = 'en' } = options;
  const entries = await getCollection(
    'projects',
    (entry) =>
      entry.data.language === lang &&
      (!technology || entry.data.technologies.includes(technology)),
  );
  return Promise.all(entries.map(resolveProject));
}

export interface ResolvedSkill {
  id: string;
  name: string;
  icon: SkillTag;
  tags: string[];
  content: string;
}

export async function getSkills(options: { lang?: string } = {}): Promise<ResolvedSkill[]> {
  const { lang = 'en' } = options;
  const entries = await getCollection('skills', (entry) => entry.id.startsWith(`${lang}/`));
  return entries.map((entry) => ({
    id: entry.id,
    name: entry.data.name,
    icon: entry.data.icon,
    tags: entry.data.tags ?? [],
    content: entry.body ?? '',
  }));
}

export interface ProfileSummary {
  experienceCount: number;
  projectCount: number;
  skillCount: number;
  topTechnologies: SkillTag[];
}

export async function getProfileSummary(options: { lang?: string } = {}): Promise<ProfileSummary> {
  const { lang = 'en' } = options;
  const [experiences, projects, skills] = await Promise.all([
    getWorkExperience({ lang }),
    getProjects({ lang }),
    getSkills({ lang }),
  ]);
  const techCounts = new Map<SkillTag, number>();
  for (const exp of experiences) {
    for (const tech of exp.technologies) techCounts.set(tech, (techCounts.get(tech) ?? 0) + 1);
  }
  for (const project of projects) {
    for (const tech of project.technologies) techCounts.set(tech, (techCounts.get(tech) ?? 0) + 1);
  }
  const topTechnologies = [...techCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tech]) => tech);
  return {
    experienceCount: experiences.length,
    projectCount: projects.length,
    skillCount: skills.length,
    topTechnologies,
  };
}

export async function searchByTechnology(
  query: string,
  options: { lang?: string } = {},
): Promise<{ experiences: ResolvedExperience[]; projects: ResolvedProject[] }> {
  const { lang = 'en' } = options;
  const q = query.toLowerCase();
  const [experiences, projects] = await Promise.all([
    getWorkExperience({ lang }),
    getProjects({ lang }),
  ]);
  return {
    experiences: experiences.filter((e) => e.technologies.some((t) => t.toLowerCase().includes(q))),
    projects: projects.filter((p) => p.technologies.some((t) => t.toLowerCase().includes(q))),
  };
}
```

- [ ] **Step 4: Run to confirm all tests pass**

Run: `cd apps/personal-website && npx vitest run src/mcp/profile-data.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/personal-website/src/mcp/profile-data.ts apps/personal-website/src/mcp/profile-data.test.ts
git commit -m "feat(personal-website): add remaining profile data accessors"
```

---

### Task 4: Install `mcp-handler` and spike Astro compatibility

This resolves the design spec's open risk (§3): confirm `mcp-handler`'s handler wires into an Astro `APIRoute` before building the full tool surface on top of it.

**Files:**
- Modify: `apps/personal-website/package.json`
- Create: `apps/personal-website/src/pages/api/mcp.ts`

- [ ] **Step 1: Install dependencies**

Run: `cd apps/personal-website && pnpm add mcp-handler @modelcontextprotocol/sdk zod`
Expected: dependencies added to `apps/personal-website/package.json`.

- [ ] **Step 2: Write the spike route with a single tool**

```ts
// apps/personal-website/src/pages/api/mcp.ts
import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import type { APIRoute } from 'astro';

const handler = createMcpHandler(
  (server) => {
    server.tool('ping', 'Health check tool', { echo: z.string().optional() }, async ({ echo }) => ({
      content: [{ type: 'text', text: `pong${echo ? `: ${echo}` : ''}` }],
    }));
  },
  {},
  { basePath: '/api' },
);

// Stateless, POST-only per the design spec (§4): no GET/SSE stream (no server-initiated
// push needed for a read-only server) and no DELETE (no sessions to terminate).
export const POST: APIRoute = ({ request }) => handler(request);
```

- [ ] **Step 3: Run the dev server and verify the spike responds**

Run: `cd apps/personal-website && npx astro dev --port 4322 &` then, once it's up:
Run: `curl -s -X POST http://localhost:4322/api/mcp -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`
Expected: JSON-RPC response listing the `ping` tool. **If this instead errors** (e.g., a Next.js-specific assumption inside `mcp-handler` about the request/route shape), fall back to `@modelcontextprotocol/sdk`'s `StreamableHTTPServerTransport` directly in stateless mode inside the same file, and note the fallback in the design spec's §3 risk callout before continuing.
Stop the dev server: `kill %1`

- [ ] **Step 4: Commit**

```bash
git add apps/personal-website/package.json apps/personal-website/pnpm-lock.yaml apps/personal-website/src/pages/api/mcp.ts
git commit -m "feat(personal-website): spike mcp-handler on an Astro API route"
```

---

### Task 5: Wire all 6 tools and 3 resources

**2026-07-05 note:** uses `server.registerTool(name, {description, inputSchema}, cb)` for all 6 tools, not `server.tool(name, description, schema, cb)` — Task 4's code-quality review found the latter is deprecated in the installed `@modelcontextprotocol/sdk@1.29.0` (`astro check` surfaces the warning directly) and Task 4's spike was already fixed to match. Zod stays pinned to `^3.25.76` (not bumped to match `astro/zod`'s v4) — see Task 4's fix commit for the reasoning.

**Files:**
- Modify: `apps/personal-website/src/pages/api/mcp.ts`

- [ ] **Step 1: Replace the spike tool with the full tool/resource surface**

```ts
// apps/personal-website/src/pages/api/mcp.ts
import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import type { APIRoute } from 'astro';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getEducation,
  getProfileSummary,
  getProjects,
  getSkills,
  getWorkExperience,
  searchByTechnology,
} from '../../mcp/profile-data';
import { getEntry } from 'astro:content';

const langSchema = z.enum(['en', 'zh']).optional();
const technologySchema = z.string().optional();

const handler = createMcpHandler(
  (server) => {
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
        content: [
          { type: 'text', text: JSON.stringify(await getWorkExperience({ technology: technology as any, lang })) },
        ],
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
        content: [
          { type: 'text', text: JSON.stringify(await getProjects({ technology: technology as any, lang })) },
        ],
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

    // `{+id}` (RFC 6570 reserved expansion) is required, not `{id}` — our ids contain
    // slashes (e.g. `en/6`), and plain `{id}` expansion only matches a single path segment.
    server.registerResource(
      'experience',
      new ResourceTemplate('profile://experience/{+id}', { list: undefined }),
      { title: 'Work/Education Experience', mimeType: 'application/json' },
      async (uri, { id }) => {
        const entry = await getEntry('experiences', id as string);
        if (!entry) throw new Error(`Experience not found: ${id}`);
        return { contents: [{ uri: uri.href, text: JSON.stringify(entry.data) }] };
      },
    );

    server.registerResource(
      'project',
      new ResourceTemplate('profile://project/{+id}', { list: undefined }),
      { title: 'Project', mimeType: 'application/json' },
      async (uri, { id }) => {
        const entry = await getEntry('projects', id as string);
        if (!entry) throw new Error(`Project not found: ${id}`);
        return { contents: [{ uri: uri.href, text: JSON.stringify(entry.data) }] };
      },
    );

    server.registerResource(
      'skill',
      new ResourceTemplate('profile://skill/{+id}', { list: undefined }),
      { title: 'Skill', mimeType: 'application/json' },
      async (uri, { id }) => {
        const entry = await getEntry('skills', id as string);
        if (!entry) throw new Error(`Skill not found: ${id}`);
        return { contents: [{ uri: uri.href, text: JSON.stringify(entry.data) }] };
      },
    );
  },
  {},
  { basePath: '/api' },
);

// Stateless, POST-only per the design spec (§4) — same rationale as Task 4's spike.
export const POST: APIRoute = ({ request }) => handler(request);
```

- [ ] **Step 2: Manually verify each tool via curl against the dev server**

Run: `cd apps/personal-website && npx astro dev --port 4322 &`
Run each (expect a JSON-RPC result with no `error` field):

```bash
curl -s -X POST http://localhost:4322/api/mcp -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_profile_summary","arguments":{"lang":"en"}}}'

curl -s -X POST http://localhost:4322/api/mcp -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_by_technology","arguments":{"query":"auth","lang":"en"}}}'

curl -s -X POST http://localhost:4322/api/mcp -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"resources/read","params":{"uri":"profile://experience/en/6"}}'
```

Stop the dev server: `kill %1`

- [ ] **Step 3: Commit**

```bash
git add apps/personal-website/src/pages/api/mcp.ts
git commit -m "feat(personal-website): wire full MCP tool and resource surface"
```

---

### Task 6: Configure `mcp.rainforest.tools` on Vercel

Manual dashboard/CLI steps (no code) — done once, not repeatable via a test.

**Files:** none (Vercel project configuration).

- [ ] **Step 1: Add the domain in the Vercel project**

Run: `cd apps/personal-website && npx vercel domains add mcp.rainforest.tools` (or via the Vercel dashboard → Project → Settings → Domains), pointing it at the same `personal-website` project as `rainforest.tools`.

- [ ] **Step 2: Add a rewrite so the subdomain root maps to the API route**

```json
// apps/personal-website/vercel.json (create if it doesn't already exist)
{
  "rewrites": [
    {
      "source": "/",
      "has": [{ "type": "host", "value": "mcp.rainforest.tools" }],
      "destination": "/api/mcp"
    }
  ]
}
```

If `vercel.json` already exists with other rewrites/config, add this entry to the existing `rewrites` array instead of replacing the file.

- [ ] **Step 3: Deploy and verify DNS/routing**

Run: `git push` (triggers the existing Vercel deployment pipeline) then, once deployed:
Run: `curl -s -X POST https://mcp.rainforest.tools -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`
Expected: JSON-RPC response listing all 6 tools.

- [ ] **Step 4: Commit the vercel.json change**

```bash
git add apps/personal-website/vercel.json
git commit -m "chore(personal-website): route mcp.rainforest.tools to the MCP API endpoint"
```

---

### Task 7: Verify with a real MCP client

**Files:** none — verification only.

- [ ] **Step 1: Connect Claude Code (or Claude.ai) to the deployed server**

Add to the relevant MCP client config:

```json
{
  "mcpServers": {
    "personal-context": {
      "url": "https://mcp.rainforest.tools"
    }
  }
}
```

- [ ] **Step 2: Confirm the client lists all 6 tools and can call at least one successfully**

Ask the connected client to call `get_profile_summary` and `search_by_technology` with a real query (e.g. `"react"`), and confirm the returned JSON matches what Task 5's curl checks produced.

- [ ] **Step 3: Note results in the design spec**

Add a short "Verified" note under the design spec's §9 Testing section recording the date and which client was used — no code change, just closing the loop on the spec.
