import {
  BoxGeometry,
  type BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { mixRgb, type Rgb, type Tokens } from '@/components/study/three/tokens';
import {
  CASE_DEPTH,
  CASE_HEIGHT,
  CASE_SHELVES,
  CASE_WIDTH,
  type Furniture,
  type HallLayout,
  SHELF_PITCH,
} from '@/lib';

export const WALL_HEIGHT = 3.4;
/** Masonry thickness: deep enough that a window has a reveal and a sill. */
export const WALL_THICKNESS = 0.45;
const WINDOW_PITCH = 3.4;
const WINDOW_WIDTH = 1.2;
const SIDE_SILL = 1.25;
const SIDE_HEAD = 2.95;
const BACK_SILL = 2.05;
const BACK_HEAD = 3.05;
const DOOR_WIDTH = 2.6;
/** The front wall stops at this height, so the reader looks in over it from outside. */
const FRONT_WALL_HEIGHT = 0.8;
/** World metres per repeat of the surface texture. */
const UV_METRES = 1.6;

/** The room's colours, all derived from the theme so the hall follows light and dark. */
export interface HallPalette {
  wall: Rgb;
  panel: Rgb;
  wood: Rgb;
  darkWood: Rgb;
  floor: Rgb;
  rug: Rgb;
  rugBorder: Rgb;
  sign: Rgb;
  leaf: Rgb;
  pot: Rgb;
  glass: Rgb;
  lamp: Rgb;
  stone: Rgb;
  paving: Rgb;
}

export function hallPalette(tokens: Tokens): HallPalette {
  const wood = mixRgb(tokens['chart-4'], tokens.foreground, 0.35);
  return {
    wall: mixRgb(tokens.card, tokens['chart-4'], 0.86),
    panel: mixRgb(wood, tokens.background, 0.55),
    wood,
    darkWood: mixRgb(wood, tokens.foreground, 0.55),
    floor: mixRgb(tokens['chart-4'], tokens.background, 0.32),
    rug: mixRgb(tokens['chart-1'], tokens.muted, 0.45),
    rugBorder: mixRgb(tokens['chart-1'], tokens.foreground, 0.55),
    sign: mixRgb(tokens.card, tokens.foreground, 0.92),
    leaf: mixRgb(tokens['chart-2'], tokens.foreground, 0.55),
    pot: mixRgb(tokens['chart-5'], tokens.muted, 0.5),
    glass: mixRgb([255, 247, 226], tokens.background, 0.8),
    lamp: [255, 226, 170],
    stone: mixRgb(tokens['chart-4'], [168, 164, 156], 0.15),
    paving: [176, 170, 158],
  };
}

type Part = BufferGeometry;

/** Every part non-indexed and coloured per vertex, so parts of any shape merge into one mesh. */
function paint(geometry: BufferGeometry, [r, g, b]: Rgb): Part {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat !== geometry) geometry.dispose();
  const count = flat.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  // Linear colour, as three expects vertex colours.
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  for (let i = 0; i < count; i++) {
    colors[i * 3] = lin(r);
    colors[i * 3 + 1] = lin(g);
    colors[i * 3 + 2] = lin(b);
  }
  flat.setAttribute('color', new Float32BufferAttribute(colors, 3));
  flat.setAttribute('uv', worldUv(flat));
  return flat;
}

/**
 * Texture coordinates from world position, projected along each face's main axis, so the
 * surface texture keeps one scale on a long wall and a chair leg alike instead of stretching.
 */
function worldUv(geometry: BufferGeometry): Float32BufferAttribute {
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    const nx = Math.abs(normal.getX(i));
    const ny = Math.abs(normal.getY(i));
    const nz = Math.abs(normal.getZ(i));
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const [u, v] = nx >= ny && nx >= nz ? [z, y] : ny >= nz ? [x, z] : [x, y];
    uv[i * 2] = u / UV_METRES;
    uv[i * 2 + 1] = v / UV_METRES;
  }
  return new Float32BufferAttribute(uv, 2);
}

function box(
  color: Rgb,
  [w, h, d]: [number, number, number],
  [x, y, z]: [number, number, number],
): Part {
  return paint(new BoxGeometry(w, h, d).translate(x, y, z), color);
}

