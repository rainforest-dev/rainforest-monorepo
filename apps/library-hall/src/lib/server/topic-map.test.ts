import { mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { loadTopicMap } from './topic-map';

describe('loadTopicMap', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'topic-map-'));
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  it('is empty without LIBRARY_TOPIC_MAP', async () => {
    expect((await loadTopicMap({})).size).toBe(0);
  });

  it('reads the file, and again once it changes', async () => {
    const path = join(dir, 'Topic-Map.md');
    await writeFile(path, '| 海 | `sea` |');
    expect((await loadTopicMap({ LIBRARY_TOPIC_MAP: path })).get('sea')).toBe(
      '海',
    );

    await writeFile(path, '| 大海 | `sea` |');
    const later = new Date(Date.now() + 5000);
    await utimes(path, later, later);
    expect((await loadTopicMap({ LIBRARY_TOPIC_MAP: path })).get('sea')).toBe(
      '大海',
    );
  });

  it('is empty, with one warning, when the file is missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const env = { LIBRARY_TOPIC_MAP: join(dir, 'missing.md') };
    expect((await loadTopicMap(env)).size).toBe(0);
    expect((await loadTopicMap(env)).size).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
