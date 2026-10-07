import { pickTarget } from '@rainforest-dev/rainforest-ui/interaction';
import { describe, expect, it } from 'vitest';

import {
  BOOK_GAP,
  booksInRow,
  GROUP_GAP,
  LABEL_GAP,
  layoutShelves,
  MODEL_PX_PER_UNIT,
  ROW_H,
  studyNavItems,
} from './layout';
import {
  isCjk,
  spineDims,
  spineTone,
  type StudyBook,
  type StudyShelf,
} from './model';

const book = (id: number, shelfKey: string): StudyBook => {
  const title = id % 2 ? 'The Salt Archive' : '霧中的書店';
  return {
    id,
    navKey: `${shelfKey}:${id}`,
    title,
    authors: ['Mara Quill'],
    series: null,
    seriesIndex: null,
    hasCover: false,
    tone: spineTone(id),
    cjk: isCjk(title),
    dims: spineDims(id),
  };
};

const shelf = (key: string, ids: number[], continued = false): StudyShelf => ({
  key,
  label: `Shelf ${key}`,
  count: ids.length + (continued ? 5 : 0),
  continued,
  books: ids.map((id) => book(id, key)),
});

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

const thickness = (id: number) => spineDims(id).width / MODEL_PX_PER_UNIT;
const runWidth = (ids: number[]) =>
  ids.reduce((sum, id) => sum + thickness(id) + BOOK_GAP, 0);

const isDivider = (board: { sx: number }) => board.sx === 0.06;

describe('layoutShelves', () => {
  it('places books left to right in reading order, x at the centre', () => {
    const layout = layoutShelves([shelf('a', range(1, 5))], 10);
    expect(layout.books.map((p) => p.order)).toEqual([0, 1, 2, 3, 4]);
    let left = 0;
    for (const placed of layout.books) {
      expect(placed.row).toBe(0);
      expect(placed.t).toBeCloseTo(thickness(placed.book.id));
      expect(placed.x).toBeCloseTo(left + placed.t / 2);
      expect(placed.y).toBeCloseTo(placed.h / 2);
      expect(placed.h).toBeCloseTo(placed.book.dims.height / 100);
      expect(placed.d).toBeCloseTo(placed.book.dims.depth / 100);
      left += placed.t + BOOK_GAP;
    }
  });

  it('separates shelves on one row by a divider and GROUP_GAP', () => {
    const layout = layoutShelves(
      [shelf('a', [1, 2, 3]), shelf('b', [4, 5, 6])],
      10,
    );
    const end = runWidth([1, 2, 3]);
    const dividers = layout.boards.filter(isDivider);
    expect(dividers).toHaveLength(1);
    expect(dividers[0]?.x).toBeCloseTo(end + GROUP_GAP / 2);
    const first = layout.books[3];
    expect(first?.shelfKey).toBe('b');
    expect(first?.row).toBe(0);
    expect(first?.x).toBeCloseTo(end + GROUP_GAP + thickness(4) / 2);
  });

  it('starts a new row when the next shelf’s first three books do not fit', () => {
    const shelves = [shelf('a', [1, 2, 3]), shelf('b', [4, 5, 6, 7])];
    const fits = runWidth([1, 2, 3]) + GROUP_GAP + runWidth([4, 5, 6]);

    const tight = layoutShelves(shelves, fits - 0.001);
    const firstOfB = tight.books.find((p) => p.shelfKey === 'b');
    expect(firstOfB?.row).toBe(1);
    expect(firstOfB?.x).toBeCloseTo(thickness(4) / 2);
    expect(tight.boards.filter(isDivider)).toHaveLength(0);

    const roomy = layoutShelves(shelves, fits + 0.001);
    expect(roomy.books.find((p) => p.shelfKey === 'b')?.row).toBe(0);
    expect(roomy.books.at(-1)?.row).toBe(1);
  });

  it('wraps a shelf longer than the row book by book', () => {
    const layout = layoutShelves([shelf('a', range(1, 20))], 2);
    expect(layout.rows).toBeGreaterThan(2);
    for (let row = 0; row < layout.rows; row += 1) {
      const books = booksInRow(layout, row);
      expect(books.length).toBeGreaterThan(0);
      const last = books.at(-1);
      expect((last?.x ?? 0) + (last?.t ?? 0) / 2).toBeLessThanOrEqual(2);
      expect(books[0]?.x).toBeCloseTo((books[0]?.t ?? 0) / 2);
    }
  });

  it('lays one floor board per row and echoes the width', () => {
    const layout = layoutShelves(
      [shelf('a', range(1, 12)), shelf('b', range(13, 20))],
      2.5,
    );
    const maxRow = Math.max(...layout.books.map((p) => p.row));
    expect(layout.rows).toBe(maxRow + 1);
    expect(layout.width).toBe(2.5);
    const floors = layout.boards.filter((b) => !isDivider(b));
    expect(floors).toHaveLength(layout.rows);
    expect(floors.map((b) => b.y)).toEqual(
      range(0, maxRow).map((r) => -r * ROW_H - 0.05),
    );
  });

  it('labels each shelf segment, marking continued and wrapped ones', () => {
    const layout = layoutShelves(
      [shelf('a', [1, 2, 3], true), shelf('b', range(4, 20))],
      3,
    );
    const segments = new Set(layout.books.map((p) => `${p.shelfKey}@${p.row}`));
    expect(layout.labels).toHaveLength(segments.size);

    const [a, b, ...wrapped] = layout.labels;
    expect(a).toMatchObject({
      shelfKey: 'a',
      text: 'Shelf a',
      count: 8,
      continued: true,
      row: 0,
      x: 0,
      top: ROW_H,
    });
    expect(b).toMatchObject({ shelfKey: 'b', continued: false, row: 0 });
    expect(b?.x).toBeCloseTo(runWidth([1, 2, 3]) + GROUP_GAP);
    expect(wrapped.length).toBeGreaterThan(0);
    for (const label of wrapped) {
      expect(label).toMatchObject({ shelfKey: 'b', continued: true, x: 0 });
      expect(label.top).toBeCloseTo((1 - label.row) * ROW_H);
    }
  });
});

