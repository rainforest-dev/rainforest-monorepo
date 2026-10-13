import { beforeAll, describe, expect, it } from 'vitest';

import { appendPages, createNotebook, getNotebook } from '@/lib/server';
import { pagePng, setUpNotebookShelf } from '@/test';

import { DELETE } from './route';

beforeAll(() => {
  setUpNotebookShelf('calibre-page-delete-');
});

const remove = (pageId: string | number) =>
  DELETE(
    new Request(`https://calibre.example.test/api/notebooks/pages/${pageId}`, {
      method: 'DELETE',
    }),
    { params: Promise.resolve({ pageId: String(pageId) }) },
  );

describe('DELETE /api/notebooks/pages/[pageId]', () => {
  it('deletes a page once, then answers 404', async () => {
    const notebook = await createNotebook('Retake');
    const { added } = await appendPages(notebook.id, [
      { name: 'blurry.png', type: 'image/png', bytes: await pagePng(5) },
      { name: 'sharp.png', type: 'image/png', bytes: await pagePng(6) },
    ]);

    const response = await remove(added[0]);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect((await getNotebook(notebook.id))?.pages.map((p) => p.id)).toEqual([
      added[1],
    ]);
    expect((await remove(added[0])).status).toBe(404);
  });

  it.each(['abc', '0', '-1'])('answers 400 to page id %j', async (pageId) => {
    expect((await remove(pageId)).status).toBe(400);
  });
});
