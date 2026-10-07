import { describe, expect, it } from 'vitest';

import { layoutShelves, ROW_H, type StudyLayout } from './layout';
import { isCjk, spineDims, spineTone, type StudyShelf } from './model';
import {
  approach,
  ATLAS_PPU_FLOOR,
  ATLAS_PPU_LADDER,
  atlasBytesAt,
  atlasOrder,
  CAMERA_MARGIN,
  cameraBounds,
  clampCameraY,
  clampPitch,
  COVER_BYTES,
  COVER_CACHE_MAX,
  COVER_CACHE_MIN,
  faceAt,
  FLOAT_GAP_PX,
  FLOAT_MARGIN_PX,
  floatCentre,
  floatHeightPx,
  focusTargetY,
  INSPECT_PITCH_MAX,
  inspectHeightPx,
  nextCarry,
  pickAtlasPpu,
  projectBox,
  pxPerUnitAt,
  rowsInView,
  screenRectOf,
  snapRect,
  targetBytes,
  TEXTURE_BUDGET_BYTES,
  type TextureBudgetInput,
  type Vec3,
  wheelPan,
  wrapYaw,
  yawDegrees,
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

describe('snapRect', () => {
  it('snaps every edge to the device pixel grid', () => {
    expect(
      snapRect(
        { left: 179.292, top: 157.789, width: 68.4732, height: 182.504 },
        2,
      ),
    ).toEqual({ left: 179.5, top: 158, width: 68.5, height: 182.5 });
  });

  it('snaps edges rather than the size, so the right edge does not drift', () => {
    expect(snapRect({ left: 10.4, top: 0, width: 10.4, height: 1 }, 1)).toEqual(
      { left: 10, top: 0, width: 11, height: 1 },
    );
  });

  it('leaves a rect already on the grid unchanged', () => {
    const rect = { left: 12.5, top: 3, width: 40.5, height: 7 };
    expect(snapRect(rect, 2)).toEqual(rect);
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
  targetBuffers: 2,
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
  it('counts reserved bytes before atlases and covers', () => {
    const base = pickAtlasPpu(desktopInput);
    const reserved = pickAtlasPpu({ ...desktopInput, reservedBytes: 1024 });
    expect(reserved.estimatedBytes).toBe(base.estimatedBytes + 1024);
  });

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
      targetBuffers: 2,
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

  it('picks at least as high a rung when the renderer reports no target buffers', () => {
    for (const input of [
      desktopInput,
      {
        ...desktopInput,
        layout: phoneLarge,
        budgetBytes: TEXTURE_BUDGET_BYTES.phone,
        canvas: { width: 366, height: 591, dpr: 2 },
      },
    ]) {
      const withTargets = pickAtlasPpu({ ...input, targetBuffers: 2 });
      const without = pickAtlasPpu({ ...input, targetBuffers: 0 });
      expect(without.ppu).toBeGreaterThanOrEqual(withTargets.ppu);
      expect(without.covers).toBeGreaterThanOrEqual(withTargets.covers);
    }
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

describe('floatHeightPx', () => {
  it('scales with the viewport between a floor and a ceiling', () => {
    expect(floatHeightPx({ width: 390, height: 590 })).toBeCloseTo(590 * 0.34);
    expect(floatHeightPx({ width: 390, height: 300 })).toBe(150);
    expect(floatHeightPx({ width: 1440, height: 900 })).toBe(240);
  });

  it('never exceeds the viewport minus its margins', () => {
    expect(floatHeightPx({ width: 390, height: 120 })).toBe(
      120 - 2 * FLOAT_MARGIN_PX,
    );
  });
});

describe('floatCentre', () => {
  const viewport = { width: 390, height: 590 };
  const size = { width: 130, height: 200 };

  it('floats above the finger with a gap so the finger leaves the cover clear', () => {
    const finger = { x: 200, y: 400 };
    const centre = floatCentre(finger, size, viewport);
    expect(centre.x).toBe(200);
    expect(centre.y + size.height / 2).toBe(finger.y - FLOAT_GAP_PX);
  });

  it('drops below the finger when there is no room above', () => {
    const finger = { x: 200, y: 120 };
    const centre = floatCentre(finger, size, viewport);
    expect(centre.y - size.height / 2).toBe(finger.y + FLOAT_GAP_PX);
  });

  it('clamps inside the viewport horizontally', () => {
    expect(floatCentre({ x: 4, y: 400 }, size, viewport).x).toBe(
      FLOAT_MARGIN_PX + size.width / 2,
    );
    expect(floatCentre({ x: 389, y: 400 }, size, viewport).x).toBe(
      viewport.width - FLOAT_MARGIN_PX - size.width / 2,
    );
  });

  it('stays inside vertically when neither side fits', () => {
    const tall = { width: 130, height: 400 };
    const centre = floatCentre({ x: 200, y: 300 }, tall, viewport);
    expect(centre.y - tall.height / 2).toBeGreaterThanOrEqual(FLOAT_MARGIN_PX);
    expect(centre.y + tall.height / 2).toBeLessThanOrEqual(
      viewport.height - FLOAT_MARGIN_PX,
    );
  });

  it('centres an item larger than the viewport', () => {
    const huge = { width: 500, height: 700 };
    expect(floatCentre({ x: 10, y: 10 }, huge, viewport)).toEqual({
      x: viewport.width / 2,
      y: viewport.height / 2,
    });
  });
});

describe('pxPerUnitAt', () => {
  it('is the base scale on the z = 0 plane and grows toward the camera', () => {
    expect(pxPerUnitAt(80, 14, 0)).toBe(80);
    expect(pxPerUnitAt(80, 14, 7)).toBe(160);
  });

  it('is unbounded at or behind the camera', () => {
    expect(pxPerUnitAt(80, 14, 14)).toBe(Infinity);
  });
});

describe('approach', () => {
  it('eases toward 1 with time and jumps when instant', () => {
    expect(approach(10, 0)).toBe(0);
    expect(approach(10, 0.1)).toBeCloseTo(1 - Math.exp(-1));
    expect(approach(10, 0.016, true)).toBe(1);
    expect(approach(10, -1)).toBe(0);
  });
});

describe('nextCarry', () => {
  const same = (a: string, b: string) => a === b;
  const empty = { items: [null, null], active: 0 } as const;

  it('pulls into the active slot', () => {
    expect(nextCarry(empty, 'a', same, true)).toEqual({
      items: ['a', null],
      active: 0,
    });
  });

  it('swaps slots and keeps the previous item leaving while scrubbing', () => {
    const a = nextCarry(empty, 'a', same, true);
    const b = nextCarry(a, 'b', same, true);
    expect(b).toEqual({ items: ['a', 'b'], active: 1 });
    const c = nextCarry(b, 'c', same, true);
    expect(c).toEqual({ items: ['c', 'b'], active: 0 });
  });

  it('turns back to a leaving item in its own slot', () => {
    const b = { items: ['a', 'b'], active: 1 } as const;
    expect(nextCarry(b, 'a', same, true)).toEqual({
      items: ['a', 'b'],
      active: 0,
    });
  });

  it('drops the leaving item when not scrubbing', () => {
    const b = { items: ['a', 'b'], active: 1 } as const;
    expect(nextCarry(b, 'c', same, false)).toEqual({
      items: [null, 'c'],
      active: 1,
    });
    expect(nextCarry(b, 'b', same, false)).toEqual({
      items: [null, 'b'],
      active: 1,
    });
  });

  it('empties the active slot when nothing is pulled', () => {
    const b = { items: ['a', 'b'], active: 1 } as const;
    expect(nextCarry(b, null, same, false)).toEqual({
      items: [null, null],
      active: 1,
    });
  });
});

describe('inspectHeightPx', () => {
  it('takes 62% of the stage height when the width allows', () => {
    expect(inspectHeightPx({ width: 390, height: 590 }, 0.66)).toBeCloseTo(
      590 * 0.62,
    );
  });

  it('shrinks so a wide cover keeps 72% of the stage width', () => {
    expect(inspectHeightPx({ width: 300, height: 900 }, 1)).toBeCloseTo(
      300 * 0.72,
    );
  });

  it('never goes negative', () => {
    expect(inspectHeightPx({ width: 0, height: 0 }, 0.7)).toBe(0);
  });
});

describe('inspect rotation', () => {
  it('clamps pitch so the book never turns upside down', () => {
    expect(clampPitch(2)).toBe(INSPECT_PITCH_MAX);
    expect(clampPitch(-2)).toBe(-INSPECT_PITCH_MAX);
    expect(clampPitch(0.2)).toBe(0.2);
    expect(INSPECT_PITCH_MAX).toBeLessThan(Math.PI / 2);
  });

  it('wraps yaw into one turn', () => {
    expect(wrapYaw(-Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2);
    expect(wrapYaw(5 * Math.PI)).toBeCloseTo(Math.PI);
    expect(yawDegrees(-Math.PI / 180)).toBe(359);
    expect(yawDegrees(2 * Math.PI - 1e-9)).toBe(0);
  });

  it('names the face toward the viewer', () => {
    expect(faceAt(0)).toBe('front');
    expect(faceAt(Math.PI / 2)).toBe('spine');
    expect(faceAt(Math.PI)).toBe('back');
    expect(faceAt(-Math.PI / 2)).toBe('edge');
    expect(faceAt(-0.3)).toBe('front');
  });
});
