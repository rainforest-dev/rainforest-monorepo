import { paintedPng, type Rgb } from './png';

export interface Point {
  x: number;
  y: number;
}

/** A synthetic photo of an open notebook and the corners of the paper in it. */
export interface PagePhoto {
  png: Buffer;
  width: number;
  height: number;
  /** TL, TR, BR, BL of the paper, in image pixels. */
  corners: [Point, Point, Point, Point];
}

const TABLE: Rgb = [46, 50, 58];
const PAPER: Rgb = [238, 234, 222];
const DOT: Rgb = [170, 168, 160];
const INK: Rgb = [40, 48, 92];
const GUTTER: Rgb = [196, 192, 182];

/**
 * A tilted notebook on a dark table, with a dot grid and a few ink strokes. `spread` makes it a
 * landscape two-page spread with a shaded gutter down the middle; otherwise a portrait page.
 * `writing` picks other strokes, for a page the lookalike check must not take for an earlier one.
 */
export function pagePhoto({
  spread = true,
  width = 900,
  height = 640,
  degrees = 6,
  writing = 0,
}: {
  spread?: boolean;
  width?: number;
  height?: number;
  degrees?: number;
  writing?: number;
} = {}): PagePhoto {
  const paperW = spread ? width * 0.78 : width * 0.42;
  const paperH = spread ? height * 0.74 : height * 0.82;
  const cx = width / 2;
  const cy = height / 2;
  const t = (degrees * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const corner = (u: number, v: number): Point => ({
    x: cx + u * cos - v * sin,
    y: cy + u * sin + v * cos,
  });
  const corners: PagePhoto['corners'] = [
    corner(-paperW / 2, -paperH / 2),
    corner(paperW / 2, -paperH / 2),
    corner(paperW / 2, paperH / 2),
    corner(-paperW / 2, paperH / 2),
  ];

  const png = paintedPng(width, height, (x, y) => {
    // Back into the paper's own upright coordinates.
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    const u = dx * cos + dy * sin + paperW / 2;
    const v = -dx * sin + dy * cos + paperH / 2;
    if (u < 0 || v < 0 || u > paperW || v > paperH) return TABLE;
    if (spread && Math.abs(u - paperW / 2) < 3) return GUTTER;
    const pageU = spread ? u % (paperW / 2) : u;
    // The right page carries different writing, so the two halves never look like one page.
    const right = spread && u > paperW / 2;
    const pitch = 34 + writing * 13;
    const line = Math.floor((v - 30) / pitch);
    if (
      v > 30 &&
      line < (right ? 10 : 6) - writing &&
      (v - 30) % pitch < 3 + writing * 2 &&
      pageU > 24 &&
      pageU < 60 + ((line * 53 + (right ? 70 : 0) + writing * 61) % 140)
    ) {
      return INK;
    }
    if (Math.round(u) % 16 === 0 && Math.round(v) % 16 === 0) return DOT;
    return PAPER;
  });
  return { png, width, height, corners };
}
