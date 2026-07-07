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
