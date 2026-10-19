import { beforeAll, describe, expect, it } from 'vitest';

import {
  appendPages,
  createNotebook,
  getNotebook,
  readPageFile,
  setPageTranscription,
} from '@/lib/server';
import { pagePng, setUpNotebookShelf, writtenPage } from '@/test';

import { DELETE, PUT } from './route';

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

const replace = (pageId: string | number, files: File[]) => {
  const form = new FormData();
  for (const file of files) form.append('file', file);
  return PUT(
    new Request(`https://calibre.example.test/api/notebooks/pages/${pageId}`, {
      method: 'PUT',
      body: form,
    }),
    { params: Promise.resolve({ pageId: String(pageId) }) },
  );
};

const jpeg = (name: string, bytes: Uint8Array) =>
  new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' });

describe('PUT /api/notebooks/pages/[pageId]', () => {
  it('swaps in a retake of the page, keeping its id and place', async () => {
    const notebook = await createNotebook('Retakes');
    const { added } = await appendPages(notebook.id, [
      { name: 'a.jpg', type: 'image/jpeg', bytes: await writtenPage(21) },
      { name: 'b.jpg', type: 'image/jpeg', bytes: await writtenPage(22) },
    ]);
    await setPageTranscription(added[0], {
      transcription: 'old text',
      pageNumber: 4,
    });
    const before = await readPageFile(added[0]);

    // A re-encoded retake is a lookalike, which appendPages would skip.
    const retake = await writtenPage(21, {
      width: 450,
      height: 640,
      quality: 60,
    });
    const response = await replace(added[0], [jpeg('retake.jpg', retake)]);
    expect(response.status).toBe(200);
    const { page } = await response.json();
    expect(page).toMatchObject({
      id: added[0],
      position: 1,
      pageNumber: 4,
      fileName: 'retake.jpg',
      transcription: null,
      source: 'replace',
    });

    const after = await readPageFile(added[0]);
    expect(after?.contentHash).not.toBe(before?.contentHash);
    expect(after?.data.equals(before!.data)).toBe(false);
    expect((await getNotebook(notebook.id))?.pages.map((p) => p.id)).toEqual(
      added,
    );
  });

  it('refuses an image that is already another page of the notebook', async () => {
    const notebook = await createNotebook('Twins');
    const second = await writtenPage(32);
    const { added } = await appendPages(notebook.id, [
      { name: 'a.jpg', type: 'image/jpeg', bytes: await writtenPage(31) },
      { name: 'b.jpg', type: 'image/jpeg', bytes: second },
    ]);
    const response = await replace(added[0], [jpeg('b-again.jpg', second)]);
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain('already page 2');
  });

  it('takes exactly one image', async () => {
    const notebook = await createNotebook('One at a time');
    const { added } = await appendPages(notebook.id, [
      { name: 'a.png', type: 'image/png', bytes: await pagePng(41) },
    ]);
    const response = await replace(added[0], [
      jpeg('x.jpg', await writtenPage(42)),
      jpeg('y.jpg', await writtenPage(43)),
    ]);
    expect(response.status).toBe(400);
  });

  it('answers 404 to an unknown page and 400 to a bad id', async () => {
    const file = jpeg('x.jpg', await writtenPage(51));
    expect((await replace(99999, [file])).status).toBe(404);
    expect((await replace('abc', [file])).status).toBe(400);
  });
});

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
