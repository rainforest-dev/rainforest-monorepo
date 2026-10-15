'use client';

import {
  Canvas,
  type ThreeEvent,
  useFrame,
  useThree,
} from '@react-three/fiber';
import {
  type RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import {
  BoxGeometry,
  type BufferGeometry,
  type Group,
  type InstancedMesh,
  Object3D,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import {
  mixRgb,
  type Rgb,
  toColor,
  type Tokens,
  useTokens,
} from '@/components/views/study/three/tokens';
import {
  type Bookcase,
  buildGrid,
  canStand,
  CASE_DEPTH,
  CASE_HEIGHT,
  CASE_SHELVES,
  CASE_WIDTH,
  cn,
  findPath,
  flightPose,
  flightProgress,
  type FloorPoint,
  type HallBook,
  type HallLayout,
  nearestOpen,
  placeBooks,
  RESORT_MS,
  SHELF_PITCH,
  type Slot,
  spineTone,
  takeoffOrder,
} from '@/lib';

import { Avatar, type AvatarMotion } from './Avatar';

export interface ThreeHallProps {
  books: readonly HallBook[];
  cases: readonly Bookcase[];
  layout: HallLayout;
  /** The bookcase to stand in front of on arrival, after coming back from the Study. */
  startKey: string | null;
  reducedMotion: boolean;
  onEnter: (bookcase: Bookcase) => void;
}

const SPEED = 2.4;
const TURN_RATE = 10;
const STRIDE_PER_METRE = 4.2;
/** A beat at the bookcase before the Study opens, so the arrival reads as arriving. */
const ENTER_PAUSE_MS = 280;
const CAMERA_OFFSET = new Vector3(0, 4.4, 6.2);
const CAMERA_LOOK = new Vector3(0, 0.9, -1.6);
const CAMERA_FOLLOW = 4;
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
  /** Client coordinates of a bookcase's middle shelf, for clicking it in tests. */
  projectCase: (key: string) => { x: number; y: number } | null;
}

type ProbeWindow = Window & { __calibreHall?: HallProbe };

function caseGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const add = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
  ) => parts.push(new BoxGeometry(w, h, d).translate(x, y, z));
  const half = CASE_WIDTH / 2;
  add(
    CASE_WIDTH,
    CASE_HEIGHT,
    0.03,
    0,
    CASE_HEIGHT / 2,
    -CASE_DEPTH / 2 + 0.015,
  );
  add(0.05, CASE_HEIGHT, CASE_DEPTH, -half + 0.025, CASE_HEIGHT / 2, 0);
  add(0.05, CASE_HEIGHT, CASE_DEPTH, half - 0.025, CASE_HEIGHT / 2, 0);
  add(CASE_WIDTH, 0.05, CASE_DEPTH, 0, CASE_HEIGHT - 0.025, 0);
  for (let level = 0; level < CASE_SHELVES; level++) {
    add(CASE_WIDTH, 0.03, CASE_DEPTH, 0, 0.105 + level * SHELF_PITCH, 0);
  }
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  if (!merged) throw new Error('bookcase geometry did not merge');
  return merged;
}

