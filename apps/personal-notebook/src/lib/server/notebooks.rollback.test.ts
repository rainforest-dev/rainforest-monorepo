import fs from 'node:fs';
import path from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import { pagePng, setUpNotebookShelf } from '@/test';

import { appendPages, createNotebook, getNotebook } from './notebooks';

// Wrapped so one test can make the page write fail; every other call writes for real.
const disk = vi.hoisted(() => ({ fail: false }));
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const write: typeof actual.writeFileSync = (...args) => {
    if (disk.fail) {
      throw Object.assign(new Error('ENOSPC: no space left on device'), {
        code: 'ENOSPC',
      });
    }
    return actual.writeFileSync(...args);
  };
  return {
    ...actual,
    default: { ...actual, writeFileSync: write },
    writeFileSync: write,
  };
});

let pagesRoot: string;

beforeAll(() => {
  pagesRoot = setUpNotebookShelf('calibre-notebooks-rollback-');
});

describe('appendPages', () => {
  it('rolls the page row back when its file cannot be written', async () => {
    const notebook = await createNotebook('Full Disk');
    const page = {
      name: 'page.png',
      type: 'image/png',
      bytes: await pagePng(33),
    };

    disk.fail = true;
    try {
      await expect(appendPages(notebook.id, [page])).rejects.toThrow(/ENOSPC/);
    } finally {
      disk.fail = false;
    }
    expect((await getNotebook(notebook.id))?.pages).toEqual([]);
    expect(fs.readdirSync(path.join(pagesRoot, String(notebook.id)))).toEqual(
      [],
    );

    // Nothing of the failed attempt is left: the same photo is not a duplicate, and it is page 1.
    const retry = await appendPages(notebook.id, [page]);
    expect(retry.skipped).toEqual([]);
    expect(
      (await getNotebook(notebook.id))?.pages.map((p) => p.position),
    ).toEqual([1]);
  });
});
