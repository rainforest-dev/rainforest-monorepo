import fs from 'node:fs';
import path from 'node:path';

import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';

import { appDb, notebookPages } from '@/db';
import { pagePng, setUpNotebookShelf } from '@/test';

import {
  appendPages,
  createNotebook,
  deleteNotebook,
  getNotebook,
  listNotebooks,
  mergeNotebooks,
  movePages,
  readPageFile,
  renameNotebook,
  reorderPages,
} from './notebooks';

let pagesRoot: string;
let fill = 0;

beforeAll(() => {
  pagesRoot = setUpNotebookShelf('calibre-organize-');
});

/** A notebook holding `count` distinct pages; returns its id and page ids in order. */
async function notebookWith(name: string, count: number) {
  const notebook = await createNotebook(name);
  const files = await Promise.all(
    Array.from({ length: count }, async (_, i) => ({
      name: `${name}-${i + 1}.png`,
      type: 'image/png',
      bytes: await pagePng(++fill),
    })),
  );
  const { added } = await appendPages(notebook.id, files);
  return { id: notebook.id, pages: added };
}

const order = async (id: number) =>
  (await getNotebook(id))?.pages.map((p) => [p.id, p.position]);

describe('renameNotebook', () => {
  it('renames, and refuses a name in use with a pointer to merging', async () => {
    const { id } = await notebookWith('Unsorted A', 0);
    const other = await notebookWith('Field Log A', 0);
    expect(await renameNotebook(id, '  2026-09 Bujo ')).toMatchObject({
      id,
      name: '2026-09 Bujo',
    });
    await expect(renameNotebook(id, 'Field Log A')).rejects.toThrow(
      `Notebook ${other.id} is already named "Field Log A"; merge into it instead`,
    );
    expect(await renameNotebook(99999, 'x')).toBeNull();
  });
});

describe('reorderPages', () => {
  it('writes the given order and renumbers from 1', async () => {
    const { id, pages } = await notebookWith('Reorder', 3);
    const [a, b, c] = pages;
    const dry = await reorderPages(id, [c, a, b], { dryRun: true });
    expect(dry).toEqual({
      notebookId: id,
      before: [a, b, c],
      after: [c, a, b],
    });
    expect(await order(id)).toEqual([
      [a, 1],
      [b, 2],
      [c, 3],
    ]);

    await reorderPages(id, [c, a, b]);
    expect(await order(id)).toEqual([
      [c, 1],
      [a, 2],
      [b, 3],
    ]);
  });

  it('refuses a list that is not exactly the notebook pages', async () => {
    const { id, pages } = await notebookWith('Reorder strict', 2);
    const other = await notebookWith('Reorder other', 1);
    await expect(reorderPages(id, [pages[0]])).rejects.toThrow(
      `missing ${pages[1]}`,
    );
    await expect(reorderPages(id, [...pages, other.pages[0]])).rejects.toThrow(
      `not in this notebook ${other.pages[0]}`,
    );
    await expect(reorderPages(id, [pages[0], pages[0]])).rejects.toThrow(
      /more than once/,
    );
  });
});

