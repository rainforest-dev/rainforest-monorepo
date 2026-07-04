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
