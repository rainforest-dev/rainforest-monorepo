import { describe, expect, it } from 'vitest';

import { detectPageQuad, otsuThreshold, toGray } from './detect';
import {
  defaultSeam,
  fullQuad,
  isConvexQuad,
  type Point,
  type Quad,
  quadArea,
  quadOutputSize,
  type Raster,
  splitSpread,
} from './geometry';
import { applyHomography, homography } from './homography';
import { warpQuad } from './warp';

function must<T>(value: T | null): T {
  if (value === null) throw new Error('expected a value');
  return value;
}

/** A synthetic photo: `paint(x, y)` gives each pixel's gray level. */
function raster(
  width: number,
  height: number,
  paint: (x: number, y: number) => number,
): Raster {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const v = paint(x + 0.5, y + 0.5);
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

/** True when `p` is inside the convex quad (clockwise in screen space). */
function inside(quad: Quad, p: Point): boolean {
  for (let i = 0; i < 4; i++) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    if ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) < 0) return false;
  }
  return true;
}

function rotatedRect(
  cx: number,
  cy: number,
  w: number,
  h: number,
  degrees: number,
): Quad {
  const t = (degrees * Math.PI) / 180;
  const corner = (dx: number, dy: number): Point => ({
    x: cx + dx * Math.cos(t) - dy * Math.sin(t),
    y: cy + dx * Math.sin(t) + dy * Math.cos(t),
  });
  return [
    corner(-w / 2, -h / 2),
    corner(w / 2, -h / 2),
    corner(w / 2, h / 2),
    corner(-w / 2, h / 2),
  ];
}

const expectNear = (actual: Quad, expected: Quad, tolerance: number) => {
  actual.forEach((p, i) => {
    expect(Math.abs(p.x - expected[i].x), `corner ${i} x`).toBeLessThanOrEqual(
      tolerance,
    );
    expect(Math.abs(p.y - expected[i].y), `corner ${i} y`).toBeLessThanOrEqual(
      tolerance,
    );
  });
};

describe('otsuThreshold', () => {
  it('splits a two-level image between its levels', () => {
    const gray = new Uint8Array(1000);
    gray.fill(40, 0, 600);
    gray.fill(210, 600);
    const t = otsuThreshold(gray);
    expect(t).toBeGreaterThanOrEqual(40);
    expect(t).toBeLessThan(210);
  });
});

describe('toGray', () => {
  it('box-averages down to the long edge it is given', () => {
    const image = raster(1000, 600, (x) => (x < 500 ? 0 : 200));
    const gray = toGray(image, 512);
    expect(gray).toMatchObject({ width: 500, height: 300, scale: 2 });
    expect(gray.data[0]).toBe(0);
    expect(gray.data[499]).toBe(200);
  });
});

describe('detectPageQuad', () => {
  it('finds an upright page exactly', () => {
    const page = (x: number, y: number) =>
      x > 100 && x < 400 && y > 50 && y < 350 ? 230 : 30;
    const quad = detectPageQuad(raster(500, 400, page));
    expect(quad).not.toBeNull();
    expectNear(
      quad as Quad,
      [
        { x: 100, y: 50 },
        { x: 400, y: 50 },
        { x: 400, y: 350 },
        { x: 100, y: 350 },
      ],
      1,
    );
  });

  it('finds a rotated page with handwriting on it within a few pixels', () => {
    const truth = rotatedRect(620, 480, 700, 560, 12);
    const image = raster(1200, 960, (x, y) => {
      if (!inside(truth, { x, y })) return 25 + ((x * 7 + y * 13) % 20);
      // Dot grid and a few ink strokes, which must not break the page apart.
      if (Math.round(x) % 24 === 0 && Math.round(y) % 24 === 0) return 120;
      if (Math.abs(y - 400) < 2 && x > 450 && x < 800) return 20;
      return 225;
    });
    const quad = detectPageQuad(image);
    expect(quad).not.toBeNull();
    // The detector works at 512 px, so one of its pixels is about 2.3 source pixels.
    expectNear(quad as Quad, truth, 6);
  });

  it('keeps both halves of a spread split by a dark gutter', () => {
    const image = raster(800, 500, (x, y) => {
      if (y < 60 || y > 440 || x < 80 || x > 720) return 20;
      return Math.abs(x - 400) < 4 ? 40 : 220;
    });
    const quad = detectPageQuad(image);
    expectNear(
      quad as Quad,
      [
        { x: 80, y: 60 },
        { x: 720, y: 60 },
        { x: 720, y: 440 },
        { x: 80, y: 440 },
      ],
      2,
    );
  });

  it('gives up on an image with no page in it', () => {
    expect(detectPageQuad(raster(300, 200, () => 128))).toBeNull();
    const speck = raster(300, 200, (x, y) =>
      x > 10 && x < 30 && y > 10 && y < 30 ? 255 : 0,
    );
    expect(detectPageQuad(speck)).toBeNull();
  });
});

