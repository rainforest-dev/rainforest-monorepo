import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fixturesByCollection } from './profile-data.fixtures';

// Vitest hoists vi.mock above all imports regardless of source position, so this runs
// before the `astro:content` import below takes effect.
vi.mock('astro:content', () => ({
  getCollection: vi.fn(),
  getEntry: vi.fn(),
}));

import { getCollection, getEntry } from 'astro:content';

import {
  getEducation,
  getProfileSummary,
  getProjects,
  getSkills,
  getWorkExperience,
  searchByTechnology,
} from './profile-data';

/**
 * Resolves the (collection, id) pair from either of Astro's two `getEntry` call shapes:
 * a single `{ collection, id }` reference object, or two separate string arguments.
 */
function toCollectionAndId(a: unknown, b: unknown): [string, string] {
  if (typeof a === 'string') return [a, b as string];
  const ref = a as { collection: string; id: string };
  return [ref.collection, ref.id];
}

beforeEach(() => {
  (getCollection as Mock).mockImplementation(async (name: string, filter?: (e: unknown) => boolean) => {
    const entries = fixturesByCollection[name as keyof typeof fixturesByCollection] ?? [];
    return filter ? entries.filter(filter) : entries;
  });
  (getEntry as Mock).mockImplementation(async (a: unknown, b?: unknown) => {
    const [collection, id] = toCollectionAndId(a, b);
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
