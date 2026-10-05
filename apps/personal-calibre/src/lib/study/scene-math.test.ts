import { describe, expect, it } from 'vitest';

import { layoutShelves, ROW_H, type StudyLayout } from './layout';
import { isCjk, spineDims, spineTone, type StudyShelf } from './model';
import {
  CAMERA_MARGIN,
  cameraBounds,
  clampCameraY,
  focusTargetY,
  screenRectOf,
  wheelPan,
} from './scene-math';

const shelf = (key: string, ids: number[]): StudyShelf => ({
  key,
  label: `Shelf ${key}`,
  count: ids.length,
  continued: false,
  books: ids.map((id) => ({
    id,
    navKey: `${key}:${id}`,
    title: 'The Salt Archive',
    authors: ['Mara Quill'],
    series: null,
    seriesIndex: null,
    hasCover: false,
    tone: spineTone(id),
    cjk: isCjk('The Salt Archive'),
    dims: spineDims(id),
  })),
});

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

const oneRow: StudyLayout = layoutShelves([shelf('a', range(1, 5))], 10);
const fourRows: StudyLayout = layoutShelves(
  [shelf('a', range(1, 12)), shelf('b', range(13, 24))],
  1.6,
);
const bottomBoard = (layout: StudyLayout) =>
  Math.min(...layout.boards.map((b) => b.y - b.sy / 2));

describe('cameraBounds', () => {
  it('pins both ends to the centre when the case is shorter than the view', () => {
    const bounds = cameraBounds(oneRow, 8);
    const top = ROW_H + CAMERA_MARGIN;
    const bottom = bottomBoard(oneRow) - CAMERA_MARGIN;
    expect(bounds.minY).toBe(bounds.maxY);
    expect(bounds.minY).toBeCloseTo((top + bottom) / 2);
  });

  it('keeps the frustum edges on the case plus the margin for a tall case', () => {
    expect(fourRows.rows).toBeGreaterThanOrEqual(4);
    const view = 4;
    const bounds = cameraBounds(fourRows, view);
    expect(bounds.maxY + view / 2).toBeCloseTo(ROW_H + CAMERA_MARGIN);
    expect(bounds.minY - view / 2).toBeCloseTo(
      bottomBoard(fourRows) - CAMERA_MARGIN,
    );
    expect(bounds.minY).toBeLessThan(bounds.maxY);
  });

  it('honours a custom margin', () => {
    const bounds = cameraBounds(fourRows, 4, 0);
    expect(bounds.maxY + 2).toBeCloseTo(ROW_H);
  });
});

describe('clampCameraY', () => {
  const bounds = { minY: -3, maxY: 1 };

  it('clamps both ends and passes values inside through', () => {
    expect(clampCameraY(5, bounds)).toBe(1);
    expect(clampCameraY(-9, bounds)).toBe(-3);
    expect(clampCameraY(-1, bounds)).toBe(-1);
  });
});

describe('wheelPan', () => {
  const bounds = { minY: -3, maxY: 1 };

  it('consumes a scroll inside the range, moving down for a positive delta', () => {
    expect(wheelPan(0, 100, 100, bounds)).toEqual({ y: -1, consumed: true });
    expect(wheelPan(0, -50, 100, bounds)).toEqual({ y: 0.5, consumed: true });
  });

  it('stops at the clamp and consumes the part that moved', () => {
    expect(wheelPan(-2.5, 400, 100, bounds)).toEqual({
      y: -3,
      consumed: true,
    });
  });

  it('does not consume a scroll past either clamp', () => {
    expect(wheelPan(-3, 100, 100, bounds)).toEqual({ y: -3, consumed: false });
    expect(wheelPan(1, -100, 100, bounds)).toEqual({ y: 1, consumed: false });
  });

  it('never consumes when the case fits the view', () => {
    const pinned = cameraBounds(oneRow, 8);
    expect(wheelPan(pinned.minY, 400, 100, pinned).consumed).toBe(false);
    expect(wheelPan(pinned.minY, -400, 100, pinned).consumed).toBe(false);
  });
});

describe('focusTargetY', () => {
  it('puts the first row inside the bounds of a tall case', () => {
    const bounds = cameraBounds(fourRows, 3);
    expect(focusTargetY(fourRows, 0)).toBeGreaterThanOrEqual(bounds.minY);
    expect(focusTargetY(fourRows, 0)).toBeLessThanOrEqual(bounds.maxY);
  });

  it('moves down one ROW_H per row and stays within the layout rows', () => {
    expect(focusTargetY(fourRows, 1) - focusTargetY(fourRows, 2)).toBeCloseTo(
      ROW_H,
    );
    expect(focusTargetY(fourRows, 99)).toBe(
      focusTargetY(fourRows, fourRows.rows - 1),
    );
  });
});

describe('screenRectOf', () => {
  const viewport = { left: 10, top: 20, width: 200, height: 100 };

  it('maps NDC corners to a client rect', () => {
    expect(
      screenRectOf(
        [
          [-1, 1],
          [0, 0],
          [1, -1],
        ],
        viewport,
      ),
    ).toEqual({ left: 10, top: 20, width: 200, height: 100 });
    expect(screenRectOf([[0, 0]], viewport)).toEqual({
      left: 110,
      top: 70,
      width: 0,
      height: 0,
    });
  });

  it('returns null without points', () => {
    expect(screenRectOf([], viewport)).toBeNull();
  });
});
