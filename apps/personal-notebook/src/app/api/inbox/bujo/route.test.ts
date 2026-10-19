import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { getNotebook } from '@/lib/server';
import { jpegBytes, scannedPdf, textPdf } from '@/test';

import { POST } from './route';

const SECRET = 'inbox-test-secret';

/** Real image bytes per `fill`: the shelf re-encodes uploads, so they must decode. */
const pixels = new Map<number, Uint8Array<ArrayBuffer>>();

beforeAll(async () => {
  for (const fill of [1, 2, 3, 5, 9]) {
    const png = await sharp({
      create: {
        width: 4,
        height: 4,
        channels: 3,
        background: { r: fill, g: fill, b: fill },
      },
    })
      .png()
      .toBuffer();
    pixels.set(fill, new Uint8Array(png));
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notebook-inbox-'));
  process.env.NOTEBOOK_DATA_DIR = dir;
});

afterEach(() => {
  delete process.env.NOTEBOOK_INBOX_SECRET;
});

// The declared type only routes the upload; sharp reads the format from the bytes.
const image = (name: string, fill: number, type = 'image/jpeg') =>
  new File([pixels.get(fill) ?? new Uint8Array()], name, { type });

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
    new Request('https://notebook.example.test/api/inbox/bujo', {
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
      if (secret !== undefined) process.env.NOTEBOOK_INBOX_SECRET = secret;
      const response = await inbox({ 'x-inbox-secret': SECRET });
      expect(response.status).toBe(404);
    },
  );

  it.each<Record<string, string>>([
    {},
    { 'x-inbox-secret': 'wrong' },
    { 'x-inbox-secret': `${SECRET}-and-more` },
    { 'x-notebook-gateway': SECRET },
  ])('answers 401 to %j', async (headers) => {
    process.env.NOTEBOOK_INBOX_SECRET = SECRET;
    const response = await inbox(headers);
    expect(response.status).toBe(401);
  });

  it('files pages into a notebook found or created by name, and dedups', async () => {
    process.env.NOTEBOOK_INBOX_SECRET = SECRET;
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
    // Every page is stored as a JPEG, whatever it arrived as.
    expect(notebook?.pages[2]?.mimeType).toBe('image/jpeg');
  });

  it('stores each page of a scanned PDF as its own page, in order', async () => {
    process.env.NOTEBOOK_INBOX_SECRET = SECRET;
    const pdf = await scannedPdf([await jpegBytes(61), await jpegBytes(62)]);
    const response = await inbox({ 'x-inbox-secret': SECRET }, [
      ['notebook', 'Scanned Log'],
      ['source', 'n8n'],
      ['file', new File([pdf], 'Scan 3.pdf', { type: 'application/pdf' })],
    ]);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.added).toHaveLength(2);
    const notebook = await getNotebook(body.notebookId);
    expect(notebook?.pages.map((p) => [p.fileName, p.position])).toEqual([
      ['Scan 3-p001.jpg', 1],
      ['Scan 3-p002.jpg', 2],
    ]);
  });

  it('refuses a PDF that is not a scan with 415', async () => {
    process.env.NOTEBOOK_INBOX_SECRET = SECRET;
    const response = await inbox({ 'x-inbox-secret': SECRET }, [
      ['notebook', 'Inbox Log'],
      [
        'file',
        new File([await textPdf()], 'week.pdf', { type: 'application/pdf' }),
      ],
    ]);
    expect(response.status).toBe(415);
    expect((await response.json()).error).toMatch(/only scanned PDFs/);
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
    process.env.NOTEBOOK_INBOX_SECRET = SECRET;
    const response = await inbox({ 'x-inbox-secret': SECRET }, fields);
    expect(response.status).toBe(400);
  });

  it('crops a sideways spread photo into two upright pages unless crop is off', async () => {
    process.env.NOTEBOOK_INBOX_SECRET = SECRET;
    const width = 600;
    const height = 800;
    const raw = Buffer.alloc(width * height * 3, 70);
    for (let y = 80; y < 720; y++) {
      for (let x = 100; x < 500; x++) {
        const writing = x > 380 && x < 400 && (y < 300 ? y > 150 : y > 600);
        const v = Math.abs(y - 400) < 8 ? 190 : writing ? 40 : 245;
        raw.fill(v, (y * width + x) * 3, (y * width + x) * 3 + 3);
      }
    }
    const spread = new Uint8Array(
      await sharp(raw, { raw: { width, height, channels: 3 } })
        .jpeg()
        .toBuffer(),
    );
    const photo = () =>
      new File([spread], 'spread.jpg', { type: 'image/jpeg' });

    const cropped = await inbox({ 'x-inbox-secret': SECRET }, [
      ['notebook', 'Spread Crop'],
      ['file', photo()],
    ]);
    const { notebookId } = await cropped.json();
    const pages = (await getNotebook(notebookId))?.pages ?? [];
    expect(pages.map((p) => p.fileName)).toEqual([
      'spread-left.jpg',
      'spread-right.jpg',
    ]);

    const kept = await inbox({ 'x-inbox-secret': SECRET }, [
      ['notebook', 'Spread Uncropped'],
      ['crop', 'off'],
      ['file', photo()],
    ]);
    const body = await kept.json();
    expect(body.added).toHaveLength(1);
  });
});
