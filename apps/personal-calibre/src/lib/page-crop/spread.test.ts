import { describe, expect, it } from 'vitest';

import type { Raster } from './geometry';
import {
  cleanMargins,
  findStackedGutter,
  isSkinOrDesk,
  rotateCounterClockwise,
  splitStacked,
} from './spread';

function raster(
  width: number,
  height: number,
  paint: (x: number, y: number) => [number, number, number],
): Raster {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      [data[i], data[i + 1], data[i + 2]] = paint(x, y);
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

const gray = (v: number): [number, number, number] => [v, v, v];
const SKIN: [number, number, number] = [220, 160, 130];

describe('findStackedGutter', () => {
  it('finds the shadow of a fold across the middle of a sideways spread', () => {
    const page = raster(120, 200, (_x, y) =>
      gray(Math.abs(y - 104) < 4 ? 200 : 250),
    );
    expect(findStackedGutter(page)).toBeCloseTo(0.52, 1);
  });

  it('ignores writing, which darkens only part of a row', () => {
    const page = raster(120, 200, (x, y) =>
      gray(y > 90 && y < 110 && x < 40 ? 30 : 250),
    );
    expect(findStackedGutter(page)).toBeNull();
  });

  it('finds no gutter on a plain page or outside the middle band', () => {
    expect(findStackedGutter(raster(120, 200, () => gray(250)))).toBeNull();
    const edgeShadow = raster(120, 200, (_x, y) => gray(y < 30 ? 180 : 250));
    expect(findStackedGutter(edgeShadow)).toBeNull();
  });
});

describe('splitStacked', () => {
  it('cuts an outline across its height, upper part first', () => {
    const [top, bottom] = splitStacked(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 200 },
        { x: 0, y: 200 },
      ],
      0.5,
    );
    expect(top).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]);
    expect(bottom[0]).toEqual({ x: 0, y: 100 });
    expect(bottom[2]).toEqual({ x: 100, y: 200 });
  });
});

describe('rotateCounterClockwise', () => {
  it('turns the right edge into the top', () => {
    const source = raster(3, 2, (x, y) =>
      x === 2 && y === 0 ? [255, 0, 0] : gray(0),
    );
    const turned = rotateCounterClockwise(source);
    expect([turned.width, turned.height]).toEqual([2, 3]);
    expect(Array.from(turned.data.subarray(0, 3))).toEqual([255, 0, 0]);
  });
});

describe('cleanMargins', () => {
  it('paints a fingertip in the margin with the paper colour', () => {
    const page = raster(100, 140, (x, y) =>
      x < 8 && y > 60 && y < 80 ? SKIN : gray(245),
    );
    expect(cleanMargins(page)).toBeGreaterThan(0);
    const i = (70 * 100 + 3) * 4;
    expect(Array.from(page.data.subarray(i, i + 3))).toEqual([245, 245, 245]);
  });

  it('leaves the middle of the page alone', () => {
    const page = raster(100, 140, (x, y) =>
      x > 40 && x < 60 && y > 60 && y < 80 ? SKIN : gray(245),
    );
    expect(cleanMargins(page)).toBe(0);
    const i = (70 * 100 + 50) * 4;
    expect(Array.from(page.data.subarray(i, i + 3))).toEqual(SKIN);
  });

  it('treats graphite and paper as neither skin nor desk', () => {
    expect(isSkinOrDesk(...SKIN)).toBe(true);
    expect(isSkinOrDesk(60, 60, 64)).toBe(false);
    expect(isSkinOrDesk(250, 248, 245)).toBe(false);
  });
});
