'use client';

import { HALL_ITEM_KINDS } from '@rainforest-dev/library-contract';
import { useLibraryT } from '@rainforest-dev/library-shell';
import {
  Canvas,
  type ThreeEvent,
  useFrame,
  useThree,
} from '@react-three/fiber';
import { Locate, RotateCcw, RotateCw } from 'lucide-react';
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import {
  type Group,
  type InstancedMesh,
  MathUtils,
  Object3D,
  Vector3,
} from 'three';

import {
  capturePoster,
  type HallMemory,
  writeHallMemory,
} from '@/components/hall/memory';
import {
  mixRgb,
  type Rgb,
  toColor,
  type Tokens,
  useTokens,
} from '@/components/study/three/tokens';
import {
  type Bookcase,
  buildGrid,
  canStand,
  CASE_DEPTH,
  CASE_HEIGHT,
  type CasePlacement,
  CASES_PER_WING,
  cn,
  findPath,
  flightPose,
  flightProgress,
  type FloorPoint,
  type HallBook,
  type HallLayout,
  hexToRgb,
  nearestOpen,
  placeBooks,
  RESORT_MS,
  type Slot,
  takeoffOrder,
  type Wing,
} from '@/lib';
import { HALL_NAMESPACE } from '@/locales';

import { Avatar, type AvatarMotion } from './Avatar';
import {
  buildDecor,
  caseGeometry,
  FLOOR_APRON,
  floorTexture,
  hallPalette,
} from './decor';

export interface ThreeHallProps {
  books: readonly HallBook[];
  cases: readonly Bookcase[];
  wings: readonly Wing[];
  layout: HallLayout;
  /** The bookcase to stand in front of on arrival, after coming back from the Study. */
  startKey: string | null;
  /** Where the reader stood when this page was last left, if the browser did not keep it. */
  memory: HallMemory | null;
  reducedMotion: boolean;
  onFirstFrame?: () => void;
  onEnter: (bookcase: Bookcase) => void;
}

const SPEED = 2.4;
const TURN_RATE = 10;
const STRIDE_PER_METRE = 4.2;
/** A beat at the bookcase before the Study opens, so the arrival reads as arriving. */
const ENTER_PAUSE_MS = 280;
const CAMERA_FOLLOW = 6;
/** Where the camera looks: ahead of the avatar, at about chest height. */
const LOOK_AHEAD = 1.6;
const LOOK_HEIGHT = 0.9;
const PITCH_MIN = 0.18;
const PITCH_MAX = 1.3;
const DISTANCE_MIN = 3.2;
const DISTANCE_MAX = 15;
/** Radians per pixel dragged. */
const DRAG_YAW = 0.006;
const DRAG_PITCH = 0.004;
/** A press that moves further than this is a drag that turns the view, not a click. */
const DRAG_SLOP = 6;
/** Radians per second while Q or E is held. */
const KEY_TURN = 1.8;
const BUTTON_TURN = Math.PI / 4;
/** Behind the avatar and above, looking ahead: the view the hall opens with. */
export const DEFAULT_ORBIT = {
  yaw: 0,
  pitch: Math.atan2(4.4, 6.2),
  distance: Math.hypot(4.4, 6.2),
};
export type Orbit = typeof DEFAULT_ORBIT;
/** Q turns the view left, E right. */
const TURN_KEYS: Record<string, number> = { q: 1, e: -1 };
/** Every case one grouping can need: a full row in each wing. */
const CASE_CAPACITY = CASES_PER_WING * HALL_ITEM_KINDS.length;
/** New bookcases rise before the first books land; old ones sink after the last books leave. */
const CASE_RISE_MS = 900;
const CASE_SINK_START_MS = 1150;
const CASE_SINK_MS = 800;
const BOOK_THICKNESS = 0.06;
const BOOK_DEPTH = 0.3;
const KEY_DIRECTIONS: Record<string, FloorPoint> = {
  w: { x: 0, z: -1 },
  arrowup: { x: 0, z: -1 },
  s: { x: 0, z: 1 },
  arrowdown: { x: 0, z: 1 },
  a: { x: -1, z: 0 },
  arrowleft: { x: -1, z: 0 },
  d: { x: 1, z: 0 },
  arrowright: { x: 1, z: 0 },
};

