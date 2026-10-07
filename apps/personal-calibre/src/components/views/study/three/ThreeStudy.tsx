'use client';

import type { NavItem } from '@rainforest-dev/rainforest-ui/interaction';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
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
import { type ScrubHitTest, useScrub } from '@/components/views/study/useScrub';
import { useIsDesktop } from '@/hooks';
import {
  atlasBytesAt,
  type AtlasPick,
  cameraBounds,
  type CameraState,
  clampCameraY,
  COVER_BYTES,
  focusTargetY,
  INSPECT_BACK_BYTES,
  isDebug,
  layoutShelves,
  pickAtlasPpu,
  rowsInView,
  type ScreenRect,
  snapRect,
  type StudyLayout,
  studyNavItems,
  TEXTURE_BUDGET_BYTES,
  type ThreeRenderer,
} from '@/lib';

import { type RowAtlas, spineCropBytes } from './atlas';
import { type CoverCache, createCoverCache } from './covers';
import { FocusOverlay } from './FocusOverlay';
import type {
  KitCanvasProps,
  KitFrameInfo,
  StudyGl,
  StudyKit,
  ThreeBackend,
} from './kit';
import { publishProbe, type StudyProbe, type StudyProbeInfo } from './probe';
import type { ScrubPointer } from './PulledBook';
import {
  type BookProjector,
  type ProjectedLabel,
  Scene,
  type SceneProps,
} from './Scene';
import { type LabelsSink, measureLabelPx, ShelfLabels } from './ShelfLabels';
import { useTokens } from './tokens';
import { useCoverPrewarm } from './useCoverPrewarm';
import { useRowAtlases } from './useRowAtlases';

export interface ThreeStudyProps extends StudyRendererProps {
  renderer: ThreeRenderer;
  onBackend: (backend: ThreeBackend) => void;
  onStartFailed: (error: unknown) => void;
  onNavItems: (items: readonly NavItem[]) => void;
  nextPageCoverIds: readonly number[];
}

const CAMERA = { fov: 30, near: 0.1, far: 200 };
const DPR: [number, number] = [1, 2];
// fiber sets PCFSoftShadowMap for boolean `shadows`, which WebGPURenderer warns about on every render.
const SHADOWS = { enabled: false, type: PCFShadowMap };
const RENDER_SAMPLES = 500;

function atlasInfo({
  pick,
  estimated,
  rows,
  report,
}: {
  pick: AtlasPick | null;
  estimated: number;
  rows: number;
  report: AtlasReport | null;
}) {
  const atlases = report ? [...report.atlases.values()] : [];
  return {
    atlasPpu: pick?.ppu ?? null,
    coverCacheMax: pick?.covers ?? null,
    atlasFits: pick?.fits ?? null,
    atlasBytes: atlases.reduce((sum, atlas) => sum + atlas.bytes, 0),
    atlasBytesEstimated: estimated,
    textureBytesEstimated: pick?.estimatedBytes ?? 0,
    atlasRows: atlases.length,
    atlasOrder: report ? [...report.atlases.keys()] : [],
    rows,
    lastAtlasAt: report?.at ?? null,
  };
}

function loadKit(renderer: ThreeRenderer): Promise<StudyKit> {
  switch (renderer) {
    case 'three-tsl':
      return import('./kitTsl').then((module) => module.kit);
    case 'three-glsl':
      return import('./kitGlsl').then((module) => module.kit);
  }
}

interface Size {
  width: number;
  height: number;
}

