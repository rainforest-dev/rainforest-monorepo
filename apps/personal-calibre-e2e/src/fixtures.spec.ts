import { expect, test } from '@playwright/test';

import { bookById, BOOKS } from './support/seed';

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
});
