import { beforeAll, describe, expect, it } from 'vitest';

import { createNotebook } from '@/lib/server';
import { setUpNotebookShelf } from '@/test';

import { GET, PATCH } from './route';

beforeAll(() => {
  setUpNotebookShelf('notebook-notebook-route-');
});

const params = (id: string | number) => ({
  params: Promise.resolve({ id: String(id) }),
});

const patch = (id: string | number, body: unknown) =>
  PATCH(
    new Request(`https://notebook.example.test/api/notebooks/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    params(id),
  );

describe('GET /api/notebooks/[id]', () => {
  it('answers a notebook with its pages, 404 for an unknown one, 400 for a bad id', async () => {
    const { id } = await createNotebook('Read Me');
    const found = await GET(new Request('https://x.test'), params(id));
    expect(found.status).toBe(200);
    expect((await found.json()).notebook).toMatchObject({
      id,
      name: 'Read Me',
      pages: [],
    });
    expect(
      (await GET(new Request('https://x.test'), params(9999))).status,
    ).toBe(404);
    expect(
      (await GET(new Request('https://x.test'), params('abc'))).status,
    ).toBe(400);
  });
});

describe('PATCH /api/notebooks/[id]', () => {
  it('archives a notebook with an end date and reopens it without one', async () => {
    const { id } = await createNotebook('Archive Me');

    const archived = await patch(id, { status: 'archived' });
    expect(archived.status).toBe(200);
    const { notebook } = await archived.json();
    expect(notebook).toMatchObject({ id, status: 'archived' });
    expect(notebook.endedOn).toBe(new Date().toISOString().slice(0, 10));

    const reopened = await patch(id, { status: 'active' });
    expect(reopened.status).toBe(200);
    expect((await reopened.json()).notebook).toMatchObject({
      status: 'active',
      endedOn: null,
    });
  });

  it.each<[string, string | number, unknown]>([
    ['a bad id', 'abc', { status: 'archived' }],
    ['a zero id', 0, { status: 'archived' }],
    ['a body that is not JSON', 1, 'archived'],
    ['an unknown status', 1, { status: 'lost' }],
    ['no status', 1, {}],
  ])('answers 400 to %s', async (_, id, body) => {
    const response = await patch(id, body);
    expect(response.status).toBe(400);
  });

  it('answers 404 for an unknown notebook', async () => {
    const response = await patch(9999, { status: 'archived' });
    expect(response.status).toBe(404);
    expect((await patch(9999, { name: 'Anything' })).status).toBe(404);
  });

  it('renames a notebook, and answers 409 to a name in use', async () => {
    const { id } = await createNotebook('Unsorted');
    await createNotebook('Taken Name');

    const renamed = await patch(id, { name: ' 2026-09 Pocket ' });
    expect(renamed.status).toBe(200);
    expect((await renamed.json()).notebook).toMatchObject({
      id,
      name: '2026-09 Pocket',
    });

    const clash = await patch(id, { name: 'Taken Name' });
    expect(clash.status).toBe(409);
    expect((await clash.json()).error).toMatch(/merge into it instead/);
    expect((await patch(id, { name: '  ' })).status).toBe(400);
  });
});
