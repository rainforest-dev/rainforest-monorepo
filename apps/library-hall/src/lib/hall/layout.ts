/** Hall geometry in metres. y is up; the avatar starts at +z and walks toward -z. */

export const CASE_WIDTH = 2;
export const CASE_DEPTH = 0.45;
export const CASE_HEIGHT = 2.2;
export const CASE_SHELVES = 4;
const CASE_GAP = 1.2;
const AISLE = 2.6;
const MAX_COLUMNS = 4;
/** Where the avatar stands to use a bookcase, in front of its face. */
const FRONT_OFFSET = 0.75;
const WALL_MARGIN = 1.4;
const ENTRANCE_DEPTH = 5;

export const BOOK_STEP = 0.075;
const BOOK_INSET = 0.08;
const SHELF_BOTTOM = 0.12;
export const SHELF_PITCH = (CASE_HEIGHT - SHELF_BOTTOM - 0.1) / CASE_SHELVES;
export const SLOTS_PER_SHELF = Math.floor(
  (CASE_WIDTH - 2 * BOOK_INSET) / BOOK_STEP,
);
export const SLOTS_PER_CASE = SLOTS_PER_SHELF * CASE_SHELVES;

export interface FloorPoint {
  x: number;
  z: number;
}

export interface CasePlacement {
  x: number;
  z: number;
  /** The walkable spot in front of the case. */
  front: FloorPoint;
}

export interface Room {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface WingPlacement {
  /** Index of the wing's first case in `HallLayout.cases`. */
  first: number;
  count: number;
  /** The wing's name sign, at the left end of its first row. */
  sign: { x: number; z: number };
}

export type FurnitureKind = 'table' | 'plant' | 'lamp';

/** Something standing on the floor that the avatar walks around. `w` runs along x, `d` along z. */
export interface Furniture {
  kind: FurnitureKind;
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface HallLayout {
  cases: CasePlacement[];
  wings: WingPlacement[];
  furniture: Furniture[];
  room: Room;
  spawn: FloorPoint;
}

/** The room's size in bookcases: wide and deep enough for every grouping, so the walls stay put. */
export interface HallFrame {
  columns: number;
  rows: number;
}

function rowsOf(count: number): number {
  return Math.max(1, Math.ceil(count / MAX_COLUMNS));
}

/** The smallest room that fits each of these arrangements, given as cases per wing. */
export function frameFor(
  arrangements: readonly (readonly number[])[],
): HallFrame {
  let columns = 1;
  let rows = 1;
  for (const wings of arrangements) {
    columns = Math.max(columns, ...wings.map((n) => Math.min(MAX_COLUMNS, n)));
    rows = Math.max(
      rows,
      wings.reduce((sum, n) => sum + rowsOf(n), 0),
    );
  }
  return { columns, rows };
}

/**
 * Rows of bookcases facing the entrance, up to four abreast with an aisle in front of each row.
 * Each wing (one collection) starts a row of its own. `wings` is the case count of each wing;
 * a bare number is one wing. The room is sized to `frame`, so it can stay the same size while
 * the bookcases inside it change.
 */
export function layoutHall(
  wings: number | readonly number[],
  frame?: HallFrame,
): HallLayout {
  const counts = typeof wings === 'number' ? [wings] : [...wings];
  const own = frameFor([counts]);
  const columns = Math.max(own.columns, frame?.columns ?? 0);
  const totalRows = Math.max(own.rows, frame?.rows ?? 0);
  const pitchX = CASE_WIDTH + CASE_GAP;
  const pitchZ = CASE_DEPTH + AISLE;
  const halfWidth = (columns * pitchX) / 2 + WALL_MARGIN;
  const cases: CasePlacement[] = [];
  const placed: WingPlacement[] = [];
  let row = 0;
  for (const count of counts) {
    const first = cases.length;
    const z0 = -row * pitchZ;
    for (let i = 0; i < count; i++) {
      const r = Math.floor(i / MAX_COLUMNS);
      const inRow = Math.min(MAX_COLUMNS, count - r * MAX_COLUMNS);
      const column = i % MAX_COLUMNS;
      const x = (column - (inRow - 1) / 2) * pitchX;
      const z = -(row + r) * pitchZ;
      cases.push({ x, z, front: { x, z: z + CASE_DEPTH / 2 + FRONT_OFFSET } });
    }
    const inFirstRow = Math.min(MAX_COLUMNS, Math.max(1, count));
    placed.push({
      first,
      count,
      sign: {
        x: Math.max(
          -halfWidth + 0.6,
          -((inFirstRow - 1) / 2) * pitchX - CASE_WIDTH / 2 - 0.55,
        ),
        z: z0,
      },
    });
    row += rowsOf(count);
  }
  const room: Room = {
    minX: -halfWidth,
    maxX: halfWidth,
    minZ: -(totalRows - 1) * pitchZ - CASE_DEPTH / 2 - WALL_MARGIN,
    maxZ: CASE_DEPTH / 2 + ENTRANCE_DEPTH,
  };
  return {
    cases,
    wings: placed,
    furniture: furnish(room),
    room,
    spawn: { x: 0, z: room.maxZ - 1.2 },
  };
}

/**
 * The reading area by the entrance and the corners: a table with chairs on each side of the
 * way in, a lamp in each front corner, a plant in each back one. Depends on the room only.
 */
function furnish(room: Room): Furniture[] {
  const half = room.maxX;
  const front = CASE_DEPTH / 2 + FRONT_OFFSET + 0.9;
  const tableZ = (front + room.maxZ) / 2;
  const tableX = Math.max(2.2, half - 1.9);
  return [
    { kind: 'table', x: -tableX, z: tableZ, w: 1.4, d: 1.7 },
    { kind: 'table', x: tableX, z: tableZ, w: 1.4, d: 1.7 },
    { kind: 'lamp', x: -half + 0.45, z: room.maxZ - 0.45, w: 0.5, d: 0.5 },
    { kind: 'lamp', x: half - 0.45, z: room.maxZ - 0.45, w: 0.5, d: 0.5 },
    { kind: 'plant', x: -half + 0.55, z: room.minZ + 0.55, w: 0.7, d: 0.7 },
    { kind: 'plant', x: half - 0.55, z: room.minZ + 0.55, w: 0.7, d: 0.7 },
  ];
}

export interface Slot {
  x: number;
  y: number;
  z: number;
  height: number;
  /** False past the case's capacity; the book is counted but not drawn. */
  visible: boolean;
}

export function bookHeight(id: number): number {
  return 0.24 + ((id * 13) % 38) / 400;
}

/** Where the `index`th book of a bookcase stands, filling shelves top to bottom. */
export function slotOf(
  placement: CasePlacement,
  index: number,
  bookId: number,
): Slot {
  const height = bookHeight(bookId);
  const visible = index < SLOTS_PER_CASE;
  const at = visible ? index : SLOTS_PER_CASE - 1;
  const shelf = CASE_SHELVES - 1 - Math.floor(at / SLOTS_PER_SHELF);
  const column = at % SLOTS_PER_SHELF;
  return {
    x: placement.x - CASE_WIDTH / 2 + BOOK_INSET + (column + 0.5) * BOOK_STEP,
    y: SHELF_BOTTOM + shelf * SHELF_PITCH + height / 2,
    z: placement.z + 0.02,
    height,
    visible,
  };
}
