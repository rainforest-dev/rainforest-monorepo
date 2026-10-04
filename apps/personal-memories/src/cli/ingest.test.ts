import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  type Embedder,
  EmbedError,
  fakeEmbedder,
} from '../lib/server/embed.ts';
import { readSearchFiles } from '../lib/server/search-files.ts';
import type { Timeline } from '../lib/server/timeline.ts';
import { writeFixtureDataDir } from './fixture.ts';
import { buildIndex } from './ingest.ts';

let root: string | undefined;
afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
  root = undefined;
});

const spied = (inner: Embedder = fakeEmbedder()) => {
  const embed = vi.fn(inner.embed);
  return { embedder: { ...inner, embed }, embed };
};

describe('buildIndex', () => {
  it('writes the search files and re-embeds nothing when nothing changed', async () => {
    root = mkdtempSync(join(tmpdir(), 'memories-index-'));
    const timeline = writeFixtureDataDir(join(root, 'data'));
    const dataRoot = join(root, 'data');
    const first = spied();
    await buildIndex(dataRoot, timeline, first.embedder, () => undefined);
    const files = await readSearchFiles(dataRoot);
    expect(files?.header.model).toBe('fake');
    expect(files?.header.docs.length).toBeGreaterThan(0);
    expect(first.embed).toHaveBeenCalled();

    const second = spied();
    await buildIndex(dataRoot, timeline, second.embedder, () => undefined);
    expect(second.embed).not.toHaveBeenCalled();
  });

  it('warns when no photo has labels', async () => {
    root = mkdtempSync(join(tmpdir(), 'memories-index-'));
    const timeline: Timeline = {
      generatedAt: '2025-11-02T00:00:00+08:00',
      events: [
        {
          id: 'P',
          source: 'photo',
          at: '2025-11-01T09:00:00+08:00',
          author: 'photo',
          photo: {
            favorite: false,
            people: 0,
            screenshot: false,
            movie: false,
            burstPick: true,
          },
        },
      ],
    };
    const log = vi.fn();
    await buildIndex(root, timeline, fakeEmbedder(), log);
    expect(log).toHaveBeenCalledWith(
      'photos: no labels in 1 photos — re-export with osxphotos 0.77.2',
    );
  });

  it('keeps the previous files and says so when embedding fails', async () => {
    root = mkdtempSync(join(tmpdir(), 'memories-index-'));
    const timeline = writeFixtureDataDir(join(root, 'data'));
    const dataRoot = join(root, 'data');
    const log = vi.fn();
    const failing: Embedder = {
      ...fakeEmbedder(),
      embed: async () => {
        throw new EmbedError('ollama-unreachable', 'down');
      },
    };
    await buildIndex(dataRoot, timeline, failing, log);
    expect(await readSearchFiles(dataRoot)).toBeUndefined();
    expect(log).toHaveBeenCalledWith(
      'search: embeddings skipped (ollama-unreachable); lexical search still works',
    );
  });
});
