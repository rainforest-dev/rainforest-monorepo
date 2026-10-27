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
/** How far a wing's sign stands in from the left wall. */
const SIGN_INSET = 0.6;

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
  /** The wing's name sign, in the left aisle beside its first row. */
  sign: { x: number; z: number };
}

export type FurnitureKind = 'table' | 'plant' | 'lamp' | 'rack';

/** Something standing on the floor that the avatar walks around. `w` runs along x, `d` along z. */
export interface Furniture {
  kind: FurnitureKind;
  x: number;
  z: number;
  w: number;
  d: number;
}

/** The magazine rack by the entrance, facing the door, and where the avatar stands to use it. */
export interface RackPlacement extends Furniture {
  kind: 'rack';
  front: FloorPoint;
}

export interface HallLayout {
  cases: CasePlacement[];
  wings: WingPlacement[];
  furniture: Furniture[];
  rack: RackPlacement;
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
    // Every sign stands in the left aisle, clear of the cases: a short wing's cases are
    // centred, and a sign beside them would sit among the name plates of the rows around it.
    placed.push({ first, count, sign: { x: -halfWidth + SIGN_INSET, z: z0 } });
    row += rowsOf(count);
  }
  const room: Room = {
    minX: -halfWidth,
    maxX: halfWidth,
    minZ: -(totalRows - 1) * pitchZ - CASE_DEPTH / 2 - WALL_MARGIN,
    maxZ: CASE_DEPTH / 2 + ENTRANCE_DEPTH,
  };
  const { furniture, rack } = furnish(room);
  return {
    cases,
    wings: placed,
    furniture,
    rack,
    room,
    spawn: { x: 0, z: room.maxZ - 1.2 },
  };
}

export const RACK_WIDTH = 1.7;
export const RACK_DEPTH = 0.55;
/** Tiers of the magazine rack, top to bottom, and the covers each shows face out. */
export const RACK_TIERS = 4;
export const RACK_COVERS_PER_TIER = 4;
export const RACK_TIER_PITCH = 0.36;
export const RACK_BOTTOM_TIER = 0.24;
export const RACK_COVER = { w: 0.3, h: 0.34 } as const;
const RACK_FRONT_OFFSET = 0.6;

/** Where the ledge of tier `tier` (0 at the top) stands above the floor. */
export function rackTierY(tier: number): number {
  return RACK_BOTTOM_TIER + (RACK_TIERS - 1 - tier) * RACK_TIER_PITCH;
}

/** The centre of cover `index` on tier `tier`, leaning back against the rack. */
export function rackCoverSlot(
  rack: Pick<Furniture, 'x' | 'z' | 'w'>,
  tier: number,
  index: number,
): { x: number; y: number; z: number } {
  const inner = rack.w - 0.2;
  const step = inner / RACK_COVERS_PER_TIER;
  return {
    x: rack.x - inner / 2 + (index + 0.5) * step,
    y: rackTierY(tier) + RACK_COVER.h / 2 + 0.02,
    z: rack.z + 0.03,
  };
}

/**
 * The reading area by the entrance and the corners: the magazine rack on the left of the way in
 * and a table with chairs on the right, a lamp in each front corner, a plant in each back one.
 * Depends on the room only.
 */
function furnish(room: Room): {
  furniture: Furniture[];
  rack: RackPlacement;
} {
  const half = room.maxX;
  const front = CASE_DEPTH / 2 + FRONT_OFFSET + 0.9;
  const tableZ = (front + room.maxZ) / 2;
  const tableX = Math.max(2.2, half - 1.9);
  // The rack is wider than a table; in a narrow room it moves in from the wall.
  const rackX = -Math.min(tableX, half - RACK_WIDTH / 2 - 0.15);
  const rack: RackPlacement = {
    kind: 'rack',
    x: rackX,
    z: tableZ,
    w: RACK_WIDTH,
    d: RACK_DEPTH,
    front: { x: rackX, z: tableZ + RACK_DEPTH / 2 + RACK_FRONT_OFFSET },
  };
  const furniture: Furniture[] = [
    rack,
    { kind: 'table', x: tableX, z: tableZ, w: 1.4, d: 1.7 },
    { kind: 'lamp', x: -half + 0.45, z: room.maxZ - 0.45, w: 0.5, d: 0.5 },
    { kind: 'lamp', x: half - 0.45, z: room.maxZ - 0.45, w: 0.5, d: 0.5 },
    { kind: 'plant', x: -half + 0.55, z: room.minZ + 0.55, w: 0.7, d: 0.7 },
    { kind: 'plant', x: half - 0.55, z: room.minZ + 0.55, w: 0.7, d: 0.7 },
  ];
  return { furniture, rack };
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
