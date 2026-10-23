import {
  hallItemsResponseSchema,
  missingHallDimensions,
} from '@rainforest-dev/library-contract';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  appendPages,
  createNotebook,
  NOTEBOOK_COLORS,
  setNotebookStatus,
  setPageTranscription,
  trashNotebook,
} from '@/lib/server';
import { pagePng, setUpNotebookShelf } from '@/test';

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
    expect(item?.groups).toContain('creator:Rainforest');
    // Topics wait for page tags; the hall shelves notebooks as unsorted by topic until then.
    expect(item && missingHallDimensions(item)).toEqual(['topic']);
    expect(item?.groups.some((g) => /^year:\d{4}$/.test(g))).toBe(true);
    expect(item?.groups.some((g) => /^month:\d{4}-\d{2}$/.test(g))).toBe(true);
    expect(items.find((i) => i.id === String(archived.id))?.groups).toContain(
      'status:archived',
    );
  });

  it('dates a notebook with no start by its earliest dated page, else by its name', async () => {
    const paged = await createNotebook('Hall Paged 2026-08');
    const pages = (
      await appendPages(paged.id, [
        { name: 'a.png', type: 'image/png', bytes: await pagePng(21) },
        { name: 'b.png', type: 'image/png', bytes: await pagePng(22) },
      ])
    ).added;
    await setPageTranscription(pages[0] ?? 0, {
      transcription: 'later',
      pageDate: '2026-07-20',
    });
    await setPageTranscription(pages[1] ?? 0, {
      transcription: 'earlier',
      pageDate: '2026-07-03',
    });
    const named = await createNotebook('Bullet Journal 2025-11');

    const { items } = hallItemsResponseSchema.parse(await (await GET()).json());
    const groups = (id: number) =>
      items.find((i) => i.id === String(id))?.groups;
    expect(groups(paged.id)).toContain('month:2026-07');
    expect(groups(named.id)).toEqual(
      expect.arrayContaining(['month:2025-11', 'year:2025']),
    );
  });

  it('gives a notebook the same colour every time', async () => {
    const first = (await (await GET()).json()).items;
    const second = (await (await GET()).json()).items;
    expect(second).toEqual(first);
  });
});
