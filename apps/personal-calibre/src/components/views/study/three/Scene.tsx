'use client';

import { useFrame, useThree } from '@react-three/fiber';
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BoxGeometry,
  type InstancedMesh,
  MathUtils,
  Matrix4,
  type Mesh,
  Object3D,
  type PerspectiveCamera,
  Vector3,
} from 'three';

import type { ScrubHitTest } from '@/components/views/study/useScrub';
import {
  BOOK_GAP,
  cameraBounds,
  type CameraState,
  type Carry,
  clampCameraY,
  focusTargetY,
  FRONT_Z,
  type NdcPoint,
  nextCarry,
  type PlacedBook,
  projectBox,
  ROW_H,
  type ScreenRect,
  screenRectOf,
  type StudyLayout,
  type Vec3,
  wheelPan,
} from '@/lib';

import type { RowAtlas } from './atlas';
import type { CoverCache } from './covers';
import type { StudyKit } from './kit';
import { PulledBook, type ScrubPointer } from './PulledBook';
import { ShelfRow } from './ShelfRow';
import { mixRgb, toColor, type Tokens } from './tokens';

export type BookProjector = (
  bookId: number,
  face: 'box' | 'front',
) => ScreenRect | null;

export interface ProjectedLabel {
  shelfKey: string;
  text: string;
  count: number;
  continued: boolean;
  left: number;
  top: number;
  width: number;
}

export interface SceneProps {
  layout: StudyLayout;
  tokens: Tokens;
  kit: StudyKit;
  focusId: number | null;
  pulledId: number | null;
  scrubbing: boolean;
  hitTester: RefObject<ScrubHitTest | null>;
  pointer: RefObject<ScrubPointer>;
  selected: ReadonlySet<number>;
  reducedMotion: boolean;
  pxPerUnit: number;
  atlases: ReadonlyMap<number, RowAtlas>;
  covers: CoverCache;
  projector: RefObject<BookProjector | null>;
  onPick: (bookId: number) => void;
  onPulled: (bookId: number | null) => void;
  onFloating: (bookId: number | null) => void;
  onCamera: (state: CameraState) => void;
  onFocusRect: (rect: ScreenRect | null) => void;
  onLabels: (labels: readonly ProjectedLabel[]) => void;
}

const BOARD_MIX = 0.16;
const PANEL_Z = -0.7;
const CAMERA_TILT = 0.25;
const CAMERA_RATE = 10;
const CAMERA_EPSILON = 0.0005;
const AMBIENT = 1.6;
const SUN = { position: [3, 6, 8] as const, intensity: 1.4 };
const LINE_PX = 16;
const PLACE = new Object3D();
const CORNER = new Vector3();
const VIEW_PROJECTION = new Matrix4();
const OVERLAY_PRIORITY = 0.5;
const RECT_EPSILON = 0.25;
const NO_CARRY: Carry<PlacedBook> = { items: [null, null], active: 0 };
const sameBook = (a: PlacedBook, b: PlacedBook) => a.book.id === b.book.id;

function boxCorners(matrix: Matrix4): Vec3[] {
  const corners: Vec3[] = [];
  for (const x of [-0.5, 0.5]) {
    for (const y of [-0.5, 0.5]) {
      for (const z of [-0.5, 0.5]) {
        CORNER.set(x, y, z).applyMatrix4(matrix);
        corners.push([CORNER.x, CORNER.y, CORNER.z]);
      }
    }
  }
  return corners;
}

function placedMatrix(placed: PlacedBook): Matrix4 {
  PLACE.position.set(placed.x, placed.y, FRONT_Z - placed.d / 2);
  PLACE.rotation.set(0, 0, 0);
  PLACE.scale.set(placed.t, placed.h, placed.d);
  PLACE.updateMatrix();
  return PLACE.matrix;
}

function sameRect(a: ScreenRect | null, b: ScreenRect | null): boolean {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.left - b.left) < RECT_EPSILON &&
    Math.abs(a.top - b.top) < RECT_EPSILON &&
    Math.abs(a.width - b.width) < RECT_EPSILON &&
    Math.abs(a.height - b.height) < RECT_EPSILON
  );
}

