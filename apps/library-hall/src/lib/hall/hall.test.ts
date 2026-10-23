import { type HallItem } from '@rainforest-dev/library-contract';
import { describe, expect, it } from 'vitest';

import { parseHallGroupBy, toHallBooks } from '@/lib/items';

import {
  CASE_DEPTH,
  CASE_WIDTH,
  frameFor,
  layoutHall,
  slotOf,
  SLOTS_PER_CASE,
} from './layout';
import { buildHall, buildWings, CASES_PER_WING } from './model';
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
  item('book', '1', ['topic:Fiction', 'creator:Le Guin', 'month:2026-07']),
  item('book', '2', ['topic:Fiction', 'creator:Le Guin', 'month:2026-08']),
  item('book', '3', ['creator:Le Guin', 'month:2026-08']),
  item('book', '4', ['topic:Sea', 'creator:Herbert']),
  item('notebook', '5', ['topic:Fiction', 'month:2026-08']),
]);
const idOf = (n: number) => BOOKS[n - 1]?.id;

describe('toHallBooks', () => {
  it('reads each dimension from the item groups', () => {
    expect(BOOKS[0]?.groups).toEqual({
      topic: 'Fiction',
      creator: 'Le Guin',
      month: '2026-07',
    });
  });

  it('reads the legacy tag and author keys', () => {
    const [old] = toHallBooks([item('book', '9', ['tag:Sea', 'author:Ada'])]);
    expect(old?.groups).toEqual({ topic: 'Sea', creator: 'Ada', month: null });
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

describe('parseHallGroupBy', () => {
  it('maps old links onto the shared dimensions and falls back to topic', () => {
    expect(parseHallGroupBy('month')).toBe('month');
    expect(parseHallGroupBy('tag')).toBe('topic');
    expect(parseHallGroupBy('author')).toBe('creator');
    expect(parseHallGroupBy('series')).toBe('topic');
    expect(parseHallGroupBy(null)).toBe('topic');
  });
});

describe('buildHall', () => {
  it('stands every collection in one wing by topic, so a topic shares a case', () => {
    const wings = buildWings(BOOKS, 'topic', 'zh');
    expect(wings.map((w) => [w.id, w.label, w.unsorted])).toEqual([
      ['topics', '主題', 1],
    ]);
    expect(wings[0]?.cases.map((c) => [c.key, c.label, c.bookIds])).toEqual([
      ['topics-topic-Fiction', 'Fiction', [idOf(1), idOf(2), idOf(5)]],
      ['topics-topic-Sea', 'Sea', [idOf(4)]],
      ['topics-none', '未分類', [idOf(3)]],
    ]);
  });

  it('gives each collection its own wing by creator, unsorted items on a case of their own', () => {
    const wings = buildWings(BOOKS, 'creator', 'zh');
    expect(
      wings.map((w) => [w.id, w.unsorted, w.cases.map((c) => c.label)]),
    ).toEqual([
      ['books', 0, ['Le Guin', 'Herbert']],
      // The notebook has no creator: it is counted, not folded into a case named after its wing.
      ['notebooks', 1, ['無作者或來源']],
    ]);
  });

  it('reads months as a timeline, newest first, in every wing', () => {
    expect(
      buildHall(BOOKS, 'month', 'zh').map((c) => [c.wing, c.label]),
    ).toEqual([
      ['books', '2026-08'],
      ['books', '2026-07'],
      ['books', '無日期'],
      ['notebooks', '2026-08'],
    ]);
  });

  it('keeps a small collection on the floor beside a big one', () => {
    const many = toHallBooks([
      ...Array.from({ length: 40 }, (_, i) =>
        item('article', `a${i}`, [`creator:site${i}`]),
      ),
      item('book', 'b1', ['creator:Le Guin']),
      item('notebook', 'n1', []),
    ]);
    const wings = buildWings(many, 'creator', 'zh');
    expect(wings.map((w) => [w.id, w.cases.length])).toEqual([
      ['books', 1],
      ['notebooks', 1],
      ['rack', CASES_PER_WING],
    ]);
  });

  it('gives the shared topic wing a row per collection', () => {
    const many = toHallBooks([
      ...Array.from({ length: 40 }, (_, i) =>
        item('article', `a${i}`, [`topic:t${i}`]),
      ),
      item('book', 'b1', ['topic:t0']),
    ]);
    const [wing] = buildWings(many, 'topic', 'zh');
    expect(wing?.cases).toHaveLength(CASES_PER_WING * 2);
    expect(wing?.cases.at(-1)?.kind).toBe('other');
  });

  it('names the bookcases in English for an en page', () => {
    expect(buildHall(BOOKS, 'topic', 'en').at(-1)?.label).toBe('No topic');
    expect(buildWings(BOOKS, 'topic', 'en')[0]?.label).toBe('Topics');
    expect(buildHall(BOOKS, 'collection', 'en').map((c) => c.label)).toEqual([
      'Books',
      'Notebooks',
    ]);
  });

  it('merges the smallest groups past the limit and keeps the unsorted case apart', () => {
    const topics = toHallBooks([
      item('book', '1', ['topic:A']),
      item('book', '2', ['topic:A']),
      item('book', '3', ['topic:B']),
      item('book', '4', ['topic:C']),
      item('book', '5', []),
    ]);
    const cases = buildHall(topics, 'creator', 'zh', 2);
    expect(cases.map((c) => c.key)).toEqual(['books-none']);
    const wing = buildWings(topics, 'topic', 'zh', 3)[0];
    expect(wing?.cases.map((c) => [c.key, c.bookIds.length])).toEqual([
      ['topics-topic-A', 2],
      ['topics-other', 2],
      ['topics-none', 1],
    ]);
  });

  it('keeps every item exactly once', () => {
    for (const groupBy of [
      'topic',
      'creator',
      'month',
      'collection',
    ] as const) {
      const cases = buildHall(BOOKS, groupBy, 'zh', 1);
      expect(cases.flatMap((c) => c.bookIds).sort()).toEqual(
        BOOKS.map((b) => b.id).sort(),
      );
    }
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

describe('layoutHall with wings', () => {
  it('starts each wing on a row of its own', () => {
    const { cases, wings } = layoutHall([2, 1, 4]);
    expect(wings.map((w) => [w.first, w.count])).toEqual([
      [0, 2],
      [2, 1],
      [3, 4],
    ]);
    const rows = [...new Set(cases.map((c) => c.z))];
    expect(rows).toHaveLength(3);
    expect(cases[2]?.z).toBeLessThan(cases[1]?.z ?? 0);
  });

  it('keeps the room the size of its frame whatever stands in it', () => {
    const frame = frameFor([
      [4, 4, 4, 4],
      [1, 1],
    ]);
    const big = layoutHall([4, 4, 4, 4], frame);
    const small = layoutHall([1, 1], frame);
    expect(small.room).toEqual(big.room);
  });

  it('keeps the furniture off the walkways', () => {
    const layout = layoutHall([4, 4, 4, 4]);
    const grid = buildGrid(layout);
    for (const f of layout.furniture)
      expect(canStand(grid, { x: f.x, z: f.z })).toBe(false);
    expect(canStand(grid, layout.spawn)).toBe(true);
    for (const placement of layout.cases)
      expect(findPath(grid, layout.spawn, placement.front)).not.toBeNull();
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
    const before = placeBooks(buildHall(BOOKS, 'topic', 'zh'), layout);
    const after = placeBooks(buildHall(BOOKS, 'creator', 'zh'), layout);
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