function cylinder(
  color: Rgb,
  [top, bottom, h]: [number, number, number],
  [x, y, z]: [number, number, number],
  segments = 10,
): Part {
  return paint(
    new CylinderGeometry(top, bottom, h, segments).translate(x, y, z),
    color,
  );
}

function merge(parts: Part[]): BufferGeometry {
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  if (!merged) throw new Error('hall decor did not merge');
  return merged;
}

function table(p: HallPalette, f: Furniture, out: Part[]) {
  const top = 0.74;
  out.push(box(p.wood, [f.w, 0.05, 0.8], [f.x, top, f.z]));
  for (const dx of [-1, 1])
    for (const dz of [-1, 1])
      out.push(
        box(
          p.darkWood,
          [0.06, top, 0.06],
          [f.x + dx * (f.w / 2 - 0.1), top / 2, f.z + dz * 0.3],
        ),
      );
  // A chair on each long side, facing the table.
  for (const side of [-1, 1]) {
    const z = f.z + side * 0.62;
    out.push(box(p.darkWood, [0.46, 0.05, 0.44], [f.x, 0.46, z]));
    out.push(box(p.darkWood, [0.46, 0.5, 0.05], [f.x, 0.72, z + side * 0.2]));
    for (const dx of [-1, 1])
      for (const dz of [-1, 1])
        out.push(
          box(
            p.darkWood,
            [0.04, 0.46, 0.04],
            [f.x + dx * 0.19, 0.23, z + dz * 0.18],
          ),
        );
  }
  // A book left open and a small stack.
  out.push(box(p.sign, [0.34, 0.02, 0.24], [f.x - 0.25, top + 0.035, f.z]));
  out.push(box(p.rugBorder, [0.2, 0.06, 0.28], [f.x + 0.35, top + 0.055, f.z]));
}

function plant(p: HallPalette, f: Furniture, out: Part[]) {
  out.push(cylinder(p.pot, [0.26, 0.2, 0.5], [f.x, 0.25, f.z]));
  out.push(
    paint(
      new IcosahedronGeometry(0.42, 1)
        .scale(1, 1.3, 1)
        .translate(f.x, 0.95, f.z),
      p.leaf,
    ),
  );
  out.push(
    paint(
      new IcosahedronGeometry(0.28, 1).translate(f.x + 0.18, 1.45, f.z - 0.08),
      p.leaf,
    ),
  );
}

function lampStand(p: HallPalette, f: Furniture, out: Part[]) {
  out.push(cylinder(p.darkWood, [0.18, 0.2, 0.04], [f.x, 0.02, f.z]));
  out.push(cylinder(p.darkWood, [0.025, 0.025, 1.55], [f.x, 0.8, f.z], 6));
}

/** A hole in a wall: centred at `at` along the wall, from `sill` to `head` above the floor. */
interface Opening {
  at: number;
  width: number;
  sill: number;
  head: number;
}

/**
 * One straight run of a wall. `axis` is the direction it runs in; `across` is its centre line on
 * the other axis. `side` points out of the room, so `inner` and `outer` place trims on either face.
 */
interface WallRun {
  axis: 'x' | 'z';
  across: number;
  side: -1 | 1;
}

function along(
  run: WallRun,
  color: Rgb,
  [from, to]: [number, number],
  [bottom, top]: [number, number],
  depth: number,
  offset: number,
): Part {
  const length = to - from;
  const mid = (from + to) / 2;
  const height = top - bottom;
  const y = (bottom + top) / 2;
  const at = run.across + run.side * offset;
  return run.axis === 'x'
    ? box(color, [length, height, depth], [mid, y, at])
    : box(color, [depth, height, length], [at, y, mid]);
}

/** The masonry of one wall, laid in pieces around its openings so they are real holes. */
function masonry(
  run: WallRun,
  color: Rgb,
  [from, to]: [number, number],
  openings: Opening[],
  height: number,
  out: Part[],
) {
  const t = WALL_THICKNESS;
  let cursor = from;
  for (const o of [...openings].sort((a, b) => a.at - b.at)) {
    const left = o.at - o.width / 2;
    const right = o.at + o.width / 2;
    if (left > cursor)
      out.push(along(run, color, [cursor, left], [0, height], t, 0));
    out.push(along(run, color, [left, right], [0, o.sill], t, 0));
    out.push(along(run, color, [left, right], [o.head, height], t, 0));
    cursor = right;
  }
  if (to > cursor) out.push(along(run, color, [cursor, to], [0, height], t, 0));
}

