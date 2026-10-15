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
const ENTRANCE_DEPTH = 4;

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

export interface HallLayout {
  cases: CasePlacement[];
  room: Room;
  spawn: FloorPoint;
}

/**
 * Rows of bookcases facing the entrance, up to four abreast, with an aisle in front of each row.
 * A pure function of the count, so the hall stays put while books move between cases.
 */
export function layoutHall(count: number): HallLayout {
  const columns = Math.max(1, Math.min(MAX_COLUMNS, count));
  const rows = Math.max(1, Math.ceil(count / columns));
  const pitchX = CASE_WIDTH + CASE_GAP;
  const pitchZ = CASE_DEPTH + AISLE;
  const cases: CasePlacement[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / columns);
    const inRow = Math.min(columns, count - row * columns);
    const column = i % columns;
    const x = (column - (inRow - 1) / 2) * pitchX;
    const z = -row * pitchZ;
    cases.push({ x, z, front: { x, z: z + CASE_DEPTH / 2 + FRONT_OFFSET } });
  }
  const halfWidth = (columns * pitchX) / 2 + WALL_MARGIN;
  const room: Room = {
    minX: -halfWidth,
    maxX: halfWidth,
    minZ: -(rows - 1) * pitchZ - CASE_DEPTH / 2 - WALL_MARGIN,
    maxZ: CASE_DEPTH / 2 + ENTRANCE_DEPTH,
  };
  return { cases, room, spawn: { x: 0, z: room.maxZ - 1.2 } };
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