function useSize(ref: RefObject<HTMLDivElement | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = Math.floor(entry.contentRect.width);
      const height = Math.floor(entry.contentRect.height);
      setSize((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

interface AtlasReport {
  atlases: ReadonlyMap<number, RowAtlas>;
  at: number;
}

interface AtlasSceneProps extends Omit<SceneProps, 'atlases'> {
  layoutKey: string;
  visibleRows: readonly number[];
  pick: AtlasPick;
  nextPageCoverIds: readonly number[];
  onAtlases: (report: AtlasReport) => void;
  onPrewarmed: () => void;
}

function AtlasScene({
  layoutKey,
  visibleRows,
  pick,
  nextPageCoverIds,
  onAtlases,
  onPrewarmed,
  ...scene
}: AtlasSceneProps) {
  const maxAnisotropy = useThree((state) => scene.kit.maxAnisotropy(state.gl));
  const compiling = useRef<Promise<void> | null>(null);
  const atlases = useRowAtlases({
    layout: scene.layout,
    layoutKey,
    tokens: scene.tokens,
    visibleRows,
    maxAnisotropy,
    ppu: pick.ppu,
    compiling,
  });
  useEffect(() => {
    onAtlases({ atlases, at: performance.now() });
  }, [atlases, onAtlases]);
  useCoverPrewarm({
    layout: scene.layout,
    focusId: scene.focusId,
    scrubbing: scene.scrubbing,
    covers: scene.covers,
    kit: scene.kit,
    nextPageCoverIds,
    compiling,
    onPrewarmed,
  });
  return <Scene {...scene} atlases={atlases} />;
}

function initialRows(
  layout: StudyLayout,
  focusRow: number,
  viewUnits: number,
): number[] {
  const y = clampCameraY(
    focusTargetY(layout, focusRow),
    cameraBounds(layout, viewUnits),
  );
  return rowsInView(layout, y, viewUnits);
}

function FrameDriver({
  ready,
  onFrame,
}: {
  ready: boolean;
  onFrame: (start: number) => void;
}) {
  useFrame(({ gl, scene, camera }) => {
    if (!ready) return;
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
  pull,
  inspect,
  onBackend,
  onStartFailed,
  onNavItems,
  nextPageCoverIds,
}: ThreeStudyProps) {
  const debug = isDebug(useSearchParams());
  const desktop = useIsDesktop();
  const pxPerUnit = desktop ? 100 : 80;
  const wrap = useRef<HTMLDivElement>(null);
  const { width, height } = useSize(wrap);
  const [kit, setKit] = useState<StudyKit | null>(null);
  const tokens = useTokens();
  const [backend, setBackend] = useState<ThreeBackend | null>(null);
  const [pulledId, setPulledId] = useState<number | null>(null);
  const [floatingId, setFloatingId] = useState<number | null>(null);
  const pointer = useRef<ScrubPointer>({
    x: 0,
    y: 0,
    invalidate: () => undefined,
  });
  const pointerOrigin = useRef({ left: 0, top: 0 });
  const projector = useRef<BookProjector | null>(null);
  const gl = useRef<StudyGl | null>(null);
  const glInit = useRef<Promise<void> | null>(null);
  const glReady = useRef(false);
  const [ready, setReady] = useState(false);
  const kitRef = useRef<StudyKit | null>(null);
  const lastFrame = useRef<KitFrameInfo>({ drawCalls: 0, triangles: 0 });
  const overlay = useRef<HTMLDivElement>(null);
  const labelsSink = useRef<LabelsSink | null>(null);
  const [covers, setCovers] = useState<CoverCache | null>(null);
  const coversRef = useRef(covers);
  coversRef.current = covers;
  const atlasState = useRef<{
    pick: AtlasPick | null;
    estimated: number;
    rows: number;
    report: AtlasReport | null;
  }>({ pick: null, estimated: 0, rows: 0, report: null });
  const probe = useRef<StudyProbe>({
    canvasMountAt: 0,
    kitLoadMs: 0,
    initMs: 0,
    firstFrameAt: null,
    firstRenderMs: null,
    pulledId: null,
    floatingId: null,
    inspectingId: null,
    camera: null,
    prewarmedAt: null,
    renderMs: [],
    projectBook: (bookId) => projector.current?.(bookId, 'box') ?? null,
    projectFront: (bookId) => projector.current?.(bookId, 'front') ?? null,
    info: (): StudyProbeInfo => {
      const renderer = gl.current;
      const loaded = kitRef.current;
      const atlas = atlasInfo(atlasState.current);
      const coverCacheBytes = (coversRef.current?.size() ?? 0) * COVER_BYTES;
      const memory =
        renderer && loaded
          ? loaded.textureMemory(renderer)
          : { textures: 0, bytes: 0 };
      const carried = new Set([
        probe.current.pulledId,
        probe.current.floatingId,
      ]);
      return {
        backend: renderer && loaded ? loaded.backendOf(renderer) : 'starting',
        drawCalls: lastFrame.current.drawCalls,
        triangles: lastFrame.current.triangles,
        textures: memory.textures,
        texturesSizeReported:
          memory.bytes ??
          atlas.atlasBytes +
            coverCacheBytes +
            INSPECT_BACK_BYTES +
            spineCropBytes(atlasState.current.report?.atlases, carried),
        texturesSizeSource: memory.bytes === null ? 'estimated' : 'reported',
        programs: renderer && loaded ? loaded.programsOf(renderer) : 0,
        ...atlas,
        coversCached: coversRef.current?.size() ?? 0,
        coverCacheBytes,
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

  useEffect(
    () => () => {
      const created = gl.current;
      const init = glInit.current;
      // fiber skips dispose() on a renderer whose init() is still pending at teardown.
      if (created && init && !glReady.current)
        void init.then(
          () => created.dispose(),
          () => undefined,
        );
    },
    [],
  );

  useEffect(() => (debug ? publishProbe(probe.current) : undefined), [debug]);

  const layout = useMemo(() => {
    const element = wrap.current;
    if (width <= 0 || !element) return null;
    const labelPx = measureLabelPx(element);
    return layoutShelves(
      model.shelves,
      width / pxPerUnit - 0.8,
      (shelf, continued) => labelPx(shelf, continued) / pxPerUnit,
    );
  }, [model, width, pxPerUnit]);
  const dpr = Math.min(window.devicePixelRatio || 1, DPR[1]);
  const pick = useMemo(
    () =>
      layout && kit
        ? pickAtlasPpu({
            layout,
            budgetBytes: desktop
              ? TEXTURE_BUDGET_BYTES.desktop
              : TEXTURE_BUDGET_BYTES.phone,
            canvas: { width, height, dpr },
            targetBuffers: kit.reportedTargetBuffers,
            coverBytes: COVER_BYTES,
            reservedBytes: INSPECT_BACK_BYTES,
          })
        : null,
    [layout, desktop, width, height, dpr, kit],
  );
  const coverMax = pick?.covers ?? null;
  useEffect(() => {
    if (!tokens || coverMax === null) return;
    const cache = createCoverCache(tokens, {
      max: coverMax,
      upload: (texture) => {
        const renderer = gl.current;
        const loaded = kitRef.current;
        if (renderer && loaded) loaded.uploadTexture(renderer, texture);
      },
    });
    setCovers(cache);
    return () => cache.dispose();
  }, [tokens, model.key, coverMax]);
  const focusRow = useRef(0);
  const focusedRow = layout?.books.find(
    (placed) => placed.book.id === focusId,
  )?.row;
  focusRow.current = focusedRow ?? focusRow.current;
  const visibleRows = useMemo(
    () =>
      layout ? initialRows(layout, focusRow.current, height / pxPerUnit) : [],
    [layout, height, pxPerUnit],
  );
  useEffect(() => {
    atlasState.current = {
      ...atlasState.current,
      pick,
      estimated: layout && pick ? atlasBytesAt(layout, pick.ppu) : 0,
      rows: layout?.rows ?? 0,
    };
  }, [layout, pick]);
  const onAtlases = useCallback((report: AtlasReport) => {
    atlasState.current = { ...atlasState.current, report };
  }, []);
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
  const { activate, isPulled, dismiss, pullAt, setScrubbing } = pull;
  const onPick = useCallback(
    (bookId: number) => activate(bookId, isPulled(bookId)),
    [activate, isPulled],
  );
  const hitTester = useRef<ScrubHitTest | null>(null);
  const inspectingId = inspect.open ? pull.pulledId : null;
  useEffect(() => {
    probe.current.inspectingId = inspectingId;
  }, [inspectingId]);
  useScrub({
    surfaceRef: wrap,
    enabled: !inspect.open,
    hitTest: (x, y) => hitTester.current?.(x, y) ?? null,
    onPull: pullAt,
    onScrubbing: (scrubbing) => {
      const rect = wrap.current?.getBoundingClientRect();
      if (scrubbing && rect) {
        pointerOrigin.current.left = rect.left;
        pointerOrigin.current.top = rect.top;
      }
      setScrubbing(scrubbing);
    },
    onMove: (x, y) => {
      const at = pointer.current;
      at.x = x - pointerOrigin.current.left;
      at.y = y - pointerOrigin.current.top;
      at.invalidate();
    },
  });
  const onPulled = useCallback((bookId: number | null) => {
    probe.current.pulledId = bookId;
    setPulledId(bookId);
  }, []);
  const onFloating = useCallback((bookId: number | null) => {
    probe.current.floatingId = bookId;
    setFloatingId(bookId);
  }, []);
  const onCamera = useCallback((state: CameraState) => {
    probe.current.camera = state;
  }, []);

  const onFocusRect = useCallback((rect: ScreenRect | null) => {
    const element = overlay.current;
    if (!element) return;
    if (!rect) {
      element.style.display = 'none';
      return;
    }
    const snapped = snapRect(rect, window.devicePixelRatio);
    element.style.display = '';
    element.style.transform = `translate(${snapped.left}px, ${snapped.top}px)`;
    element.style.width = `${snapped.width}px`;
    element.style.height = `${snapped.height}px`;
  }, []);
  const onLabels = useCallback((labels: readonly ProjectedLabel[]) => {
    labelsSink.current?.(labels);
  }, []);
  const onPrewarmed = useCallback(() => {
    probe.current.prewarmedAt = performance.now();
  }, []);

  const createGl = useCallback(
    (props: unknown) => {
      if (!kit) throw new Error('the study kit is not loaded');
      const start = performance.now();
      try {
        const created = kit.createRenderer(props as KitCanvasProps);
        gl.current = created;
        glInit.current = kit.init(created).then(() => {
          probe.current.initMs = performance.now() - start;
          glReady.current = true;
          setReady(true);
        });
        glInit.current.catch(onStartFailed);
        return created;
      } catch (error) {
        onStartFailed(error);
        throw error;
      }
    },
    [kit, onStartFailed],
  );

  const onFrame = useCallback(
    (start: number) => {
      const end = performance.now();
      const current = probe.current;
      if (!kit || !gl.current) return;
      lastFrame.current = kit.frameInfo(gl.current);
      current.renderMs.push(end - start);
      if (current.renderMs.length > RENDER_SAMPLES) current.renderMs.shift();
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
      data-floating-id={floatingId ?? undefined}
      data-inspecting-id={inspectingId ?? undefined}
      className="bg-muted relative h-[min(70dvh,640px)] overflow-hidden rounded-lg transition-colors data-[inspecting-id]:bg-[color-mix(in_oklab,var(--muted)_45%,black)] motion-reduce:transition-none lg:h-[min(78dvh,760px)]"
    >
      {kit && layout && tokens && pick && covers && (
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
          onPointerMissed={dismiss}
          aria-hidden="true"
        >
          <FrameDriver ready={ready} onFrame={onFrame} />
          {ready && (
            <AtlasScene
              layoutKey={`${model.key}:${layout.width}`}
              visibleRows={visibleRows}
              pick={pick}
              nextPageCoverIds={nextPageCoverIds}
              onAtlases={onAtlases}
              onPrewarmed={onPrewarmed}
              covers={covers}
              onFocusRect={onFocusRect}
              onLabels={onLabels}
              layout={layout}
              tokens={tokens}
              kit={kit}
              focusId={focusId}
              pulledId={pull.pulledId}
              scrubbing={pull.scrubbing}
              inspecting={inspect.open}
              stage={inspect.stage}
              hitTester={hitTester}
              pointer={pointer}
              selected={selected}
              reducedMotion={reducedMotion}
              pxPerUnit={pxPerUnit}
              projector={projector}
              onPick={onPick}
              onPulled={onPulled}
              onFloating={onFloating}
              onCamera={onCamera}
            />
          )}
        </Canvas>
      )}
      <ShelfLabels sinkRef={labelsSink} />
      <FocusOverlay ref={overlay} listboxRef={containerRef} />
    </div>
  );
}