/**
 * Frame, sill and glass for one window. The glass sits on the wall's centre line, so the reveal
 * shows the wall's depth from either side.
 */
function windowIn(
  run: WallRun,
  o: Opening,
  p: HallPalette,
  solid: Part[],
  glass: Part[],
) {
  const t = WALL_THICKNESS;
  const span: [number, number] = [o.at - o.width / 2, o.at + o.width / 2];
  const bar = 0.05;
  // Inner sill board, proud of the plaster; a stone sill outside that sheds the rain.
  solid.push(
    along(
      run,
      p.wood,
      [span[0] - 0.08, span[1] + 0.08],
      [o.sill - 0.04, o.sill + 0.01],
      t * 0.6,
      -t * 0.25,
    ),
  );
  solid.push(
    along(
      run,
      p.stone,
      [span[0] - 0.06, span[1] + 0.06],
      [o.sill - 0.08, o.sill],
      t * 0.6,
      t * 0.32,
    ),
  );
  // Frame round the opening and a cross of glazing bars.
  solid.push(along(run, p.darkWood, span, [o.sill, o.sill + bar], 0.08, 0));
  solid.push(along(run, p.darkWood, span, [o.head - bar, o.head], 0.08, 0));
  for (const edge of [span[0], span[1] - bar])
    solid.push(
      along(run, p.darkWood, [edge, edge + bar], [o.sill, o.head], 0.08, 0),
    );
  solid.push(
    along(
      run,
      p.darkWood,
      [o.at - 0.02, o.at + 0.02],
      [o.sill, o.head],
      0.06,
      0,
    ),
  );
  const transom = o.sill + (o.head - o.sill) * 0.62;
  solid.push(
    along(run, p.darkWood, span, [transom - 0.02, transom + 0.02], 0.06, 0),
  );
  glass.push(along(run, p.glass, span, [o.sill, o.head], 0.015, 0));
}

/** Wainscot, chair rail, skirting and cornice along a wall's inner face. */
function innerTrim(
  run: WallRun,
  p: HallPalette,
  span: [number, number],
  solid: Part[],
) {
  const face = -WALL_THICKNESS / 2;
  solid.push(along(run, p.panel, span, [0, 1], 0.04, face - 0.02));
  solid.push(along(run, p.darkWood, span, [0.995, 1.045], 0.07, face - 0.035));
  solid.push(along(run, p.darkWood, span, [0, 0.14], 0.06, face - 0.03));
  solid.push(
    along(
      run,
      p.darkWood,
      span,
      [WALL_HEIGHT - 0.12, WALL_HEIGHT],
      0.3,
      face - 0.1,
    ),
  );
}

/** A stone plinth course and a coping along a wall's outside. */
function outerTrim(
  run: WallRun,
  p: HallPalette,
  span: [number, number],
  height: number,
  solid: Part[],
) {
  const t = WALL_THICKNESS;
  solid.push(along(run, p.stone, span, [0, 0.45], 0.08, t / 2 + 0.03));
  solid.push(
    along(
      run,
      p.stone,
      [span[0] - 0.06, span[1] + 0.06],
      [height, height + 0.12],
      t + 0.14,
      0,
    ),
  );
}

/** Deterministic noise for the scenery, so the trees stand in the same places on every visit. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** Faceted, so a few triangles read as foliage rather than as a smooth ball. */
function faceted(geometry: BufferGeometry, color: Rgb): Part {
  const part = paint(geometry, color);
  part.computeVertexNormals();
  return part;
}

const TRUNK: Rgb = [104, 80, 60];
const LEAVES: readonly Rgb[] = [
  [86, 128, 70],
  [70, 112, 64],
  [104, 140, 76],
  [62, 100, 72],
];
const HILLS: readonly Rgb[] = [
  [104, 132, 98],
  [92, 120, 96],
  [118, 140, 104],
];

