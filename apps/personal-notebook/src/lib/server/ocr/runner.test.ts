import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { appDb, notebookPages } from '@/db';
import {
  appendPages,
  createNotebook,
  getNotebookPages,
  replacePage,
  setPageTranscription,
} from '@/lib/server/notebooks';
import { pagePng, setUpNotebookShelf } from '@/test';

import type { OcrEngine } from './engine';
import {
  MAX_OCR_ATTEMPTS,
  nextPageForOcr,
  ocrNextPage,
  startOcrWorker,
} from './runner';

const ANSWER =
  'DATE: 2026-10-11\nPAGE: 4\nHEADINGS: Sunday\nTEXT:\n• walk\n人 laundry';

const engine = (
  read: OcrEngine['read'] = async () => ANSWER,
  ready: OcrEngine['ready'] = async () => undefined,
): OcrEngine => ({ name: 'test-vl', ready, read });

let fill = 10;
async function freshPages(count: number): Promise<number[]> {
  // Clear what earlier tests left waiting, so each test sees only its own pages.
  appDb.update(notebookPages).set({ transcription: 'done' }).run();
  const notebook = await createNotebook(`OCR ${fill}`);
  const files = await Promise.all(
    Array.from({ length: count }, async (_, i) => ({
      name: `p${i}.png`,
      type: 'image/png',
      bytes: await pagePng((fill += 7)),
    })),
  );
  const { added } = await appendPages(notebook.id, files);
  return added;
}

const page = (id: number) =>
  appDb.select().from(notebookPages).where(eq(notebookPages.id, id)).get();

beforeAll(() => {
  setUpNotebookShelf('calibre-ocr-');
});

describe('ocrNextPage', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('reads the oldest waiting page and fills its text, date and number', async () => {
    const [first, second] = await freshPages(2);
    expect(nextPageForOcr()).toBe(first);
    expect(await ocrNextPage(engine())).toBe('read');
    expect(page(first ?? 0)).toMatchObject({
      transcription: 'Sunday\n\n• walk\nx laundry',
      pageDate: '2026-10-11',
      pageNumber: 4,
      transcribedBy: 'ocr:test-vl',
      ocrError: null,
    });
    expect(nextPageForOcr()).toBe(second);
  });

  it('keeps a date and number someone already set', async () => {
    const [id = 0] = await freshPages(1);
    appDb
      .update(notebookPages)
      .set({ pageDate: '2026-01-01', pageNumber: 9 })
      .where(eq(notebookPages.id, id))
      .run();
    await ocrNextPage(engine());
    expect(page(id)).toMatchObject({ pageDate: '2026-01-01', pageNumber: 9 });
  });

  it('never overwrites a transcription written while the model was reading', async () => {
    const [id = 0] = await freshPages(1);
    const outcome = await ocrNextPage(
      engine(async () => {
        await setPageTranscription(id, { transcription: 'by hand' });
        return ANSWER;
      }),
    );
    expect(outcome).toBe('read');
    expect(page(id)).toMatchObject({
      transcription: 'by hand',
      transcribedBy: null,
    });
  });

  it('drops a read whose page image was replaced meanwhile', async () => {
    const [id = 0] = await freshPages(1);
    const retake = async () => {
      const replaced = await replacePage(id, {
        name: 'retake.png',
        type: 'image/png',
        bytes: await pagePng((fill += 7)),
      });
      expect(replaced.ok).toBe(true);
    };
    expect(
      await ocrNextPage(
        engine(async () => {
          await retake();
          return ANSWER;
        }),
      ),
    ).toBe('read');
    expect(page(id)).toMatchObject({ transcription: null, pageDate: null });
    expect(
      await ocrNextPage(
        engine(async () => {
          await retake();
          throw new Error('model crashed');
        }),
      ),
    ).toBe('failed');
    expect(page(id)).toMatchObject({ ocrAttempts: 0, ocrError: null });
    expect(nextPageForOcr()).toBe(id);
  });

  it('drops the OCR mark when someone edits the text', async () => {
    const [id = 0] = await freshPages(1);
    await ocrNextPage(engine());
    await setPageTranscription(id, { transcription: 'fixed by hand' });
    expect(page(id)?.transcribedBy).toBeNull();
  });

  it('retries a page that gave up once its image is replaced', async () => {
    const [id = 0] = await freshPages(1);
    const failing = engine(async () => {
      throw new Error('model crashed');
    });
    for (let i = 0; i < MAX_OCR_ATTEMPTS; i++) await ocrNextPage(failing);
    expect(nextPageForOcr()).toBeUndefined();
    await replacePage(id, {
      name: 'retake.png',
      type: 'image/png',
      bytes: await pagePng((fill += 7)),
    });
    expect(page(id)).toMatchObject({ ocrAttempts: 0, ocrError: null });
    expect(nextPageForOcr()).toBe(id);
  });

  it('counts failures and gives up after the limit', async () => {
    const [id = 0] = await freshPages(1);
    const failing = engine(async () => {
      throw new Error('model crashed');
    });
    for (let i = 0; i < MAX_OCR_ATTEMPTS; i++)
      expect(await ocrNextPage(failing)).toBe('failed');
    expect(page(id)).toMatchObject({
      transcription: null,
      ocrAttempts: MAX_OCR_ATTEMPTS,
      ocrError: 'model crashed',
    });
    expect(await ocrNextPage(failing)).toBe('idle');
  });

  it('treats an empty answer as a failure', async () => {
    const [id = 0] = await freshPages(1);
    expect(await ocrNextPage(engine(async () => 'TEXT:\n'))).toBe('failed');
    expect(page(id)?.ocrAttempts).toBe(1);
  });
});

describe('startOcrWorker', () => {
  const quiet = { info: () => undefined, warn: vi.fn() };

  it('drains waiting pages and charges no attempt while the engine is down', async () => {
    const ids = await freshPages(2);
    let up = false;
    const read = vi.fn(async () => ANSWER);
    const stop = startOcrWorker(
      engine(read, async () => {
        if (!up) throw new Error('connect ECONNREFUSED');
      }),
      { intervalMs: 20, log: quiet },
    );
    try {
      await vi.waitFor(() => expect(quiet.warn).toHaveBeenCalled());
      expect(read).not.toHaveBeenCalled();
      expect(ids.map((id) => page(id)?.ocrAttempts)).toEqual([0, 0]);
      up = true;
      await vi.waitFor(() =>
        expect(ids.map((id) => page(id)?.transcribedBy)).toEqual([
          'ocr:test-vl',
          'ocr:test-vl',
        ]),
      );
      expect(startOcrWorker(engine(), { log: quiet })).toBe(stop);
    } finally {
      stop();
    }
  });

  it('lists pages it read like any other', async () => {
    const [id = 0] = await freshPages(1);
    await ocrNextPage(engine());
    const pages = await getNotebookPages(page(id)?.notebookId ?? 0);
    expect(pages?.[0]?.transcribedBy).toBe('ocr:test-vl');
  });
});
