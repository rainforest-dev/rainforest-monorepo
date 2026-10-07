import { expect, test } from '@playwright/test';

import { bookById, BOOKS, COVER_IDS } from './support/seed';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

test.describe('fixture library', () => {
  test('seeds the made-up library', async ({ request }) => {
    const res = await request.get('/api/books?limit=100');
    const body = (await res.json()) as {
      total: number;
      books: Array<{ id: number; title: string }>;
    };
    expect(body.total).toBe(BOOKS.length);
    expect(body.books.map((b) => b.title)).toContain(bookById(1).title);
  });

  test('serves the seeded files', async ({ request }) => {
    const res = await request.post('/api/books/download/bulk', {
      data: { bookIds: [1, 2], format: 'EPUB' },
    });
    expect(res.ok()).toBe(true);
    expect(res.headers()['content-type']).toContain('zip');
  });

  test('seeds three platforms and the seed deliveries', async ({ request }) => {
    const res = await request.get('/api/books/1/deliveries');
    const body = (await res.json()) as {
      events: Array<{ platformKey: string }>;
    };
    expect(body.events.map((e) => e.platformKey).sort()).toEqual([
      'kobo',
      'notebooklm',
    ]);
  });

  test('serves made-up covers for ids ending in 7', async ({ request }) => {
    for (const id of [7, 27]) {
      const res = await request.get(`/api/books/${id}/cover`);
      expect(res.status()).toBe(200);
      expect([...(await res.body()).subarray(0, 8)]).toEqual(PNG_SIGNATURE);
    }
    expect((await request.get('/api/books/1/cover')).status()).toBe(404);
  });

  test('reports hasCover exactly for the cover ids', async ({ request }) => {
    const res = await request.get('/api/books?limit=100');
    const body = (await res.json()) as {
      books: Array<{ id: number; hasCover: boolean | null }>;
    };
    const listed = new Set(body.books.map((b) => b.id));
    expect(
      body.books
        .filter((b) => b.hasCover)
        .map((b) => b.id)
        .sort((a, b) => a - b),
    ).toEqual(COVER_IDS.filter((id) => listed.has(id)));
  });
});
