import type { Point, Quad, Raster } from './geometry';

export const SPREAD_ASPECT = 1.15;

const GUTTER_BAND = [0.35, 0.65] as const;
const GUTTER_SMOOTHING = 0.02;
const GUTTER_MIN_DEPTH = 10;

const luma = (data: Uint8ClampedArray, i: number) =>
  0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

export function findStackedGutter(page: Raster): number | null {
  const { data, width, height } = page;
  if (height < 8 || width < 8) return null;
  const rows = new Float64Array(height);
  const values = new Float64Array(width);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) values[x] = luma(data, (y * width + x) * 4);
    values.sort();
    rows[y] = values[width >> 1];
  }

  const radius = Math.max(1, Math.round(height * GUTTER_SMOOTHING));
  const smooth = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    let count = 0;
    for (
      let j = Math.max(0, y - radius);
      j <= Math.min(height - 1, y + radius);
      j++
    ) {
      sum += rows[j];
      count++;
    }
    smooth[y] = sum / count;
  }

  const from = Math.floor(height * GUTTER_BAND[0]);
  const to = Math.ceil(height * GUTTER_BAND[1]);
  let darkest = Infinity;
  let at = -1;
  for (let y = from; y < to; y++) {
    if (smooth[y] < darkest) [darkest, at] = [smooth[y], y];
  }
  const band = Array.from(smooth.subarray(from, to)).sort((a, b) => a - b);
  const typical = band[band.length >> 1];
  if (at < 0 || typical - darkest < GUTTER_MIN_DEPTH) return null;
  return (at + 0.5) / height;
}

const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

export function splitStacked([tl, tr, br, bl]: Quad, at: number): [Quad, Quad] {
  const left = lerp(tl, bl, at);
  const right = lerp(tr, br, at);
  return [
    [tl, tr, right, left],
    [left, right, br, bl],
  ];
}

export function rotateCounterClockwise({
  data,
  width,
  height,
}: Raster): Raster {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = (y * width + x) * 4;
      const to = ((width - 1 - x) * height + y) * 4;
      out[to] = data[from];
      out[to + 1] = data[from + 1];
      out[to + 2] = data[from + 2];
      out[to + 3] = data[from + 3];
    }
  }
  return { data: out, width: height, height: width };
}

export function isSkinOrDesk(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return (
    r > 95 && g > 40 && b > 20 && r > g && r > b && r - g > 15 && max - min > 15
  );
}

export const MARGIN_SHARE = 0.18;
/** How far, in RGB distance, a pixel must be from the paper before it can count as skin or desk. */
const PAPER_DISTANCE = 45;
/** More of the margin than this looking like skin means the paper itself is warm, so nothing is cleaned. */
const MAX_MARKED_SHARE = 0.5;

/** Median colour of the middle half of the page, which is mostly paper whatever its tint. */
function paperColour({
  data,
  width,
  height,
}: Raster): [number, number, number] {
  const channels: [number[], number[], number[]] = [[], [], []];
  for (let y = height >> 2; y < height - (height >> 2); y += 2) {
    for (let x = width >> 2; x < width - (width >> 2); x += 2) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) channels[c].push(data[i + c]);
    }
  }
  const median = (values: number[]) =>
    values.length ? values.sort((a, b) => a - b)[values.length >> 1] : 255;
  return [median(channels[0]), median(channels[1]), median(channels[2])];
}

/**
 * Paints out fingers and desk that reach into the page from its edge. Only warm regions
 * connected to the outer edge are touched, so ink drawn in the margin is kept, and a page
 * whose margin is mostly warm (cream paper under warm light) is left as it is.
 */
export function cleanMargins(page: Raster, share = MARGIN_SHARE): number {
  const { data, width, height } = page;
  const bandX = Math.max(1, Math.round(width * share));
  const bandY = Math.max(1, Math.round(height * share));
  const inMargin = (x: number, y: number) =>
    x < bandX || x >= width - bandX || y < bandY || y >= height - bandY;
  const paper = paperColour(page);

  const candidate = new Uint8Array(width * height);
  let marginPixels = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!inMargin(x, y)) continue;
      marginPixels++;
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const distance = Math.hypot(r - paper[0], g - paper[1], b - paper[2]);
      if (distance > PAPER_DISTANCE && isSkinOrDesk(r, g, b)) {
        candidate[y * width + x] = 1;
      }
    }
  }

  // Keep only candidates connected to the page edge: a finger or the desk enters from outside.
  const mask = new Uint8Array(width * height);
  const stack: number[] = [];
  const seed = (x: number, y: number) => {
    const p = y * width + x;
    if (candidate[p] && !mask[p]) {
      mask[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < width; x++) {
    seed(x, 0);
    seed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    seed(0, y);
    seed(width - 1, y);
  }
  let marked = 0;
  while (stack.length) {
    const p = stack.pop() as number;
    marked++;
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) seed(x - 1, y);
    if (x < width - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < height - 1) seed(x, y + 1);
  }
  if (marked === 0 || marked > marginPixels * MAX_MARKED_SHARE) return 0;

  const grown = mask.slice();
  const reach = Math.max(1, Math.round(Math.max(width, height) * 0.004));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      for (let dy = -reach; dy <= reach; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -reach; dx <= reach; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width || !inMargin(xx, yy)) continue;
          grown[yy * width + xx] = 1;
        }
      }
    }
  }

  let painted = 0;
  for (let p = 0; p < grown.length; p++) {
    if (!grown[p]) continue;
    const i = p * 4;
    data[i] = paper[0];
    data[i + 1] = paper[1];
    data[i + 2] = paper[2];
    painted++;
  }
  return painted;
}