function rowsOf(layout: StudyLayout): PlacedBook[][] {
  const rows: PlacedBook[][] = Array.from({ length: layout.rows }, () => []);
  for (const placed of layout.books) rows[placed.row]?.push(placed);
  return rows;
}

export function Scene({
  layout,
  tokens,
  kit,
  focusId,
  pulledId: pullId,
  scrubbing,
  hitTester,
  pointer,
  selected,
  reducedMotion,
  pxPerUnit,
  atlases,
  covers,
  projector,
  onPick,
  onPulled,
  onFloating,
  onCamera,
  onFocusRect,
  onLabels,
}: SceneProps) {
  const { camera, size, gl, invalidate } = useThree();
  const boards = useRef<InstancedMesh>(null);
  const carrierA = useRef<Mesh>(null);
  const carrierB = useRef<Mesh>(null);
  const boardGeometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const rows = useMemo(() => rowsOf(layout), [layout]);
  const byId = useMemo(
    () => new Map(layout.books.map((placed) => [placed.book.id, placed])),
    [layout],
  );
  const focused = focusId === null ? undefined : byId.get(focusId);
  const pulling = pullId === null ? undefined : byId.get(pullId);
  const still = reducedMotion && !scrubbing;
  const pulled = still ? null : (pulling ?? null);
  const pulledId = pulled?.book.id ?? null;
  const highlightId = still ? (pulling?.book.id ?? null) : null;
  const [carry, setCarry] = useState(NO_CARRY);
  if (carry.items[carry.active] !== pulled) {
    setCarry(nextCarry(carry, pulled, sameBook, scrubbing && !reducedMotion));
  }
  const leaving = carry.items[carry.active === 0 ? 1 : 0] ?? null;
  const pulledMesh = carry.active === 0 ? carrierA : carrierB;
  const onHome = useCallback((bookId: number) => {
    setCarry((current) => {
      const other = current.active === 0 ? 1 : 0;
      if (current.items[other]?.book.id !== bookId) return current;
      const items: Carry<PlacedBook>['items'] =
        other === 0 ? [null, current.items[1]] : [current.items[0], null];
      return { items, active: current.active };
    });
  }, []);
  const floatingId = scrubbing ? pulledId : null;

  const panel = useMemo(
    () => kit.materials.surface(toColor(tokens.muted)),
    [kit, tokens],
  );
  const board = useMemo(
    () =>
      kit.materials.surface(
        toColor(mixRgb(tokens.foreground, tokens.muted, BOARD_MIX)),
      ),
    [kit, tokens],
  );
  useEffect(() => () => boardGeometry.dispose(), [boardGeometry]);
  useEffect(() => () => panel.dispose(), [panel]);
  useEffect(() => () => board.dispose(), [board]);

  useEffect(() => onPulled(pulledId), [pulledId, onPulled]);
  useEffect(() => onFloating(floatingId), [floatingId, onFloating]);
  useLayoutEffect(() => {
    pointer.current.invalidate = invalidate;
  }, [pointer, invalidate]);

  useLayoutEffect(() => {
    const mesh = boards.current;
    if (!mesh) return;
    layout.boards.forEach((b, i) => {
      PLACE.position.set(b.x, b.y, b.z);
      PLACE.scale.set(b.sx, b.sy, b.sz);
      PLACE.updateMatrix();
      mesh.setMatrixAt(i, PLACE.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    invalidate();
  }, [layout, invalidate]);

  const viewUnits = size.height / pxPerUnit;
  const distance =
    viewUnits /
    (2 * Math.tan(MathUtils.degToRad((camera as PerspectiveCamera).fov / 2)));
  const bounds = useMemo(
    () => cameraBounds(layout, viewUnits),
    [layout, viewUnits],
  );
  const boundsRef = useRef(bounds);
  const cameraY = useRef<number | null>(null);
  const targetY = useRef(0);
  const reported = useRef<number | null>(null);

  const scrubbingRef = useRef(scrubbing);
  scrubbingRef.current = scrubbing;

  useLayoutEffect(() => {
    boundsRef.current = bounds;
    if (!scrubbingRef.current || cameraY.current === null) {
      targetY.current = clampCameraY(
        focusTargetY(layout, focused?.row ?? 0),
        bounds,
      );
    }
    if (cameraY.current === null || reducedMotion) {
      cameraY.current = targetY.current;
    } else {
      cameraY.current = clampCameraY(cameraY.current, bounds);
    }
    reported.current = null;
    invalidate();
  }, [layout, focusId, focused?.row, bounds, reducedMotion, invalidate]);

  useFrame((_, delta) => {
    const target = targetY.current;
    let y = cameraY.current ?? target;
    const k = reducedMotion ? 1 : 1 - Math.exp(-delta * CAMERA_RATE);
    y += (target - y) * k;
    if (Math.abs(target - y) < CAMERA_EPSILON) y = target;
    cameraY.current = y;
    camera.position.set(layout.width / 2, y + CAMERA_TILT, distance);
    camera.lookAt(layout.width / 2, y, 0);
    if (y !== target) invalidate();
    if (reported.current !== y) {
      reported.current = y;
      onCamera({ y, bounds: boundsRef.current });
    }
  });

  const pan = useCallback(
    (deltaPx: number) => {
      const from = cameraY.current ?? targetY.current;
      const next = wheelPan(from, deltaPx, pxPerUnit, boundsRef.current);
      if (!next.consumed) return false;
      cameraY.current = next.y;
      targetY.current = next.y;
      invalidate();
      return true;
    },
    [pxPerUnit, invalidate],
  );

  useEffect(() => {
    const canvas = gl.domElement;
    const onWheel = (event: WheelEvent) => {
      const unit =
        event.deltaMode === 1
          ? LINE_PX
          : event.deltaMode === 2
            ? canvas.clientHeight
            : 1;
      if (pan(event.deltaY * unit)) event.preventDefault();
    };
    let lastTouchY: number | null = null;
    const onTouchStart = (event: TouchEvent) => {
      lastTouchY =
        event.touches.length === 1 ? (event.touches[0]?.clientY ?? null) : null;
    };
    const onTouchMove = (event: TouchEvent) => {
      const touchY = event.touches[0]?.clientY;
      if (lastTouchY === null || touchY === undefined) return;
      if (pan(lastTouchY - touchY)) event.preventDefault();
      lastTouchY = touchY;
    };
    const onTouchEnd = () => {
      lastTouchY = null;
    };
    // React registers onWheel and onTouchMove as passive, so they could not prevent the page scroll.
    const active = { passive: false };
    canvas.addEventListener('wheel', onWheel, active);
    canvas.addEventListener('touchstart', onTouchStart, active);
    canvas.addEventListener('touchmove', onTouchMove, active);
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchEnd);
    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [gl, pan]);

  const onHover = useCallback(
    (hovering: boolean) => {
      gl.domElement.style.cursor = hovering ? 'pointer' : '';
    },
    [gl],
  );
  useEffect(() => () => onHover(false), [onHover]);

  useEffect(() => {
    projector.current = (bookId, face) => {
      const placed = byId.get(bookId);
      if (!placed) return null;
      camera.updateMatrixWorld();
      const mesh = pulledMesh.current;
      let matrix = PLACE.matrix;
      if (bookId === pulledId && mesh) {
        mesh.updateMatrixWorld();
        matrix = mesh.matrixWorld;
      } else {
        matrix = placedMatrix(placed);
      }
      const points: NdcPoint[] = [];
      for (const x of [-0.5, 0.5]) {
        for (const y of [-0.5, 0.5]) {
          for (const z of face === 'front' ? [0.5] : [-0.5, 0.5]) {
            CORNER.set(x, y, z).applyMatrix4(matrix).project(camera);
            points.push([CORNER.x, CORNER.y]);
          }
        }
      }
      return screenRectOf(points, gl.domElement.getBoundingClientRect());
    };
    return () => {
      projector.current = null;
    };
  }, [projector, byId, pulledId, pulledMesh, camera, gl]);

  useEffect(() => {
    const toScreen = (x: number, y: number, viewport: DOMRect) => {
      CORNER.set(x, y, FRONT_Z).project(camera);
      return {
        x: viewport.left + ((CORNER.x + 1) / 2) * viewport.width,
        y: viewport.top + ((1 - CORNER.y) / 2) * viewport.height,
      };
    };
    hitTester.current = (clientX, clientY) => {
      camera.updateMatrixWorld();
      const viewport = gl.domElement.getBoundingClientRect();
      const row = rows.findIndex((_, r) => {
        const top = toScreen(0, (1 - r) * ROW_H, viewport).y;
        const bottom = toScreen(0, -r * ROW_H, viewport).y;
        return clientY >= top && clientY < bottom;
      });
      const hit = rows[row]?.find((placed) => {
        const half = placed.t / 2 + BOOK_GAP / 2;
        const left = toScreen(placed.x - half, 0, viewport).x;
        const right = toScreen(placed.x + half, 0, viewport).x;
        return clientX >= left && clientX < right;
      });
      return hit?.book.id ?? null;
    };
    return () => {
      hitTester.current = null;
    };
  }, [hitTester, rows, camera, gl]);

  const reportedRect = useRef<ScreenRect | null | undefined>(undefined);
  const reportedLabels = useRef('');
  useLayoutEffect(() => {
    reportedRect.current = undefined;
    reportedLabels.current = '';
    invalidate();
  }, [layout, onFocusRect, onLabels, invalidate]);

  useFrame(() => {
    camera.updateMatrixWorld();
    VIEW_PROJECTION.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    const viewport = { width: size.width, height: size.height };
    let rect: ScreenRect | null = null;
    if (focused) {
      const mesh = pulledMesh.current;
      let matrix: Matrix4;
      if (focused.book.id === pulledId && mesh) {
        mesh.updateMatrixWorld();
        matrix = mesh.matrixWorld;
      } else {
        matrix = placedMatrix(focused);
      }
      rect = projectBox(boxCorners(matrix), VIEW_PROJECTION.elements, viewport);
    }
    if (
      reportedRect.current === undefined ||
      !sameRect(rect, reportedRect.current)
    ) {
      reportedRect.current = rect;
      onFocusRect(rect);
    }
    const labelsKey = `${cameraY.current}:${size.width}:${size.height}`;
    if (labelsKey !== reportedLabels.current) {
      reportedLabels.current = labelsKey;
      onLabels(
        layout.labels.map((label): ProjectedLabel => {
          CORNER.set(label.x + label.width, label.top, FRONT_Z).applyMatrix4(
            VIEW_PROJECTION,
          );
          const right = ((CORNER.x + 1) / 2) * size.width;
          CORNER.set(label.x, label.top, FRONT_Z).applyMatrix4(VIEW_PROJECTION);
          const left = ((CORNER.x + 1) / 2) * size.width;
          return {
            shelfKey: label.shelfKey,
            text: label.text,
            count: label.count,
            continued: label.continued,
            left,
            top: ((1 - CORNER.y) / 2) * size.height,
            width: right - left,
          };
        }),
      );
    }
  }, OVERLAY_PRIORITY);

  const caseHeight = layout.rows * ROW_H;
  return (
    <>
      <ambientLight intensity={AMBIENT} />
      <directionalLight position={SUN.position} intensity={SUN.intensity} />
      <mesh
        material={panel}
        position={[layout.width / 2, ROW_H - caseHeight / 2, PANEL_Z]}
      >
        <planeGeometry args={[layout.width + 0.6, caseHeight + 0.2]} />
      </mesh>
      <instancedMesh
        key={`boards-${layout.boards.length}`}
        ref={boards}
        args={[boardGeometry, board, layout.boards.length]}
      />
      {rows.map((books, row) => (
        <ShelfRow
          key={row}
          books={books}
          atlas={atlases.get(row)}
          kit={kit}
          tokens={tokens}
          selected={selected}
          pulledId={pulledId}
          leavingId={leaving?.book.id ?? null}
          highlightId={highlightId}
          onPick={onPick}
          onHover={onHover}
        />
      ))}
      {([0, 1] as const).map((slot) => {
        const book = carry.items[slot] ?? null;
        return (
          <PulledBook
            key={slot}
            book={book}
            mode={slot !== carry.active ? 'home' : scrubbing ? 'float' : 'pull'}
            instant={reducedMotion}
            pointer={pointer}
            pxPerUnit={pxPerUnit}
            onHome={onHome}
            atlas={book ? atlases.get(book.row) : undefined}
            kit={kit}
            tokens={tokens}
            covers={covers}
            meshRef={slot === 0 ? carrierA : carrierB}
            onPick={onPick}
            onHover={onHover}
          />
        );
      })}
    </>
  );
}
