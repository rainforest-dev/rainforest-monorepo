import { describe, expect, it } from 'vitest';

import { contentKey, navKey } from '@/lib/group-entries';
import type { EntryGroupRef, LibraryEntry } from '@/types';

import {
  buildStudyModel,
  isCjk,
  isStudyGroupBy,
  spineDims,
  spineTone,
} from './model';

const TITLES = [
  'The Salt Archive',
  '霧中的書店',
  'Ledger of Small Winds',
  'Two Clocks at Low Water',
];

const entry = (id: number, group?: EntryGroupRef): LibraryEntry => ({
  book: {
    id,
    title: TITLES[id % TITLES.length] ?? `Book ${id}`,
    authorSort: null,
    hasCover: id % 10 === 7,
    seriesIndex: group ? id : null,
    authors: ['Mara Quill'],
    series: group?.label ?? null,
    formats: ['EPUB'],
    deliveredTo: [],
    seriesId: group?.id ?? null,
    authorIds: [],
    tags: [],
    pubdate: null,
  },
  group,
});

const ref = (
  key: string,
  label: string,
  total: number,
  offset = 0,
): EntryGroupRef => ({ key, label, total, offset, id: offset });

describe('spineDims', () => {
  it('uses the prototype formula in pixels', () => {
    expect(spineDims(1)).toEqual({ width: 33, height: 185, depth: 122 });
  });

  it('stays within the prototype range', () => {
    for (let id = 1; id <= 250; id += 1) {
      const { width, height } = spineDims(id);
      expect(width).toBeGreaterThanOrEqual(26);
      expect(width).toBeLessThanOrEqual(41);
      expect(height).toBeGreaterThanOrEqual(172);
      expect(height).toBeLessThanOrEqual(209);
    }
  });
});

describe('spineTone', () => {
  it('is chart-(id % 5 + 1)', () => {
    expect(spineTone(5)).toBe(1);
    expect(spineTone(9)).toBe(5);
  });
});

describe('isCjk', () => {
  it('matches CJK titles', () => {
    expect(isCjk('霧中的書店')).toBe(true);
    expect(isCjk('海港來信')).toBe(true);
  });

  it('does not match Latin titles with curly quotes', () => {
    expect(isCjk('The Lamplighter’s Year')).toBe(false);
    expect(isCjk('Two Clocks at Low Water')).toBe(false);
  });
});

describe('isStudyGroupBy', () => {
  it('accepts series and author only', () => {
    expect(isStudyGroupBy('series')).toBe(true);
    expect(isStudyGroupBy('author')).toBe(true);
    expect(isStudyGroupBy('tag')).toBe(false);
    expect(isStudyGroupBy(null)).toBe(false);
  });
});

describe('buildStudyModel', () => {
  const none = ref('series:none', 'No series', 1);
  const salt = ref('series:2', 'Salt Tides', 12, 4);
  const fog = ref('series:1', 'Fog Harbour', 3);
  const entries = [
    entry(1, none),
    entry(2, salt),
    entry(3, salt),
    entry(4, fog),
  ];

  it('keeps groupEntries order with the fallback group last', () => {
    const model = buildStudyModel(entries, 'series');
    expect(model.shelves.map((s) => s.key)).toEqual([
      'series:2',
      'series:1',
      'series:none',
    ]);
    expect(model.shelves[0]?.books.map((b) => b.id)).toEqual([2, 3]);
  });

  it('counts the group total and marks continued groups', () => {
    const [saltShelf, fogShelf] = buildStudyModel(entries, 'series').shelves;
    expect(saltShelf).toMatchObject({
      label: 'Salt Tides',
      count: 12,
      continued: true,
    });
    expect(fogShelf).toMatchObject({ count: 3, continued: false });
  });

  it('derives each book from its entry', () => {
    const model = buildStudyModel(entries, 'series');
    const book = model.shelves[1]?.books[0];
    expect(book).toEqual({
      id: 4,
      navKey: navKey(entries[3] as LibraryEntry),
      title: 'The Salt Archive',
      authors: ['Mara Quill'],
      series: 'Fog Harbour',
      seriesIndex: 4,
      hasCover: false,
      tone: spineTone(4),
      cjk: false,
      dims: spineDims(4),
    });
    expect(model.shelves[0]?.books[0]?.cjk).toBe(false);
    expect(
      buildStudyModel([entry(5, fog)], 'series').shelves[0]?.books[0]?.cjk,
    ).toBe(true);
  });

  it('keys the model by content, not array identity', () => {
    const a = buildStudyModel(entries, 'series');
    const b = buildStudyModel(
      entries.map((e) => ({ ...e, book: { ...e.book } })),
      'series',
    );
    expect(a.key).toBe(contentKey(entries));
    expect(b.key).toBe(a.key);
  });
});
