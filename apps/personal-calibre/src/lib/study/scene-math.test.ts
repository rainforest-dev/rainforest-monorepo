import { describe, expect, it } from 'vitest';

import { layoutShelves, ROW_H, type StudyLayout } from './layout';
import { isCjk, spineDims, spineTone, type StudyShelf } from './model';
import {
  ATLAS_PPU_FLOOR,
  ATLAS_PPU_LADDER,
  atlasBytesAt,
  atlasOrder,
  CAMERA_MARGIN,
  cameraBounds,
  clampCameraY,
  COVER_BYTES,
  COVER_CACHE_MAX,
  COVER_CACHE_MIN,
  focusTargetY,
  pickAtlasPpu,
  projectBox,
  REPORTED_TARGET_BUFFERS,
  rowsInView,
  screenRectOf,
  targetBytes,
  TEXTURE_BUDGET_BYTES,
  type TextureBudgetInput,
  type Vec3,
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

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const VIEWPORT = { width: 800, height: 600 };

const box = ([x0, y0, z0]: Vec3, [x1, y1, z1]: Vec3): Vec3[] =>
  [x0, x1].flatMap((x) =>
    [y0, y1].flatMap((y) => [z0, z1].map((z): Vec3 => [x, y, z])),
  );

const perspective = (near: number, far: number): number[] => [
  1,
  0,
  0,
  0,
  0,
  1,
  0,
  0,
  0,
  0,
  -(far + near) / (far - near),
  -1,
  0,
  0,
  (-2 * far * near) / (far - near),
  0,
];

describe('projectBox', () => {
  it('maps the unit cube to the full viewport under an identity view-projection', () => {
    expect(
      projectBox(box([-1, -1, -1], [1, 1, 1]), IDENTITY, VIEWPORT),
    ).toEqual({ left: 0, top: 0, width: 800, height: 600 });
  });

  it('puts +y at the top of the screen', () => {
    expect(
      projectBox(box([-0.5, 0, 0], [0, 0.5, 0]), IDENTITY, VIEWPORT),
    ).toEqual({ left: 200, top: 150, width: 200, height: 150 });
  });

  it('returns null for a box behind the camera', () => {
    const behind = box([-0.5, -0.5, 1], [0.5, 0.5, 2]);
    expect(projectBox(behind, perspective(0.1, 100), VIEWPORT)).toBeNull();
  });

  it('divides by w in front of the camera', () => {
    const front = box([-1, -1, -2], [1, 1, -2]);
    expect(projectBox(front, perspective(0.1, 100), VIEWPORT)).toEqual({
      left: 200,
      top: 150,
      width: 400,
      height: 300,
    });
  });

  it('clips a box partly off-screen to the viewport', () => {
    expect(
      projectBox(box([0.5, -2, 0], [3, 0, 0]), IDENTITY, VIEWPORT),
    ).toEqual({ left: 600, top: 300, width: 200, height: 300 });
  });

  it('returns null for a box entirely off-screen', () => {
    expect(
      projectBox(box([2, 2, 0], [3, 3, 0]), IDENTITY, VIEWPORT),
    ).toBeNull();
  });

  it('returns null for no corners', () => {
    expect(projectBox([], IDENTITY, VIEWPORT)).toBeNull();
  });
});

describe('atlasOrder', () => {
  it('builds the visible rows first, then the rest nearest first', () => {
    expect(atlasOrder(6, [2, 3])).toEqual({
      sync: [2, 3],
      idle: [1, 4, 0, 5],
    });
  });

  it('breaks distance ties towards the lower row', () => {
    expect(atlasOrder(5, [2]).idle).toEqual([1, 3, 0, 4]);
  });

  it('builds row 0 synchronously when nothing is visible', () => {
    expect(atlasOrder(3, [])).toEqual({ sync: [0], idle: [1, 2] });
  });

  it('ignores rows outside the layout', () => {
    expect(atlasOrder(3, [-1, 1, 7])).toEqual({ sync: [1], idle: [0, 2] });
    expect(atlasOrder(3, [9])).toEqual({ sync: [0], idle: [1, 2] });
    expect(atlasOrder(0, [0])).toEqual({ sync: [], idle: [] });
  });
});

describe('rowsInView', () => {
  it('lists the rows a view centred on the first row can see', () => {
    expect(rowsInView(fourRows, focusTargetY(fourRows, 0), 3)).toEqual([0, 1]);
  });

  it('lists every row of a case shorter than the view', () => {
    expect(rowsInView(fourRows, -ROW_H, 40)).toEqual(
      Array.from({ length: fourRows.rows }, (_, row) => row),
    );
  });
});

const desktopPage = layoutShelves(
  [shelf('a', range(1, 20)), shelf('b', range(21, 30))],
  1144 / 100 - 0.8,
);
const phoneLarge = layoutShelves(
  Array.from({ length: 25 }, (_, i) =>
    shelf(`s${i}`, range(i * 10 + 1, i * 10 + 10)),
  ),
  366 / 80 - 0.8,
);
const desktopInput: TextureBudgetInput = {
  layout: desktopPage,
  budgetBytes: TEXTURE_BUDGET_BYTES.desktop,
  canvas: { width: 1144, height: 760, dpr: 2 },
  targetBuffers: REPORTED_TARGET_BUFFERS,
  coverBytes: COVER_BYTES,
};
const fixedBytes = (input: TextureBudgetInput, covers = COVER_CACHE_MAX) =>
  covers * input.coverBytes + targetBytes(input);

describe('atlasBytesAt', () => {
  it('grows about fourfold from 80 to 160 px per unit', () => {
    const ratio =
      atlasBytesAt(desktopPage, 160) / atlasBytesAt(desktopPage, 80);
    expect(ratio).toBeGreaterThan(3.9);
    expect(ratio).toBeLessThan(4.1);
  });

  it('grows with the row count', () => {
    expect(atlasBytesAt(fourRows, 160)).toBeGreaterThan(
      atlasBytesAt(layoutShelves([shelf('a', range(1, 3))], 1.6), 160),
    );
    expect(atlasBytesAt(fourRows, 160) / fourRows.rows).toBeCloseTo(
      (Math.ceil(1.6 * 160) * Math.ceil(ROW_H * 160) * 4 * 4) / 3,
    );
  });
});

describe('pickAtlasPpu', () => {
  it('keeps 160 for a 30-book page on a desktop canvas at @2', () => {
    expect(pickAtlasPpu(desktopInput)).toEqual({
      ppu: 160,
      covers: COVER_CACHE_MAX,
      estimatedBytes: fixedBytes(desktopInput) + atlasBytesAt(desktopPage, 160),
      fits: true,
    });
  });

  it('steps down for 250 books on the phone budget', () => {
    const pick = pickAtlasPpu({
      layout: phoneLarge,
      budgetBytes: TEXTURE_BUDGET_BYTES.phone,
      canvas: { width: 366, height: 591, dpr: 2 },
      targetBuffers: REPORTED_TARGET_BUFFERS,
      coverBytes: COVER_BYTES,
    });
    expect(phoneLarge.rows).toBeGreaterThan(20);
    expect(ATLAS_PPU_LADDER).toContain(pick.ppu);
    expect(pick.ppu).toBeLessThan(160);
  });

  it('walks down one rung when the budget drops by the difference between two rungs', () => {
    const exact = fixedBytes(desktopInput) + atlasBytesAt(desktopPage, 160);
    expect(pickAtlasPpu({ ...desktopInput, budgetBytes: exact }).ppu).toBe(160);
    const gap = atlasBytesAt(desktopPage, 160) - atlasBytesAt(desktopPage, 128);
    expect(
      pickAtlasPpu({ ...desktopInput, budgetBytes: exact - gap }),
    ).toMatchObject({ ppu: 128, fits: true });
    expect(
      pickAtlasPpu({ ...desktopInput, budgetBytes: exact - gap - 1 }).ppu,
    ).toBe(112);
  });

  it('keeps the full cover cache whenever a rung fits', () => {
    const exact = fixedBytes(desktopInput) + atlasBytesAt(desktopPage, 96);
    expect(pickAtlasPpu({ ...desktopInput, budgetBytes: exact })).toMatchObject(
      { ppu: 96, covers: COVER_CACHE_MAX, fits: true },
    );
  });

  it('shrinks the cover cache at the floor until the estimate fits', () => {
    const atFloor = atlasBytesAt(desktopPage, ATLAS_PPU_FLOOR);
    const full = fixedBytes(desktopInput) + atFloor;
    const pick = pickAtlasPpu({ ...desktopInput, budgetBytes: full - 1 });
    expect(pick).toEqual({
      ppu: ATLAS_PPU_FLOOR,
      covers: COVER_CACHE_MAX - 1,
      estimatedBytes: fixedBytes(desktopInput, COVER_CACHE_MAX - 1) + atFloor,
      fits: true,
    });
    expect(pick.estimatedBytes).toBeLessThanOrEqual(full - 1);

    const lowest = fixedBytes(desktopInput, COVER_CACHE_MIN) + atFloor;
    expect(
      pickAtlasPpu({ ...desktopInput, budgetBytes: lowest }),
    ).toMatchObject({
      ppu: ATLAS_PPU_FLOOR,
      covers: COVER_CACHE_MIN,
      fits: true,
    });
  });

  it('holds the 250-book desktop page under budget at 96 by dropping covers', () => {
    const large = layoutShelves(
      Array.from({ length: 25 }, (_, i) =>
        shelf(`s${i}`, range(i * 10 + 1, i * 10 + 10)),
      ),
      1144 / 100 - 0.8,
    );
    const pick = pickAtlasPpu({ ...desktopInput, layout: large });
    expect(pick.ppu).toBe(ATLAS_PPU_FLOOR);
    expect(pick.fits).toBe(true);
    expect(pick.covers).toBeLessThan(COVER_CACHE_MAX);
    expect(pick.covers).toBeGreaterThanOrEqual(COVER_CACHE_MIN);
    expect(pick.estimatedBytes).toBeLessThanOrEqual(
      TEXTURE_BUDGET_BYTES.desktop,
    );
  });

  it('returns the floor with the smallest cache and says it does not fit when even that misses', () => {
    const lowest =
      fixedBytes(desktopInput, COVER_CACHE_MIN) +
      atlasBytesAt(desktopPage, ATLAS_PPU_FLOOR);
    expect(pickAtlasPpu({ ...desktopInput, budgetBytes: lowest - 1 })).toEqual({
      ppu: ATLAS_PPU_FLOOR,
      covers: COVER_CACHE_MIN,
      estimatedBytes: lowest,
      fits: false,
    });
  });

  it('counts the canvas targets at dpr squared', () => {
    expect(
      targetBytes({
        canvas: { width: 10, height: 5, dpr: 2 },
        targetBuffers: 2,
      }),
    ).toBe(10 * 5 * 4 * 4 * 2);
  });
});
