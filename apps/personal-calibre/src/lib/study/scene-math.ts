import { ROW_H, type StudyLayout } from './layout';

export const CAMERA_MARGIN = 0.3;

export interface CameraBounds {
  minY: number;
  maxY: number;
}

export interface CameraState {
  y: number;
  bounds: CameraBounds;
}

export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type NdcPoint = readonly [number, number];

function caseBottom(layout: StudyLayout): number {
  return layout.boards.reduce(
    (bottom, board) => Math.min(bottom, board.y - board.sy / 2),
    -(layout.rows - 1) * ROW_H,
  );
}

export function focusTargetY(layout: StudyLayout, row: number): number {
  const clamped = Math.min(Math.max(row, 0), layout.rows - 1);
  return -clamped * ROW_H + ROW_H * 0.5;
}

export function cameraBounds(
  layout: StudyLayout,
  viewHeightUnits: number,
  margin = CAMERA_MARGIN,
): CameraBounds {
  const top = ROW_H + margin;
  const bottom = caseBottom(layout) - margin;
  const half = viewHeightUnits / 2;
  const minY = bottom + half;
  const maxY = top - half;
  if (minY > maxY) {
    const centre = (top + bottom) / 2;
    return { minY: centre, maxY: centre };
  }
  return { minY, maxY };
}

export function clampCameraY(y: number, bounds: CameraBounds): number {
  return Math.min(Math.max(y, bounds.minY), bounds.maxY);
}

export function wheelPan(
  y: number,
  deltaPx: number,
  pxPerUnit: number,
  bounds: CameraBounds,
): { y: number; consumed: boolean } {
  const next = clampCameraY(y - deltaPx / pxPerUnit, bounds);
  return { y: next, consumed: Math.abs(next - y) > 1e-6 };
}

export function screenRectOf(
  points: readonly NdcPoint[],
  viewport: ScreenRect,
): ScreenRect | null {
  if (points.length === 0) return null;
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const [x, y] of points) {
    const sx = viewport.left + ((x + 1) / 2) * viewport.width;
    const sy = viewport.top + ((1 - y) / 2) * viewport.height;
    left = Math.min(left, sx);
    right = Math.max(right, sx);
    top = Math.min(top, sy);
    bottom = Math.max(bottom, sy);
  }
  return { left, top, width: right - left, height: bottom - top };
}