interface HallProbe {
  firstFrameAt: number | null;
  avatar: () => FloorPoint;
  walking: () => boolean;
  resorting: () => boolean;
  /** The camera's angle around the avatar, in radians. */
  yaw: () => number;
  /** Client coordinates of a bookcase's middle shelf, for clicking it in tests. */
  projectCase: (key: string) => { x: number; y: number } | null;
}

type ProbeWindow = Window & { __libraryHall?: HallProbe };

function spineRgb(tokens: Tokens, color: string): Rgb {
  return mixRgb(hexToRgb(color), tokens.muted, 0.72);
}

const scratch = new Object3D();

function writeBook(
  mesh: InstancedMesh,
  index: number,
  pose: { x: number; y: number; z: number; spin: number; scale: number },
  height: number,
) {
  scratch.position.set(pose.x, pose.y, pose.z);
  scratch.rotation.set(0, pose.spin * Math.PI * 2, 0);
  const s = Math.max(pose.scale, 0.0001);
  scratch.scale.set(BOOK_THICKNESS * s, height * s, BOOK_DEPTH * s);
  scratch.updateMatrix();
  mesh.setMatrixAt(index, scratch.matrix);
}

const AT_REST = { spin: 0, scale: 1 };
const HIDDEN = { spin: 0, scale: 0 };

/** A bookcase at `placement`, `rise` of its full height out of the floor. */
function writeCase(
  mesh: InstancedMesh,
  index: number,
  placement: CasePlacement | undefined,
  rise: number,
) {
  if (placement) scratch.position.set(placement.x, 0, placement.z);
  else scratch.position.set(0, -10, 0);
  scratch.rotation.set(0, 0, 0);
  const s = placement ? Math.max(rise, 0.0001) : 0.0001;
  scratch.scale.set(1, s, 1);
  scratch.updateMatrix();
  mesh.setMatrixAt(index, scratch.matrix);
}

const ease = (t: number) => t * t * (3 - 2 * t);

function samePlace(a: CasePlacement | undefined, b: CasePlacement | undefined) {
  return !!a && !!b && Math.abs(a.x - b.x) < 1e-3 && Math.abs(a.z - b.z) < 1e-3;
}

/**
 * Stands every case of `to`. With `elapsed`, a case that is new or has moved rises out of the
 * floor, and one of `from` that is no longer needed sinks into it, in the second half of the
 * mesh. Without it, the cases simply stand.
 */
function poseCases(
  mesh: InstancedMesh,
  from: readonly CasePlacement[] | null,
  to: readonly CasePlacement[],
  elapsed: number | null,
) {
  const rise =
    elapsed === null ? 1 : ease(MathUtils.clamp(elapsed / CASE_RISE_MS, 0, 1));
  const sink =
    elapsed === null
      ? 0
      : 1 -
        ease(
          MathUtils.clamp((elapsed - CASE_SINK_START_MS) / CASE_SINK_MS, 0, 1),
        );
  for (let i = 0; i < CASE_CAPACITY; i++) {
    const before = from?.[i];
    const after = to[i];
    const stays = samePlace(before, after);
    writeCase(mesh, i, after, stays ? 1 : rise);
    writeCase(
      mesh,
      CASE_CAPACITY + i,
      before && !stays && elapsed !== null ? before : undefined,
      sink,
    );
  }
  mesh.instanceMatrix.needsUpdate = true;
}