describe('movePages', () => {
  it('moves pages between notebooks next to an anchor and moves their files', async () => {
    const inbox = await notebookWith('Move from', 3);
    const target = await notebookWith('Move to', 2);
    const [x, y, z] = inbox.pages;
    const [t1, t2] = target.pages;

    const result = await movePages([z, x], target.id, { afterPageId: t1 });
    expect(result.target.after).toEqual([t1, z, x, t2]);
    expect(result.sources).toEqual([
      { notebookId: inbox.id, before: [x, y, z], after: [y] },
    ]);
    expect(await order(target.id)).toEqual([
      [t1, 1],
      [z, 2],
      [x, 3],
      [t2, 4],
    ]);
    expect(await order(inbox.id)).toEqual([[y, 1]]);
    expect(
      fs.existsSync(path.join(pagesRoot, String(target.id), `${z}.jpg`)),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(pagesRoot, String(inbox.id), `${z}.jpg`)),
    ).toBe(false);
    expect(await readPageFile(z)).not.toBeNull();
  });

  it('changes nothing on a dry run', async () => {
    const from = await notebookWith('Dry from', 1);
    const to = await notebookWith('Dry to', 1);
    const result = await movePages(from.pages, to.id, {
      beforePageId: to.pages[0],
      dryRun: true,
    });
    expect(result.target.after).toEqual([from.pages[0], to.pages[0]]);
    expect(await order(from.id)).toEqual([[from.pages[0], 1]]);
  });

  it('drops a page whose image the target already has', async () => {
    const to = await notebookWith('Dup to', 1);
    const from = await notebookWith('Dup from', 1);
    // appendPages refuses an image any notebook already holds, so the copy predates that rule.
    const original = appDb
      .select()
      .from(notebookPages)
      .where(eq(notebookPages.id, to.pages[0]))
      .get()!;
    appDb
      .update(notebookPages)
      .set({ contentHash: original.contentHash })
      .where(eq(notebookPages.id, from.pages[0]))
      .run();

    const result = await movePages(from.pages, to.id);
    expect(result.moved).toEqual([]);
    expect(result.dropped).toEqual([
      { pageId: from.pages[0], duplicateOf: to.pages[0] },
    ]);
    expect(await order(from.id)).toEqual([]);
    expect(await order(to.id)).toEqual([[to.pages[0], 1]]);
    expect(await readPageFile(from.pages[0])).toBeNull();
  });

  it('refuses unknown pages and anchors outside the target', async () => {
    const a = await notebookWith('Bad move a', 1);
    const b = await notebookWith('Bad move b', 1);
    await expect(movePages([99999], b.id)).rejects.toThrow(/not found: 99999/);
    await expect(
      movePages(a.pages, b.id, { beforePageId: a.pages[0] }),
    ).rejects.toThrow(/being moved/);
    const c = await notebookWith('Bad move c', 1);
    await expect(
      movePages(a.pages, b.id, { afterPageId: c.pages[0] }),
    ).rejects.toThrow(`not in notebook ${b.id}`);
  });
});

describe('mergeNotebooks', () => {
  it('moves every page to the start of the target and deletes the source', async () => {
    const unsorted = await notebookWith('Merge source', 2);
    const target = await notebookWith('Merge target', 1);
    const result = await mergeNotebooks(unsorted.id, target.id, {
      placement: 'start',
    });
    expect(result.deletedNotebookId).toBe(unsorted.id);
    expect(result.target.after).toEqual([...unsorted.pages, ...target.pages]);
    expect(await getNotebook(unsorted.id)).toBeNull();
    expect(fs.existsSync(path.join(pagesRoot, String(unsorted.id)))).toBe(
      false,
    );
    expect((await listNotebooks()).some((n) => n.id === unsorted.id)).toBe(
      false,
    );
  });

  it('keeps the source on a dry run and refuses merging into itself', async () => {
    const source = await notebookWith('Merge dry', 1);
    const target = await notebookWith('Merge dry target', 0);
    const result = await mergeNotebooks(source.id, target.id, { dryRun: true });
    expect(result).toMatchObject({ dryRun: true, deletedNotebookId: null });
    expect(await getNotebook(source.id)).not.toBeNull();
    await expect(mergeNotebooks(source.id, source.id)).rejects.toThrow(
      /into itself/,
    );
  });
});

describe('deleteNotebook', () => {
  it('deletes an empty notebook, and one with pages only when asked', async () => {
    const empty = await notebookWith('Delete empty', 0);
    expect(await deleteNotebook(empty.id)).toMatchObject({
      deletedPageIds: [],
    });

    const full = await notebookWith('Delete full', 2);
    await expect(deleteNotebook(full.id)).rejects.toThrow(/still has 2 pages/);
    expect(
      await deleteNotebook(full.id, { deletePages: true, dryRun: true }),
    ).toMatchObject({ dryRun: true, deletedPageIds: full.pages });
    expect(await getNotebook(full.id)).not.toBeNull();

    await deleteNotebook(full.id, { deletePages: true });
    expect(await getNotebook(full.id)).toBeNull();
    expect(await readPageFile(full.pages[0])).toBeNull();
    expect(await deleteNotebook(full.id)).toBeNull();
  });
});
