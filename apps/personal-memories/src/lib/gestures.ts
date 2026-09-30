export type Point = { x: number; y: number };

export const LONG_PRESS_MS = 450;
export const MOVE_TOLERANCE_PX = 10;
export const PINCH_ZOOM_OUT = 0.75;

export const distance = (a: Point, b: Point) =>
  Math.hypot(b.x - a.x, b.y - a.y);

export const movedBeyond = (
  a: Point,
  b: Point,
  tolerance = MOVE_TOLERANCE_PX,
) => distance(a, b) > tolerance;

export const pinchRatio = (start: number, end: number) =>
  start > 0 ? end / start : 1;

export const isZoomOutPinch = (ratio: number) => ratio <= PINCH_ZOOM_OUT;