function tree(x: number, z: number, random: () => number, out: Part[]) {
  const height = 1.6 + random() * 1.2;
  out.push(cylinder(TRUNK, [0.1, 0.16, height], [x, height / 2, z], 7));
  const crowns = 2 + Math.floor(random() * 2);
  for (let i = 0; i < crowns; i++) {
    const r = 0.8 + random() * 0.7;
    const leaf = LEAVES[Math.floor(random() * LEAVES.length)] ?? LEAVES[0];
    out.push(
      faceted(
        new IcosahedronGeometry(r, 0)
          .scale(1, 0.9 + random() * 0.4, 1)
          .translate(
            x + (random() - 0.5) * 0.8,
            height + r * 0.5 + i * 0.55,
            z + (random() - 0.5) * 0.8,
          ),
        leaf,
      ),
    );
  }
}

/** Paving slabs in a rectangle, each a shade off its neighbours, with a joint between them. */
function paving(
  p: HallPalette,
  [x0, x1]: [number, number],
  [z0, z1]: [number, number],
  slab: number,
  random: () => number,
  out: Part[],
) {
  const joint = 0.025;
  for (let z = z0; z < z1 - 0.01; z += slab) {
    const offset = Math.round((z - z0) / slab) % 2 ? slab / 2 : 0;
    for (let x = x0 - offset; x < x1 - 0.01; x += slab) {
      const a = Math.max(x, x0);
      const b = Math.min(x + slab, x1);
      const c = Math.min(z + slab, z1);
      if (b - a < 0.05) continue;
      const shade = 0.9 + random() * 0.16;
      const color = p.paving.map((v) => Math.min(255, v * shade));
      const tone: Rgb = [color[0] ?? 0, color[1] ?? 0, color[2] ?? 0];
      out.push(
        box(
          tone,
          [b - a - joint, 0.04, c - z - joint],
          [(a + b) / 2, 0.02, (z + c) / 2],
        ),
      );
    }
  }
}

export interface HallDecor {
  /** Lit and shadowed: the building, its furniture and the trees and paving outside. */
  solid: BufferGeometry;
  /** Unlit: lamp shades. */
  glow: BufferGeometry;
  /** Window panes, drawn see-through. */
  glass: BufferGeometry;
  /**
   * A roof over the room that is never drawn but casts a shadow, so sunlight reaches the floor
   * only through the windows and over the front wall.
   */
  roof: BufferGeometry;
  /** The hills on the horizon: lit, but too far off to cast a shadow worth computing. */
  scenery: BufferGeometry;
}

/**
 * The building around the bookcases and the ground it stands on. The walls are masonry with real
 * window openings; the front wall stops at waist height between its corner piers and door posts,
 * so the reader looks in over it as into a doll's house. Outside, paving leads to the door
 * across grass with trees, and hills close the view.
 */
