import { describe, expect, it } from 'vitest';

import type { FilterOptions } from '@/types';

import {
  CASE_DEPTH,
  CASE_WIDTH,
  layoutHall,
  slotOf,
  SLOTS_PER_CASE,
} from './layout';
import { bookcasePatch, buildHall, type HallBook } from './model';
import { buildGrid, canStand, clearLine, findPath, nearestOpen } from './path';
import { flightPose, flightProgress, placeBooks, RESORT_MS } from './resort';

const FILTERS: FilterOptions = {
  authors: [
    { id: 1, name: 'Le Guin', sort: null },
    { id: 2, name: 'Calvino', sort: null },
  ],
  tags: [{ id: 7, name: 'Fiction' }],
  series: [
    { id: 10, name: 'Earthsea' },
    { id: 11, name: 'Hainish' },
  ],
};

const book = (
  id: number,
  series: number | null,
  author: number | null,
  tag: number | null = null,
): HallBook => ({ id, title: `Book ${id}`, series, author, tag });

const BOOKS = [
  book(1, 10, 1, 7),
  book(2, 10, 1, 7),
  book(3, 10, 1),
  book(4, 11, 1),
  book(5, null, 2, 7),
];

describe('buildHall', () => {
  it('puts each group on its own bookcase, biggest first', () => {
    const cases = buildHall(BOOKS, FILTERS, 'series');
    expect(cases.map((c) => [c.label, c.bookIds])).toEqual([
      ['Earthsea', [1, 2, 3]],
      ['Hainish', [4]],
      ['No series', [5]],
    ]);
  });

  it('regroups the same books by author or tag', () => {
    expect(buildHall(BOOKS, FILTERS, 'author').map((c) => c.label)).toEqual([
      'Le Guin',
      'Calvino',
    ]);
    expect(buildHall(BOOKS, FILTERS, 'tag').map((c) => c.label)).toEqual([
      'Fiction',
      'No tag',
    ]);
  });

  it('merges the smallest groups into one case past the limit', () => {
    const cases = buildHall(BOOKS, FILTERS, 'series', 2);
    expect(cases.map((c) => [c.key, c.bookIds])).toEqual([
      ['series-10', [1, 2, 3]],
      ['other', [4, 5]],
    ]);
  });

  it('keeps every book exactly once', () => {
    const cases = buildHall(BOOKS, FILTERS, 'series', 2);
    expect(cases.flatMap((c) => c.bookIds).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('bookcasePatch', () => {
  it('filters the Study to one group', () => {
    const [earthsea] = buildHall(BOOKS, FILTERS, 'series');
    expect(earthsea && bookcasePatch(earthsea, 'series')).toEqual({
      groupBy: 'series',
      series: 10,
    });
    const [fiction] = buildHall(BOOKS, FILTERS, 'tag');
    expect(fiction && bookcasePatch(fiction, 'tag')).toEqual({
      groupBy: 'series',
      tag: 7,
    });
  });

  it('opens a no-group case unfiltered', () => {
    const none = buildHall(BOOKS, FILTERS, 'series').at(-1);
    expect(none && bookcasePatch(none, 'series')).toEqual({
      groupBy: 'series',
    });
  });
});

describe('layoutHall', () => {
  it('keeps bookcases apart and inside the room', () => {
    const { cases, room } = layoutHall(10);
    for (const [i, a] of cases.entries()) {
      expect(a.x - CASE_WIDTH / 2).toBeGreaterThan(room.minX);
      expect(a.x + CASE_WIDTH / 2).toBeLessThan(room.maxX);
      expect(a.z - CASE_DEPTH / 2).toBeGreaterThan(room.minZ);
      for (const b of cases.slice(i + 1)) {
        const apart =
          Math.abs(a.x - b.x) >= CASE_WIDTH ||
          Math.abs(a.z - b.z) >= CASE_DEPTH;
        expect(apart).toBe(true);
      }
    }
  });

  it('fills shelves top down and stops drawing past capacity', () => {
    const [placement] = layoutHall(1).cases;
    if (!placement) throw new Error('no case');
    const first = slotOf(placement, 0, 1);
    const second = slotOf(placement, 1, 1);
    expect(second.x).toBeGreaterThan(first.x);
    expect(second.y).toBe(first.y);
    expect(slotOf(placement, SLOTS_PER_CASE - 1, 1).y).toBeLessThan(first.y);
    expect(slotOf(placement, SLOTS_PER_CASE, 1).visible).toBe(false);
  });
});

describe('walking', () => {
  const layout = layoutHall(8);
  const grid = buildGrid(layout);

  it('can stand at the entrance and in front of every case, not inside one', () => {
    expect(canStand(grid, layout.spawn)).toBe(true);
    for (const placement of layout.cases) {
      expect(canStand(grid, placement.front)).toBe(true);
      expect(canStand(grid, placement)).toBe(false);
    }
  });

  it('walks straight when nothing is in the way', () => {
    const to = { x: layout.spawn.x + 1, z: layout.spawn.z };
    expect(findPath(grid, layout.spawn, to)).toEqual([to]);
  });

  it('goes around the front row to reach the back row', () => {
    const back = layout.cases[4];
    if (!back) throw new Error('no back row');
    const path = findPath(grid, layout.spawn, back.front);
    expect(path).not.toBeNull();
    expect(path?.at(-1)).toEqual(back.front);
    let from = layout.spawn;
    for (const waypoint of path ?? []) {
      expect(clearLine(grid, from, waypoint)).toBe(true);
      from = waypoint;
    }
  });

  it('refuses a target inside a bookcase and finds the nearest open spot', () => {
    const [placement] = layout.cases;
    if (!placement) throw new Error('no case');
    expect(findPath(grid, layout.spawn, placement)).toBeNull();
    const near = nearestOpen(grid, placement);
    expect(near && canStand(grid, near)).toBe(true);
  });
});

describe('re-sort', () => {
  it('moves each book from its old slot to its new one', () => {
    const layout = layoutHall(3);
    const before = placeBooks(buildHall(BOOKS, FILTERS, 'series'), layout);
    const after = placeBooks(buildHall(BOOKS, FILTERS, 'author'), layout);
    const from = before.get(4);
    const to = after.get(4);
    if (!from || !to) throw new Error('book 4 not placed');
    const start = flightPose(from, to, 0);
    const end = flightPose(from, to, 1);
    expect([start.x, start.y, start.z]).toEqual([from.x, from.y, from.z]);
    expect(end.x).toBeCloseTo(to.x);
    expect(end.y).toBeCloseTo(to.y);
    expect(end.z).toBeCloseTo(to.z);
    expect(flightPose(from, to, 0.5).y).toBeGreaterThan(Math.max(from.y, to.y));
  });

  it('starts books at different times and lands them all by the end', () => {
    expect(flightProgress(0, 0)).toBe(0);
    expect(flightProgress(RESORT_MS * 0.2, 0)).toBeGreaterThan(0);
    expect(flightProgress(RESORT_MS * 0.2, 0.9)).toBe(0);
    expect(flightProgress(RESORT_MS, 0.999)).toBe(1);
  });
});