function spineRgb(tokens: Tokens, id: number): Rgb {
  return mixRgb(tokens[`chart-${spineTone(id)}`], tokens.muted, 0.6);
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

function shortestTurn(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

interface SceneProps extends ThreeHallProps {
  tokens: Tokens;
  labels: RefObject<HTMLDivElement | null>;
  keys: RefObject<Set<string>>;
  /** Set to the scene's invalidate, so a key press can wake the on-demand render loop. */
  kick: RefObject<() => void>;
}

function HallScene({
  books,
  cases,
  layout,
  startKey,
  reducedMotion,
  onEnter,
  tokens,
  labels,
  keys,
  kick,
}: SceneProps) {
  const invalidate = useThree((s) => s.invalidate);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const grid = useMemo(() => buildGrid(layout), [layout]);
  const startAt = useRef(
    layout.cases[cases.findIndex((c) => c.key === startKey)]?.front ??
      layout.spawn,
  );
  const walker = useRef({
    x: startAt.current.x,
    z: startAt.current.z,
    heading: Math.PI,
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

  useEffect(() => {
    onEnterRef.current = onEnter;
  }, [onEnter]);
  useEffect(() => {
    kick.current = invalidate;
  }, [kick, invalidate]);
  useEffect(() => () => caseGeo.dispose(), [caseGeo]);

  useLayoutEffect(() => {
    const mesh = bookMesh.current;
    if (!mesh) return;
    books.forEach((book, i) =>
      mesh.setColorAt(i, toColor(spineRgb(tokens, book.id))),
    );
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    invalidate();
  }, [books, tokens, invalidate]);

  useLayoutEffect(() => {
    const mesh = caseMesh.current;
    if (!mesh) return;
    layout.cases.forEach((placement, i) => {
      scratch.position.set(placement.x, 0, placement.z);
      scratch.rotation.set(0, 0, 0);
      scratch.scale.set(1, 1, 1);
      scratch.updateMatrix();
      mesh.setMatrixAt(i, scratch.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    invalidate();
  }, [layout, invalidate]);

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
      resorting: () => flight.current !== null,
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
    target.__calibreHall = probe;
    return () => {
      if (target.__calibreHall === probe) delete target.__calibreHall;
    };
  }, [camera, cases, gl, layout]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const now = performance.now();
    let busy = false;
    if (firstFrame.current === null) firstFrame.current = now;

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

    // Walking: keys steer directly; otherwise follow the path.
    const w = walker.current;
    let step = 0;
    let dir: FloorPoint = { x: 0, z: 0 };
    for (const key of keys.current) {
      const d = KEY_DIRECTIONS[key];
      if (d) dir = { x: dir.x + d.x, z: dir.z + d.z };
    }
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

    // Camera follows from behind and above.
    const goal = new Vector3(w.x, 0, w.z).add(CAMERA_OFFSET);
    const k =
      firstFrame.current === now ? 1 : 1 - Math.exp(-CAMERA_FOLLOW * dt);
    state.camera.position.lerp(goal, k);
    state.camera.lookAt(new Vector3(w.x, 0, w.z).add(CAMERA_LOOK));
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
          CASE_HEIGHT + 0.22,
          placement.z,
        ).project(state.camera);
        const behind = p.z > 1;
        plate.style.visibility = behind ? 'hidden' : 'visible';
        plate.style.transform = `translate(-50%, -100%) translate(${((p.x + 1) / 2) * width}px, ${((1 - p.y) / 2) * height}px)`;
      });
    }

    if (busy || keys.current.size > 0) invalidate();
  });

  const room = layout.room;
  const roomWidth = room.maxX - room.minX;
  const roomDepth = room.maxZ - room.minZ;
  const roomX = (room.minX + room.maxX) / 2;
  const roomZ = (room.minZ + room.maxZ) / 2;
  const floor = toColor(mixRgb(tokens.muted, tokens.background, 0.7));
  const wall = toColor(mixRgb(tokens.muted, tokens.card, 0.85));
  const wood = toColor(mixRgb(tokens['chart-4'], tokens.foreground, 0.35));

  return (
    <>
      <color attach="background" args={[toColor(tokens.background)]} />
      <ambientLight intensity={1.6} />
      <directionalLight position={[4, 9, 6]} intensity={1.8} />
      <mesh
        rotation-x={-Math.PI / 2}
        position={[roomX, 0, roomZ]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          walkTo({ x: e.point.x, z: e.point.z }, null);
        }}
      >
        <planeGeometry args={[roomWidth, roomDepth]} />
        <meshLambertMaterial color={floor} />
      </mesh>
      <mesh position={[roomX, 1.6, room.minZ - 0.1]}>
        <boxGeometry args={[roomWidth + 0.4, 3.2, 0.2]} />
        <meshLambertMaterial color={wall} />
      </mesh>
      {[room.minX - 0.1, room.maxX + 0.1].map((x) => (
        <mesh key={x} position={[x, 1.6, roomZ]}>
          <boxGeometry args={[0.2, 3.2, roomDepth]} />
          <meshLambertMaterial color={wall} />
        </mesh>
      ))}
      <instancedMesh
        ref={caseMesh}
        args={[caseGeo, undefined, layout.cases.length]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (e.instanceId !== undefined) walkToCase(e.instanceId);
        }}
      >
        <meshLambertMaterial color={wood} />
      </instancedMesh>
      <instancedMesh
        ref={bookMesh}
        args={[undefined, undefined, Math.max(1, books.length)]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
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

export default function ThreeHall(props: ThreeHallProps) {
  const tokens = useTokens();
  const labels = useRef<HTMLDivElement>(null);
  const keys = useRef(new Set<string>());
  // Replaced with the scene's invalidate once the canvas mounts.
  const kick = useRef<() => void>(Function.prototype as () => void);

  const release = () => keys.current.clear();

  return (
    <div
      data-hall-canvas
      // Focusable so WASD and the arrow keys steer without fighting the page's own shortcuts.
      tabIndex={0}
      aria-label="Library hall. Use W A S D or the arrow keys to walk."
      onKeyDown={(event) => {
        const key = event.key.toLowerCase();
        if (!(key in KEY_DIRECTIONS)) return;
        event.preventDefault();
        event.stopPropagation();
        keys.current.add(key);
        kick.current();
      }}
      onKeyUp={(event) => keys.current.delete(event.key.toLowerCase())}
      onBlur={release}
      className="bg-muted focus-visible:ring-ring relative h-[min(70dvh,640px)] cursor-pointer overflow-hidden rounded-lg outline-none focus-visible:ring-2 lg:h-[min(78dvh,760px)]"
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
            keys={keys}
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
    </div>
  );
}
