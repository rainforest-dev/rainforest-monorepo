import { beforeAll, describe, expect, it } from 'vitest';

import { createNotebook, getNotebook } from '@/lib/server';
import { setUpNotebookShelf } from '@/test';

import { POST } from './route';

beforeAll(() => {
  setUpNotebookShelf('notebook-notebook-bulk-route-');
});

const post = (body: unknown) =>
  POST(
    new Request('https://notebook.example.test/api/notebooks/bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );

describe('POST /api/notebooks/bulk', () => {
  it('runs the action and answers which notebooks changed', async () => {
    const a = await createNotebook('Route Bulk A');
    const b = await createNotebook('Route Bulk B');
    const response = await post({ action: 'trash', ids: [a.id, b.id] });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ done: [a.id, b.id], failed: [] });
    expect((await getNotebook(a.id))?.trashedAt).not.toBeNull();
  });

  it('refuses an unknown action, no ids, and a merge with no target', async () => {
    const { id } = await createNotebook('Route Bulk C');
    expect((await post({ action: 'burn', ids: [id] })).status).toBe(400);
    expect((await post({ action: 'archive', ids: [] })).status).toBe(400);
    expect((await post('not json')).status).toBe(400);
    const merge = await post({ action: 'merge', ids: [id] });
    expect(merge.status).toBe(400);
    expect((await merge.json()).error).toMatch(/merge into/);
  });
});
