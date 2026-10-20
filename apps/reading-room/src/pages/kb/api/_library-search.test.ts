// The leading underscore keeps Astro from routing this file as an endpoint.
import { rmSync } from 'node:fs';

import { librarySearchResponseSchema } from '@rainforest-dev/library-contract';
import type { APIContext } from 'astro';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type FixtureVault,
  writeFixtureVault,
} from '@/server/kb/kb.fixtures.js';

import { GET } from './library-search.js';

let vault: FixtureVault;
const saved = { ...process.env };

beforeAll(() => {
  vault = writeFixtureVault();
  process.env.KB_WIKI_PATH = vault.config.roots.wiki;
  process.env.KB_READWISE_PATH = vault.config.roots.readwise;
  process.env.KB_OBSIDIAN_VAULT = vault.config.vault;
});
afterAll(() => {
  process.env = saved;
  rmSync(vault.root, { recursive: true, force: true });
});

const search = async (q: string) => {
  const url = new URL(`http://kb.test/kb/api/library-search?q=${q}`);
  const response = await GET({
    url,
    locals: { locale: 'zh' },
  } as unknown as APIContext);
  return { status: response.status, body: await response.json() };
};

describe('GET /kb/api/library-search', () => {
  it('answers in the shape the hall parses, linked inside /kb', async () => {
    const { status, body } = await search('lanterns');
    expect(status).toBe(200);
    expect(
      librarySearchResponseSchema.parse(body).results.length,
    ).toBeGreaterThan(0);
    for (const hit of body.results) {
      expect(hit.kind).toBe('kb');
      expect(hit.href.startsWith('/kb/')).toBe(true);
    }
  });

  it('leaves private notes out', async () => {
    const { body } = await search('heist');
    expect(body.results).toEqual([]);
  });
});