describe('layoutShelves with heading widths', () => {
  const small = range(1, 12).map((i) => shelf(`s${i}`, [i]));
  const wide = () => 1.6;

  it('keeps the headings on one row apart, each inside its own slot', () => {
    const layout = layoutShelves(small, 4, wide);
    for (let row = 0; row < layout.rows; row += 1) {
      const labels = layout.labels.filter((label) => label.row === row);
      labels.forEach((label, i) => {
        const next = labels[i + 1];
        expect(label.width).toBeGreaterThan(0);
        expect(label.x + label.width).toBeLessThanOrEqual(
          next ? next.x - LABEL_GAP + 1e-9 : 4 + 1e-9,
        );
        if (next) expect(next.x - label.x).toBeGreaterThanOrEqual(1.6);
      });
    }
  });

  it('starts a group after the previous heading and puts the divider before it', () => {
    const layout = layoutShelves(small.slice(0, 2), 4, wide);
    const [a, b] = layout.labels;
    expect(b?.row).toBe(0);
    expect(b?.x).toBeCloseTo((a?.x ?? 0) + 1.6 + LABEL_GAP);
    const divider = layout.boards.find(isDivider);
    expect(divider?.x).toBeCloseTo((b?.x ?? 0) - GROUP_GAP / 2);
  });

  it('gives a heading wider than the row a row of its own', () => {
    const layout = layoutShelves(small.slice(0, 3), 4, () => 9);
    expect(layout.labels.map((label) => label.row)).toEqual([0, 1, 2]);
    for (const label of layout.labels) {
      expect(label.width).toBeCloseTo(4);
    }
  });

  it('reserves the continued heading of a wrapped group too', () => {
    const layout = layoutShelves(
      [shelf('a', range(1, 14)), shelf('b', [20])],
      3,
      wide,
    );
    const b = layout.labels.find((label) => label.shelfKey === 'b');
    const before = layout.labels.find(
      (label) => label.row === b?.row && label.shelfKey === 'a',
    );
    if (b && before) {
      expect(b.x).toBeGreaterThanOrEqual(before.x + 1.6 + LABEL_GAP - 1e-9);
    }
  });
});

describe('studyNavItems', () => {
  const layout = layoutShelves(
    [shelf('a', range(1, 6)), shelf('b', range(7, 16))],
    2,
  );
  const items = studyNavItems(layout);
  const keyOf = (order: number) => layout.books[order]?.book.navKey ?? null;

  it('feeds pickTarget from the layout, without rects', () => {
    expect(items).toHaveLength(layout.books.length);
    layout.books.forEach((placed, i) => {
      expect(items[i]).toEqual({
        key: placed.book.navKey,
        row: placed.row,
        order: placed.order,
        col: placed.x,
      });
    });
  });

  it('moves ArrowDown to the nearest x on the next row', () => {
    const from = booksInRow(layout, 0).at(-1);
    const next = booksInRow(layout, 1);
    const nearest = next.reduce((best, p) =>
      Math.abs(p.x - (from?.x ?? 0)) < Math.abs(best.x - (from?.x ?? 0))
        ? p
        : best,
    );
    expect(pickTarget(items, from?.book.navKey ?? null, 'ArrowDown')).toBe(
      nearest.book.navKey,
    );
  });

  it('sends Home and End to the ends of the physical row', () => {
    const row = booksInRow(layout, 1);
    const middle = row[Math.floor(row.length / 2)]?.book.navKey ?? null;
    expect(pickTarget(items, middle, 'Home')).toBe(row[0]?.book.navKey);
    expect(pickTarget(items, middle, 'End')).toBe(row.at(-1)?.book.navKey);
  });

  it('stops at the page edges', () => {
    const last = layout.books.length - 1;
    expect(pickTarget(items, keyOf(0), 'ArrowLeft')).toBeNull();
    expect(pickTarget(items, keyOf(0), 'ArrowUp')).toBeNull();
    expect(pickTarget(items, keyOf(last), 'ArrowRight')).toBeNull();
    expect(pickTarget(items, keyOf(last), 'ArrowDown')).toBeNull();
  });
});
