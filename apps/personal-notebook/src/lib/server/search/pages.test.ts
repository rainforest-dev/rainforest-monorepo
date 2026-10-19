import fs from 'node:fs';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  appendPages,
  createNotebook,
  restoreNotebook,
  setPageTranscription,
  trashNotebook,
} from '@/lib/server/notebooks';
import { pagePng, setUpNotebookShelf } from '@/test';

import { pageQueryReady, searchNotebookPages, settlePageIndex } from './pages';

let ids: number[] = [];
let root = '';

beforeAll(async () => {
  root = path.dirname(setUpNotebookShelf('calibre-page-search-'));
  process.env['CALIBRE_EMBED'] = 'fake';
  const notebook = await createNotebook('Autumn Journal');
  const files = await Promise.all(
    [11, 22, 33, 44].map(async (fill) => ({
      name: `p${fill}.png`,
      type: 'image/png',
      bytes: await pagePng(fill),
    })),
  );
  ids = (await appendPages(notebook.id, files)).added;
  const texts = [
    ['Harbour walk\n• lantern repair', '2026-09-01'],
    ['Reading list\n• the lantern keeper', '2026-09-14'],
    ['Weekend\n• swim in the ocean', '2026-10-02'],
  ] as const;
  for (const [i, [transcription, pageDate]] of texts.entries())
    await setPageTranscription(ids[i] ?? 0, { transcription, pageDate });
});

afterAll(() => {
  delete process.env['CALIBRE_EMBED'];
});

describe('searchNotebookPages', () => {
  it('finds pages by their words and marks the match', async () => {
    const { hits } = await searchNotebookPages('lantern', { exact: true });
    expect(hits.map((h) => h.id)).toEqual([ids[0], ids[1]]);
    expect(hits[0]).toMatchObject({
      notebookName: 'Autumn Journal',
      heading: 'Harbour walk',
      match: 'words',
      pageDate: '2026-09-01',
    });
    expect(hits[0]?.snippet.filter((p) => p.match).map((p) => p.text)).toEqual([
      'lantern',
    ]);
  });

  it('keeps to the page date range and skips pages with no text', async () => {
    const { hits } = await searchNotebookPages('lantern', {
      exact: true,
      from: '2026-09-10',
      to: '2026-09-30',
    });
    expect(hits.map((h) => h.id)).toEqual([ids[1]]);
    expect(
      (await searchNotebookPages('Autumn', { exact: true })).hits.map(
        (h) => h.id,
      ),
    ).toEqual(ids.slice(0, 3));
  });

  it('adds pages close in meaning once the index is built', async () => {
    await searchNotebookPages('sea');
    await settlePageIndex();
    expect(
      fs.existsSync(path.join(root, 'search', 'notebook-pages', 'docs.json')),
    ).toBe(true);
    const result = await searchNotebookPages('sea');
    expect(result.semantic).toBe('on');
    expect(result.hits).toEqual([
      expect.objectContaining({ id: ids[2], match: 'meaning' }),
    ]);
  });

  it('takes the nearest by meaning among pages in the date range', async () => {
    const { hits } = await searchNotebookPages('sea', {
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(hits).toEqual([]);
    expect(
      (await searchNotebookPages('sea', { from: '2026-10-01' })).hits.map(
        (h) => h.id,
      ),
    ).toEqual([ids[2]]);
  });

  it('searches a single Chinese character but not a single letter', async () => {
    expect(pageQueryReady('海')).toBe(true);
    expect(pageQueryReady(' a ')).toBe(false);
    // Every transcribed page has an 'a', so an answer here would mean the check was skipped.
    expect(await searchNotebookPages('a', { exact: true })).toEqual({
      hits: [],
      semantic: 'off',
    });
    await setPageTranscription(ids[2] ?? 0, {
      transcription: 'Weekend\n• swim in the ocean 海',
    });
    expect(
      (await searchNotebookPages('海', { exact: true })).hits.map((h) => h.id),
    ).toEqual([ids[2]]);
  });

  it('re-indexes when a page gains text', async () => {
    await setPageTranscription(ids[3] ?? 0, {
      transcription: 'Tide tables',
    });
    await searchNotebookPages('sea');
    await settlePageIndex();
    const { hits } = await searchNotebookPages('sea');
    expect(hits.map((h) => h.id).sort()).toEqual([ids[2], ids[3]].sort());
  });

  it('indexes an edit made while a build is running', async () => {
    await setPageTranscription(ids[3] ?? 0, { transcription: 'Grocery list' });
    await searchNotebookPages('sea');
    // The build for the grocery text is still running; this edit must not be lost behind it.
    await setPageTranscription(ids[3] ?? 0, { transcription: 'Tide tables' });
    await searchNotebookPages('sea');
    await settlePageIndex();
    const { hits } = await searchNotebookPages('sea');
    expect(hits.find((h) => h.id === ids[3])?.match).toBe('meaning');
  });

  it('leaves out pages of a notebook in Trash', async () => {
    const notebook = await createNotebook('Trash Journal');
    const {
      added: [page = 0],
    } = await appendPages(notebook.id, [
      { name: 'trash.png', type: 'image/png', bytes: await pagePng(99) },
    ]);
    await setPageTranscription(page, { transcription: 'Compass bearings' });
    const found = async () =>
      (await searchNotebookPages('compass', { exact: true })).hits.map(
        (h) => h.id,
      );
    expect(await found()).toEqual([page]);
    await trashNotebook(notebook.id);
    expect(await found()).toEqual([]);
    await restoreNotebook(notebook.id);
    expect(await found()).toEqual([page]);
  });
});
