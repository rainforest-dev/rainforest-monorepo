'use client';

import type { NavItem } from '@rainforest-dev/rainforest-ui/interaction';
import { Canvas, useFrame } from '@react-three/fiber';
import { useSearchParams } from 'next/navigation';
import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PCFShadowMap } from 'three';

import type { StudyRendererProps } from '@/components/views/study/StudyListbox';
import { useIsDesktop } from '@/hooks';
import {
  type CameraState,
  isDebug,
  layoutShelves,
  type StudyBackend,
  studyNavItems,
  type ThreeRenderer,
} from '@/lib';

import type { KitCanvasProps, StudyGl, StudyKit } from './kit';
import { publishProbe, type StudyProbe } from './probe';
import { type BookProjector, Scene } from './Scene';
import { useTokens } from './tokens';

type ThreeBackend = Exclude<StudyBackend, 'css'>;

export interface ThreeStudyProps extends StudyRendererProps {
  renderer: ThreeRenderer;
  onBackend: (backend: ThreeBackend) => void;
  onStartFailed: (error: unknown) => void;
  onNavItems: (items: readonly NavItem[]) => void;
}

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

export default function ThreeStudy({
  renderer,
  model,
  options,
  focusId,
  reducedMotion,
  nav,
  onBackend,
  onStartFailed,
  onNavItems,
}: ThreeStudyProps) {
  const debug = isDebug(useSearchParams());
  const pxPerUnit = useIsDesktop() ? 100 : 80;
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap);
  const [kit, setKit] = useState<StudyKit | null>(null);
  const tokens = useTokens();
  const [backend, setBackend] = useState<ThreeBackend | null>(null);
  const [pulledId, setPulledId] = useState<number | null>(null);
  const projector = useRef<BookProjector | null>(null);
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
    camera: null,
    projectBook: (bookId) => projector.current?.(bookId) ?? null,
    info: () => {
      const renderer = gl.current;
      const loaded = kitRef.current;
      return {
        backend: renderer && loaded ? loaded.backendOf(renderer) : 'starting',
        drawCalls: lastFrame.current.drawCalls,
        triangles: lastFrame.current.triangles,
        textures: renderer?.info.memory.textures ?? 0,
        texturesSizeReported: renderer?.info.memory.texturesSize ?? 0,
        programs: renderer && loaded ? loaded.programsOf(renderer) : 0,
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

  useEffect(() => (kit ? () => kit.materials.dispose() : undefined), [kit]);

  useEffect(() => (debug ? publishProbe(probe.current) : undefined), [debug]);

  const layout = useMemo(
    () =>
      width > 0 ? layoutShelves(model.shelves, width / pxPerUnit - 0.8) : null,
    [model, width, pxPerUnit],
  );
  const selectedKey = options
    .filter((option) => option.selected)
    .map(({ book }) => book.id)
    .join(',');
  const selected = useMemo(
    () => new Set(selectedKey ? selectedKey.split(',').map(Number) : []),
    [selectedKey],
  );

  useEffect(() => {
    onNavItems(layout ? studyNavItems(layout) : []);
  }, [layout, onNavItems]);

  const { containerRef } = nav;
  const onPick = useCallback(
    (bookId: number) => {
      containerRef.current
        ?.querySelector<HTMLElement>(`[data-book-id="${bookId}"]`)
        ?.focus({ preventScroll: true });
    },
    [containerRef],
  );
  const onPulled = useCallback((bookId: number | null) => {
    probe.current.pulledId = bookId;
    setPulledId(bookId);
  }, []);
  const onCamera = useCallback((state: CameraState) => {
    probe.current.camera = state;
  }, []);

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
      data-pulled-id={pulledId ?? ''}
      className="bg-muted relative h-[min(70dvh,640px)] overflow-hidden rounded-lg lg:h-[min(78dvh,760px)]"
    >
      {kit && layout && tokens && (
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
          <Scene
            layout={layout}
            tokens={tokens}
            kit={kit}
            focusId={focusId}
            selected={selected}
            reducedMotion={reducedMotion}
            pxPerUnit={pxPerUnit}
            projector={projector}
            onPick={onPick}
            onPulled={onPulled}
            onCamera={onCamera}
          />
        </Canvas>
      )}
    </div>
  );
}
