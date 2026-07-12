import { describe, expect, it } from 'vitest';

import { getCollection, getEntry, parseEntry } from './loader';

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

  describe('validation errors', () => {
    // parseEntry is tested directly against fabricated content rather than by writing
    // a real file to disk: the collections' file lists are now resolved once, at
    // import time, by Vite's eager `import.meta.glob` (see loader.ts) — a file written
    // at test-run time would never be picked up by that already-resolved map.
    it('identifies the offending file when content fails schema validation', () => {
      const badFile = './data/organizations/en/__invalid-test-fixture__.json';
      expect(() =>
        parseEntry('organizations', badFile, JSON.stringify({ name: 'Bad Org', language: 'not-a-real-locale' })),
      ).toThrow(/__invalid-test-fixture__\.json/);
    });
  });
});
