import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SOURCES_FIXTURE, TOPICS_FIXTURE } from './registry.fixtures.js';
import {
  handleRegistryPatch,
  SOURCES_PATCH,
  TOPICS_PATCH,
  writeErrorResponse,
} from './registryApi.js';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    writeFileSync: vi.fn(actual.writeFileSync),
    renameSync: vi.fn(actual.renameSync),
  };
});

function errno(code: string): NodeJS.ErrnoException {
  const err: NodeJS.ErrnoException = new Error(`${code}: operation failed`);
  err.code = code;
  return err;
}

describe('writeErrorResponse', () => {
  it.each(['EROFS', 'EACCES', 'EPERM'])(
    'reports %s as a read-only vault the UI can act on',
    async (code) => {
      const res = writeErrorResponse(
        errno(code),
        '/vault/RSS-Source-Registry.md',
      );

      expect(res.status).toBe(409);
      await expect(res.json()).resolves.toMatchObject({ writable: false });
    },
  );

  it('does not pass a missing file off as a read-only mount', async () => {
    const res = writeErrorResponse(
      errno('ENOENT'),
      '/vault/RSS-Source-Registry.md',
    );

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string; writable?: boolean };
    expect(body.error).toContain('/vault/RSS-Source-Registry.md');
    expect(body.writable).toBeUndefined();
  });

  it('keeps anything else a 500', async () => {
    const res = writeErrorResponse(
      new Error('Entry not found: Astro'),
      '/vault/RSS-Source-Registry.md',
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: 'Error: Entry not found: Astro',
    });
  });
});

describe('handleRegistryPatch', () => {
  const originalVaultPath = process.env.VAULT_PATH;
  let sourcesFile: string;
  let topicsFile: string;

  beforeEach(() => {
    const dir = mkdtempSync(join(tmpdir(), 'rss-manager-'));
    sourcesFile = join(dir, 'RSS-Source-Registry.md');
    topicsFile = join(dir, 'RSS-Topic-Registry.md');
    writeFileSync(sourcesFile, SOURCES_FIXTURE, 'utf-8');
    writeFileSync(topicsFile, TOPICS_FIXTURE, 'utf-8');
    process.env.VAULT_PATH = dir;
    vi.mocked(writeFileSync).mockClear();
    vi.mocked(renameSync).mockClear();
  });

  afterEach(() => {
    if (originalVaultPath === undefined) delete process.env.VAULT_PATH;
    else process.env.VAULT_PATH = originalVaultPath;
  });

  function patch(body: unknown) {
    return new Request('http://localhost/api/sources', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('applies a batch in one write and answers with the re-parsed list', async () => {
    const res = await handleRegistryPatch(
      patch({
        names: ["TkDodo's Blog", 'The GitHub Blog'],
        action: 'activate',
      }),
      SOURCES_PATCH,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      applied: string[];
      sources: { name: string; status: string }[];
      writable: boolean;
      warnings: string[];
    };
    expect(body).toMatchObject({
      ok: true,
      applied: ["TkDodo's Blog", 'The GitHub Blog'],
      writable: true,
      warnings: [],
    });
    expect(body.sources.filter((s) => s.status === 'active')).toHaveLength(5);
    expect(renameSync).toHaveBeenCalledTimes(1);
    expect(readFileSync(sourcesFile, 'utf-8')).toContain(
      "- [x] **TkDodo's Blog**",
    );
  });

  it('declines a topic', async () => {
    const res = await handleRegistryPatch(
      patch({ names: ['Home automation'], action: 'decline' }),
      TOPICS_PATCH,
    );

    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      applied: ['Home automation'],
      topics: expect.arrayContaining([
        expect.objectContaining({
          name: 'Home automation',
          status: 'declined',
        }),
      ]),
    });
  });

  it('writes nothing and names every rejected item', async () => {
    const res = await handleRegistryPatch(
      patch({ names: ["TkDodo's Blog", 'Astro', 'Nope'], action: 'activate' }),
      SOURCES_PATCH,
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({
      error:
        'Nothing was written: Astro (cannot activate a source that is active); Nope (not in the registry).',
      rejected: [
        { name: 'Astro', reason: 'cannot activate a source that is active' },
        { name: 'Nope', reason: 'not in the registry' },
      ],
    });
    expect(body.writable).toBeUndefined();
    expect(writeFileSync).not.toHaveBeenCalled();
    expect(readFileSync(sourcesFile, 'utf-8')).toBe(SOURCES_FIXTURE);
  });

  it('warns about duplicate names in the list it returns', async () => {
    writeFileSync(
      sourcesFile,
      SOURCES_FIXTURE.replace(
        '## No RSS Found',
        '- [ ] **Astro** #dup\n  https://dup.example.com/rss.xml\n\n## No RSS Found',
      ),
      'utf-8',
    );

    const res = await handleRegistryPatch(
      patch({ names: ['The GitHub Blog'], action: 'retire' }),
      SOURCES_PATCH,
    );

    await expect(res.json()).resolves.toMatchObject({
      warnings: ['"Astro" appears 2 times; a write acts on the first one.'],
    });
  });

  const NAMES_REQUIRED = 'names is required: a non-empty array of entry names';
  it.each([
    [{ action: 'activate' }, NAMES_REQUIRED],
    [{ name: 'Astro', action: 'activate' }, NAMES_REQUIRED],
    [{ names: 'Astro', action: 'activate' }, NAMES_REQUIRED],
    [{ names: [], action: 'activate' }, NAMES_REQUIRED],
    [{ names: ['Astro', 3], action: 'activate' }, NAMES_REQUIRED],
    [{ names: ['Astro'] }, 'action is required'],
    [{ names: ['Astro'], action: 'delete' }, 'Unknown action: delete'],
    [{ names: ['Astro'], action: 'decline' }, 'Unknown action: decline'],
  ])('answers 400 to %j before touching the vault', async (body, error) => {
    const res = await handleRegistryPatch(patch(body), SOURCES_PATCH);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error });
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('reports a read-only mount as 409 with writable false and writes nothing', async () => {
    vi.mocked(writeFileSync).mockImplementationOnce(() => {
      throw errno('EROFS');
    });

    const res = await handleRegistryPatch(
      patch({ names: ['Astro', 'CSS-Tricks'], action: 'retire' }),
      SOURCES_PATCH,
    );

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ writable: false });
    expect(renameSync).not.toHaveBeenCalled();
    expect(readFileSync(sourcesFile, 'utf-8')).toBe(SOURCES_FIXTURE);
  });

  it.skipIf(process.getuid?.() === 0)(
    'reports a read-only file as 409 with writable false',
    async () => {
      chmodSync(sourcesFile, 0o444);

      const res = await handleRegistryPatch(
        patch({ names: ['Astro'], action: 'retire' }),
        SOURCES_PATCH,
      );

      expect(res.status).toBe(409);
      await expect(res.json()).resolves.toMatchObject({ writable: false });
      expect(readFileSync(sourcesFile, 'utf-8')).toBe(SOURCES_FIXTURE);
    },
  );

  it('reports a missing file as 404', async () => {
    process.env.VAULT_PATH = mkdtempSync(join(tmpdir(), 'rss-manager-'));

    const res = await handleRegistryPatch(
      patch({ names: ['Astro'], action: 'retire' }),
      SOURCES_PATCH,
    );

    expect(res.status).toBe(404);
  });
});
