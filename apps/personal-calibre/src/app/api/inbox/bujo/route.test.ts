import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { getNotebook } from '@/lib/server';
import { createCalibreDb } from '@/test';

import { POST } from './route';

const SECRET = 'inbox-test-secret';

beforeAll(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'calibre-inbox-'));
  process.env.CALIBRE_LIBRARY_PATH = createCalibreDb({
    authors: [],
    series: [],
    tags: [],
    books: [],
  });
  process.env.CALIBRE_APP_DB_PATH = path.join(dir, 'app.db');
  process.env.CALIBRE_NOTEBOOKS_DIR = path.join(dir, 'pages');
});

afterEach(() => {
  delete process.env.CALIBRE_INBOX_SECRET;
});

const image = (name: string, fill: number, type = 'image/jpeg') =>
  new File([new Uint8Array(32).fill(fill)], name, { type });

function inbox(
  headers: Record<string, string>,
  fields: Array<[string, string | File]> = [
    ['notebook', 'Inbox Log'],
    ['file', image('p1.jpg', 1)],
  ],
) {
  const form = new FormData();
  for (const [key, value] of fields) form.append(key, value);
  return POST(
    new Request('https://calibre.example.test/api/inbox/bujo', {
      method: 'POST',
      headers,
      body: form,
    }),
  );
}

describe('POST /api/inbox/bujo', () => {
  it.each([undefined, '', '  '])(
    'answers 404 while the secret is %j',
    async (secret) => {
      if (secret !== undefined) process.env.CALIBRE_INBOX_SECRET = secret;
      const response = await inbox({ 'x-inbox-secret': SECRET });
      expect(response.status).toBe(404);
    },
  );

  it.each<Record<string, string>>([
    {},
    { 'x-inbox-secret': 'wrong' },
    { 'x-inbox-secret': `${SECRET}-and-more` },
    { 'x-calibre-gateway': SECRET },
  ])('answers 401 to %j', async (headers) => {
    process.env.CALIBRE_INBOX_SECRET = SECRET;
    const response = await inbox(headers);
    expect(response.status).toBe(401);
  });

  it('files pages into a notebook found or created by name, and dedups', async () => {
    process.env.CALIBRE_INBOX_SECRET = SECRET;
    const headers = { 'x-inbox-secret': SECRET };

    const first = await inbox(headers, [
      ['notebook', 'Inbox Log'],
      ['source', 'n8n'],
      ['file', image('p1.jpg', 1)],
      ['file', image('p2.png', 2, 'image/png')],
    ]);
    expect(first.status).toBe(200);
    const body = await first.json();
    expect(body.added).toHaveLength(2);
    expect(body.skipped).toEqual([]);

    const second = await inbox(headers, [
      ['notebook', 'Inbox Log'],
      ['file', image('p1-again.jpg', 1)],
      ['file', image('p3.webp', 3, '')],
    ]);
    const again = await second.json();
    expect(again.notebookId).toBe(body.notebookId);
    expect(again.added).toHaveLength(1);
    expect(again.skipped).toEqual([
      { name: 'p1-again.jpg', reason: 'duplicate: already in this notebook' },
    ]);

    const notebook = await getNotebook(body.notebookId);
    expect(
      notebook?.pages.map((p) => [p.fileName, p.position, p.source]),
    ).toEqual([
      ['p1.jpg', 1, 'n8n'],
      ['p2.png', 2, 'n8n'],
      ['p3.webp', 3, 'inbox'],
    ]);
    expect(notebook?.pages[2]?.mimeType).toBe('image/webp');
  });

  it('refuses a PDF with 415', async () => {
    process.env.CALIBRE_INBOX_SECRET = SECRET;
    const response = await inbox({ 'x-inbox-secret': SECRET }, [
      ['notebook', 'Inbox Log'],
      ['file', image('week.pdf', 9, 'application/pdf')],
    ]);
    expect(response.status).toBe(415);
    expect((await response.json()).error).toMatch(/PDF/);
  });

  it.each<[string, Array<[string, string | File]>]>([
    ['no notebook', [['file', image('x.jpg', 5)]]],
    [
      'a blank notebook',
      [
        ['notebook', '  '],
        ['file', image('x.jpg', 5)],
      ],
    ],
    ['no file', [['notebook', 'Inbox Log']]],
  ])('answers 400 to %s', async (_, fields) => {
    process.env.CALIBRE_INBOX_SECRET = SECRET;
    const response = await inbox({ 'x-inbox-secret': SECRET }, fields);
    expect(response.status).toBe(400);
  });
});