export function buildDecor(layout: HallLayout, p: HallPalette): HallDecor {
  const { room } = layout;
  const t = WALL_THICKNESS;
  const half = room.maxX;
  const cz = (room.minZ + room.maxZ) / 2;
  const depth = room.maxZ - room.minZ;
  const solid: Part[] = [];
  const glow: Part[] = [];
  const glass: Part[] = [];
  const random = seeded(7);

  // Side walls, each with a row of tall windows and a pilaster between each pair.
  const n = Math.max(1, Math.floor((depth - 1.6) / WINDOW_PITCH));
  const span = (n - 1) * WINDOW_PITCH;
  const sideWindows: Opening[] = Array.from({ length: n }, (_, i) => ({
    at: cz - span / 2 + i * WINDOW_PITCH,
    width: WINDOW_WIDTH,
    sill: SIDE_SILL,
    head: SIDE_HEAD,
  }));
  for (const side of [-1, 1] as const) {
    const run: WallRun = { axis: 'z', across: side * (half + t / 2), side };
    const length: [number, number] = [room.minZ, room.maxZ];
    masonry(run, p.wall, length, sideWindows, WALL_HEIGHT, solid);
    innerTrim(run, p, length, solid);
    outerTrim(run, p, [room.minZ - t, room.maxZ + t], WALL_HEIGHT, solid);
    for (const o of sideWindows) windowIn(run, o, p, solid, glass);
    sideWindows
      .slice(0, -1)
      .forEach((o) =>
        solid.push(
          along(
            run,
            p.panel,
            [o.at + WINDOW_PITCH / 2 - 0.17, o.at + WINDOW_PITCH / 2 + 0.17],
            [0, WALL_HEIGHT],
            0.12,
            -t / 2 - 0.06,
          ),
        ),
      );
  }

  // The back wall, with high windows behind the last row of bookcases.
  const backCount = Math.max(1, Math.floor((2 * half - 1) / WINDOW_PITCH));
  const backSpan = (backCount - 1) * WINDOW_PITCH;
  const backWindows: Opening[] = Array.from({ length: backCount }, (_, i) => ({
    at: -backSpan / 2 + i * WINDOW_PITCH,
    width: WINDOW_WIDTH,
    sill: BACK_SILL,
    head: BACK_HEAD,
  }));
  const back: WallRun = { axis: 'x', across: room.minZ - t / 2, side: -1 };
  masonry(back, p.wall, [-half - t, half + t], backWindows, WALL_HEIGHT, solid);
  innerTrim(back, p, [-half, half], solid);
  outerTrim(back, p, [-half - t, half + t], WALL_HEIGHT, solid);
  for (const o of backWindows) windowIn(back, o, p, solid, glass);

  // The front: full-height piers at the corners, and between them a waist-high wall with a
  // capped gate post either side of the door, low enough that the camera looks in over it.
  const front: WallRun = { axis: 'x', across: room.maxZ + t / 2, side: 1 };
  const door = DOOR_WIDTH / 2;
  const pier = 0.55;
  const postTop = FRONT_WALL_HEIGHT + 0.35;
  for (const s of [-1, 1]) {
    const corner: [number, number] =
      s < 0 ? [-half - t, -half + pier] : [half - pier, half + t];
    const post: [number, number] =
      s < 0 ? [-door - 0.4, -door] : [door, door + 0.4];
    const low: [number, number] =
      s < 0 ? [corner[1], post[0]] : [post[1], corner[0]];
    solid.push(along(front, p.wall, corner, [0, WALL_HEIGHT], t, 0));
    solid.push(along(front, p.wall, post, [0, postTop], t + 0.06, 0));
    solid.push(
      along(
        front,
        p.stone,
        [post[0] - 0.05, post[1] + 0.05],
        [postTop, postTop + 0.1],
        t + 0.16,
        0,
      ),
    );
    solid.push(along(front, p.wall, low, [0, FRONT_WALL_HEIGHT], t, 0));
    solid.push(
      along(
        front,
        p.stone,
        [low[0] - 0.04, low[1] + 0.04],
        [FRONT_WALL_HEIGHT, FRONT_WALL_HEIGHT + 0.08],
        t + 0.14,
        0,
      ),
    );
    solid.push(
      along(
        front,
        p.panel,
        low,
        [0, FRONT_WALL_HEIGHT - 0.05],
        0.04,
        -t / 2 - 0.02,
      ),
    );
    // The plinth course stops at the door.
    const plinth: [number, number] =
      s < 0 ? [corner[0], post[1]] : [post[0], corner[1]];
    solid.push(along(front, p.stone, plinth, [0, 0.45], 0.08, t / 2 + 0.03));
  }
  // A stone threshold across the doorway.
  solid.push(along(front, p.stone, [-door, door], [0, 0.03], t + 0.1, 0));

  // A rug from the entrance to the first aisle.
  const rugFront = CASE_DEPTH / 2 + 1.2;
  const rugDepth = room.maxZ - 0.5 - rugFront;
  if (rugDepth > 0.5) {
    const rugZ = rugFront + rugDepth / 2;
    solid.push(box(p.rugBorder, [2.6, 0.012, rugDepth], [0, 0.006, rugZ]));
    solid.push(box(p.rug, [2.3, 0.016, rugDepth - 0.3], [0, 0.008, rugZ]));
  }

  for (const f of layout.furniture) {
    if (f.kind === 'table') table(p, f, solid);
    else if (f.kind === 'plant') plant(p, f, solid);
    else {
      lampStand(p, f, solid);
      glow.push(cylinder(p.lamp, [0.16, 0.26, 0.3], [f.x, 1.65, f.z], 12));
    }
  }

  // A post and board at the head of each wing, under its name.
  for (const wing of layout.wings) {
    const { x, z } = wing.sign;
    solid.push(cylinder(p.darkWood, [0.03, 0.03, 1.7], [x, 0.85, z], 6));
    solid.push(cylinder(p.darkWood, [0.16, 0.18, 0.04], [x, 0.02, z]));
    solid.push(box(p.sign, [0.62, 0.36, 0.04], [x, 1.6, z + 0.03]));
  }

  // Outside: a paved apron along the front, a forecourt at the door and a path away from it.
  const outside = room.maxZ + t;
  paving(
    p,
    [-half - t - 1, half + t + 1],
    [outside, outside + 1.2],
    0.6,
    random,
    solid,
  );
  paving(
    p,
    [-door - 1.6, door + 1.6],
    [outside + 1.2, outside + 5.2],
    0.8,
    random,
    solid,
  );
  paving(p, [-0.9, 0.9], [outside + 5.2, outside + 24], 0.6, random, solid);

  // Trees: a row down each side, a few in front clear of the path, a belt behind.
  const wide = half + t;
  for (let z = room.minZ - 2; z < outside + 16; z += 4.2)
    for (const s of [-1, 1])
      tree(s * (wide + 3 + random() * 3.5), z + random() * 2, random, solid);
  for (let x = -wide - 6; x <= wide + 6; x += 4)
    tree(x + random() * 2, room.minZ - t - 3.5 - random() * 4, random, solid);
  for (const s of [-1, 1])
    for (let i = 0; i < 4; i++)
      tree(
        s * (door + 3.5 + i * 3.2 + random()),
        outside + 6 + random() * 9,
        random,
        solid,
      );

  // Hills in a ring on the horizon, beyond the trees.
  const hills: Part[] = [];
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2 + random() * 0.2;
    const distance = 60 + random() * 22;
    const r = 14 + random() * 14;
    const color = HILLS[i % HILLS.length] ?? HILLS[0];
    hills.push(
      faceted(
        new IcosahedronGeometry(r, 1)
          .scale(1, 0.35 + random() * 0.3, 0.7)
          .translate(
            Math.sin(angle) * distance,
            -r * 0.12,
            cz - Math.cos(angle) * distance,
          ),
        color,
      ),
    );
  }

  const roof = new BoxGeometry(2 * (half + t), 0.2, depth + 2 * t).translate(
    0,
    WALL_HEIGHT + 0.25,
    cz,
  );

  return {
    solid: merge(solid),
    glow: merge(glow),
    glass: merge(glass),
    roof,
    scenery: merge(hills),
  };
}

