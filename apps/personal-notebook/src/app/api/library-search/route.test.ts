import { librarySearchResponseSchema } from '@rainforest-dev/library-contract';
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
let pageId = 0;

beforeAll(async () => {
  setUpNotebookShelf('notebook-library-search-');
  process.env['NOTEBOOK_EMBED'] = 'fake';
  notebookId = (await createNotebook('Garden Log')).id;
  [pageId = 0] = (
    await appendPages(notebookId, [
      { name: 'p.png', type: 'image/png', bytes: await pagePng(15) },
    ])
  ).added;
  await setPageTranscription(pageId, {
    transcription: 'Garden\n• plant tulips',
    pageDate: '2026-09-01',
  });
});

afterAll(() => {
  delete process.env['NOTEBOOK_EMBED'];
});

const search = async (q: string) =>
  (
    await GET(
      new Request(
        `https://notebook.example.test/api/library-search?q=${encodeURIComponent(q)}`,
      ),
    )
  ).json();

describe('GET /api/library-search', () => {
  it('answers pages in the library search shape, linked into the reader', async () => {
    const body = await search('tulips');
    expect(librarySearchResponseSchema.safeParse(body).success).toBe(true);
    expect(body.results[0]).toMatchObject({
      kind: 'notebook',
      id: `page-${pageId}`,
      href: `/notebooks/${notebookId}?page=${pageId}`,
    });
    expect(body.results[0].subtitle).toContain('Garden Log');
    expect(body.results[0].snippet).toContain('tulips');
  });

  it('finds nothing for an empty query', async () => {
    expect(await search('')).toEqual({ results: [] });
  });
});
