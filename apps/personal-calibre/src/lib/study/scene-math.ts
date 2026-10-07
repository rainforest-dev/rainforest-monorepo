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
export type Vec3 = readonly [number, number, number];

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

const at = (m: ArrayLike<number>, i: number) => m[i] ?? 0;

export function projectBox(
  corners: readonly Vec3[],
  viewProjection: ArrayLike<number>,
  viewport: { width: number; height: number },
): ScreenRect | null {
  if (corners.length === 0) return null;
  const m = viewProjection;
  const points: NdcPoint[] = [];
  for (const [x, y, z] of corners) {
    const w = at(m, 3) * x + at(m, 7) * y + at(m, 11) * z + at(m, 15);
    if (w <= 1e-6) return null;
    points.push([
      (at(m, 0) * x + at(m, 4) * y + at(m, 8) * z + at(m, 12)) / w,
      (at(m, 1) * x + at(m, 5) * y + at(m, 9) * z + at(m, 13)) / w,
    ]);
  }
  const rect = screenRectOf(points, { left: 0, top: 0, ...viewport });
  if (!rect) return null;
  const left = Math.max(rect.left, 0);
  const top = Math.max(rect.top, 0);
  const right = Math.min(rect.left + rect.width, viewport.width);
  const bottom = Math.min(rect.top + rect.height, viewport.height);
  if (right <= left || bottom <= top) return null;
  return { left, top, width: right - left, height: bottom - top };
}

export function snapRect(rect: ScreenRect, dpr: number): ScreenRect {
  const snap = (value: number) => Math.round(value * dpr) / dpr;
  const left = snap(rect.left);
  const top = snap(rect.top);
  return {
    left,
    top,
    width: snap(rect.left + rect.width) - left,
    height: snap(rect.top + rect.height) - top,
  };
}

export const ATLAS_PPU_LADDER = [160, 128, 112, 96] as const;
export type AtlasPpu = (typeof ATLAS_PPU_LADDER)[number];
export const ATLAS_PPU_FLOOR: AtlasPpu = 96;
export const TEXTURE_BUDGET_BYTES = {
  desktop: 50 * 1024 * 1024,
  phone: 30 * 1024 * 1024,
} as const;
export const COVER_W = 256;
export const COVER_H = 384;
export const COVER_CACHE_MAX = 24;
export const COVER_NEIGHBOURS = 4;
export const COVER_CACHE_MIN = 2 * COVER_NEIGHBOURS + 1;

export interface TextureBudgetInput {
  layout: StudyLayout;
  budgetBytes: number;
  canvas: { width: number; height: number; dpr: number };
  targetBuffers: number;
  coverBytes: number;
  reservedBytes?: number;
}

export interface AtlasPick {
  ppu: AtlasPpu;
  covers: number;
  estimatedBytes: number;
  fits: boolean;
}

export function textureBytes(width: number, height: number): number {
  return (width * height * 4 * 4) / 3;
}

export const COVER_BYTES = textureBytes(COVER_W, COVER_H);
export const INSPECT_BACK_BYTES = COVER_BYTES;

export function rowAtlasSize(
  widthUnits: number,
  ppu: number,
): { width: number; height: number } {
  return {
    width: Math.ceil(widthUnits * ppu),
    height: Math.ceil(ROW_H * ppu),
  };
}

export function rowAtlasBytes(widthUnits: number, ppu: number): number {
  const { width, height } = rowAtlasSize(widthUnits, ppu);
  return textureBytes(width, height);
}

export function atlasBytesAt(layout: StudyLayout, ppu: number): number {
  return layout.rows * rowAtlasBytes(layout.width, ppu);
}

export function targetBytes({
  canvas,
  targetBuffers,
}: Pick<TextureBudgetInput, 'canvas' | 'targetBuffers'>): number {
  return canvas.width * canvas.height * canvas.dpr ** 2 * 4 * targetBuffers;
}

export function pickAtlasPpu(input: TextureBudgetInput): AtlasPick {
  const targets = targetBytes(input) + (input.reservedBytes ?? 0);
  const estimate = (ppu: AtlasPpu, covers: number) =>
    targets + covers * input.coverBytes + atlasBytesAt(input.layout, ppu);
  const pick = (ppu: AtlasPpu, covers: number, fits: boolean): AtlasPick => ({
    ppu,
    covers,
    estimatedBytes: estimate(ppu, covers),
    fits,
  });
  const ppu = ATLAS_PPU_LADDER.find(
    (rung) => estimate(rung, COVER_CACHE_MAX) <= input.budgetBytes,
  );
  if (ppu !== undefined) return pick(ppu, COVER_CACHE_MAX, true);
  const room = input.budgetBytes - estimate(ATLAS_PPU_FLOOR, 0);
  const covers = Math.min(COVER_CACHE_MAX, Math.floor(room / input.coverBytes));
  return covers >= COVER_CACHE_MIN
    ? pick(ATLAS_PPU_FLOOR, covers, true)
    : pick(ATLAS_PPU_FLOOR, COVER_CACHE_MIN, false);
}

