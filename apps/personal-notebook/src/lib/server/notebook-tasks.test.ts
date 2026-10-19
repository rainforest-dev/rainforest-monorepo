import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';

import { db, notebookPages } from '@/db';
import { pagePng, setUpNotebookShelf } from '@/test';

import { notebookTasks } from './notebook-tasks';
import { appendPages, createNotebook, trashNotebook } from './notebooks';

let fill = 60;
async function notebook(name: string, count: number) {
  const created = await createNotebook(name);
  const files = await Promise.all(
    Array.from({ length: count }, async (_, i) => ({
      name: `p${i}.png`,
      type: 'image/png',
      bytes: await pagePng((fill += 7)),
    })),
  );
  return {
    id: created.id,
    pages: (await appendPages(created.id, files)).added,
  };
}

const write = (id: number, pageDate: string | null, transcription: string) =>
  db
    .update(notebookPages)
    .set({ pageDate, transcription })
    .where(eq(notebookPages.id, id))
    .run();

beforeAll(() => {
  setUpNotebookShelf('notebook-tasks-');
});

describe('notebookTasks', () => {
  it('reads notebooks in writing order and leaves out the ones in Trash', async () => {
    // Created first but written later, so its copy of an item is the newer one.
    const newer = await notebook('Tasks newer', 1);
    const older = await notebook('Tasks older', 1);
    const trashed = await notebook('Tasks trashed', 1);
    write(older.pages[0] ?? 0, '2026-08-01', '• Fix bike\n• Call mum');
    write(newer.pages[0] ?? 0, '2026-10-01', 'x Fix bike');
    write(trashed.pages[0] ?? 0, '2026-10-02', '• Hidden');
    await trashNotebook(trashed.id);

    const tasks = notebookTasks(new Date('2026-10-16T00:00:00Z'));
    expect(tasks.map((t) => [t.text, t.source.notebookName, t.stale])).toEqual([
      ['Call mum', 'Tasks older', true],
    ]);
  });
});