/**
 * The bookcase: back panel, sides, plinth, cornice and shelves in one geometry. Vertex colours
 * shade the parts (the back sits in shadow), multiplied by the material's wood colour.
 */
export function caseGeometry(): BufferGeometry {
  const parts: Part[] = [];
  const add = (
    shade: number,
    [w, h, d]: [number, number, number],
    [x, y, z]: [number, number, number],
  ) => {
    const v = Math.round(255 * shade);
    parts.push(box([v, v, v], [w, h, d], [x, y, z]));
  };
  const half = CASE_WIDTH / 2;
  add(
    0.55,
    [CASE_WIDTH, CASE_HEIGHT, 0.03],
    [0, CASE_HEIGHT / 2, -CASE_DEPTH / 2 + 0.015],
  );
  for (const side of [-1, 1]) {
    add(
      1,
      [0.06, CASE_HEIGHT, CASE_DEPTH],
      [side * (half - 0.03), CASE_HEIGHT / 2, 0],
    );
    // Fluted front edge on each side.
    add(
      0.8,
      [0.09, CASE_HEIGHT - 0.2, 0.04],
      [side * (half - 0.03), CASE_HEIGHT / 2, CASE_DEPTH / 2],
    );
  }
  add(0.75, [CASE_WIDTH + 0.04, 0.1, CASE_DEPTH + 0.04], [0, 0.05, 0]);
  add(
    1,
    [CASE_WIDTH + 0.12, 0.08, CASE_DEPTH + 0.1],
    [0, CASE_HEIGHT - 0.04, 0.02],
  );
  add(
    0.85,
    [CASE_WIDTH + 0.04, 0.05, CASE_DEPTH + 0.06],
    [0, CASE_HEIGHT + 0.02, 0.02],
  );
  for (let level = 0; level < CASE_SHELVES; level++) {
    add(
      0.95,
      [CASE_WIDTH - 0.08, 0.03, CASE_DEPTH],
      [0, 0.105 + level * SHELF_PITCH, 0],
    );
  }
  return merge(parts);
}

