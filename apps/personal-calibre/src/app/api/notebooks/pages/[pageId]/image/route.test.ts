import fs from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';

import { appendPages, createNotebook } from '@/lib/server';
import { pagePng, setUpNotebookShelf } from '@/test';

import { GET } from './route';

let pagesRoot: string;

beforeAll(() => {
  pagesRoot = setUpNotebookShelf('calibre-page-image-');
});

const get = (pageId: string | number) =>
  GET(
    new Request(
      `https://calibre.example.test/api/notebooks/pages/${pageId}/image`,
    ),
    { params: Promise.resolve({ pageId: String(pageId) }) },
  );

describe('GET /api/notebooks/pages/[pageId]/image', () => {
  it('serves the stored JPEG with an immutable cache header', async () => {
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
    expect(response.headers.get('cache-control')).toContain('immutable');
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(response.headers.get('content-length')).toBe(String(bytes.length));
    expect(await sharp(bytes).metadata()).toMatchObject({
      format: 'jpeg',
      width: 30,
      height: 40,
    });

    // A page whose file has gone is a 404, like an unknown page.
    fs.rmSync(path.join(pagesRoot, String(notebook.id), `${added[0]}.jpg`));
    expect((await get(added[0])).status).toBe(404);
  });

  it.each(['abc', '0', '9999'])('answers 404 to page id %j', async (pageId) => {
    expect((await get(pageId)).status).toBe(404);
  });
});
