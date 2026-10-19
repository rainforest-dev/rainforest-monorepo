import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';

import { db, notebookPages } from '@/db';
import { pagePng, setUpNotebookShelf } from '@/test';

import {
  latestDatedMonth,
  notebookCalendar,
  undatedPages,
} from './notebook-calendar';
import { appendPages, createNotebook } from './notebooks';
import { MAX_OCR_ATTEMPTS } from './ocr';

let fill = 30;
async function pages(name: string, count: number): Promise<number[]> {
  const notebook = await createNotebook(name);
  const files = await Promise.all(
    Array.from({ length: count }, async (_, i) => ({
      name: `p${i}.png`,
      type: 'image/png',
      bytes: await pagePng((fill += 7)),
    })),
  );
  return (await appendPages(notebook.id, files)).added;
}

const set = (id: number, values: Partial<typeof notebookPages.$inferInsert>) =>
  db.update(notebookPages).set(values).where(eq(notebookPages.id, id)).run();

beforeAll(() => {
  setUpNotebookShelf('notebook-calendar-');
});

describe('notebook calendar', () => {
  it('lists the month’s dated pages and the nearest months either side', async () => {
    const [a = 0, b = 0, c = 0] = await pages('Calendar A', 3);
    const [d = 0, e = 0] = await pages('Calendar B', 2);
    set(a, { pageDate: '2026-08-30', transcription: 'August' });
    set(b, { pageDate: '2026-09-02', transcription: 'Wed' });
    set(c, { pageDate: '2026-09-01' });
    set(d, { pageDate: '2026-09-02' });
    set(e, { pageDate: '2026-11-05' });

    const september = notebookCalendar('2026-09');
    expect(
      september.pages.map((p) => [p.id, p.pageDate, p.notebookName]),
    ).toEqual([
      [c, '2026-09-01', 'Calendar A'],
      [b, '2026-09-02', 'Calendar A'],
      [d, '2026-09-02', 'Calendar B'],
    ]);
    expect(september).toMatchObject({ prev: '2026-08', next: '2026-11' });
    expect(notebookCalendar('2026-10')).toMatchObject({
      pages: [],
      prev: '2026-09',
      next: '2026-11',
    });
    expect(notebookCalendar('2026-11').next).toBeUndefined();
    expect(latestDatedMonth()).toBe('2026-11');
  });

  it('counts undated pages by why they have no date', async () => {
    const before = undatedPages();
    const [waiting = 0, read = 0, failed = 0] = await pages('Calendar C', 3);
    set(waiting, { ocrAttempts: 1 });
    set(read, { transcription: 'no date here' });
    set(failed, { ocrAttempts: MAX_OCR_ATTEMPTS });
    expect(undatedPages()).toEqual({
      waiting: before.waiting + 1,
      noDate: before.noDate + 1,
      gaveUp: before.gaveUp + 1,
    });
  });
});
