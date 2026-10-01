import { describe, expect, it } from 'vitest';

import type { LibraryBook, LibraryEntry } from '@/types';

import {
  bookIdOfNavKey,
  booksLabel,
  contentKey,
  groupEntries,
  groupTitle,
  navKey,
} from './group-entries';

const book = (id: number, title = `Book ${id}`): LibraryBook => ({
  id,
  title,
  authorSort: null,
  hasCover: false,
  seriesIndex: null,
  authors: [],
  series: null,
  formats: ['EPUB'],
  deliveredTo: [],
  seriesId: null,
  authorIds: [],
  tags: [],
  pubdate: null,
});

const entry = (
  id: number,
  key: string,
  label: string,
  total: number,
  offset: number,
): LibraryEntry => ({
  book: book(id),
  group: {
    key,
    label,
    total,
    offset,
    id: key.endsWith(':none') ? null : Number(key.split(':')[1]),
  },
});

describe('groupEntries', () => {
  it('turns consecutive entries into groups', () => {
    const groups = groupEntries(
      [
        entry(1, 'series:1', 'Amber Road', 2, 0),
        entry(2, 'series:1', 'Amber Road', 2, 1),
        entry(3, 'series:3', 'Northbound', 20, 0),
      ],
      'series',
    );
    expect(groups.map((g) => [g.key, g.entries.map((e) => e.book.id)])).toEqual(
      [
        ['series:1', [1, 2]],
        ['series:3', [3]],
      ],
    );
    expect(groups[1]).toMatchObject({
      label: 'Northbound',
      total: 20,
      continued: false,
      filter: { param: 'series', id: 3 },
    });
  });

  it('marks a group that started on an earlier page as continued', () => {
    const [group] = groupEntries(
      [entry(21, 'series:3', 'Northbound', 20, 15)],
      'series',
    );
    expect(group?.continued).toBe(true);
    expect(group && groupTitle(group)).toBe('Northbound (continued)');
  });

  it('puts the fallback group last and gives it no filter', () => {
    const groups = groupEntries(
      [entry(9, 'tag:none', 'Untagged', 1, 0), entry(1, 'tag:1', 'sea', 1, 0)],
      'tag',
    );
    expect(groups.map((g) => g.key)).toEqual(['tag:1', 'tag:none']);
    expect(groups[1]?.filter).toBeNull();
  });

  it('keeps a book that appears under two tags in both groups', () => {
    const groups = groupEntries(
      [entry(3, 'tag:4', 'essays', 1, 0), entry(3, 'tag:7', 'letters', 1, 0)],
      'tag',
    );
    expect(groups.map((g) => g.entries[0]?.book.id)).toEqual([3, 3]);
  });
});

describe('nav keys', () => {
  it('prefixes the group key, or all when ungrouped', () => {
    expect(navKey({ book: book(5) })).toBe('all:5');
    expect(navKey(entry(5, 'tag:7', 'letters', 1, 0))).toBe('tag:7:5');
    expect(bookIdOfNavKey('tag:7:5')).toBe(5);
    expect(bookIdOfNavKey('all:12')).toBe(12);
  });
});

describe('contentKey', () => {
  it('is equal for equal content and changes with a new delivery', () => {
    const a = [{ book: book(1, 'Salt') }];
    const b = [{ book: book(1, 'Salt') }];
    expect(contentKey(a)).toBe(contentKey(b));
    const delivered = [{ book: { ...book(1, 'Salt'), deliveredTo: ['kobo'] } }];
    expect(contentKey(delivered)).not.toBe(contentKey(a));
  });
});

describe('booksLabel', () => {
  it('pluralises', () => {
    expect(booksLabel(1)).toBe('1 book');
    expect(booksLabel(20)).toBe('20 books');
  });
});
