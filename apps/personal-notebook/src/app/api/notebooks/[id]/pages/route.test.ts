import { beforeAll, describe, expect, it } from 'vitest';

import { createNotebook, getNotebook } from '@/lib/server';
import { pagePng, setUpNotebookShelf } from '@/test';

import { POST } from './route';

beforeAll(() => {
  setUpNotebookShelf('notebook-notebook-pages-');
});

function post(id: string | number, body: FormData | string) {
  return POST(
    new Request(`https://notebook.example.test/api/notebooks/${id}/pages`, {
      method: 'POST',
      body,
      ...(typeof body === 'string' && {
        headers: { 'content-type': 'text/plain' },
      }),
    }),
    { params: Promise.resolve({ id: String(id) }) },
  );
}

const form = (...files: File[]) => {
  const data = new FormData();
  for (const file of files) data.append('file', file);
  return data;
};

const png = async (name: string, fill: number) =>
  new File([await pagePng(fill)], name, { type: 'image/png' });

describe('POST /api/notebooks/[id]/pages', () => {
  it('appends uploaded pages in order and reports re-sent ones as skipped', async () => {
    const { id } = await createNotebook('Upload Here');
    const first = await post(
      id,
      form(await png('left.png', 1), await png('right.png', 2)),
    );
    expect(first.status).toBe(200);
    const body = await first.json();
    expect(body).toMatchObject({ notebookId: id, skipped: [] });
    expect(body.added).toHaveLength(2);

    const again = await (
      await post(id, form(await png('left-again.png', 1)))
    ).json();
    expect(again.added).toEqual([]);
    expect(again.skipped).toEqual([
      { name: 'left-again.png', reason: 'duplicate: already in this notebook' },
    ]);

    const notebook = await getNotebook(id);
    expect(notebook?.pages.map((p) => [p.fileName, p.source])).toEqual([
      ['left.png', 'upload'],
      ['right.png', 'upload'],
    ]);
  });

  it('answers 400 to a bad id and 404 to an unknown notebook', async () => {
    expect((await post('abc', form(await png('a.png', 3)))).status).toBe(400);
    expect((await post(9999, form(await png('a.png', 3)))).status).toBe(404);
  });

  it('answers 400 to a body that is not a multipart form, or carries no file', async () => {
    const { id } = await createNotebook('Bad Bodies');
    expect((await post(id, 'hello')).status).toBe(400);
    const response = await post(id, form());
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/at least one file/);
  });

  it('refuses a batch holding an unreadable PDF with 415 and stores none of it', async () => {
    const { id } = await createNotebook('Bad PDF');
    const response = await post(
      id,
      form(
        await png('fine.png', 4),
        new File([new Uint8Array(8)], 'week.pdf', { type: 'application/pdf' }),
      ),
    );
    expect(response.status).toBe(415);
    expect((await getNotebook(id))?.pages).toEqual([]);
  });
});
