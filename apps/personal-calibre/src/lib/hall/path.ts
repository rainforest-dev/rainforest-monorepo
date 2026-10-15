import {
  CASE_DEPTH,
  CASE_WIDTH,
  type FloorPoint,
  type HallLayout,
} from './layout';

export const CELL = 0.25;
/** How far the avatar's body reaches from its centre; blocked cells are grown by this much. */
export const AVATAR_RADIUS = 0.3;

export interface WalkGrid {
  originX: number;
  originZ: number;
  columns: number;
  rows: number;
  /** Row-major; true where the avatar may stand. */
  open: boolean[];
}

export function buildGrid(layout: HallLayout): WalkGrid {
  const { room } = layout;
  const originX = room.minX;
  const originZ = room.minZ;
  const columns = Math.ceil((room.maxX - room.minX) / CELL);
  const rows = Math.ceil((room.maxZ - room.minZ) / CELL);
  const open: boolean[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const x = originX + (c + 0.5) * CELL;
      const z = originZ + (r + 0.5) * CELL;
      const insideWalls =
        x - AVATAR_RADIUS >= room.minX &&
        x + AVATAR_RADIUS <= room.maxX &&
        z - AVATAR_RADIUS >= room.minZ &&
        z + AVATAR_RADIUS <= room.maxZ;
      const hitsCase = layout.cases.some(
        (p) =>
          Math.abs(x - p.x) < CASE_WIDTH / 2 + AVATAR_RADIUS &&
          Math.abs(z - p.z) < CASE_DEPTH / 2 + AVATAR_RADIUS,
      );
      open.push(insideWalls && !hitsCase);
    }
  }
  return { originX, originZ, columns, rows, open };
}

interface Cell {
  c: number;
  r: number;
}

function cellOf(grid: WalkGrid, p: FloorPoint): Cell {
  return {
    c: Math.floor((p.x - grid.originX) / CELL),
    r: Math.floor((p.z - grid.originZ) / CELL),
  };
}

function centreOf(grid: WalkGrid, { c, r }: Cell): FloorPoint {
  return {
    x: grid.originX + (c + 0.5) * CELL,
    z: grid.originZ + (r + 0.5) * CELL,
  };
}

function isOpen(grid: WalkGrid, c: number, r: number): boolean {
  return (
    c >= 0 &&
    r >= 0 &&
    c < grid.columns &&
    r < grid.rows &&
    grid.open[r * grid.columns + c] === true
  );
}

export function canStand(grid: WalkGrid, p: FloorPoint): boolean {
  const { c, r } = cellOf(grid, p);
  return isOpen(grid, c, r);
}

/** The open cell nearest to `p`, searching outward ring by ring. */
export function nearestOpen(grid: WalkGrid, p: FloorPoint): FloorPoint | null {
  const start = cellOf(grid, p);
  const reach = Math.max(grid.columns, grid.rows);
  for (let ring = 0; ring <= reach; ring++) {
    let best: Cell | null = null;
    let bestDistance = Infinity;
    for (let dr = -ring; dr <= ring; dr++) {
      for (let dc = -ring; dc <= ring; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
        const cell = { c: start.c + dc, r: start.r + dr };
        if (!isOpen(grid, cell.c, cell.r)) continue;
        const centre = centreOf(grid, cell);
        const distance = Math.hypot(centre.x - p.x, centre.z - p.z);
        if (distance < bestDistance) {
          best = cell;
          bestDistance = distance;
        }
      }
    }
    if (best) return ring === 0 ? p : centreOf(grid, best);
  }
  return null;
}

/** True when a straight walk from a to b crosses only open cells. */
export function clearLine(
  grid: WalkGrid,
  a: FloorPoint,
  b: FloorPoint,
): boolean {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (CELL / 3));
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    if (!canStand(grid, { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }))
      return false;
  }
  return true;
}

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

/**
 * A* over the walk grid, then string-pulled so the avatar walks straight wherever it can.
 * Returns the waypoints after `from`, ending exactly at `to`, or null when `to` cannot be reached.
 */
export function findPath(
  grid: WalkGrid,
  from: FloorPoint,
  to: FloorPoint,
): FloorPoint[] | null {
  const start = cellOf(grid, from);
  const goal = cellOf(grid, to);
  if (!isOpen(grid, goal.c, goal.r)) return null;
  if (clearLine(grid, from, to)) return [to];
  const index = (c: number, r: number) => r * grid.columns + c;
  const g = new Map<number, number>([[index(start.c, start.r), 0]]);
  const came = new Map<number, number>();
  const open = new Map<number, number>([
    [index(start.c, start.r), Math.hypot(goal.c - start.c, goal.r - start.r)],
  ]);
  const closed = new Set<number>();
  const goalIndex = index(goal.c, goal.r);
  while (open.size > 0) {
    let current = -1;
    let lowest = Infinity;
    for (const [i, f] of open) {
      if (f < lowest) {
        lowest = f;
        current = i;
      }
    }
    if (current === goalIndex) break;
    open.delete(current);
    closed.add(current);
    const c = current % grid.columns;
    const r = Math.floor(current / grid.columns);
    for (const [dc, dr] of NEIGHBOURS) {
      const nc = c + dc;
      const nr = r + dr;
      if (!isOpen(grid, nc, nr)) continue;
      // No cutting corners past a bookcase's edge.
      if (
        dc !== 0 &&
        dr !== 0 &&
        (!isOpen(grid, c + dc, r) || !isOpen(grid, c, r + dr))
      )
        continue;
      const next = index(nc, nr);
      if (closed.has(next)) continue;
      const cost = (g.get(current) ?? 0) + Math.hypot(dc, dr);
      if (cost >= (g.get(next) ?? Infinity)) continue;
      g.set(next, cost);
      came.set(next, current);
      open.set(next, cost + Math.hypot(goal.c - nc, goal.r - nr));
    }
  }
  if (!came.has(goalIndex) && goalIndex !== index(start.c, start.r))
    return null;
  const cells: FloorPoint[] = [];
  for (
    let i: number | undefined = goalIndex;
    i !== undefined;
    i = came.get(i)
  ) {
    cells.push(
      centreOf(grid, { c: i % grid.columns, r: Math.floor(i / grid.columns) }),
    );
  }
  cells.reverse();
  cells[cells.length - 1] = to;
  const path: FloorPoint[] = [];
  let anchor = from;
  let k = 0;
  while (k < cells.length) {
    let far = k;
    for (let j = cells.length - 1; j > k; j--) {
      if (clearLine(grid, anchor, cells[j] as FloorPoint)) {
        far = j;
        break;
      }
    }
    const waypoint = cells[far] as FloorPoint;
    path.push(waypoint);
    anchor = waypoint;
    k = far + 1;
  }
  return path;
}
