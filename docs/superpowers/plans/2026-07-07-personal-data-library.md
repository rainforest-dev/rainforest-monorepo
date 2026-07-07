# Personal Data Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the profile content (organizations/experiences/projects/skills) and its data-access layer out of `apps/personal-website`'s Astro-specific `astro:content` system into a plain, framework-agnostic Nx library, so it can be imported by both `apps/personal-website` and the future `apps/personal-mcp`.

**Architecture:** New library `libs/personal-data` (package `@rainforest-dev/personal-data`) owns the raw content files, Zod schemas, canonical vocabularies, a plain filesystem-based loader (replacing `astro:content`'s `getCollection`/`getEntry`), and the resolve/get functions currently in `apps/personal-website/src/mcp/profile-data.ts`. `apps/personal-website` is then updated to import from this library instead of defining these things locally.

**Tech Stack:** TypeScript, Zod, `gray-matter` (frontmatter parsing), `fast-glob` (file discovery), Vite (library build via `vite-plugin-dts`), Vitest (`@nx/vitest` inferred `test` target).

---

## Part 1: Design reference

See `docs/superpowers/specs/2026-07-07-personal-mcp-split-design.md` for the full rationale. This plan implements that spec's §3–4 and the first part of §7 (steps 1).

Source files being ported (read these before starting, they are the ground truth for behavior):
- `apps/personal-website/src/mcp/profile-data.ts` (business logic to port)
- `apps/personal-website/src/mcp/profile-data.fixtures.ts` (fixtures — become real test data instead)
- `apps/personal-website/src/mcp/smoke.test.ts` (the `astro:content` mocking harness — being replaced, not ported)
- `apps/personal-website/src/content.config.ts` (schemas being ported, only the `organizations`/`experiences`/`projects`/`skills` collections — `blog`/`authors` stay in `apps/personal-website`, out of scope)
- `apps/personal-website/src/utils/constants/index.ts` (the `tags.skills`/`tags.experience` arrays — canonical vocab source moves to the lib)
- `apps/personal-website/src/utils/i18n/settings.ts` (the `supportedLngs` array — canonical vocab source moves to the lib)
- `apps/personal-website/src/data/{organizations,experiences,projects,skills}/**` (the actual content files, moving)

Confirmed on-disk frontmatter shapes (read directly, not assumed from the Astro schema):
- `organizations/{lang}/{id}.json` — plain JSON, no body: `{"name": "...", "link": "...", "language": "en"}`.
- `experiences/{lang}/{id}.md` — frontmatter + markdown body. Reference fields (`organization`, `projects`) are **plain string IDs** in the frontmatter (e.g. `organization: 'en/codegreen'`, `projects: [en/hashgreen-dex, ...]`) — Astro's `reference()` helper is what turns these into `{collection, id}` objects at parse time; our own loader does not need to reproduce that indirection, it can treat them as plain strings directly.
- `projects/{lang}/{id}.md` — same shape, `organization`/`experience` are plain string IDs.
- `skills/{lang}/{id}.md` — frontmatter only (`name`, `icon`, `tags`), body unused by the current UI but preserved for parity.

---

## Part 2: Tasks

### Task 1: Scaffold the `libs/personal-data` package

**Files:**
- Create: `libs/personal-data/package.json`
- Create: `libs/personal-data/tsconfig.json`
- Create: `libs/personal-data/tsconfig.lib.json`
- Create: `libs/personal-data/vite.config.ts`
- Create: `libs/personal-data/src/index.ts` (placeholder export, filled in later tasks)

- [ ] **Step 1: Create `libs/personal-data/package.json`**

```json
{
  "name": "@rainforest-dev/personal-data",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.cjs"
    }
  },
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "typings": "./dist/index.d.ts",
  "files": ["dist", "!**/*.tsbuildinfo"],
  "nx": {
    "sourceRoot": "libs/personal-data/src",
    "name": "personal-data"
  },
  "dependencies": {
    "fast-glob": "^3.3.3",
    "gray-matter": "^4.0.3",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "vite-plugin-dts": "^4.5.4"
  }
}
```

- [ ] **Step 2: Create `libs/personal-data/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "files": [],
  "include": [],
  "references": [{ "path": "./tsconfig.lib.json" }]
}
```

- [ ] **Step 3: Create `libs/personal-data/tsconfig.lib.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "rootDir": "src",
    "outDir": "dist",
    "tsBuildInfoFile": "dist/tsconfig.lib.tsbuildinfo",
    "emitDeclarationOnly": false,
    "target": "ESNext",
    "moduleResolution": "bundler",
    "module": "ESNext",
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "references": [],
  "exclude": [
    "vite.config.ts",
    "src/**/*.test.ts",
    "src/**/*.spec.ts"
  ]
}
```

- [ ] **Step 4: Create `libs/personal-data/vite.config.ts`**

```typescript
import * as path from 'path';
import dts from 'vite-plugin-dts';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/personal-data',
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
      entry: { index: 'src/index.ts' },
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
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
      reportsDirectory: '../../coverage/libs/personal-data',
      provider: 'v8',
    },
  },
});
```

- [ ] **Step 5: Create a placeholder `libs/personal-data/src/index.ts`**

```typescript
export const PLACEHOLDER = true;
```

- [ ] **Step 6: Install dependencies**

Run: `cd /Users/rainforest/Repositories/rainforest-monorepo && pnpm install`
Expected: lockfile updates to include `fast-glob`, `gray-matter`, `vite-plugin-dts` for the new `personal-data` workspace package; no errors.

- [ ] **Step 7: Verify Nx recognizes the new project**

Run: `cd /Users/rainforest/Repositories/rainforest-monorepo && npx nx show project personal-data`
Expected: prints project info including inferred `build` and `test` targets (from `@nx/vite`/`@nx/vitest`, matching how `libs/rainforest-ui` is inferred — no `project.json` needed).

- [ ] **Step 8: Commit**

```bash
cd /Users/rainforest/Repositories/rainforest-monorepo
git add libs/personal-data package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(personal-data): scaffold empty library package

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Canonical vocab

**Files:**
- Create: `libs/personal-data/src/vocab.ts`
- Test: `libs/personal-data/src/vocab.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// libs/personal-data/src/vocab.test.ts
import { describe, expect, it } from 'vitest';

import { experienceTypes, locales, skillTags } from './vocab';

describe('vocab', () => {
  it('exposes the skill tag vocabulary as a readonly tuple', () => {
    expect(skillTags).toContain('typescript');
    expect(skillTags).toContain('nextjs');
    expect(skillTags.length).toBe(22);
  });

  it('exposes job/education as the only experience types', () => {
    expect(experienceTypes).toEqual(['job', 'education']);
  });

  it('exposes en/zh as the only supported locales', () => {
    expect(locales).toEqual(['en', 'zh']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/rainforest/Repositories/rainforest-monorepo && npx nx test personal-data`
Expected: FAIL — `Cannot find module './vocab'`

- [ ] **Step 3: Write `libs/personal-data/src/vocab.ts`**

```typescript
// The single source of truth for the technology/experience-type/locale vocabulary
// used both by this library's own Zod schemas and by apps/personal-website's UI
// (which imports these arrays via @rainforest-dev/personal-data instead of
// defining them locally — see docs/superpowers/specs/2026-07-07-personal-mcp-split-design.md §3).
export const skillTags = [
  'nextjs',
  'vue',
  'docker',
  'flutter',
  'react',
  'tailwindcss',
  'mui',
  'auth0',
  'qwik',
  'playwright',
  'vitest',
  'python',
  'pytorch',
  'fastapi',
  'swift',
  'github-actions',
  'nodejs',
  'nx',
  'vite',
  'typescript',
  'express',
  'terraform',
] as const;

export const experienceTypes = ['job', 'education'] as const;

export const locales = ['en', 'zh'] as const;

export type SkillTag = (typeof skillTags)[number];
export type ExperienceType = (typeof experienceTypes)[number];
export type Locale = (typeof locales)[number];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/rainforest/Repositories/rainforest-monorepo && npx nx test personal-data`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
cd /Users/rainforest/Repositories/rainforest-monorepo
git add libs/personal-data/src/vocab.ts libs/personal-data/src/vocab.test.ts
git commit -m "$(cat <<'EOF'
feat(personal-data): add canonical skill/experience/locale vocabulary

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Zod schemas

**Files:**
- Create: `libs/personal-data/src/schemas.ts`
- Test: `libs/personal-data/src/schemas.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// libs/personal-data/src/schemas.test.ts
import { describe, expect, it } from 'vitest';

import {
  experienceSchema,
  organizationSchema,
  projectSchema,
  skillSchema,
} from './schemas';

describe('schemas', () => {
  it('parses a valid organization', () => {
    const org = organizationSchema.parse({
      name: 'CodeGreen',
      link: 'https://www.codegreen.org',
      language: 'en',
    });
    expect(org.name).toBe('CodeGreen');
  });

  it('rejects an organization with an invalid language', () => {
    expect(() =>
      organizationSchema.parse({ name: 'X', language: 'fr' }),
    ).toThrow();
  });

  it('parses a valid experience with reference fields as plain string ids', () => {
    const exp = experienceSchema.parse({
      type: 'job',
      language: 'en',
      organization: 'en/codegreen',
      position: 'Senior Frontend Engineer',
      startAt: '2022-07',
      endAt: '2024-10',
      projects: ['en/opencgt'],
    });
    expect(exp.organization).toBe('en/codegreen');
    expect(exp.technologies).toEqual([]);
    expect(exp.startAt).toBeInstanceOf(Date);
  });

  it('rejects an experience with an unknown technology tag', () => {
    expect(() =>
      experienceSchema.parse({
        type: 'job',
        language: 'en',
        organization: 'en/codegreen',
        position: 'X',
        startAt: '2022-07',
        technologies: ['not-a-real-tag'],
      }),
    ).toThrow();
  });

  it('parses a valid project', () => {
    const project = projectSchema.parse({
      name: 'OpenCGT',
      language: 'en',
      technologies: ['nextjs', 'auth0'],
      organization: 'en/codegreen',
      experience: 'en/6',
    });
    expect(project.technologies).toEqual(['nextjs', 'auth0']);
  });

  it('parses a valid skill with default empty tags', () => {
    const skill = skillSchema.parse({ name: 'TypeScript', icon: 'typescript' });
    expect(skill.tags).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/rainforest/Repositories/rainforest-monorepo && npx nx test personal-data`
Expected: FAIL — `Cannot find module './schemas'`

- [ ] **Step 3: Write `libs/personal-data/src/schemas.ts`**

```typescript
import { z } from 'zod';

import { experienceTypes, locales, skillTags } from './vocab';

export const organizationSchema = z.object({
  name: z.string(),
  language: z.enum(locales),
  department: z.string().optional(),
  link: z.string().url().optional(),
});

export const experienceSchema = z.object({
  type: z.enum(experienceTypes),
  language: z.enum(locales),
  organization: z.string(),
  position: z.string(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional(),
  technologies: z.array(z.enum(skillTags)).default([]),
  projects: z.array(z.string()).default([]),
});

export const projectSchema = z.object({
  name: z.string(),
  language: z.enum(locales),
  technologies: z.array(z.enum(skillTags)),
  organization: z.string(),
  experience: z.string(),
});

export const skillSchema = z.object({
  name: z.string(),
  icon: z.enum(skillTags),
  tags: z.array(z.string()).default([]),
});

export type OrganizationData = z.infer<typeof organizationSchema>;
export type ExperienceData = z.infer<typeof experienceSchema>;
export type ProjectData = z.infer<typeof projectSchema>;
export type SkillData = z.infer<typeof skillSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/rainforest/Repositories/rainforest-monorepo && npx nx test personal-data`
Expected: PASS (all tests from Task 2 and Task 3)

- [ ] **Step 5: Commit**

```bash
cd /Users/rainforest/Repositories/rainforest-monorepo
git add libs/personal-data/src/schemas.ts libs/personal-data/src/schemas.test.ts
git commit -m "$(cat <<'EOF'
feat(personal-data): add Zod schemas for organizations/experiences/projects/skills

Reference fields (organization, projects, experience) are plain string
ids here, not Astro's reference() objects — the on-disk frontmatter
already stores them as plain strings; reference() was Astro's own
runtime transform, not something the source data required.

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Move the content data files

**Files:**
- Create: `libs/personal-data/src/data/organizations/{en,zh}/*.json` (copied from `apps/personal-website/src/data/organizations/`)
- Create: `libs/personal-data/src/data/experiences/{en,zh}/*.md` (copied from `apps/personal-website/src/data/experiences/`)
- Create: `libs/personal-data/src/data/projects/{en,zh}/*.md` (copied from `apps/personal-website/src/data/projects/`)
- Create: `libs/personal-data/src/data/skills/{en,zh}/*.md` (copied from `apps/personal-website/src/data/skills/`)
- Delete: the four source directories under `apps/personal-website/src/data/` listed above (`blog`/`authors` stay — out of scope)

- [ ] **Step 1: Move the files with git (preserves history)**

```bash
cd /Users/rainforest/Repositories/rainforest-monorepo
mkdir -p libs/personal-data/src/data
git mv apps/personal-website/src/data/organizations libs/personal-data/src/data/organizations
git mv apps/personal-website/src/data/experiences libs/personal-data/src/data/experiences
git mv apps/personal-website/src/data/projects libs/personal-data/src/data/projects
git mv apps/personal-website/src/data/skills libs/personal-data/src/data/skills
```

- [ ] **Step 2: Verify the move**

Run: `find libs/personal-data/src/data -type f | wc -l` (expect 52: 12 organizations + 12 experiences + 8 projects + 26 skills — recount against `find apps/personal-website/src/data/{organizations,experiences,projects,skills} -type f | wc -l` run *before* Step 1 if you want to double check the exact number; the point is nothing got lost, not that it's exactly 52)
Run: `ls apps/personal-website/src/data/` (expect only `blog` and `authors` remain)

- [ ] **Step 3: Commit**

```bash
cd /Users/rainforest/Repositories/rainforest-monorepo
git add -A
git commit -m "$(cat <<'EOF'
feat(personal-data): move organizations/experiences/projects/skills content files

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Filesystem-based loader

**Files:**
- Create: `libs/personal-data/src/loader.ts`
- Test: `libs/personal-data/src/loader.test.ts`

This replaces `astro:content`'s `getCollection`/`getEntry`. It reads the **real files** moved in Task 4 — no mocking, which is the whole point of this migration (see spec §1, §6).

- [ ] **Step 1: Write the failing test**

```typescript
// libs/personal-data/src/loader.test.ts
import { describe, expect, it } from 'vitest';

import { getCollection, getEntry } from './loader';

describe('loader', () => {
  it('loads all organization entries from real JSON files', async () => {
    const orgs = await getCollection('organizations');
    expect(orgs.length).toBeGreaterThan(0);
    const codegreenEn = orgs.find((o) => o.id === 'en/codegreen');
    expect(codegreenEn?.data.name).toBe('CodeGreen');
    expect(codegreenEn?.body).toBe('');
  });

  it('loads all experience entries from real markdown files, parsing frontmatter and body', async () => {
    const entry = await getEntry('experiences', 'en/6');
    expect(entry?.data.organization).toBe('en/codegreen');
    expect(entry?.data.projects).toContain('en/opencgt');
    expect(entry?.body).toContain('Worked at a startup');
  });

  it('supports a filter predicate on getCollection', async () => {
    const jobs = await getCollection('experiences', (e) => e.data.type === 'job' && e.data.language === 'en');
    expect(jobs.every((e) => e.data.type === 'job' && e.data.language === 'en')).toBe(true);
  });

  it('returns undefined from getEntry for an unknown id', async () => {
    const missing = await getEntry('organizations', 'en/does-not-exist');
    expect(missing).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/rainforest/Repositories/rainforest-monorepo && npx nx test personal-data`
Expected: FAIL — `Cannot find module './loader'`

- [ ] **Step 3: Write `libs/personal-data/src/loader.ts`**

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';

import fg from 'fast-glob';
import matter from 'gray-matter';
import type { z } from 'zod';

import {
  experienceSchema,
  organizationSchema,
  projectSchema,
  skillSchema,
} from './schemas';

const DATA_ROOT = path.join(__dirname, 'data');

const schemas = {
  organizations: organizationSchema,
  experiences: experienceSchema,
  projects: projectSchema,
  skills: skillSchema,
} as const;

type CollectionName = keyof typeof schemas;

export interface Entry<Data> {
  id: string;
  data: Data;
  body: string;
}

type CollectionData<C extends CollectionName> = z.infer<(typeof schemas)[C]>;

function readEntry<C extends CollectionName>(collection: C, filePath: string): Entry<CollectionData<C>> {
  const collectionRoot = path.join(DATA_ROOT, collection);
  const id = path
    .relative(collectionRoot, filePath)
    .replace(/\.(md|json)$/, '')
    .split(path.sep)
    .join('/');
  const schema = schemas[collection];

  if (filePath.endsWith('.json')) {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return { id, data: schema.parse(raw) as CollectionData<C>, body: '' };
  }

  const { data, content } = matter(fs.readFileSync(filePath, 'utf-8'));
  return { id, data: schema.parse(data) as CollectionData<C>, body: content.trim() };
}

export async function getCollection<C extends CollectionName>(
  collection: C,
  filter?: (entry: Entry<CollectionData<C>>) => boolean,
): Promise<Entry<CollectionData<C>>[]> {
  const collectionRoot = path.join(DATA_ROOT, collection);
  const pattern = collection === 'organizations' ? '**/*.json' : '**/*.md';
  const files = fg.sync(pattern, { cwd: collectionRoot, absolute: true });
  const entries = files.map((file) => readEntry(collection, file));
  return filter ? entries.filter(filter) : entries;
}

export async function getEntry<C extends CollectionName>(
  collection: C,
  id: string,
): Promise<Entry<CollectionData<C>> | undefined> {
  const entries = await getCollection(collection);
  return entries.find((entry) => entry.id === id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/rainforest/Repositories/rainforest-monorepo && npx nx test personal-data`
Expected: PASS (all tests from Tasks 2, 3, and 5)

- [ ] **Step 5: Commit**

```bash
cd /Users/rainforest/Repositories/rainforest-monorepo
git add libs/personal-data/src/loader.ts libs/personal-data/src/loader.test.ts
git commit -m "$(cat <<'EOF'
feat(personal-data): add filesystem-based collection loader

Replaces astro:content's getCollection/getEntry with plain fs + fast-glob
+ gray-matter reads against real files — no framework runtime dependency,
and no mocking needed in tests (this is the fix for the astro:content/
Vitest gap documented in 2026-07-04-personal-context-mcp-design.md §9).

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Port the data-access layer (`profile-data.ts`)

**Files:**
- Create: `libs/personal-data/src/profile-data.ts`
- Test: `libs/personal-data/src/profile-data.test.ts`

This ports every exported function from `apps/personal-website/src/mcp/profile-data.ts` unchanged in *behavior*, only changing the import source (`astro:content` → `./loader`) and the reference-field handling (plain string ids instead of `{collection, id}` objects — see Task 3's note).

- [ ] **Step 1: Write the failing test**

```typescript
// libs/personal-data/src/profile-data.test.ts
import { describe, expect, it } from 'vitest';

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
} from './profile-data';

describe('profile-data', () => {
  it('getWorkExperience returns resolved organizations and merged technologies', async () => {
    const jobs = await getWorkExperience({ lang: 'en' });
    const codegreen = jobs.find((j) => j.id === 'en/6');
    expect(codegreen?.organization.name).toBe('CodeGreen');
    // en/6 has no direct technologies but links to en/opencgt, which has auth0 —
    // this is the exact regression this test structure was written to catch
    // (see original design's "resolveExperience technologies bug" fix).
    expect(codegreen?.technologies).toContain('auth0');
  });

  it('getWorkExperience filters by technology using the merged set', async () => {
    const auth0Jobs = await getWorkExperience({ technology: 'auth0', lang: 'en' });
    expect(auth0Jobs.some((j) => j.id === 'en/6')).toBe(true);
  });

  it('getEducation returns only education-type entries', async () => {
    const education = await getEducation({ lang: 'en' });
    expect(education.every((e) => e.id !== 'en/6')).toBe(true);
  });

  it('getExperienceById resolves the same shape as getWorkExperience', async () => {
    const entry = await getExperienceById('en/6');
    expect(entry?.organization.name).toBe('CodeGreen');
    expect(entry?.technologies).toContain('auth0');
  });

  it('getProjects resolves organization and returns declared technologies', async () => {
    const projects = await getProjects({ lang: 'en' });
    const opencgt = projects.find((p) => p.id === 'en/opencgt');
    expect(opencgt?.organization.name).toBe('CodeGreen');
    expect(opencgt?.technologies).toContain('nextjs');
  });

  it('getProjectById returns the same shape as getProjects', async () => {
    const project = await getProjectById('en/opencgt');
    expect(project?.name).toBe('OpenCGT');
  });

  it('getSkills returns entries scoped to the requested language', async () => {
    const skills = await getSkills({ lang: 'en' });
    expect(skills.some((s) => s.id === 'en/ts')).toBe(true);
    expect(skills.every((s) => s.id.startsWith('en/'))).toBe(true);
  });

  it('getProfileSummary counts experiences/projects/skills and ranks technologies', async () => {
    const summary = await getProfileSummary({ lang: 'en' });
    expect(summary.experienceCount).toBeGreaterThan(0);
    expect(summary.projectCount).toBeGreaterThan(0);
    expect(summary.skillCount).toBeGreaterThan(0);
    expect(summary.topTechnologies.length).toBeGreaterThan(0);
  });

  it('searchByTechnology substring-matches across experiences and projects', async () => {
    const results = await searchByTechnology('next', { lang: 'en' });
    expect(results.projects.some((p) => p.id === 'en/opencgt')).toBe(true);
  });

  it('getSkillById returns the same shape as getSkills entries', async () => {
    const skill = await getSkillById('en/ts');
    expect(skill?.name).toBe('TypeScript');
    expect(skill?.icon).toBe('typescript');
  });

  it('getSkillById returns undefined for an unknown id', async () => {
    expect(await getSkillById('en/does-not-exist')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/rainforest/Repositories/rainforest-monorepo && npx nx test personal-data`
Expected: FAIL — `Cannot find module './profile-data'`

- [ ] **Step 3: Write `libs/personal-data/src/profile-data.ts`**

```typescript
import { getCollection, getEntry } from './loader';
import type { ExperienceType, Locale, SkillTag } from './vocab';

export interface ResolvedOrganization {
  id: string;
  name: string;
  link?: string;
}

export interface ResolvedExperience {
  id: string;
  type: ExperienceType;
  language: string;
  position: string;
  startAt: Date;
  endAt?: Date;
  technologies: SkillTag[];
  organization: ResolvedOrganization;
  content: string;
}

async function resolveOrganization(id: string): Promise<ResolvedOrganization> {
  const org = await getEntry('organizations', id);
  if (!org) throw new Error(`Organization not found: ${id}`);
  return { id: org.id, name: org.data.name, link: org.data.link };
}

/**
 * Resolves an experience entry. `technologies` must be the already-merged set
 * (direct + linked projects') so the returned data stays consistent with
 * whatever technology filter was used to find this entry in the first place —
 * see `experienceTechnologies` below.
 */
async function resolveExperience(
  entry: Awaited<ReturnType<typeof getCollection<'experiences'>>>[number],
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
    content: entry.body,
  };
}

/** Technologies declared directly on the experience, plus technologies of any linked projects. */
async function experienceTechnologies(
  entry: Awaited<ReturnType<typeof getCollection<'experiences'>>>[number],
): Promise<SkillTag[]> {
  const direct = entry.data.technologies ?? [];
  const projectIds = entry.data.projects ?? [];
  const projects = await Promise.all(projectIds.map((id) => getEntry('projects', id)));
  const fromProjects = projects.flatMap((p) => p?.data.technologies ?? []);
  return Array.from(new Set([...direct, ...fromProjects]));
}

/** Experience entries of a given type (`job` or `education`) in a given language. */
function getExperiencesByType(type: ExperienceType, lang: string) {
  return getCollection('experiences', (entry) => entry.data.type === type && entry.data.language === lang);
}

export async function getWorkExperience(
  options: { technology?: SkillTag; lang?: Locale } = {},
): Promise<ResolvedExperience[]> {
  const { technology, lang = 'en' } = options;
  const entries = await getExperiencesByType('job', lang);
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

export async function getEducation(
  options: { lang?: Locale } = {},
): Promise<ResolvedExperience[]> {
  const { lang = 'en' } = options;
  const entries = await getExperiencesByType('education', lang);
  return Promise.all(
    entries.map(async (entry) => resolveExperience(entry, await experienceTechnologies(entry))),
  );
}

/**
 * A single experience (job or education) by id, fully resolved — same shape as
 * `getWorkExperience`/`getEducation`'s entries. Used by the MCP resource reader so a
 * `profile://experience/{id}` read returns the same resolved organization/technologies
 * as the tool surface, not a raw entry with unresolved reference pointers.
 */
export async function getExperienceById(id: string): Promise<ResolvedExperience | undefined> {
  const entry = await getEntry('experiences', id);
  if (!entry) return undefined;
  return resolveExperience(entry, await experienceTechnologies(entry));
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

async function resolveProject(
  entry: Awaited<ReturnType<typeof getCollection<'projects'>>>[number],
): Promise<ResolvedProject> {
  return {
    id: entry.id,
    name: entry.data.name,
    language: entry.data.language,
    technologies: entry.data.technologies,
    organization: await resolveOrganization(entry.data.organization),
    experience: entry.data.experience,
    content: entry.body,
  };
}

export async function getProjects(
  options: { technology?: SkillTag; lang?: Locale } = {},
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

/** A single project by id, fully resolved — same rationale as `getExperienceById`. */
export async function getProjectById(id: string): Promise<ResolvedProject | undefined> {
  const entry = await getEntry('projects', id);
  if (!entry) return undefined;
  return resolveProject(entry);
}

export interface ResolvedSkill {
  id: string;
  name: string;
  icon: SkillTag;
  tags: string[];
  content: string;
}

export async function getSkills(options: { lang?: Locale } = {}): Promise<ResolvedSkill[]> {
  const { lang = 'en' } = options;
  const entries = await getCollection('skills', (entry) => entry.id.startsWith(`${lang}/`));
  return entries.map((entry) => ({
    id: entry.id,
    name: entry.data.name,
    icon: entry.data.icon,
    tags: entry.data.tags ?? [],
    content: entry.body,
  }));
}

/**
 * A single skill by id. Skills have no reference fields to resolve (unlike
 * experience/project), so this is a thin wrapper — but it's still exported
 * (rather than having consumers reach into loader.ts directly) so the
 * library's public surface is entirely profile-data.ts, keeping loader.ts
 * a private implementation detail.
 */
export async function getSkillById(id: string): Promise<ResolvedSkill | undefined> {
  const entry = await getEntry('skills', id);
  if (!entry) return undefined;
  return {
    id: entry.id,
    name: entry.data.name,
    icon: entry.data.icon,
    tags: entry.data.tags ?? [],
    content: entry.body,
  };
}

export interface ProfileSummary {
  experienceCount: number;
  projectCount: number;
  skillCount: number;
  topTechnologies: SkillTag[];
}

export async function getProfileSummary(options: { lang?: Locale } = {}): Promise<ProfileSummary> {
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
  options: { lang?: Locale } = {},
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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/rainforest/Repositories/rainforest-monorepo && npx nx test personal-data`
Expected: PASS (all tests across the whole library)

- [ ] **Step 5: Commit**

```bash
cd /Users/rainforest/Repositories/rainforest-monorepo
git add libs/personal-data/src/profile-data.ts libs/personal-data/src/profile-data.test.ts
git commit -m "$(cat <<'EOF'
feat(personal-data): port profile-data resolve/get functions off astro:content

Same public API and behavior as apps/personal-website/src/mcp/profile-data.ts —
only the import source changed (astro:content -> ./loader) and reference
fields are now plain string ids instead of Astro's {collection, id} objects.
Tests run against the real moved content files, no mocking required.

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Public exports

**Files:**
- Modify: `libs/personal-data/src/index.ts`

- [ ] **Step 1: Replace the placeholder index with real exports**

```typescript
export type { ExperienceType, Locale, SkillTag } from './vocab';
export { experienceTypes, locales, skillTags } from './vocab';

export type {
  ExperienceData,
  OrganizationData,
  ProjectData,
  SkillData,
} from './schemas';

export type { Entry } from './loader';

export type {
  ProfileSummary,
  ResolvedExperience,
  ResolvedOrganization,
  ResolvedProject,
  ResolvedSkill,
} from './profile-data';
export {
  getEducation,
  getExperienceById,
  getProfileSummary,
  getProjectById,
  getProjects,
  getSkillById,
  getSkills,
  getWorkExperience,
  searchByTechnology,
} from './profile-data';
```

- [ ] **Step 2: Build the library and verify no type errors**

Run: `cd /Users/rainforest/Repositories/rainforest-monorepo && npx nx build personal-data`
Expected: succeeds, `libs/personal-data/dist/index.js` and `index.d.ts` are produced.

- [ ] **Step 3: Run the full test suite once more**

Run: `cd /Users/rainforest/Repositories/rainforest-monorepo && npx nx test personal-data`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/rainforest/Repositories/rainforest-monorepo
git add libs/personal-data/src/index.ts
git commit -m "$(cat <<'EOF'
feat(personal-data): finalize public API surface

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Wire `apps/personal-website` to consume the library

**Files:**
- Modify: `apps/personal-website/package.json` (add dependency, remove nothing yet — MCP deps come out in the cutover plan)
- Modify: `apps/personal-website/src/utils/constants/index.ts`
- Modify: `apps/personal-website/src/utils/i18n/settings.ts`
- Modify: `apps/personal-website/src/content.config.ts` (remove the four migrated collections)
- Modify: `apps/personal-website/src/pages/api/mcp.ts` (repoint its import from `../../mcp/profile-data` to `@rainforest-dev/personal-data`)
- Delete: `apps/personal-website/src/mcp/profile-data.ts`
- Delete: `apps/personal-website/src/mcp/profile-data.fixtures.ts`
- Delete: `apps/personal-website/src/mcp/smoke.test.ts`

This task keeps `mcp.rainforest.tools` working exactly as it does today (still routed through `apps/personal-website`'s existing, if imperfect, `vercel.json` rewrite) — only the *source* of the data changes. The route itself gets deleted later, in the cutover plan, once `apps/personal-mcp` is live.

- [ ] **Step 1: Add the workspace dependency**

Edit `apps/personal-website/package.json`, in `"dependencies"`, add (alphabetically, next to `@rainforest-dev/rainforest-ui`):

```json
    "@rainforest-dev/personal-data": "workspace:*",
```

Run: `cd /Users/rainforest/Repositories/rainforest-monorepo && pnpm install`
Expected: no errors, `apps/personal-website/node_modules/@rainforest-dev/personal-data` symlinks to `libs/personal-data`.

- [ ] **Step 2: Re-point `tags.skills`/`tags.experience` to the library**

In `apps/personal-website/src/utils/constants/index.ts`, replace:

```typescript
export const tags = {
  skills: [
    'nextjs',
    'vue',
    'docker',
    'flutter',
    'react',
    'tailwindcss',
    'mui',
    'auth0',
    'qwik',
    'playwright',
    'vitest',
    'python',
    'pytorch',
    'fastapi',
    'swift',
    'github-actions',
    'nodejs',
    'nx',
    'vite',
    'typescript',
    'express',
    'terraform',
  ],
  experience: ['job', 'education'],
} as const;
```

with:

```typescript
import { experienceTypes, skillTags } from '@rainforest-dev/personal-data';

export const tags = {
  skills: skillTags,
  experience: experienceTypes,
} as const;
```

Add the new import at the top of the file alongside the existing `import type { ILink, SkillTag } from '@types';` line.

- [ ] **Step 3: Re-point `supportedLngs` to the library**

In `apps/personal-website/src/utils/i18n/settings.ts`, add the import and change `supportedLngs`:

```typescript
import { locales as supportedLocales } from '@rainforest-dev/personal-data';
import { enUS, type Locale, zhTW } from 'date-fns/locale';

export const fallbackLng = 'en' as const;
export const supportedLngs = supportedLocales;
```

(The rest of the file — `cookieName`, `defaultNS`, `getOptions`, the date-fns `locales` map — is unchanged. Note this file's own `locales` export, the date-fns map, is a different thing from the library's `locales` array — that's exactly why the import is aliased to `supportedLocales`.)

- [ ] **Step 4: Remove the four migrated collections from `content.config.ts`**

In `apps/personal-website/src/content.config.ts`, delete the `organizations`, `experiences`, `projects`, and `skills` `defineCollection(...)` blocks and their entries in the `export const collections = { ... }` object, keeping only `blog` and `authors`. After this change the file's `collections` export should read:

```typescript
export const collections = {
  blog,
  authors,
};
```

Also remove the now-unused imports this leaves behind (check `tags`, `supportedLngs`, `reference` usage — `reference` is still used by `blog`'s `author`/`relatedPosts` fields, so keep that import; `tags` and `supportedLngs` are likely no longer used in this file once the four collections are gone — remove those imports only if the file no longer references them).

- [ ] **Step 5: Repoint the MCP route's import**

In `apps/personal-website/src/pages/api/mcp.ts`, change:

```typescript
import {
  getEducation,
  getExperienceById,
  getProfileSummary,
  getProjectById,
  getProjects,
  getSkills,
  getWorkExperience,
  searchByTechnology,
} from '../../mcp/profile-data';
```

to:

```typescript
import {
  getEducation,
  getExperienceById,
  getProfileSummary,
  getProjectById,
  getProjects,
  getSkills,
  getWorkExperience,
  searchByTechnology,
} from '@rainforest-dev/personal-data';
```

(The `getEntry` import from `astro:content` used by the `skill` resource handler stays as-is for now — `apps/personal-website`'s own Astro build can still resolve `astro:content` for other collections like `blog`/`authors`; this route gets deleted entirely in the cutover plan anyway, so it's not worth also porting that one handler's `getEntry('skills', ...)` call to the library here.)

- [ ] **Step 6: Delete the now-superseded local files**

```bash
cd /Users/rainforest/Repositories/rainforest-monorepo
git rm apps/personal-website/src/mcp/profile-data.ts
git rm apps/personal-website/src/mcp/profile-data.fixtures.ts
git rm apps/personal-website/src/mcp/smoke.test.ts
```

- [ ] **Step 7: Verify the site still builds and its own tests still pass**

Run: `cd /Users/rainforest/Repositories/rainforest-monorepo && npx nx build personal-website`
Expected: succeeds — `astro check && astro build` complete with 0 errors. (This is also the first real proof the library's types line up correctly with the route's usage.)

Run: `cd /Users/rainforest/Repositories/rainforest-monorepo && npx nx test personal-website`
Expected: passes (there should be no personal-website-local tests referencing the deleted `mcp/` files left over — if any exist, remove them; the `smoke.test.ts` deleted in Step 6 was the only one).

- [ ] **Step 8: Commit**

```bash
cd /Users/rainforest/Repositories/rainforest-monorepo
git add -A
git commit -m "$(cat <<'EOF'
refactor(personal-website): consume @rainforest-dev/personal-data

apps/personal-website now imports the profile content/vocab/data-access
layer from the new shared library instead of defining it locally.
The /api/mcp route keeps working unchanged (still served from this app,
still reached via the existing vercel.json rewrite) — only where the
data comes from changed. Route removal happens in a follow-up cutover
once apps/personal-mcp is live.

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Part 3: Definition of done

- [ ] `npx nx test personal-data` passes with real-file-backed tests (no `vi.mock`).
- [ ] `npx nx build personal-data` produces `dist/index.js` + `dist/index.d.ts`.
- [ ] `npx nx build personal-website` still succeeds.
- [ ] `npx nx test personal-website` still passes.
- [ ] `mcp.rainforest.tools` (via whatever routing currently reaches it) still returns the same tool/resource data as before — spot check with the same curl command from the original design's local-integration step, e.g.:
  ```bash
  curl -s -X POST https://rainforest.tools/api/mcp -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_work_experience","arguments":{"technology":"auth0"}}}'
  ```
  Expected: includes the CodeGreen (`en/6`) entry, same as before this migration.
