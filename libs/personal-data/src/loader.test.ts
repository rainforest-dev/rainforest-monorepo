import * as fs from 'node:fs';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

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

  describe('validation errors', () => {
    const badFile = path.join(__dirname, 'data', 'organizations', 'en', '__invalid-test-fixture__.json');

    afterEach(() => {
      fs.rmSync(badFile, { force: true });
    });

    it('identifies the offending file when content fails schema validation', async () => {
      fs.writeFileSync(badFile, JSON.stringify({ name: 'Bad Org', language: 'not-a-real-locale' }));

      await expect(getCollection('organizations')).rejects.toThrow(/__invalid-test-fixture__\.json/);
    });
  });
});
