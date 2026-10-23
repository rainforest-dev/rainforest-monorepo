import {
  BoxGeometry,
  type BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  PlaneGeometry,
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
const WALL_THICKNESS = 0.2;
const WINDOW_PITCH = 3.4;
/** How far the floor runs on past the entrance, so the view in never ends at an edge. */
export const FLOOR_APRON = 10;

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
  return flat;
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

/** A plane facing into the room from the front (normal -z), unseen from outside it. */
function inwardPlane(
  color: Rgb,
  [w, h]: [number, number],
  [x, y, z]: [number, number, number],
): Part {
  return paint(
    new PlaneGeometry(w, h).rotateY(Math.PI).translate(x, y, z),
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

/**
 * The room around the bookcases: walls with wainscot, windows and pilasters, a rug and a
 * reading area by the entrance, and each wing's sign post. Two meshes: `solid` is lit, `glow`
 * (window panes, lamp shades) is not.
 */
export function buildDecor(
  layout: HallLayout,
  p: HallPalette,
): { solid: BufferGeometry; glow: BufferGeometry } {
  const { room } = layout;
  const width = room.maxX - room.minX;
  const depth = room.maxZ - room.minZ;
  const cx = (room.minX + room.maxX) / 2;
  const cz = (room.minZ + room.maxZ) / 2;
  const t = WALL_THICKNESS;
  const solid: Part[] = [];
  const glow: Part[] = [];

  // Walls: back and both sides, each with a wainscot, a skirting board and a cornice.
  const backZ = room.minZ - t / 2;
  solid.push(
    box(p.wall, [width + 2 * t, WALL_HEIGHT, t], [cx, WALL_HEIGHT / 2, backZ]),
  );
  solid.push(box(p.panel, [width, 1, 0.04], [cx, 0.5, room.minZ + 0.02]));
  solid.push(
    box(p.darkWood, [width, 0.05, 0.07], [cx, 1.02, room.minZ + 0.035]),
  );
  solid.push(
    box(p.darkWood, [width, 0.14, 0.06], [cx, 0.07, room.minZ + 0.03]),
  );
  solid.push(
    box(
      p.darkWood,
      [width + 2 * t, 0.12, 0.3],
      [cx, WALL_HEIGHT - 0.06, backZ + 0.05],
    ),
  );
  for (const side of [-1, 1]) {
    const x = side < 0 ? room.minX - t / 2 : room.maxX + t / 2;
    const inner = side < 0 ? room.minX : room.maxX;
    solid.push(box(p.wall, [t, WALL_HEIGHT, depth], [x, WALL_HEIGHT / 2, cz]));
    solid.push(box(p.panel, [0.04, 1, depth], [inner - side * 0.02, 0.5, cz]));
    solid.push(
      box(p.darkWood, [0.07, 0.05, depth], [inner - side * 0.035, 1.02, cz]),
    );
    solid.push(
      box(p.darkWood, [0.06, 0.14, depth], [inner - side * 0.03, 0.07, cz]),
    );
    solid.push(
      box(
        p.darkWood,
        [0.3, 0.12, depth],
        [x - side * 0.05, WALL_HEIGHT - 0.06, cz],
      ),
    );
    // Tall windows with a pilaster between each pair.
    const n = Math.max(1, Math.floor((depth - 1.6) / WINDOW_PITCH));
    const span = (n - 1) * WINDOW_PITCH;
    for (let i = 0; i < n; i++) {
      const z = cz - span / 2 + i * WINDOW_PITCH;
      glow.push(box(p.glass, [0.02, 1.7, 1.2], [inner - side * 0.005, 2.1, z]));
      solid.push(
        box(p.darkWood, [0.06, 0.06, 1.3], [inner - side * 0.03, 1.22, z]),
      );
      solid.push(
        box(p.darkWood, [0.06, 0.06, 1.3], [inner - side * 0.03, 2.98, z]),
      );
      solid.push(
        box(p.darkWood, [0.05, 1.7, 0.05], [inner - side * 0.03, 2.1, z]),
      );
      solid.push(
        box(p.darkWood, [0.05, 0.05, 1.2], [inner - side * 0.03, 2.3, z]),
      );
      for (const edge of [-1, 1])
        solid.push(
          box(
            p.darkWood,
            [0.06, 1.8, 0.06],
            [inner - side * 0.03, 2.1, z + edge * 0.63],
          ),
        );
      if (i < n - 1)
        solid.push(
          box(
            p.panel,
            [0.16, WALL_HEIGHT, 0.34],
            [inner - side * 0.08, WALL_HEIGHT / 2, z + WINDOW_PITCH / 2],
          ),
        );
    }
  }
  // The front wall, around a doorway on the way in. It only faces into the room, so the
  // camera sees through it from outside, as into a doll's house, and sees it when turned
  // around inside.
  const door = 2.6;
  const leaf = (width - door) / 2;
  for (const side of [-1, 1]) {
    const x = cx + side * (door / 2 + leaf / 2);
    solid.push(
      inwardPlane(p.wall, [leaf, WALL_HEIGHT], [x, WALL_HEIGHT / 2, room.maxZ]),
    );
    solid.push(inwardPlane(p.panel, [leaf, 1], [x, 0.5, room.maxZ - 0.01]));
  }
  solid.push(
    inwardPlane(
      p.wall,
      [door, WALL_HEIGHT - 2.6],
      [cx, (WALL_HEIGHT + 2.6) / 2, room.maxZ],
    ),
  );
  solid.push(
    inwardPlane(p.darkWood, [door + 0.2, 0.12], [cx, 2.6, room.maxZ - 0.01]),
  );

  // Back wall windows, high up behind the last row.
  const backWindows = Math.max(1, Math.floor((width - 1) / WINDOW_PITCH));
  const backSpan = (backWindows - 1) * WINDOW_PITCH;
  for (let i = 0; i < backWindows; i++) {
    const x = cx - backSpan / 2 + i * WINDOW_PITCH;
    glow.push(box(p.glass, [1.2, 1, 0.02], [x, 2.55, room.minZ + 0.005]));
    solid.push(box(p.darkWood, [1.3, 0.06, 0.06], [x, 2.03, room.minZ + 0.03]));
    solid.push(box(p.darkWood, [1.3, 0.06, 0.06], [x, 3.07, room.minZ + 0.03]));
    solid.push(box(p.darkWood, [0.05, 1, 0.05], [x, 2.55, room.minZ + 0.03]));
  }

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

  return { solid: merge(solid), glow: merge(glow) };
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

/** Floorboards, drawn once per theme and tiled across the floor. */
export function floorTexture(p: HallPalette): CanvasTexture | null {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const rows = 8;
  const h = canvas.height / rows;
  for (let r = 0; r < rows; r++) {
    // Boards in each row are offset from the last, as laid boards are.
    const offset = ((r * 97) % 5) * 37;
    for (let x = -offset; x < canvas.width; x += 128) {
      const shade = 0.9 + (((r * 31 + x * 7) % 11) / 11) * 0.18;
      const [cr, cg, cb] = p.floor.map((c) => Math.min(255, c * shade));
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      ctx.fillRect(x, r * h, 128, h);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x, r * h, 1.5, h);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, r * h, canvas.width, 1.5);
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