function canvas2d(size: number) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return { canvas, ctx: canvas.getContext('2d') };
}

function tiled(canvas: HTMLCanvasElement, srgb = true): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  if (srgb) texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Speckle at three scales, so two pixels never shade alike and one tile never repeats in an
 * obvious pattern. Drawn grey around white: it multiplies the colour it lies on.
 */
function speckle(
  ctx: CanvasRenderingContext2D,
  size: number,
  random: () => number,
  strength: number,
) {
  for (const [count, radius, alpha] of [
    [60, 22, 0.05],
    [900, 3, 0.07],
    [9000, 0.8, 0.09],
  ] as const) {
    for (let i = 0; i < count; i++) {
      const dark = random() < 0.5;
      ctx.fillStyle = dark
        ? `rgba(0,0,0,${alpha * strength})`
        : `rgba(255,255,255,${alpha * strength})`;
      const x = random() * size;
      const y = random() * size;
      const r = radius * (0.5 + random());
      // Each mark is drawn again one tile over, so the texture wraps without a seam.
      for (const dx of [-size, 0, size])
        for (const dy of [-size, 0, size]) {
          ctx.beginPath();
          ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
          ctx.fill();
        }
    }
  }
}

/**
 * The surface every lit part shares: plaster, stone and wood all read as a material rather than
 * a flat colour. World-space coordinates keep it at one scale everywhere.
 */
export function surfaceTexture(): CanvasTexture | null {
  const { canvas, ctx } = canvas2d(256);
  if (!ctx) return null;
  ctx.fillStyle = 'rgb(236,236,236)';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, seeded(11), 1);
  return tiled(canvas);
}

/** Floorboards with grain, drawn once per theme and tiled across the floor. */
export function floorTexture(p: HallPalette): CanvasTexture | null {
  const size = 512;
  const { canvas, ctx } = canvas2d(size);
  if (!ctx) return null;
  const random = seeded(3);
  const rows = 8;
  const h = size / rows;
  const plank = size / 2;
  for (let r = 0; r < rows; r++) {
    // Boards in each row are offset from the last, as laid boards are.
    const offset = Math.floor(random() * plank);
    for (let x = -offset; x < size; x += plank) {
      const shade = 0.86 + random() * 0.24;
      const [cr, cg, cb] = p.floor.map((c) => Math.min(255, c * shade));
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      ctx.fillRect(x, r * h, plank, h);
      // Grain: long, slightly wavy lines along the board.
      for (let g = 0; g < 9; g++) {
        const y = r * h + 3 + random() * (h - 6);
        ctx.strokeStyle = `rgba(${random() < 0.6 ? '0,0,0' : '255,255,255'},${0.05 + random() * 0.07})`;
        ctx.lineWidth = 0.6 + random() * 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 1; k <= 8; k++)
          ctx.lineTo(x + (plank * k) / 8, y + (random() - 0.5) * 2.4);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(x, r * h, 2, h);
      if (x + plank > size) {
        ctx.fillRect(x + plank - size, r * h, 2, h);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, r * h, size, 2);
  }
  return tiled(canvas);
}

/** Grass: a green base with blades of lighter and darker green, tiled across the ground. */
export function grassTexture(): CanvasTexture | null {
  const size = 256;
  const { canvas, ctx } = canvas2d(size);
  if (!ctx) return null;
  const random = seeded(5);
  ctx.fillStyle = 'rgb(98,132,72)';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 40; i++) {
    const x = random() * size;
    const y = random() * size;
    ctx.fillStyle = `rgba(${random() < 0.5 ? '70,100,50' : '130,160,90'},0.18)`;
    for (const dx of [-size, 0, size])
      for (const dy of [-size, 0, size]) {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, 18 + random() * 20, 0, Math.PI * 2);
        ctx.fill();
      }
  }
  for (let i = 0; i < 5000; i++) {
    const x = random() * size;
    const y = random() * size;
    const tone = random();
    ctx.strokeStyle =
      tone < 0.45
        ? 'rgba(60,92,44,0.5)'
        : tone < 0.9
          ? 'rgba(140,172,96,0.45)'
          : 'rgba(170,160,96,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (random() - 0.5) * 2, y - 2 - random() * 3);
    ctx.stroke();
  }
  return tiled(canvas);
}