function shortestTurn(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

interface SceneProps extends ThreeHallProps {
  tokens: Tokens;
  labels: RefObject<HTMLDivElement | null>;
  signs: RefObject<HTMLDivElement | null>;
  keys: RefObject<Set<string>>;
  orbit: RefObject<Orbit>;
  /** Set to the scene's invalidate, so a key press can wake the on-demand render loop. */
  kick: RefObject<() => void>;
}

function HallScene({
  books,
  cases,
  layout,
  startKey,
  memory,
  reducedMotion,
  onEnter,
  tokens,
  labels,
  signs,
  keys,
  orbit,
  kick,
  onFirstFrame,
}: SceneProps) {
  const invalidate = useThree((s) => s.invalidate);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const grid = useMemo(() => buildGrid(layout), [layout]);
  const startAt = useRef(
    layout.cases[cases.findIndex((c) => c.key === startKey)]?.front ??
      (memory && canStand(grid, memory) ? memory : null) ??
      layout.spawn,
  );
  const walker = useRef({
    x: startAt.current.x,
    z: startAt.current.z,
    heading: startKey === null && memory ? memory.heading : Math.PI,
    path: [] as FloorPoint[],
    enter: null as number | null,
    arrivedAt: null as number | null,
  });
  const motion = useRef<AvatarMotion>({ phase: 0, stride: 0 });
  const avatar = useRef<Group>(null);
  const bookMesh = useRef<InstancedMesh>(null);
  const caseMesh = useRef<InstancedMesh>(null);
  const caseGeo = useMemo(caseGeometry, []);
  const caseOfBook = useMemo(() => {
    const out = new Map<number, number>();
    cases.forEach((c, i) => c.bookIds.forEach((id) => out.set(id, i)));
    return out;
  }, [cases]);
  const slots = useMemo(() => placeBooks(cases, layout), [cases, layout]);
  const settled = useRef<Map<number, Slot> | null>(null);
  const flight = useRef<{
    from: Map<number, Slot>;
    to: Map<number, Slot>;
    start: number;
  } | null>(null);
  const firstFrame = useRef<number | null>(null);
  const onEnterRef = useRef(onEnter);
  const onFirstFrameRef = useRef(onFirstFrame);

  useEffect(() => {
    onEnterRef.current = onEnter;
    onFirstFrameRef.current = onFirstFrame;
  }, [onEnter, onFirstFrame]);

  // Leaving the page keeps the spot and a small picture of it for a rebuilt Back. pagehide, not
  // unload: an unload listener alone would bar the page from the bfcache.
  useEffect(() => {
    const save = () => {
      let poster: string | null = null;
      try {
        // The drawing buffer is cleared after compositing, so draw a frame and copy it at once.
        gl.render(scene, camera);
        poster = capturePoster(gl.domElement);
      } catch {
        poster = null;
      }
      const w = walker.current;
      writeHallMemory({ x: w.x, z: w.z, heading: w.heading, poster });
    };
    window.addEventListener('pagehide', save);
    return () => window.removeEventListener('pagehide', save);
  }, [gl, scene, camera]);
  useEffect(() => {
    kick.current = invalidate;
  }, [kick, invalidate]);
  useEffect(() => () => caseGeo.dispose(), [caseGeo]);

  useLayoutEffect(() => {
    const mesh = bookMesh.current;
    if (!mesh) return;
    books.forEach((book, i) =>
      mesh.setColorAt(i, toColor(spineRgb(tokens, book.color))),
    );
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    invalidate();
  }, [books, tokens, invalidate]);

  // A new grouping raises the bookcases it needs and sinks the ones it does not.
  const settledCases = useRef<readonly CasePlacement[] | null>(null);
  const caseFlight = useRef<{
    from: readonly CasePlacement[];
    start: number;
  } | null>(null);
  useLayoutEffect(() => {
    const mesh = caseMesh.current;
    if (!mesh) return;
    const before = settledCases.current;
    settledCases.current = layout.cases;
    const moved =
      before !== null &&
      (before.length !== layout.cases.length ||
        before.some((p, i) => !samePlace(p, layout.cases[i])));
    if (moved && before && !reducedMotion) {
      caseFlight.current = { from: before, start: performance.now() };
      poseCases(mesh, before, layout.cases, 0);
    } else {
      caseFlight.current = null;
      poseCases(mesh, null, layout.cases, null);
    }
    invalidate();
  }, [layout, reducedMotion, invalidate]);

  // A bookcase can rise where the avatar stands; step out of its way.
  useEffect(() => {
    const w = walker.current;
    if (canStand(grid, w)) return;
    const spot = nearestOpen(grid, w);
    if (!spot) return;
    w.x = spot.x;
    w.z = spot.z;
    w.path = [];
    w.enter = null;
    invalidate();
  }, [grid, invalidate]);

  const palette = useMemo(() => hallPalette(tokens), [tokens]);
  const decor = useMemo(() => buildDecor(layout, palette), [layout, palette]);
  useEffect(
    () => () => {
      decor.solid.dispose();
      decor.glow.dispose();
    },
    [decor],
  );
  const floorMap = useMemo(() => floorTexture(palette), [palette]);
  useEffect(() => () => floorMap?.dispose(), [floorMap]);

  // A new grouping sends every book flying from where it stood to its new bookcase.
  useLayoutEffect(() => {
    const mesh = bookMesh.current;
    if (!mesh) return;
    const before = settled.current;
    settled.current = slots;
    if (before && !reducedMotion) {
      flight.current = { from: before, to: slots, start: performance.now() };
    } else {
      flight.current = null;
      books.forEach((book, i) => {
        const slot = slots.get(book.id);
        if (slot)
          writeBook(
            mesh,
            i,
            { ...slot, ...(slot.visible ? AT_REST : HIDDEN) },
            slot.height,
          );
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
    invalidate();
  }, [slots, books, reducedMotion, invalidate]);

  const walkTo = (target: FloorPoint, enter: number | null) => {
    const w = walker.current;
    const goal = canStand(grid, target) ? target : nearestOpen(grid, target);
    if (!goal) return;
    const path = findPath(grid, w, goal);
    if (!path) return;
    w.path = path;
    w.enter = enter;
    w.arrivedAt = null;
    invalidate();
  };

  const walkToCase = (index: number) => {
    const placement = layout.cases[index];
    const bookcase = cases[index];
    if (!placement || !bookcase || bookcase.bookIds.length === 0) return;
    walkTo(placement.front, index);
  };

  useEffect(() => {
    const target = window as ProbeWindow;
    const probe: HallProbe = {
      get firstFrameAt() {
        return firstFrame.current;
      },
      avatar: () => ({ x: walker.current.x, z: walker.current.z }),
      walking: () =>
        walker.current.path.length > 0 || walker.current.enter !== null,
      resorting: () => flight.current !== null || caseFlight.current !== null,
      yaw: () => orbit.current.yaw,
      projectCase: (key) => {
        const index = cases.findIndex((c) => c.key === key);
        const placement = layout.cases[index];
        if (!placement) return null;
        const point = new Vector3(
          placement.x,
          CASE_HEIGHT / 2,
          placement.z + CASE_DEPTH / 2,
        ).project(camera);
        const rect = gl.domElement.getBoundingClientRect();
        return {
          x: rect.left + ((point.x + 1) / 2) * rect.width,
          y: rect.top + ((1 - point.y) / 2) * rect.height,
        };
      },
    };
    target.__libraryHall = probe;
    return () => {
      if (target.__libraryHall === probe) delete target.__libraryHall;
    };
  }, [camera, cases, gl, layout, orbit]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const now = performance.now();
    let busy = false;
    if (firstFrame.current === null) {
      firstFrame.current = now;
      queueMicrotask(() => onFirstFrameRef.current?.());
    }

    // Re-sort flight.
    const mesh = bookMesh.current;
    const f = flight.current;
    if (mesh && f) {
      const elapsed = now - f.start;
      books.forEach((book, i) => {
        const from = f.from.get(book.id);
        const to = f.to.get(book.id);
        if (!from || !to) return;
        const t = flightProgress(elapsed, takeoffOrder(book.id));
        writeBook(mesh, i, flightPose(from, to, t), from.height);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (elapsed >= RESORT_MS) flight.current = null;
      busy = true;
    }

    const cm = caseMesh.current;
    const cf = caseFlight.current;
    if (cm && cf) {
      const elapsed = now - cf.start;
      poseCases(cm, cf.from, layout.cases, elapsed);
      if (elapsed >= CASE_SINK_START_MS + CASE_SINK_MS) {
        caseFlight.current = null;
        poseCases(cm, null, layout.cases, null);
      }
      busy = true;
    }

    // Q and E turn the view.
    const o = orbit.current;
    let turn = 0;
    for (const key of keys.current) turn += TURN_KEYS[key] ?? 0;
    if (turn !== 0) o.yaw += turn * KEY_TURN * dt;

    // Walking: keys steer relative to the view; otherwise follow the path.
    const w = walker.current;
    let step = 0;
    let input: FloorPoint = { x: 0, z: 0 };
    for (const key of keys.current) {
      const d = KEY_DIRECTIONS[key];
      if (d) input = { x: input.x + d.x, z: input.z + d.z };
    }
    const cos = Math.cos(o.yaw);
    const sin = Math.sin(o.yaw);
    const dir: FloorPoint = {
      x: input.x * cos + input.z * sin,
      z: -input.x * sin + input.z * cos,
    };
    const length = Math.hypot(dir.x, dir.z);
    if (length > 0) {
      w.path = [];
      w.enter = null;
      const reach = SPEED * dt;
      const nx = w.x + (dir.x / length) * reach;
      const nz = w.z + (dir.z / length) * reach;
      // Slide along walls and bookcases instead of stopping dead.
      if (canStand(grid, { x: nx, z: w.z })) w.x = nx;
      if (canStand(grid, { x: w.x, z: nz })) w.z = nz;
      w.heading +=
        shortestTurn(w.heading, Math.atan2(dir.x, dir.z)) *
        Math.min(1, TURN_RATE * dt);
      step = reach;
    } else if (w.path.length > 0) {
      const next = w.path[0] as FloorPoint;
      const dx = next.x - w.x;
      const dz = next.z - w.z;
      const distance = Math.hypot(dx, dz);
      const reach = SPEED * dt;
      if (distance <= reach) {
        w.x = next.x;
        w.z = next.z;
        w.path.shift();
        step = distance;
      } else {
        w.x += (dx / distance) * reach;
        w.z += (dz / distance) * reach;
        step = reach;
      }
      if (distance > 0.001)
        w.heading +=
          shortestTurn(w.heading, Math.atan2(dx, dz)) *
          Math.min(1, TURN_RATE * dt);
      if (w.path.length === 0 && w.enter !== null) w.arrivedAt = now;
    } else if (w.enter !== null) {
      // Turn to face the bookcase, then go in.
      w.heading +=
        shortestTurn(w.heading, Math.PI) * Math.min(1, TURN_RATE * dt);
      if (w.arrivedAt !== null && now - w.arrivedAt >= ENTER_PAUSE_MS) {
        const bookcase = cases[w.enter];
        w.enter = null;
        w.arrivedAt = null;
        if (bookcase) onEnterRef.current(bookcase);
      }
      busy = true;
    }
    const m = motion.current;
    m.phase += step * STRIDE_PER_METRE;
    const strideTarget = step > 0 ? 1 : 0;
    m.stride += (strideTarget - m.stride) * Math.min(1, 12 * dt);
    if (step > 0 || m.stride > 0.01) busy = true;
    else m.stride = 0;
    if (avatar.current) {
      avatar.current.position.set(w.x, 0, w.z);
      avatar.current.rotation.y = w.heading;
    }

    // Camera orbits the avatar at the reader's angle, kept inside the walls.
    const reach = o.distance * Math.cos(o.pitch);
    const room = layout.room;
    const goal = new Vector3(
      MathUtils.clamp(w.x + sin * reach, room.minX + 0.3, room.maxX - 0.3),
      o.distance * Math.sin(o.pitch),
      Math.max(w.z + cos * reach, room.minZ + 0.3),
    );
    const k =
      firstFrame.current === now ? 1 : 1 - Math.exp(-CAMERA_FOLLOW * dt);
    state.camera.position.lerp(goal, k);
    state.camera.lookAt(
      w.x - sin * LOOK_AHEAD,
      LOOK_HEIGHT,
      w.z - cos * LOOK_AHEAD,
    );
    // Name plates project with this frame's camera, not the one the last render left behind.
    state.camera.updateMatrixWorld();
    if (state.camera.position.distanceTo(goal) > 0.01) busy = true;

    // Name plates follow their bookcases on screen.
    const plates = labels.current?.children;
    if (plates) {
      const { width, height } = state.size;
      layout.cases.forEach((placement, i) => {
        const plate = plates[i] as HTMLElement | undefined;
        if (!plate) return;
        const p = new Vector3(
          placement.x,
          CASE_HEIGHT + 0.3,
          placement.z,
        ).project(state.camera);
        const behind = p.z > 1;
        plate.style.visibility = behind ? 'hidden' : 'visible';
        plate.style.transform = `translate(-50%, -100%) translate(${((p.x + 1) / 2) * width}px, ${((1 - p.y) / 2) * height}px)`;
      });
    }
    const boards = signs.current?.children;
    if (boards) {
      const { width, height } = state.size;
      layout.wings.forEach((wing, i) => {
        const board = boards[i] as HTMLElement | undefined;
        if (!board) return;
        const p = new Vector3(wing.sign.x, 1.6, wing.sign.z).project(
          state.camera,
        );
        board.style.visibility = p.z > 1 ? 'hidden' : 'visible';
        board.style.transform = `translate(-50%, -50%) translate(${((p.x + 1) / 2) * width}px, ${((1 - p.y) / 2) * height}px)`;
      });
    }

    if (busy || keys.current.size > 0) invalidate();
  });

  const room = layout.room;
  const roomWidth = room.maxX - room.minX;
  const roomDepth = room.maxZ - room.minZ;
  const roomX = (room.minX + room.maxX) / 2;
  const floorDepth = roomDepth + FLOOR_APRON;
  const floorZ = room.minZ + floorDepth / 2;
  if (floorMap) floorMap.repeat.set(roomWidth / 2.4, floorDepth / 2.4);
  const background = toColor(tokens.background);

  return (
    <>
      <color attach="background" args={[background]} />
      <fog attach="fog" args={[background, 20, 46]} />
      <hemisphereLight
        args={[toColor(palette.glass), toColor(palette.darkWood), 1.15]}
      />
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[5, 10, 7]}
        intensity={1.6}
        color={toColor(palette.lamp)}
      />
      <directionalLight position={[-6, 6, -4]} intensity={0.45} />
      <mesh
        rotation-x={-Math.PI / 2}
        position={[roomX, 0, floorZ]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (e.delta > DRAG_SLOP) return;
          walkTo({ x: e.point.x, z: e.point.z }, null);
        }}
      >
        <planeGeometry args={[roomWidth, floorDepth]} />
        <meshLambertMaterial
          map={floorMap}
          color={floorMap ? '#ffffff' : toColor(palette.floor)}
        />
      </mesh>
      <mesh geometry={decor.solid}>
        <meshLambertMaterial vertexColors />
      </mesh>
      <mesh geometry={decor.glow}>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </mesh>
      <instancedMesh
        ref={caseMesh}
        // Room for every case one grouping can need, and as many sinking out of the way.
        args={[caseGeo, undefined, CASE_CAPACITY * 2]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (e.delta > DRAG_SLOP) return;
          if (e.instanceId !== undefined) walkToCase(e.instanceId);
        }}
      >
        <meshLambertMaterial vertexColors color={toColor(palette.wood)} />
      </instancedMesh>
      <instancedMesh
        // The instance count is fixed at creation; a refresh with more books needs a new mesh.
        key={books.length}
        ref={bookMesh}
        args={[undefined, undefined, Math.max(1, books.length)]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (e.delta > DRAG_SLOP) return;
          const book =
            e.instanceId === undefined ? undefined : books[e.instanceId];
          const index = book ? caseOfBook.get(book.id) : undefined;
          if (index !== undefined) walkToCase(index);
        }}
      >
        <boxGeometry />
        <meshLambertMaterial />
      </instancedMesh>
      <group ref={avatar}>
        <Avatar motion={motion} />
      </group>
    </>
  );
}

const clampPitch = (pitch: number) =>
  MathUtils.clamp(pitch, PITCH_MIN, PITCH_MAX);
const clampDistance = (distance: number) =>
  MathUtils.clamp(distance, DISTANCE_MIN, DISTANCE_MAX);

export default function ThreeHall(props: ThreeHallProps) {
  const tokens = useTokens();
  const t = useLibraryT(HALL_NAMESPACE);
  const frame = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const signs = useRef<HTMLDivElement>(null);
  const keys = useRef(new Set<string>());
  const orbit = useRef<Orbit>({ ...DEFAULT_ORBIT });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  // Replaced with the scene's invalidate once the canvas mounts.
  const kick = useRef<() => void>(Function.prototype as () => void);
  const release = () => keys.current.clear();
  const turnBy = (radians: number) => {
    orbit.current.yaw += radians;
    kick.current();
  };

  // Pinch, or the wheel once the hall has focus, zooms. A wheel over an unfocused hall still
  // scrolls the page. React's wheel handler is passive, hence the listener.
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && document.activeElement !== element) return;
      event.preventDefault();
      const o = orbit.current;
      o.distance = clampDistance(o.distance * Math.exp(event.deltaY * 0.0015));
      kick.current();
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div
      ref={frame}
      data-hall-canvas
      // Focusable so WASD and the arrow keys steer without fighting the page's own shortcuts.
      tabIndex={0}
      aria-label={t('hall.canvas')}
      onKeyDown={(event) => {
        const key = event.key.toLowerCase();
        if (!(key in KEY_DIRECTIONS) && !(key in TURN_KEYS)) return;
        event.preventDefault();
        event.stopPropagation();
        keys.current.add(key);
        kick.current();
      }}
      onKeyUp={(event) => keys.current.delete(event.key.toLowerCase())}
      onBlur={release}
      // Dragging turns the view; a press that barely moves is still a click that walks.
      onPointerDown={(event) => {
        if (!(event.target instanceof HTMLCanvasElement)) return;
        drag.current = { x: event.clientX, y: event.clientY, moved: false };
      }}
      onPointerMove={(event) => {
        const d = drag.current;
        if (!d || event.buttons === 0) return;
        const dx = event.clientX - d.x;
        const dy = event.clientY - d.y;
        if (!d.moved && Math.hypot(dx, dy) < DRAG_SLOP) return;
        d.moved = true;
        d.x = event.clientX;
        d.y = event.clientY;
        const o = orbit.current;
        o.yaw -= dx * DRAG_YAW;
        o.pitch = clampPitch(o.pitch + dy * DRAG_PITCH);
        kick.current();
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      className="bg-muted focus-visible:ring-ring relative h-[min(70dvh,640px)] cursor-grab touch-pan-y overflow-hidden rounded-lg outline-none focus-visible:ring-2 active:cursor-grabbing lg:h-[min(78dvh,760px)]"
    >
      {tokens && (
        <Canvas
          frameloop="demand"
          dpr={[1, 2]}
          camera={{ fov: 45, near: 0.1, far: 120 }}
          aria-hidden
        >
          <HallScene
            {...props}
            tokens={tokens}
            labels={labels}
            signs={signs}
            keys={keys}
            orbit={orbit}
            kick={kick}
          />
        </Canvas>
      )}
      <div
        ref={labels}
        aria-hidden
        className="pointer-events-none absolute inset-0"
      >
        {props.layout.cases.map((placement, i) => {
          const bookcase = props.cases[i];
          return (
            <div
              key={`${placement.x},${placement.z}`}
              data-hall-label={bookcase?.key}
              className={cn(
                'bg-card/90 text-foreground absolute left-0 top-0 max-w-40 truncate rounded px-2 py-0.5 text-xs shadow-sm',
                !bookcase && 'hidden',
              )}
              style={{ visibility: 'hidden' }}
            >
              {bookcase ? (
                <>
                  {bookcase.label}{' '}
                  <span className="text-muted-foreground">
                    {bookcase.bookIds.length}
                  </span>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
      <div
        ref={signs}
        aria-hidden
        className="pointer-events-none absolute inset-0"
      >
        {props.wings.map((wing) => (
          <div
            key={wing.id}
            data-hall-sign={wing.id}
            className="bg-primary text-primary-foreground absolute left-0 top-0 whitespace-nowrap rounded px-2 py-0.5 text-sm font-semibold shadow"
            style={{ visibility: 'hidden' }}
          >
            {wing.label}
          </div>
        ))}
      </div>
      <div className="absolute bottom-2 right-2 flex gap-1">
        <ViewButton
          name="turn-left"
          label={t('hall.turnLeft')}
          onClick={() => turnBy(BUTTON_TURN)}
        >
          <RotateCcw aria-hidden className="size-4" />
        </ViewButton>
        <ViewButton
          name="turn-right"
          label={t('hall.turnRight')}
          onClick={() => turnBy(-BUTTON_TURN)}
        >
          <RotateCw aria-hidden className="size-4" />
        </ViewButton>
        <ViewButton
          name="reset"
          label={t('hall.resetView')}
          onClick={() => {
            orbit.current = { ...DEFAULT_ORBIT };
            kick.current();
          }}
        >
          <Locate aria-hidden className="size-4" />
        </ViewButton>
      </div>
    </div>
  );
}

function ViewButton({
  name,
  label,
  onClick,
  children,
}: {
  name: string;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-hall-view={name}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="bg-card/90 text-foreground hover:bg-card focus-visible:ring-ring flex size-9 cursor-pointer items-center justify-center rounded-md border shadow-sm outline-none focus-visible:ring-2"
    >
      {children}
    </button>
  );
}