describe('homography', () => {
  it('maps the four corners exactly, and straight lines stay straight', () => {
    const from = fullQuad(300, 400);
    const to: Quad = [
      { x: 37, y: 12 },
      { x: 410, y: 40 },
      { x: 390, y: 520 },
      { x: 20, y: 470 },
    ];
    const h = must(homography(from, to));
    from.forEach((corner, i) => {
      const mapped = applyHomography(h, corner);
      expect(mapped.x).toBeCloseTo(to[i].x, 9);
      expect(mapped.y).toBeCloseTo(to[i].y, 9);
    });
    // The midpoint of an edge lands on the matching edge of the target.
    const mid = applyHomography(h, { x: 150, y: 0 });
    const cross =
      (to[1].x - to[0].x) * (mid.y - to[0].y) -
      (to[1].y - to[0].y) * (mid.x - to[0].x);
    expect(Math.abs(cross)).toBeLessThan(1e-6);
  });

  it('refuses degenerate corners', () => {
    const line: Quad = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ];
    expect(homography(fullQuad(10, 10), line)).toBeNull();
  });
});

describe('warpQuad', () => {
  it('straightens a tilted page into an upright rectangle', () => {
    // Left half of the page dark, right half light: the split must land mid-output.
    const truth = rotatedRect(200, 200, 240, 160, 20);
    const h = must(homography(fullQuad(240, 160), truth));
    const inverse = must(homography(truth, fullQuad(240, 160)));
    const image = raster(400, 400, (x, y) => {
      if (!inside(truth, { x, y })) return 0;
      return applyHomography(inverse, { x, y }).x < 120 ? 60 : 200;
    });
    expect(applyHomography(h, { x: 0, y: 0 }).x).toBeCloseTo(truth[0].x, 6);

    const { width, height } = quadOutputSize(truth, 3000);
    expect([width, height]).toEqual([240, 160]);
    const out = warpQuad(image, truth, width, height);
    const at = (x: number, y: number) => out.data[(y * width + x) * 4];
    expect(at(60, 80)).toBe(60);
    expect(at(180, 80)).toBe(200);
    expect(at(60, 10)).toBe(60);
    expect(at(230, 150)).toBe(200);
    expect(out.data[3]).toBe(255);
  });

  it('caps the long edge of the output', () => {
    expect(quadOutputSize(fullQuad(6000, 4000), 3000)).toEqual({
      width: 3000,
      height: 2000,
    });
    expect(quadOutputSize(fullQuad(800, 600), 3000)).toEqual({
      width: 800,
      height: 600,
    });
  });
});

describe('spreads', () => {
  it('splits into a left and a right page that share the seam', () => {
    const spread: Quad = [
      { x: 10, y: 20 },
      { x: 810, y: 30 },
      { x: 800, y: 620 },
      { x: 20, y: 600 },
    ];
    const seam = defaultSeam(spread);
    expect(seam).toEqual([
      { x: 410, y: 25 },
      { x: 410, y: 610 },
    ]);
    const [left, right] = splitSpread(spread, seam);
    expect(left).toEqual([spread[0], seam[0], seam[1], spread[3]]);
    expect(right).toEqual([seam[0], spread[1], spread[2], seam[1]]);
    expect(isConvexQuad(left) && isConvexQuad(right)).toBe(true);
    expect(quadArea(left) + quadArea(right)).toBeCloseTo(quadArea(spread), 6);
  });

  it('notices a crossed outline', () => {
    const bowtie: Quad = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
    ];
    expect(isConvexQuad(bowtie)).toBe(false);
  });
});
