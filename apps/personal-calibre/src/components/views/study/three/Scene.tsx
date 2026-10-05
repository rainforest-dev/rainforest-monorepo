'use client';

import { useFrame, useThree } from '@react-three/fiber';
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
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

import {
  cameraBounds,
  type CameraState,
  clampCameraY,
  focusTargetY,
  FRONT_Z,
  type NdcPoint,
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
import { PulledBook } from './PulledBook';
import { ShelfRow } from './ShelfRow';
import { mixRgb, toColor, type Tokens } from './tokens';

export type BookProjector = (bookId: number) => ScreenRect | null;

export interface ProjectedLabel {
  shelfKey: string;
  text: string;
  count: number;
  continued: boolean;
  left: number;
  top: number;
}

export interface SceneProps {
  layout: StudyLayout;
  tokens: Tokens;
  kit: StudyKit;
  focusId: number | null;
  selected: ReadonlySet<number>;
  reducedMotion: boolean;
  pxPerUnit: number;
  atlases: ReadonlyMap<number, RowAtlas>;
  covers: CoverCache;
  projector: RefObject<BookProjector | null>;
  onPick: (bookId: number) => void;
  onPulled: (bookId: number | null) => void;
  onCamera: (state: CameraState) => void;
  onFocusRect: (rect: ScreenRect | null) => void;
  onPulledRect: (rect: ScreenRect | null) => void;
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
  selected,
  reducedMotion,
  pxPerUnit,
  atlases,
  covers,
  projector,
  onPick,
  onPulled,
  onCamera,
  onFocusRect,
  onPulledRect,
  onLabels,
}: SceneProps) {
  const { camera, size, gl, invalidate } = useThree();
  const boards = useRef<InstancedMesh>(null);
  const pulledMesh = useRef<Mesh>(null);
  const boardGeometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const rows = useMemo(() => rowsOf(layout), [layout]);
  const byId = useMemo(
    () => new Map(layout.books.map((placed) => [placed.book.id, placed])),
    [layout],
  );
  const focused = focusId === null ? undefined : byId.get(focusId);
  const pulled = reducedMotion ? null : (focused ?? null);
  const pulledId = pulled?.book.id ?? null;
  const highlightId = reducedMotion ? (focused?.book.id ?? null) : null;

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

  useLayoutEffect(() => {
    boundsRef.current = bounds;
    targetY.current = clampCameraY(
      focusTargetY(layout, focused?.row ?? 0),
      bounds,
    );
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
    projector.current = (bookId) => {
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
          for (const z of [-0.5, 0.5]) {
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
  }, [projector, byId, pulledId, camera, gl]);

  const reportedRect = useRef<ScreenRect | null | undefined>(undefined);
  const reportedPulled = useRef<ScreenRect | null | undefined>(undefined);
  const reportedLabels = useRef('');
  useLayoutEffect(() => {
    reportedRect.current = undefined;
    reportedPulled.current = undefined;
    reportedLabels.current = '';
    invalidate();
  }, [layout, onFocusRect, onPulledRect, onLabels, invalidate]);

  useFrame(() => {
    camera.updateMatrixWorld();
    VIEW_PROJECTION.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    const viewport = { width: size.width, height: size.height };
    let rect: ScreenRect | null = null;
    let pulledRect: ScreenRect | null = null;
    if (focused) {
      const mesh = pulledMesh.current;
      const isPulled = focused.book.id === pulledId && mesh !== null;
      let matrix: Matrix4;
      if (isPulled) {
        mesh.updateMatrixWorld();
        matrix = mesh.matrixWorld;
      } else {
        matrix = placedMatrix(focused);
      }
      rect = projectBox(boxCorners(matrix), VIEW_PROJECTION.elements, viewport);
      if (isPulled) pulledRect = rect;
    }
    if (
      reportedPulled.current === undefined ||
      !sameRect(pulledRect, reportedPulled.current)
    ) {
      reportedPulled.current = pulledRect;
      onPulledRect(pulledRect);
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
          CORNER.set(label.x, label.top, FRONT_Z).applyMatrix4(VIEW_PROJECTION);
          return {
            shelfKey: label.shelfKey,
            text: label.text,
            count: label.count,
            continued: label.continued,
            left: ((CORNER.x + 1) / 2) * size.width,
            top: ((1 - CORNER.y) / 2) * size.height,
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
          highlightId={highlightId}
          onPick={onPick}
          onHover={onHover}
        />
      ))}
      <PulledBook
        book={pulled}
        atlas={pulled ? atlases.get(pulled.row) : undefined}
        width={layout.width}
        kit={kit}
        tokens={tokens}
        covers={covers}
        meshRef={pulledMesh}
        onPick={onPick}
        onHover={onHover}
      />
    </>
  );
}
