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

import { getWorkExperience } from './profile-data';

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
