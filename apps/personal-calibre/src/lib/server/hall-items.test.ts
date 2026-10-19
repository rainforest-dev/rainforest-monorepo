import fs from 'node:fs';
import path from 'node:path';

import { hallItemSchema } from '@rainforest-dev/library-contract';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createCalibreDb } from '@/test';

import { listBookHallItems, monthOf } from './hall-items';

let dir = '';

beforeAll(() => {
  dir = createCalibreDb({
    authors: [
      [1, 'Mara Ostrand', 'Ostrand, Mara'],
      [2, 'Tobiah Quell', 'Quell, Tobiah'],
    ],
    series: [[1, 'Amber Road']],
    tags: [
      [1, 'sea'],
      [2, 'winter'],
    ],
    books: [
      {
        id: 1,
        title: 'Brine and Bell',
        authorIds: [2, 1],
        seriesId: 1,
        seriesIndex: 1,
        tagIds: [2, 1],
        timestamp: '2026-08-03 10:00:00+00:00',
        hasCover: true,
      },
      { id: 2, title: 'Cold Lantern', authorIds: [] },
    ],
  });
  process.env.CALIBRE_LIBRARY_PATH = dir;
  process.env.CALIBRE_APP_DB_PATH = path.join(dir, 'app.db');
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('listBookHallItems', () => {
  it('shelves each book by its tags, series, authors and month added', () => {
    const [brine] = listBookHallItems();
    expect(brine).toEqual({
      kind: 'book',
      id: '1',
      title: 'Brine and Bell',
      color: expect.stringMatching(/^#[0-9a-f]{6}$/),
      groups: [
        'tag:winter',
        'tag:sea',
        'series:Amber Road',
        'author:Tobiah Quell',
        'author:Mara Ostrand',
        'month:2026-08',
      ],
      href: '/books?book=1',
      subtitle: 'Tobiah Quell、Mara Ostrand',
      cover: '/books/api/books/1/cover',
    });
  });

  it('leaves out the cover and subtitle a book does not have', () => {
    const cold = listBookHallItems().find((item) => item.id === '2');
    expect(cold).toBeDefined();
    expect(cold).not.toHaveProperty('cover');
    expect(cold).not.toHaveProperty('subtitle');
    expect(cold?.groups).toEqual([]);
  });

  it('returns items the hall contract accepts', () => {
    for (const item of listBookHallItems()) {
      expect(hallItemSchema.safeParse(item).success).toBe(true);
    }
  });
});

describe('monthOf', () => {
  it('reads the year and month of a Calibre timestamp', () => {
    expect(monthOf('2026-08-03 10:00:00+00:00')).toBe('2026-08');
    expect(monthOf('2026-08-03T10:00:00Z')).toBe('2026-08');
  });

  it('is null without a timestamp', () => {
    expect(monthOf(null)).toBeNull();
    expect(monthOf('')).toBeNull();
  });
});
