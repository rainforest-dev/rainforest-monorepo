import fs from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';

import { appendPages, createNotebook } from '@/lib/server';
import { pagePng, setUpNotebookShelf } from '@/test';

import { GET } from './route';

let pagesRoot: string;

beforeAll(() => {
  pagesRoot = setUpNotebookShelf('notebook-page-image-');
});

const get = (pageId: string | number, headers?: HeadersInit) =>
  GET(
    new Request(
      `https://notebook.example.test/api/notebooks/pages/${pageId}/image`,
      { headers },
    ),
    { params: Promise.resolve({ pageId: String(pageId) }) },
  );

describe('GET /api/notebooks/pages/[pageId]/image', () => {
  it('serves the stored JPEG, revalidated by its content hash', async () => {
    const notebook = await createNotebook('Pictures');
    const { added } = await appendPages(notebook.id, [
      {
        name: 'page.png',
        type: 'image/png',
        bytes: await pagePng(7, { width: 30, height: 40 }),
      },
    ]);
    const response = await get(added[0]);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(response.headers.get('cache-control')).toBe('private, no-cache');
    const etag = response.headers.get('etag');
    expect(etag).toMatch(/^"[0-9a-f]{64}"$/);
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(response.headers.get('content-length')).toBe(String(bytes.length));
    expect(await sharp(bytes).metadata()).toMatchObject({
      format: 'jpeg',
      width: 30,
      height: 40,
    });

    const revalidated = await get(added[0], { 'If-None-Match': etag! });
    expect(revalidated.status).toBe(304);
    expect(await revalidated.text()).toBe('');

    // A page whose file has gone is a 404, like an unknown page.
    fs.rmSync(path.join(pagesRoot, String(notebook.id), `${added[0]}.jpg`));
    expect((await get(added[0])).status).toBe(404);
  });

  it.each(['abc', '0', '9999'])('answers 404 to page id %j', async (pageId) => {
    expect((await get(pageId)).status).toBe(404);
  });
});
