import fs from 'node:fs';
import path from 'node:path';

import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';

import { appDb, notebookPages, notebooks } from '@/db';
import { pagePng, setUpNotebookShelf } from '@/test';

import { applyNotebookBulkAction } from './notebook-bulk';
import { notebookCalendar, undatedPages } from './notebook-calendar';
import {
  appendPages,
  createNotebook,
  findOrCreateNotebookByName,
  getNotebook,
  listNotebooks,
  purgeExpiredTrash,
  restoreNotebook,
  setNotebookStatus,
  trashNotebook,
} from './notebooks';
import { nextPageForOcr } from './ocr';

let pagesRoot = '';
let fill = 20;

async function notebookWith(name: string, count: number) {
  const notebook = await createNotebook(name);
  const files = await Promise.all(
    Array.from({ length: count }, async (_, i) => ({
      name: `p${i}.png`,
      type: 'image/png',
      bytes: await pagePng((fill += 5)),
    })),
  );
  const { added } = await appendPages(notebook.id, files);
  return { id: notebook.id, pageIds: added };
}

const trashedAt = (id: number, value: string) =>
  appDb
    .update(notebooks)
    .set({ trashedAt: value })
    .where(eq(notebooks.id, id))
    .run();

const shelfIds = async () => (await listNotebooks()).map((n) => n.id);
const trashIds = async () =>
  (await listNotebooks({ trashed: true })).map((n) => n.id);

beforeAll(() => {
  pagesRoot = setUpNotebookShelf('calibre-trash-');
});

describe('Trash', () => {
  it('takes a notebook off the shelf and puts it back with its status', async () => {
    const { id } = await notebookWith('Trash Round Trip', 1);
    await setNotebookStatus(id, 'archived');

    const trashed = await trashNotebook(id);
    expect(trashed?.trashedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(await shelfIds()).not.toContain(id);
    expect(await trashIds()).toContain(id);
    // Trashing again keeps the first date, so the 30 days do not restart.
    trashedAt(id, '2026-01-01 00:00:00');
    expect((await trashNotebook(id))?.trashedAt).toBe('2026-01-01 00:00:00');

    expect(await restoreNotebook(id)).toMatchObject({
      status: 'archived',
      trashedAt: null,
    });
    expect(await shelfIds()).toContain(id);
    expect(await trashIds()).not.toContain(id);
    expect(await trashNotebook(999_999)).toBeNull();
  });

  it('hides a trashed notebook’s pages from the calendar, the undated count and OCR', async () => {
    appDb.update(notebookPages).set({ transcription: 'done' }).run();
    const { id, pageIds } = await notebookWith('Trash Hidden', 2);
    const [dated = 0, waiting = 0] = pageIds;
    appDb
      .update(notebookPages)
      .set({ pageDate: '2031-05-04', transcription: 'May' })
      .where(eq(notebookPages.id, dated))
      .run();
    const before = undatedPages().waiting;
    expect(notebookCalendar('2031-05').pages.map((p) => p.id)).toEqual([dated]);
    expect(nextPageForOcr()).toBe(waiting);

    await trashNotebook(id);
    expect(notebookCalendar('2031-05').pages).toEqual([]);
    expect(undatedPages().waiting).toBe(before - 1);
    expect(nextPageForOcr()).toBeUndefined();

    await restoreNotebook(id);
    expect(nextPageForOcr()).toBe(waiting);
  });

  it('purges notebooks 30 days after they were trashed, with their images', async () => {
    const old = await notebookWith('Trash Old', 1);
    const recent = await notebookWith('Trash Recent', 1);
    trashedAt(old.id, '2026-09-01 12:00:00');
    trashedAt(recent.id, '2026-09-01 12:00:01');
    expect(fs.existsSync(path.join(pagesRoot, String(old.id)))).toBe(true);

    expect(await purgeExpiredTrash(new Date('2026-10-01T12:00:00Z'))).toEqual([
      old.id,
    ]);
    expect(await getNotebook(old.id)).toBeNull();
    expect(fs.existsSync(path.join(pagesRoot, String(old.id)))).toBe(false);
    expect(await getNotebook(recent.id)).not.toBeNull();
  });

  it('refuses a new notebook named like one in Trash, and brings that one back for uploads', async () => {
    const { id } = await notebookWith('Trash Name', 1);
    await trashNotebook(id);
    await expect(createNotebook('Trash Name')).rejects.toThrow(/in Trash/);
    const found = await findOrCreateNotebookByName('Trash Name');
    expect(found).toMatchObject({ id, trashedAt: null });
  });
});

describe('applyNotebookBulkAction', () => {
  it('archives each notebook and reports a missing one without stopping', async () => {
    const a = await notebookWith('Bulk A', 0);
    const b = await notebookWith('Bulk B', 0);
    expect(
      await applyNotebookBulkAction('archive', [a.id, 999_998, b.id]),
    ).toEqual({
      done: [a.id, b.id],
      failed: [{ id: 999_998, error: 'Notebook not found' }],
    });
    expect((await getNotebook(b.id))?.status).toBe('archived');
    expect(await applyNotebookBulkAction('reopen', [a.id, b.id])).toMatchObject(
      {
        done: [a.id, b.id],
      },
    );
    expect((await getNotebook(a.id))?.status).toBe('active');
  });

  it('merges every selected notebook into the chosen one', async () => {
    const keep = await notebookWith('Bulk Keep', 1);
    const one = await notebookWith('Bulk One', 2);
    const two = await notebookWith('Bulk Two', 1);
    await expect(
      applyNotebookBulkAction('merge', [keep.id, one.id]),
    ).rejects.toThrow(/merge into/);
    await expect(
      applyNotebookBulkAction('merge', [one.id, two.id], { targetId: keep.id }),
    ).rejects.toThrow(/merge into/);

    expect(
      await applyNotebookBulkAction('merge', [one.id, keep.id, two.id], {
        targetId: keep.id,
      }),
    ).toEqual({ done: [one.id, two.id], failed: [] });
    expect((await getNotebook(keep.id))?.pages.map((p) => p.id)).toEqual([
      ...keep.pageIds,
      ...one.pageIds,
      ...two.pageIds,
    ]);
    expect(await getNotebook(one.id)).toBeNull();
  });

  it('trashes, restores and deletes for good', async () => {
    const { id } = await notebookWith('Bulk Gone', 1);
    await applyNotebookBulkAction('trash', [id]);
    expect(await trashIds()).toContain(id);
    await applyNotebookBulkAction('restore', [id]);
    expect(await shelfIds()).toContain(id);
    expect(await applyNotebookBulkAction('delete', [id])).toEqual({
      done: [id],
      failed: [],
    });
    expect(await getNotebook(id)).toBeNull();
    expect(fs.existsSync(path.join(pagesRoot, String(id)))).toBe(false);
  });
});
