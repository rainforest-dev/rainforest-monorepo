'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useSearchParams } from 'next/navigation';
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
  InstancedBufferAttribute,
  type InstancedMesh,
  MathUtils,
  Object3D,
  PCFShadowMap,
  type PerspectiveCamera,
} from 'three';

import type { StudyRendererProps } from '@/components/views/study/StudyListbox';
import { useIsDesktop } from '@/hooks';
import {
  FRONT_Z,
  isDebug,
  layoutShelves,
  ROW_H,
  type StudyBackend,
  type StudyLayout,
  type ThreeRenderer,
} from '@/lib';

import type { KitCanvasProps, StudyGl, StudyKit } from './kit';
import { publishProbe, type StudyProbe } from './probe';
import { mixRgb, readTokens, toColor, type Tokens } from './tokens';

type ThreeBackend = Exclude<StudyBackend, 'css'>;

export interface ThreeStudyProps extends StudyRendererProps {
  renderer: ThreeRenderer;
  onBackend: (backend: ThreeBackend) => void;
  onStartFailed: (error: unknown) => void;
}

const SIDE_MIX = 0.45;
const BOARD_MIX = 0.16;
const PANEL_Z = -0.7;
const PLACE = new Object3D();
const CAMERA = { fov: 30, near: 0.1, far: 200 };
const DPR: [number, number] = [1, 2];
// fiber sets PCFSoftShadowMap for boolean `shadows`, which WebGPURenderer warns about on every render.
const SHADOWS = { enabled: false, type: PCFShadowMap };

function loadKit(renderer: ThreeRenderer): Promise<StudyKit> {
  switch (renderer) {
    case 'three-tsl':
      return import('./kitTsl').then((module) => module.kit);
    case 'three-glsl':
      return Promise.reject(new Error('three-glsl is not available yet'));
  }
}

function useWidth(ref: RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

function FrameDriver({ onFrame }: { onFrame: (start: number) => void }) {
  useFrame(({ gl, scene, camera }) => {
    const start = performance.now();
    gl.render(scene, camera);
    onFrame(start);
  }, 1);
  return null;
}

interface ShelvesProps {
  layout: StudyLayout;
  tokens: Tokens;
  kit: StudyKit;
  focusRow: number;
  pxPerUnit: number;
}

function Shelves({ layout, tokens, kit, focusRow, pxPerUnit }: ShelvesProps) {
  const { camera, size, invalidate } = useThree();
  const books = useRef<InstancedMesh>(null);
  const boards = useRef<InstancedMesh>(null);
  const bookGeometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const boardGeometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const spine = useMemo(() => kit.materials.spine(), [kit]);
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

  useEffect(
    () => () => {
      bookGeometry.dispose();
      boardGeometry.dispose();
    },
    [bookGeometry, boardGeometry],
  );
  useEffect(() => () => spine.dispose(), [spine]);
  useEffect(() => () => panel.dispose(), [panel]);
  useEffect(() => () => board.dispose(), [board]);

  useLayoutEffect(() => {
    const mesh = books.current;
    if (!mesh) return;
    const sides = new Float32Array(layout.books.length * 3);
    layout.books.forEach((placed, i) => {
      PLACE.position.set(placed.x, placed.y, FRONT_Z - placed.d / 2);
      PLACE.scale.set(placed.t, placed.h, placed.d);
      PLACE.updateMatrix();
      mesh.setMatrixAt(i, PLACE.matrix);
      const tone = tokens[`chart-${placed.book.tone}`];
      toColor(mixRgb(tone, tokens.muted, SIDE_MIX)).toArray(sides, i * 3);
    });
    bookGeometry.setAttribute('aCol', new InstancedBufferAttribute(sides, 3));
    mesh.instanceMatrix.needsUpdate = true;
    invalidate();
  }, [layout, tokens, bookGeometry, invalidate]);

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
    invalidate();
  }, [layout, invalidate]);

  useLayoutEffect(() => {
    const fov = (camera as PerspectiveCamera).fov;
    const distance =
      size.height / pxPerUnit / (2 * Math.tan(MathUtils.degToRad(fov / 2)));
    const y = -focusRow * ROW_H + ROW_H * 0.5;
    camera.position.set(layout.width / 2, y + 0.25, distance);
    camera.lookAt(layout.width / 2, y, 0);
    invalidate();
  }, [camera, size.height, pxPerUnit, layout.width, focusRow, invalidate]);

  const caseHeight = layout.rows * ROW_H;
  return (
    <>
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
      <instancedMesh
        key={`books-${layout.books.length}`}
        ref={books}
        args={[bookGeometry, spine, layout.books.length]}
      />
    </>
  );
}

