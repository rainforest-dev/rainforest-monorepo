import { isConvexQuad, type Quad, quadArea, type Raster } from './geometry';

/** Long edge the detector works at: plenty to find a page, and fast on a phone. */
export const DETECT_EDGE = 512;

export interface GrayImage {
  data: Uint8Array;
  width: number;
  height: number;
}

/**
 * Luma of an RGBA raster, box-averaged down by a whole factor so its long edge is at most
 * `maxEdge`. `scale` is that factor: one gray pixel covers `scale` × `scale` source pixels.
 */
export function toGray(
  raster: Raster,
  maxEdge = Infinity,
): GrayImage & { scale: number } {
  const { data, width, height } = raster;
  const scale = Math.max(1, Math.ceil(Math.max(width, height) / maxEdge));
  const w = Math.ceil(width / scale);
  const h = Math.ceil(height / scale);
  const sums = new Float64Array(w * h);
  const counts = new Uint32Array(w * h);
  for (let y = 0; y < height; y++) {
    const row = Math.floor(y / scale) * w;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const cell = row + Math.floor(x / scale);
      sums[cell] += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      counts[cell]++;
    }
  }
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < gray.length; i++)
    gray[i] = Math.round(sums[i] / counts[i]);
  return { data: gray, width: w, height: h, scale };
}

/** Otsu's threshold: the gray level that best separates the histogram into two classes. */
export function otsuThreshold(gray: Uint8Array): number {
  const histogram = new Float64Array(256);
  for (const value of gray) histogram[value]++;
  const total = gray.length;
  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * histogram[t];

  let sumBelow = 0;
  let weightBelow = 0;
  let best = 0;
  let bestVariance = -1;
  for (let t = 0; t < 256; t++) {
    weightBelow += histogram[t];
    if (weightBelow === 0) continue;
    const weightAbove = total - weightBelow;
    if (weightAbove === 0) break;
    sumBelow += t * histogram[t];
    const meanBelow = sumBelow / weightBelow;
    const meanAbove = (sumAll - sumBelow) / weightAbove;
    const variance =
      weightBelow *
      weightAbove *
      (meanBelow - meanAbove) *
      (meanBelow - meanAbove);
    if (variance > bestVariance) {
      bestVariance = variance;
      best = t;
    }
  }
  return best;
}

/** Below this share of the image, a bright region is not taken for a page. */
const MIN_REGION_SHARE = 0.05;
/** A second region at least this share of the largest joins it: the other half of a spread. */
const COMPANION_SHARE = 0.25;
/** A detected outline smaller than this share of the image is not trusted. */
const MIN_QUAD_SHARE = 0.1;
/** Gray levels spanning less than this have no page edge worth finding. */
const MIN_CONTRAST = 32;

/**
 * Finds the outline of a bright page on a darker background: Otsu-threshold the luma, take the
 * largest bright 4-connected region (with any region at least a quarter its size, so a spread
 * split by a dark gutter stays whole), and read its corners off the extreme points along x+y and
 * x−y. Returns `null` when nothing page-like is found; callers fall back to the whole image.
 */
export function detectPageQuad(
  raster: Raster,
  maxEdge = DETECT_EDGE,
): Quad | null {
  const { data: gray, width, height, scale } = toGray(raster, maxEdge);
  let darkest = 255;
  let brightest = 0;
  for (const value of gray) {
    if (value < darkest) darkest = value;
    if (value > brightest) brightest = value;
  }
  if (brightest - darkest < MIN_CONTRAST) return null;
  const threshold = otsuThreshold(gray);
  const n = width * height;

  const labels = new Int32Array(n).fill(-1);
  const areas: number[] = [];
  const stack = new Int32Array(n);
  for (let start = 0; start < n; start++) {
    if (labels[start] !== -1 || gray[start] <= threshold) continue;
    const label = areas.length;
    let area = 0;
    let top = 0;
    stack[top++] = start;
    labels[start] = label;
    while (top > 0) {
      const at = stack[--top];
      area++;
      const x = at % width;
      const neighbours = [
        x > 0 ? at - 1 : -1,
        x < width - 1 ? at + 1 : -1,
        at - width,
        at + width,
      ];
      for (const next of neighbours) {
        if (next < 0 || next >= n) continue;
        if (labels[next] !== -1 || gray[next] <= threshold) continue;
        labels[next] = label;
        stack[top++] = next;
      }
    }
    areas.push(area);
  }

  const largest = Math.max(0, ...areas);
  if (largest < n * MIN_REGION_SHARE) return null;
  const chosen = new Uint8Array(areas.length);
  areas.forEach((area, label) => {
    if (area >= largest * COMPANION_SHARE) chosen[label] = 1;
  });

  // Each corner is the outer corner of its extreme pixel, so an upright rectangle is exact.
  let minSum = Infinity;
  let maxSum = -Infinity;
  let minDiff = Infinity;
  let maxDiff = -Infinity;
  const corners = { tl: [0, 0], tr: [0, 0], br: [0, 0], bl: [0, 0] };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const label = labels[y * width + x];
      if (label === -1 || !chosen[label]) continue;
      const sum = x + y;
      const diff = x - y;
      if (sum < minSum) [minSum, corners.tl] = [sum, [x, y]];
      if (sum > maxSum) [maxSum, corners.br] = [sum, [x + 1, y + 1]];
      if (diff > maxDiff) [maxDiff, corners.tr] = [diff, [x + 1, y]];
      if (diff < minDiff) [minDiff, corners.bl] = [diff, [x, y + 1]];
    }
  }

  // Back to source pixels; the last cell of a row or column may be partial, hence the clamp.
  const point = ([x, y]: number[]) => ({
    x: Math.min(x * scale, raster.width),
    y: Math.min(y * scale, raster.height),
  });
  const quad: Quad = [
    point(corners.tl),
    point(corners.tr),
    point(corners.br),
    point(corners.bl),
  ];
  if (!isConvexQuad(quad)) return null;
  if (quadArea(quad) < raster.width * raster.height * MIN_QUAD_SHARE)
    return null;
  return quad;
}
