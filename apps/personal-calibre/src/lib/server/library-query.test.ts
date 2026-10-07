import fs from 'node:fs';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createCalibreDb } from '@/test';

import {
  hydrateLibraryBooks,
  type LibraryQuery,
  queryLibrary,
} from './library-query';

let dir = '';

beforeAll(() => {
  dir = createCalibreDb({
    authors: [
      [1, 'Mara Ostrand', 'Ostrand, Mara'],
      [2, 'Tobiah Quell', 'Quell, Tobiah'],
    ],
    series: [
      [1, 'Amber Road'],
      [2, 'Northbound'],
    ],
    tags: [
      [1, 'sea'],
      [2, 'winter'],
      [3, 'yew'],
      [4, 'zephyr'],
    ],
    books: [
      {
        id: 1,
        title: 'Brine and Bell',
        authorIds: [1],
        seriesId: 1,
        seriesIndex: 2,
        tagIds: [1, 2],
      },
      {
        id: 2,
        title: 'Cold Lantern',
        authorIds: [1],
        seriesId: 1,
        seriesIndex: 1,
        hasCover: true,
      },
      {
        id: 3,
        title: 'Driftwood Hours',
        authorIds: [2],
        seriesId: 1,
        seriesIndex: 3,
      },
      {
        id: 4,
        title: 'Ferry at Dusk',
        authorIds: [2],
        seriesId: 2,
        seriesIndex: 1,
        tagIds: [1],
      },
      {
        id: 5,
        title: 'Gull Weather',
        authorIds: [2],
        seriesId: 2,
        seriesIndex: 2,
        hasCover: true,
      },
      {
        id: 6,
        title: 'Harbour Ledger',
        authorIds: [1],
        tagIds: [1],
        hasCover: true,
      },
      { id: 7, title: 'Iron Tide Almanac', authorIds: [2], tagIds: [2] },
      {
        id: 8,
        title: 'Juniper Signal',
        authorIds: [],
        tagIds: [3, 4],
        hasCover: true,
      },
      {
        id: 9,
        title: 'Kelp Forest Letters',
        authorIds: [2, 1],
        pubdate: '2001-04-15T00:00:00+00:00',
        hasCover: true,
      },
    ],
  });
  process.env.CALIBRE_LIBRARY_PATH = dir;
  process.env.CALIBRE_APP_DB_PATH = path.join(dir, 'app.db');
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const base: LibraryQuery = {
  page: 1,
  pageSize: 4,
  sortBy: 'title',
  sortDir: 'asc',
};
const ids = (r: Awaited<ReturnType<typeof queryLibrary>>) =>
  r.entries.map((e) => e.book.id);

describe('queryLibrary, ungrouped', () => {
  it('pages books in title order and counts the whole library', async () => {
    const result = await queryLibrary(base);
    expect(ids(result)).toEqual([1, 2, 3, 4]);
    expect(result).toMatchObject({
      page: 1,
      pageCount: 3,
      matching: 9,
      libraryTotal: 9,
      matchingIds: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    });
    expect(result.entries[0]?.group).toBeUndefined();
  });

  it('reverses the order with sortDir desc', async () => {
    expect(ids(await queryLibrary({ ...base, sortDir: 'desc' }))).toEqual([
      9, 8, 7, 6,
    ]);
  });

  it('returns an empty page past the end with the real page count', async () => {
    const result = await queryLibrary({ ...base, page: 5 });
    expect(result.entries).toEqual([]);
    expect(result.pageCount).toBe(3);
  });

  it('clamps an astronomically large page instead of erroring', async () => {
    const result = await queryLibrary({ ...base, page: 1e20 });
    expect(result.entries).toEqual([]);
    expect(result.pageCount).toBe(3);
    expect(result.matching).toBe(9);
  });

  it('filters before paging', async () => {
    const result = await queryLibrary({ ...base, tagId: 1 });
    expect(ids(result)).toEqual([1, 4, 6]);
    expect(result).toMatchObject({
      matching: 3,
      libraryTotal: 9,
      matchingIds: [1, 4, 6],
    });
  });
});

describe('queryLibrary, grouped', () => {
  it('orders series by name, books by series index, and pages over entries', async () => {
    const page1 = await queryLibrary({ ...base, groupBy: 'series' });
    expect(ids(page1)).toEqual([2, 1, 3, 4]);
    expect(page1.entries[0]?.group).toEqual({
      key: 'series:1',
      label: 'Amber Road',
      total: 3,
      offset: 0,
      id: 1,
    });
    expect(page1).toMatchObject({ pageCount: 3, matching: 9 });

    const page2 = await queryLibrary({ ...base, groupBy: 'series', page: 2 });
    expect(ids(page2)).toEqual([5, 6, 7, 8]);
    expect(page2.entries[0]?.group).toMatchObject({
      key: 'series:2',
      offset: 1,
      total: 2,
    });
    expect(page2.entries[1]?.group).toEqual({
      key: 'series:none',
      label: 'No series',
      total: 4,
      offset: 0,
      id: null,
    });

    const page3 = await queryLibrary({ ...base, groupBy: 'series', page: 3 });
    expect(ids(page3)).toEqual([9]);
    expect(page3.entries[0]?.group).toMatchObject({
      key: 'series:none',
      offset: 3,
    });
  });

  it('lists a book once per tag, puts Untagged last, and counts the book once', async () => {
    const result = await queryLibrary({
      ...base,
      pageSize: 20,
      groupBy: 'tag',
    });
    expect(result.entries.map((e) => `${e.group?.key}:${e.book.id}`)).toEqual([
      'tag:1:1',
      'tag:1:4',
      'tag:1:6',
      'tag:2:1',
      'tag:2:7',
      'tag:3:8',
      'tag:4:8',
      'tag:none:2',
      'tag:none:3',
      'tag:none:5',
      'tag:none:9',
    ]);
    expect(result.matching).toBe(11);
    expect(result.matchingIds).toHaveLength(9);
    expect(result.entries.at(-1)?.group?.label).toBe('Untagged');
  });

  it('groups by author with No author last', async () => {
    const result = await queryLibrary({
      ...base,
      pageSize: 20,
      groupBy: 'author',
    });
    expect(result.entries.at(-1)?.group).toMatchObject({
      key: 'author:none',
      label: 'No author',
    });
    expect(result.entries.filter((e) => e.book.id === 9)).toHaveLength(2);
  });

  it('clamps an astronomically large page instead of erroring', async () => {
    const result = await queryLibrary({
      ...base,
      groupBy: 'series',
      page: 1e20,
    });
    expect(result.entries).toEqual([]);
    expect(result.pageCount).toBe(3);
  });

  it('applies filters before grouping', async () => {
    const result = await queryLibrary({ ...base, groupBy: 'series', tagId: 1 });
    expect(result.entries.map((e) => `${e.group?.key}:${e.book.id}`)).toEqual([
      'series:1:1',
      'series:2:4',
      'series:none:6',
    ]);
  });
});

describe('queryLibrary, next-page cover ids', () => {
  const COVERED = new Set([2, 5, 6, 8, 9]);
  const coveredIds = (r: Awaited<ReturnType<typeof queryLibrary>>) => [
    ...new Set(ids(r).filter((id) => COVERED.has(id))),
  ];

  it('ungrouped: lists the covered books of the next page in order', async () => {
    const page1 = await queryLibrary(base);
    const page2 = await queryLibrary({ ...base, page: 2 });
    const page3 = await queryLibrary({ ...base, page: 3 });
    expect(page1.nextPageCoverIds).toEqual([5, 6, 8]);
    expect(page1.nextPageCoverIds).toEqual(coveredIds(page2));
    expect(page2.nextPageCoverIds).toEqual([9]);
    expect(page2.nextPageCoverIds).toEqual(coveredIds(page3));
    expect(page3.nextPageCoverIds).toEqual([]);
  });

  it('ungrouped: follows the sort direction', async () => {
    const desc = { ...base, sortDir: 'desc' as const };
    const page1 = await queryLibrary(desc);
    expect(page1.nextPageCoverIds).toEqual([5, 2]);
    expect(page1.nextPageCoverIds).toEqual(
      coveredIds(await queryLibrary({ ...desc, page: 2 })),
    );
  });

  it('grouped by series: follows the entry order across a group boundary', async () => {
    const query = { ...base, groupBy: 'series' as const };
    const page1 = await queryLibrary(query);
    const page2 = await queryLibrary({ ...query, page: 2 });
    expect(page2.entries.map((e) => e.group?.key)).toEqual([
      'series:2',
      'series:none',
      'series:none',
      'series:none',
    ]);
    expect(page1.nextPageCoverIds).toEqual([5, 6, 8]);
    expect(page1.nextPageCoverIds).toEqual(coveredIds(page2));
    expect(page2.nextPageCoverIds).toEqual([9]);
    expect(
      (await queryLibrary({ ...query, page: 3 })).nextPageCoverIds,
    ).toEqual([]);
  });

  it('grouped by tag: lists a book in two tags once', async () => {
    const query = { ...base, groupBy: 'tag' as const };
    const page2 = await queryLibrary({ ...query, page: 2 });
    expect(ids(page2)).toEqual([7, 8, 8, 2]);
    expect((await queryLibrary(query)).nextPageCoverIds).toEqual([8, 2]);
  });

  it('respects filters', async () => {
    const query = { ...base, pageSize: 2, tagId: 1 };
    expect((await queryLibrary(query)).nextPageCoverIds).toEqual([6]);
    expect(
      (await queryLibrary({ ...query, groupBy: 'series' })).nextPageCoverIds,
    ).toEqual([6]);
    expect(
      (await queryLibrary({ ...base, tagId: 999 })).nextPageCoverIds,
    ).toEqual([]);
  });

  it('an out-of-range page returns no next-page ids', async () => {
    for (const page of [5, 1e20]) {
      expect((await queryLibrary({ ...base, page })).nextPageCoverIds).toEqual(
        [],
      );
      expect(
        (await queryLibrary({ ...base, groupBy: 'series', page }))
          .nextPageCoverIds,
      ).toEqual([]);
    }
  });
});

describe('hydrateLibraryBooks', () => {
  it('pairs authors with ids in link order and adds series, tags and pubdate', async () => {
    const [nine, one] = await hydrateLibraryBooks([9, 1]);
    expect(nine).toMatchObject({
      id: 9,
      authors: ['Tobiah Quell', 'Mara Ostrand'],
      authorIds: [2, 1],
      seriesId: null,
      tags: [],
      pubdate: '2001-04-15T00:00:00+00:00',
    });
    expect(one).toMatchObject({
      id: 1,
      seriesId: 1,
      series: 'Amber Road',
      tags: [
        { id: 1, name: 'sea' },
        { id: 2, name: 'winter' },
      ],
    });
  });
});
