/** A point in image space: pixels from the top-left corner, or 0..1 when normalised. */
export interface Point {
  x: number;
  y: number;
}

/** A page outline as four corners, clockwise from the top-left: TL, TR, BR, BL. */
export type Quad = readonly [Point, Point, Point, Point];

/** The seam between the two pages of a spread: where it meets the top and bottom edges. */
export type Seam = readonly [top: Point, bottom: Point];

/** An RGBA pixel buffer, laid out like the browser's `ImageData`. */
export interface Raster {
  data: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
}

export const fullQuad = (width: number, height: number): Quad => [
  { x: 0, y: 0 },
  { x: width, y: 0 },
  { x: width, y: height },
  { x: 0, y: height },
];

export const scaleQuad = (quad: Quad, sx: number, sy = sx): Quad =>
  quad.map((p) => ({ x: p.x * sx, y: p.y * sy })) as unknown as Quad;

export const distance = (a: Point, b: Point): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

const midpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

/** Area of a quad by the shoelace formula; positive whatever its winding. */
export function quadArea(quad: Quad): number {
  let twice = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    twice += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twice) / 2;
}

/** True when the quad is convex and does not cross itself, so it can be warped. */
export function isConvexQuad(quad: Quad): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    const c = quad[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-9) return false;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}

/**
 * The size of the rectangle a quad straightens into: its longer top/bottom edge by its longer
 * left/right edge, scaled down so the long edge is at most `maxEdge`.
 */
export function quadOutputSize(
  quad: Quad,
  maxEdge: number,
): { width: number; height: number } {
  const [tl, tr, br, bl] = quad;
  const width = Math.max(distance(tl, tr), distance(bl, br));
  const height = Math.max(distance(tl, bl), distance(tr, br));
  const scale = Math.min(1, maxEdge / Math.max(width, height, 1));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** A spread's seam where a fresh one starts: halfway along the top and bottom edges. */
export const defaultSeam = ([tl, tr, br, bl]: Quad): Seam => [
  midpoint(tl, tr),
  midpoint(bl, br),
];

/** Splits a spread along its seam into the left page and then the right page. */
export function splitSpread(
  [tl, tr, br, bl]: Quad,
  [top, bottom]: Seam,
): [Quad, Quad] {
  return [
    [tl, top, bottom, bl],
    [top, tr, br, bottom],
  ];
}
