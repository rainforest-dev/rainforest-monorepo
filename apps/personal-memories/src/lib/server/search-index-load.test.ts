import { mkdtempSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { writeFixtureDataDir } from '@/cli/fixture.ts';
import { buildIndex } from '@/cli/ingest.ts';

import { fakeEmbedder } from './embed.ts';

let root: string | undefined;
afterEach(() => {
  vi.unstubAllEnvs();
  if (root) rmSync(root, { recursive: true, force: true });
  root = undefined;
});

describe('getSearchIndex', () => {
  it('builds once for concurrent requests and again after docs.json changes', async () => {
    root = mkdtempSync(join(tmpdir(), 'memories-load-'));
    const data = join(root, 'data');
    const timeline = writeFixtureDataDir(data);
    await buildIndex(data, timeline, fakeEmbedder(), () => undefined);
    vi.stubEnv('MEMORIES_DATA_DIR', data);
    vi.resetModules();
    const { getSearchIndex } = await import('./search-index.ts');

    const [a, b] = await Promise.all([getSearchIndex(), getSearchIndex()]);
    expect(a).toBeDefined();
    expect(a).toBe(b);
    expect(await getSearchIndex()).toBe(a);

    const later = new Date(Date.now() + 60_000);
    utimesSync(join(data, 'search', 'docs.json'), later, later);
    const reloaded = await getSearchIndex();
    expect(reloaded).not.toBe(a);
    expect(reloaded?.vectors).toBeDefined();
  });
});
