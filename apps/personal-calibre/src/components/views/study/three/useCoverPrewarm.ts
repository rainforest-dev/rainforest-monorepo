'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import type { Camera, Object3D, Scene } from 'three';

import {
  booksInRow,
  COVER_NEIGHBOURS,
  type PlacedBook,
  type StudyLayout,
} from '@/lib';

import type { CoverCache } from './covers';
import type { StudyGl, StudyKit } from './kit';
import { whenIdle } from './useRowAtlases';

export interface CoverPrewarmArgs {
  layout: StudyLayout;
  focusId: number | null;
  covers: CoverCache;
  kit: StudyKit;
  nextPageCoverIds: readonly number[];
  onPrewarmed: () => void;
}

function around(layout: StudyLayout, focusId: number | null): PlacedBook[] {
  const centre =
    layout.books.find((placed) => placed.book.id === focusId)?.order ?? 0;
  return layout.books.slice(
    Math.max(0, centre - COVER_NEIGHBOURS),
    centre + COVER_NEIGHBOURS + 1,
  );
}

const IDLE_SLACK_MS = 4;

function compileEveryRow(
  kit: StudyKit,
  gl: StudyGl,
  scene: Scene,
  camera: Camera,
): Promise<void> {
  const culled: Object3D[] = [];
  scene.traverse((object) => {
    if (!object.frustumCulled) return;
    culled.push(object);
    object.frustumCulled = false;
  });
  // three's compileAsync culls while it projects, before its first await, so culling can be restored once the call returns.
  const compiled = kit.compile(gl, scene, camera);
  for (const object of culled) object.frustumCulled = true;
  return compiled;
}

type IdleHandle = ReturnType<typeof whenIdle>;

function ensureInIdle(
  covers: CoverCache,
  books: readonly PlacedBook[],
  onQueued?: (loads: Promise<unknown>) => void,
): IdleHandle {
  const queue = [...books];
  const loads: Promise<unknown>[] = [];
  let handle: IdleHandle;
  const step = (deadline: IdleDeadline) => {
    let ensured = false;
    while (
      queue.length > 0 &&
      (!ensured || deadline.timeRemaining() > IDLE_SLACK_MS)
    ) {
      const placed = queue.shift();
      if (placed) loads.push(covers.ensure(placed.book));
      ensured = true;
    }
    if (queue.length > 0) handle = whenIdle(step);
    else onQueued?.(Promise.allSettled(loads));
  };
  handle = whenIdle(step);
  return { cancel: () => handle.cancel() };
}

export function useCoverPrewarm({
  layout,
  focusId,
  covers,
  kit,
  nextPageCoverIds,
  onPrewarmed,
}: CoverPrewarmArgs): void {
  const { gl, scene, camera } = useThree();
  const [framed, setFramed] = useState(false);
  const framedRef = useRef(false);
  useFrame(() => {
    if (framedRef.current) return;
    framedRef.current = true;
    setFramed(true);
  });

  const focusRef = useRef(focusId);
  focusRef.current = focusId;
  const [prewarmed, setPrewarmed] = useState<CoverCache | null>(null);
  const compiled = useRef<StudyLayout | null>(null);

  useEffect(() => {
    if (!framed) return;
    let live = true;
    const firstRow = booksInRow(layout, 0).filter(
      (placed) => placed.book.hasCover,
    );
    const books = [
      ...new Set([...firstRow, ...around(layout, focusRef.current)]),
    ];
    const handle = ensureInIdle(covers, books, (loads) => {
      const compile =
        compiled.current === layout
          ? Promise.resolve()
          : compileEveryRow(kit, gl as unknown as StudyGl, scene, camera);
      compiled.current = layout;
      Promise.allSettled([loads, compile]).then(() => {
        if (!live) return;
        setPrewarmed(covers);
        onPrewarmed();
      });
    });
    return () => {
      live = false;
      handle.cancel();
    };
  }, [framed, layout, covers, kit, gl, scene, camera, onPrewarmed]);

  useEffect(() => {
    if (prewarmed !== covers) return;
    const handle = whenIdle(() => covers.prefetch(nextPageCoverIds));
    return () => handle.cancel();
  }, [prewarmed, covers, nextPageCoverIds]);

  useEffect(() => {
    if (prewarmed !== covers || focusId === null) return;
    const handle = ensureInIdle(covers, around(layout, focusId));
    return () => handle.cancel();
  }, [prewarmed, covers, layout, focusId]);
}
