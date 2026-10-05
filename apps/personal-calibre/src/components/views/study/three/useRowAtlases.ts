'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';

import { atlasOrder, type AtlasPpu, booksInRow, type StudyLayout } from '@/lib';

import { buildRowAtlas, type RowAtlas } from './atlas';
import type { Tokens } from './tokens';

export interface RowAtlasesArgs {
  layout: StudyLayout;
  layoutKey: string;
  tokens: Tokens;
  visibleRows: readonly number[];
  maxAnisotropy: number;
  ppu: AtlasPpu;
}

interface AtlasSet {
  atlases: Map<number, RowAtlas>;
  idle: number[];
  build: (row: number) => RowAtlas;
}

const IDLE_TIMEOUT_MS = 200;
const IDLE_SLACK_MS = 4;

type IdleHandle = { cancel: () => void };

function whenIdle(callback: (deadline: IdleDeadline) => void): IdleHandle {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(callback, {
      timeout: IDLE_TIMEOUT_MS,
    });
    return { cancel: () => window.cancelIdleCallback(id) };
  }
  const id = window.setTimeout(
    () => callback({ didTimeout: true, timeRemaining: () => 0 }),
    1,
  );
  return { cancel: () => window.clearTimeout(id) };
}

export function useRowAtlases({
  layout,
  layoutKey,
  tokens,
  visibleRows,
  maxAnisotropy,
  ppu,
}: RowAtlasesArgs): ReadonlyMap<number, RowAtlas> {
  const set = useMemo<AtlasSet>(() => {
    const build = (row: number) =>
      buildRowAtlas(
        booksInRow(layout, row),
        layout.width,
        tokens,
        maxAnisotropy,
        ppu,
      );
    const { sync, idle } = atlasOrder(layout.rows, visibleRows);
    return {
      atlases: new Map(sync.map((row) => [row, build(row)])),
      idle,
      build,
    };
  }, [layout, layoutKey, tokens, visibleRows, maxAnisotropy, ppu]);

  const [snapshot, setSnapshot] = useState(() => ({
    set,
    atlases: new Map(set.atlases) as ReadonlyMap<number, RowAtlas>,
  }));
  const current =
    snapshot.set === set ? snapshot : { set, atlases: new Map(set.atlases) };
  if (current !== snapshot) setSnapshot(current);

  const [framed, setFramed] = useState(false);
  const framedRef = useRef(false);
  useFrame(() => {
    if (framedRef.current) return;
    framedRef.current = true;
    setFramed(true);
  });

  useEffect(() => {
    if (!framed || set.idle.length === 0) return;
    let handle: IdleHandle | null = null;
    const step = (deadline: IdleDeadline) => {
      let built = false;
      while (
        set.idle.length > 0 &&
        (!built || deadline.timeRemaining() > IDLE_SLACK_MS)
      ) {
        const row = set.idle.shift();
        if (row === undefined || set.atlases.has(row)) continue;
        set.atlases.set(row, set.build(row));
        built = true;
      }
      if (built) setSnapshot({ set, atlases: new Map(set.atlases) });
      handle = set.idle.length > 0 ? whenIdle(step) : null;
    };
    handle = whenIdle(step);
    return () => handle?.cancel();
  }, [set, framed]);

  useEffect(
    () => () => {
      for (const atlas of set.atlases.values()) atlas.texture.dispose();
    },
    [set],
  );

  return current.atlases;
}
