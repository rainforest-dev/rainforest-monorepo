'use client';

import { type RefObject, useCallback, useRef, useState } from 'react';

import type { ScreenRect } from '@/lib';

export interface InspectStage {
  yaw: number;
  pitch: number;
  invalidate: () => void;
  bookRect: () => ScreenRect | null;
}

export interface StudyInspect {
  open: boolean;
  stage: RefObject<InspectStage>;
  show: () => void;
  close: () => void;
}

export function useStudyInspect(pulledId: number | null): StudyInspect {
  const [openFor, setOpenFor] = useState<number | null>(null);
  const stage = useRef<InspectStage>({
    yaw: 0,
    pitch: 0,
    invalidate: () => undefined,
    bookRect: () => null,
  });
  const pulledRef = useRef(pulledId);
  pulledRef.current = pulledId;

  const show = useCallback(() => {
    const id = pulledRef.current;
    if (id === null) return;
    stage.current.yaw = 0;
    stage.current.pitch = 0;
    setOpenFor(id);
  }, []);
  const close = useCallback(() => setOpenFor(null), []);

  return {
    open: openFor !== null && openFor === pulledId,
    stage,
    show,
    close,
  };
}
