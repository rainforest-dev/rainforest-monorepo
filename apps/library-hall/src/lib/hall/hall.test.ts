import { type HallItem } from '@rainforest-dev/library-contract';
import { describe, expect, it } from 'vitest';

import { toHallBooks } from '@/lib/items';

import {
  CASE_DEPTH,
  CASE_WIDTH,
  layoutHall,
  slotOf,
  SLOTS_PER_CASE,
} from './layout';
import { buildHall } from './model';
import { buildGrid, canStand, clearLine, findPath, nearestOpen } from './path';
import { flightPose, flightProgress, placeBooks, RESORT_MS } from './resort';

const item = (
  kind: HallItem['kind'],
  id: string,
  groups: string[],
): HallItem => ({
  kind,
  id,
  title: `Item ${id}`,
  color: '#3e7d7d',
  groups,
  href: `/x/${id}`,
});

const BOOKS = toHallBooks([
  item('book', '1', ['tag:Fiction', 'series:Earthsea', 'author:Le Guin']),
  item('book', '2', ['tag:Fiction', 'series:Earthsea', 'author:Le Guin']),
  item('book', '3', ['series:Earthsea', 'author:Le Guin']),
  item('book', '4', ['series:Hainish', 'author:Le Guin']),
  item('notebook', '5', ['tag:Fiction', 'month:2026-08']),
]);
const idOf = (n: number) => BOOKS[n - 1]?.id;

describe('toHallBooks', () => {
  it('reads each grouping from the item groups', () => {
    expect(BOOKS[0]?.groups).toEqual({
      tag: 'Fiction',
      series: 'Earthsea',
      author: 'Le Guin',
      month: null,
    });
  });

  it('gives every key one stable, distinct id and drops repeats', () => {
    const again = toHallBooks([
      item('book', '1', []),
      item('book', '1', []),
      item('notebook', '1', []),
    ]);
    expect(again).toHaveLength(2);
    expect(again[0]?.id).toBe(BOOKS[0]?.id);
    expect(again[0]?.id).not.toBe(again[1]?.id);
  });
});

describe('buildHall', () => {
  it('puts each group on its own bookcase, biggest first, ungrouped last', () => {
    const cases = buildHall(BOOKS, 'series', 'zh');
    expect(cases.map((c) => [c.label, c.bookIds])).toEqual([
      ['Earthsea', [idOf(1), idOf(2), idOf(3)]],
      ['Hainish', [idOf(4)]],
      ['無系列', [idOf(5)]],
    ]);
  });

  it('regroups the same items by tag or by collection', () => {
    expect(buildHall(BOOKS, 'tag', 'zh').map((c) => c.label)).toEqual([
      'Fiction',
      '未分類',
    ]);
    expect(buildHall(BOOKS, 'collection', 'zh').map((c) => c.label)).toEqual([
      '書',
      '筆記本',
    ]);
  });

  it('names the bookcases in English for an en page', () => {
    expect(buildHall(BOOKS, 'series', 'en').at(-1)?.label).toBe('No series');
    expect(buildHall(BOOKS, 'collection', 'en').map((c) => c.label)).toEqual([
      'Books',
      'Notebooks',
    ]);
  });

  it('merges the smallest groups into one case past the limit', () => {
    const cases = buildHall(BOOKS, 'series', 'zh', 2);
    expect(cases.map((c) => [c.key, c.bookIds])).toEqual([
      ['series-Earthsea', [idOf(1), idOf(2), idOf(3)]],
      ['other', [idOf(4), idOf(5)]],
    ]);
  });

  it('keeps every item exactly once', () => {
    const cases = buildHall(BOOKS, 'series', 'zh', 2);
    expect(cases.flatMap((c) => c.bookIds).sort()).toEqual(
      BOOKS.map((b) => b.id).sort(),
    );
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
    const before = placeBooks(buildHall(BOOKS, 'series', 'zh'), layout);
    const after = placeBooks(buildHall(BOOKS, 'author', 'zh'), layout);
    const from = before.get(idOf(4) ?? 0);
    const to = after.get(idOf(4) ?? 0);
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
