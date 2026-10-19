import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { appDb, notebooks } from '@/db';
import { setUpNotebookShelf } from '@/test';

import { applyNotebookBulkAction } from './notebook-bulk';
import {
  createNotebook,
  getNotebook,
  purgeExpiredTrash,
  trashNotebook,
} from './notebooks';

/** Notebook ids whose page folder fails to delete, as a disk error would. */
const stuck = new Set<string>();

vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>();
  const rmSync: typeof fs.rmSync = (target, options) => {
    if (stuck.has(String(target).split(/[/\\]/).pop() ?? '')) {
      throw new Error('EBUSY: resource busy or locked');
    }
    fs.rmSync(target, options);
  };
  return { ...fs, default: { ...fs, rmSync }, rmSync };
});

beforeAll(() => {
  setUpNotebookShelf('calibre-bulk-errors-');
});

describe('notebook removal errors', () => {
  it('reports a delete that throws and still runs the rest', async () => {
    const a = await createNotebook('Errors A');
    const b = await createNotebook('Errors B');
    const c = await createNotebook('Errors C');
    stuck.add(String(b.id));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(await applyNotebookBulkAction('delete', [a.id, b.id, c.id])).toEqual(
      {
        done: [a.id, c.id],
        failed: [{ id: b.id, error: 'EBUSY: resource busy or locked' }],
      },
    );
    expect(await getNotebook(b.id)).not.toBeNull();
    expect(await getNotebook(c.id)).toBeNull();
  });

  it('purges what it can and leaves the rest for the next visit', async () => {
    const a = await createNotebook('Purge A');
    const b = await createNotebook('Purge B');
    for (const { id } of [a, b]) {
      await trashNotebook(id);
      appDb
        .update(notebooks)
        .set({ trashedAt: '2020-01-01 00:00:00' })
        .where(eq(notebooks.id, id))
        .run();
    }
    stuck.add(String(a.id));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(await purgeExpiredTrash()).toEqual([b.id]);
    expect(await getNotebook(b.id)).toBeNull();
    expect(await getNotebook(a.id)).not.toBeNull();

    stuck.delete(String(a.id));
    expect(await purgeExpiredTrash()).toEqual([a.id]);
    expect(await getNotebook(a.id)).toBeNull();
  });

  it('refuses to merge into a notebook in Trash', async () => {
    const keep = await createNotebook('Errors Keep');
    const other = await createNotebook('Errors Other');
    await trashNotebook(keep.id);
    await expect(
      applyNotebookBulkAction('merge', [keep.id, other.id], {
        targetId: keep.id,
      }),
    ).rejects.toThrow(/Restore the notebook from Trash/);
    expect(await getNotebook(other.id)).not.toBeNull();
  });
});