export default function ThreeStudy({
  renderer,
  model,
  focusId,
  onBackend,
  onStartFailed,
}: ThreeStudyProps) {
  const debug = isDebug(useSearchParams());
  const pxPerUnit = useIsDesktop() ? 100 : 80;
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap);
  const [kit, setKit] = useState<StudyKit | null>(null);
  const [tokens] = useState(readTokens);
  const [backend, setBackend] = useState<ThreeBackend | null>(null);
  const gl = useRef<StudyGl | null>(null);
  const kitRef = useRef<StudyKit | null>(null);
  const lastFrame = useRef({ drawCalls: 0, triangles: 0 });
  const probe = useRef<StudyProbe>({
    canvasMountAt: 0,
    kitLoadMs: 0,
    initMs: 0,
    firstFrameAt: null,
    firstRenderMs: null,
    pulledId: null,
    info: () => {
      const renderer = gl.current;
      const loaded = kitRef.current;
      return {
        backend: renderer && loaded ? loaded.backendOf(renderer) : 'starting',
        drawCalls: lastFrame.current.drawCalls,
        triangles: lastFrame.current.triangles,
        textures: renderer?.info.memory.textures ?? 0,
        texturesSizeReported: renderer?.info.memory.texturesSize ?? 0,
        programs: renderer?.info.memory.programs ?? 0,
        atlasBytes: 0,
        coversCached: 0,
        dpr: renderer?.getPixelRatio() ?? window.devicePixelRatio,
      };
    },
  });

  useEffect(() => {
    let live = true;
    const start = performance.now();
    loadKit(renderer).then(
      (loaded) => {
        if (!live) return;
        probe.current.kitLoadMs = performance.now() - start;
        kitRef.current = loaded;
        setKit(loaded);
      },
      (error: unknown) => {
        if (live) onStartFailed(error);
      },
    );
    return () => {
      live = false;
    };
  }, [renderer, onStartFailed]);

  useEffect(() => (debug ? publishProbe(probe.current) : undefined), [debug]);

  const layout = useMemo(
    () =>
      width > 0 ? layoutShelves(model.shelves, width / pxPerUnit - 0.8) : null,
    [model, width, pxPerUnit],
  );
  const focusRow =
    layout?.books.find((placed) => placed.book.id === focusId)?.row ?? 0;

  const createGl = useCallback(
    async (props: unknown) => {
      if (!kit) throw new Error('the study kit is not loaded');
      const start = performance.now();
      try {
        const created = await kit.createRenderer(props as KitCanvasProps);
        probe.current.initMs = performance.now() - start;
        gl.current = created;
        return created;
      } catch (error) {
        onStartFailed(error);
        return new Promise<never>(() => undefined);
      }
    },
    [kit, onStartFailed],
  );

  const onFrame = useCallback(
    (start: number) => {
      const end = performance.now();
      const current = probe.current;
      if (!kit || !gl.current) return;
      const { drawCalls, triangles } = gl.current.info.render;
      lastFrame.current = { drawCalls, triangles };
      if (current.firstFrameAt !== null) return;
      current.firstFrameAt = end;
      current.firstRenderMs = end - start;
      const active = kit.backendOf(gl.current);
      setBackend(active);
      onBackend(active);
    },
    [kit, onBackend],
  );

  return (
    <div
      ref={wrap}
      data-study-canvas
      data-renderer={renderer}
      data-backend={backend ?? undefined}
      data-pulled-id=""
      className="bg-muted relative h-[min(70dvh,640px)] overflow-hidden rounded-lg lg:h-[min(78dvh,760px)]"
    >
      {kit && layout && (
        <Canvas
          ref={(canvas) => {
            if (canvas && probe.current.canvasMountAt === 0) {
              probe.current.canvasMountAt = performance.now();
            }
          }}
          gl={createGl}
          frameloop="demand"
          dpr={DPR}
          camera={CAMERA}
          shadows={SHADOWS}
          flat={kit.flat}
          aria-hidden="true"
        >
          <FrameDriver onFrame={onFrame} />
          <Shelves
            layout={layout}
            tokens={tokens}
            kit={kit}
            focusRow={focusRow}
            pxPerUnit={pxPerUnit}
          />
        </Canvas>
      )}
    </div>
  );
}