export function atlasOrder(
  rows: number,
  visible: readonly number[],
): { sync: number[]; idle: number[] } {
  const inRange = visible.filter(
    (row) => Number.isInteger(row) && row >= 0 && row < rows,
  );
  const sync = inRange.length > 0 ? [...new Set(inRange)] : rows > 0 ? [0] : [];
  const distance = (row: number) =>
    Math.min(...sync.map((from) => Math.abs(from - row)));
  const idle = Array.from({ length: rows }, (_, row) => row)
    .filter((row) => !sync.includes(row))
    .sort((a, b) => distance(a) - distance(b) || a - b);
  return { sync, idle };
}

export function rowsInView(
  layout: StudyLayout,
  centreY: number,
  viewHeightUnits: number,
): number[] {
  const top = centreY + viewHeightUnits / 2;
  const bottom = centreY - viewHeightUnits / 2;
  return Array.from({ length: layout.rows }, (_, row) => row).filter(
    (row) => (1 - row) * ROW_H > bottom && -row * ROW_H - 0.1 < top,
  );
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface ScreenSize {
  width: number;
  height: number;
}

export const FLOAT_GAP_PX = 28;
export const FLOAT_MARGIN_PX = 8;
const FLOAT_HEIGHT_SHARE = 0.34;
const FLOAT_HEIGHT_MIN_PX = 150;
const FLOAT_HEIGHT_MAX_PX = 240;

export function floatHeightPx(viewport: ScreenSize): number {
  const fit = Math.max(0, viewport.height - 2 * FLOAT_MARGIN_PX);
  const wanted = Math.min(
    Math.max(viewport.height * FLOAT_HEIGHT_SHARE, FLOAT_HEIGHT_MIN_PX),
    FLOAT_HEIGHT_MAX_PX,
  );
  return Math.min(wanted, fit);
}

function clampSpan(
  centre: number,
  half: number,
  extent: number,
  margin: number,
) {
  const low = margin + half;
  const high = extent - margin - half;
  return low > high ? extent / 2 : Math.min(Math.max(centre, low), high);
}

export function floatCentre(
  finger: ScreenPoint,
  size: ScreenSize,
  viewport: ScreenSize,
  gap = FLOAT_GAP_PX,
  margin = FLOAT_MARGIN_PX,
): ScreenPoint {
  const halfH = size.height / 2;
  const above = finger.y - gap - halfH;
  const below = finger.y + gap + halfH;
  const fitsAbove = above - halfH >= margin;
  const fitsBelow = below + halfH <= viewport.height - margin;
  const y = fitsAbove || !fitsBelow ? above : below;
  return {
    x: clampSpan(finger.x, size.width / 2, viewport.width, margin),
    y: clampSpan(y, halfH, viewport.height, margin),
  };
}

export function pxPerUnitAt(
  pxPerUnit: number,
  cameraZ: number,
  z: number,
): number {
  return cameraZ - z <= 1e-6 ? Infinity : (pxPerUnit * cameraZ) / (cameraZ - z);
}

export function approach(rate: number, delta: number, instant = false): number {
  return instant ? 1 : 1 - Math.exp(-rate * Math.max(delta, 0));
}

export interface Carry<T> {
  items: readonly [T | null, T | null];
  active: 0 | 1;
}

export function nextCarry<T>(
  carry: Carry<T>,
  next: T | null,
  same: (a: T, b: T) => boolean,
  keepLeaving: boolean,
): Carry<T> {
  const { items, active } = carry;
  const other = active === 0 ? 1 : 0;
  const current = items[active];
  const leaving = items[other];
  const fresh = (slot: 0 | 1, item: T | null, rest: T | null): Carry<T> => ({
    items: slot === 0 ? [item, rest] : [rest, item],
    active: slot,
  });
  if (next !== null && current !== null && same(current, next)) {
    return fresh(active, next, keepLeaving ? leaving : null);
  }
  if (!keepLeaving || next === null || current === null) {
    return fresh(active, next, null);
  }
  return fresh(other, next, current);
}

export const INSPECT_DRAG_RAD_PER_PX = 0.012;
export const INSPECT_KEY_YAW = Math.PI / 12;
export const INSPECT_KEY_PITCH = Math.PI / 18;
export const INSPECT_PITCH_MAX = 0.6;
export const INSPECT_DIM = 0.55;
const INSPECT_HEIGHT_SHARE = 0.62;
const INSPECT_WIDTH_SHARE = 0.72;
const TURN = Math.PI * 2;

export type InspectFace = 'front' | 'spine' | 'back' | 'edge';

export function inspectHeightPx(stage: ScreenSize, aspect: number): number {
  const byHeight = stage.height * INSPECT_HEIGHT_SHARE;
  const byWidth =
    aspect > 0 ? (stage.width * INSPECT_WIDTH_SHARE) / aspect : byHeight;
  return Math.max(0, Math.min(byHeight, byWidth));
}

export function clampPitch(pitch: number): number {
  return Math.min(Math.max(pitch, -INSPECT_PITCH_MAX), INSPECT_PITCH_MAX);
}

export function wrapYaw(yaw: number): number {
  return ((yaw % TURN) + TURN) % TURN;
}

export function yawDegrees(yaw: number): number {
  return Math.round((wrapYaw(yaw) * 180) / Math.PI) % 360;
}

export function faceAt(yaw: number): InspectFace {
  const degrees = yawDegrees(yaw);
  if (degrees < 45 || degrees >= 315) return 'front';
  if (degrees < 135) return 'spine';
  if (degrees < 225) return 'back';
  return 'edge';
}
