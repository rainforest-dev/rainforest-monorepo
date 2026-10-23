import { hallItemsResponseSchema } from '@rainforest-dev/library-contract';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  createNotebook,
  NOTEBOOK_COLORS,
  setNotebookStatus,
  trashNotebook,
} from '@/lib/server';
import { setUpNotebookShelf } from '@/test';

import { GET } from './route';

// `connection()` needs a request scope that a direct handler call does not have.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection: async () => undefined,
}));

beforeAll(() => {
  setUpNotebookShelf('notebook-hall-items-');
});

describe('GET /api/hall-items', () => {
  it('shelves every notebook outside Trash in the contract shape, linked under the base path', async () => {
    const kept = await createNotebook('Hall Log');
    const archived = await createNotebook('Hall Archive');
    await setNotebookStatus(archived.id, 'archived');
    const trashed = await createNotebook('Hall Trash');
    await trashNotebook(trashed.id);

    const response = await GET();
    const { items } = hallItemsResponseSchema.parse(await response.json());

    expect(items.map((i) => i.title).sort()).toEqual([
      'Hall Archive',
      'Hall Log',
    ]);
    const item = items.find((i) => i.id === String(kept.id));
    expect(item).toMatchObject({
      kind: 'notebook',
      href: `/notebooks/${kept.id}`,
    });
    expect(NOTEBOOK_COLORS).toContain(item?.color);
    expect(item?.groups).toContain('status:active');
    expect(item?.groups.some((g) => /^year:\d{4}$/.test(g))).toBe(true);
    expect(item?.groups.some((g) => /^month:\d{4}-\d{2}$/.test(g))).toBe(true);
    expect(items.find((i) => i.id === String(archived.id))?.groups).toContain(
      'status:archived',
    );
  });

  it('gives a notebook the same colour every time', async () => {
    const first = (await (await GET()).json()).items;
    const second = (await (await GET()).json()).items;
    expect(second).toEqual(first);
  });
});
