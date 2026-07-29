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
    const jobs = await getCollection(
      'experiences',
      (e) => e.data.type === 'job' && e.data.language === 'en',
    );
    expect(
      jobs.every((e) => e.data.type === 'job' && e.data.language === 'en'),
    ).toBe(true);
  });

  it('returns undefined from getEntry for an unknown id', async () => {
    const missing = await getEntry('organizations', 'en/does-not-exist');
    expect(missing).toBeUndefined();
  });

  // Characterisation tests: pin the exact shape `getEntry`/`getCollection` produce TODAY,
  // before frontmatter parsing moves from runtime (gray-matter in loader.ts) to build time (a
  // Vite transform). They must keep passing, unmodified, after that move — if one breaks, the
  // transform changed the parsed shape and the transform is what's wrong, not the test.
  describe('characterisation: parsed entry shapes', () => {
    it('parses a markdown entry with array frontmatter to the exact current shape (experiences/en/7.md)', async () => {
      const entry = await getEntry('experiences', 'en/7');
      expect(entry).toBeDefined();
      expect(entry?.id).toBe('en/7');
      expect(entry?.data).toEqual({
        type: 'job',
        employment: 'full-time',
        language: 'en',
        organization: 'en/angible',
        position: 'Senior Frontend Engineer',
        // Pinned as-is: experienceSchema's `startAt` is `z.coerce.date()`, so the quoted YAML
        // string '2025-05' is already a `Date` by the time it reaches `entry.data` today. Do
        // not "improve" this to a string — a build-time transform that starts handing zod a
        // native Date instead of a string would coerce identically here, but a consumer
        // relying on z.coerce.date() elsewhere could silently start seeing different results
        // if the transform's serialization step (e.g. JSON.stringify) mangles a Date.
        startAt: new Date('2025-05'),
        technologies: [
          'nextjs',
          'typescript',
          'auth0',
          'nx',
          'playwright',
          'fastapi',
          'docker',
          'terraform',
        ],
        projects: [],
      });
      expect(entry?.data.startAt).toBeInstanceOf(Date);
      expect(entry?.data.endAt).toBeUndefined();
      // Body is the markdown after the frontmatter fence, with no leading/trailing blank line
      // (matter()'s `content` starts with a leading "\n" right after the closing `---`; the
      // loader trims it) but internal line breaks within the paragraph are preserved as-is.
      expect(entry?.body).toBe(
        'Lead frontend development across two retail product lines in an edge-AI monorepo. Migrated\n' +
          'end-to-end authentication to a managed identity provider, retiring a large in-house auth layer, and\n' +
          'delivered the role-based permission matrix that governs access across the dashboard. Established the\n' +
          "project's end-to-end test foundation from scratch and moved its container delivery pipeline onto\n" +
          'managed Kubernetes.',
      );
      expect(entry?.body.startsWith('\n')).toBe(false);
      expect(entry?.body.endsWith('\n')).toBe(false);
    });

    it('parses a JSON-collection entry to the exact current shape (organizations/en/codegreen.json)', async () => {
      // organizations never went through gray-matter (JSON_COLLECTIONS branch in parseEntry) —
      // pinned here too so the same test file covers both parse strategies loader.ts branches
      // on, and a transform that only touches the markdown path can't silently regress this one.
      const entry = await getEntry('organizations', 'en/codegreen');
      expect(entry).toBeDefined();
      expect(entry?.id).toBe('en/codegreen');
      expect(entry?.data).toEqual({
        name: 'CodeGreen',
        language: 'en',
        link: 'https://www.codegreen.org',
      });
      expect(entry?.body).toBe('');
    });
  });

  describe('validation errors', () => {
    // parseEntry is tested directly against fabricated content rather than by writing
    // a real file to disk: the collections' file lists are now resolved once, at
    // import time, by Vite's eager `import.meta.glob` (see loader.ts) — a file written
    // at test-run time would never be picked up by that already-resolved map.
    it('identifies the offending file when content fails schema validation', () => {
      const badFile = './data/organizations/en/__invalid-test-fixture__.json';
      expect(() =>
        parseEntry(
          'organizations',
          badFile,
          JSON.stringify({ name: 'Bad Org', language: 'not-a-real-locale' }),
        ),
      ).toThrow(/__invalid-test-fixture__\.json/);
    });
  });
});
