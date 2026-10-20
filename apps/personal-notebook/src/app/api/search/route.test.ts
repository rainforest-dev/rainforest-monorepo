import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  appendPages,
  createNotebook,
  setPageTranscription,
} from '@/lib/server';
import { pagePng, setUpNotebookShelf } from '@/test';

import { GET } from './route';

// `connection()` needs a request scope that a direct handler call does not have.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection: async () => undefined,
}));

let notebookId = 0;
let pageIds: number[] = [];

beforeAll(async () => {
  setUpNotebookShelf('notebook-search-route-');
  process.env['NOTEBOOK_EMBED'] = 'fake';
  notebookId = (await createNotebook('Search Log')).id;
  const files = await Promise.all(
    [15, 25].map(async (fill) => ({
      name: `p${fill}.png`,
      type: 'image/png',
      bytes: await pagePng(fill),
    })),
  );
  pageIds = (await appendPages(notebookId, files)).added;
  await setPageTranscription(pageIds[0] ?? 0, {
    transcription: 'Garden\n• plant tulips',
    pageDate: '2026-09-01',
  });
  await setPageTranscription(pageIds[1] ?? 0, {
    transcription: 'Garden\n• tulips bloomed',
    pageDate: '2026-10-01',
  });
});

afterAll(() => {
  delete process.env['NOTEBOOK_EMBED'];
});

const search = async (query: string) =>
  (
    await GET(new Request(`https://notebook.example.test/api/search?${query}`))
  ).json();

describe('GET /api/search', () => {
  it('finds pages by the shared q and links each to its page in the reader', async () => {
    const body = await search('q=tulips&exact=1');
    expect(body.hits.map((h: { id: number }) => h.id)).toEqual(pageIds);
    expect(body.hits[0].href).toBe(
      `/notebooks/${notebookId}?page=${pageIds[0]}`,
    );
  });

  it('keeps to the page date range and ignores a malformed date', async () => {
    const body = await search('q=tulips&exact=1&from=2026-09-15&to=nope');
    expect(body.hits.map((h: { id: number }) => h.id)).toEqual([pageIds[1]]);
  });

  it('answers no hits to an empty query', async () => {
    expect((await search('')).hits).toEqual([]);
  });
});
