import fs from 'node:fs';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  appendPages,
  createNotebook,
  setPageTranscription,
} from '@/lib/server/notebooks';
import { pagePng, setUpNotebookShelf } from '@/test';

import { searchNotebookPages, settlePageIndex } from './pages';

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

  it('re-indexes when a page gains text', async () => {
    await setPageTranscription(ids[3] ?? 0, {
      transcription: 'Tide tables',
    });
    await searchNotebookPages('sea');
    await settlePageIndex();
    const { hits } = await searchNotebookPages('sea');
    expect(hits.map((h) => h.id).sort()).toEqual([ids[2], ids[3]].sort());
  });
});
