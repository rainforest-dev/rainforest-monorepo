'use client';

import { type RefObject, useEffect, useRef } from 'react';

export const SCRUB_HOLD_MS = 400;
const SCRUB_SLOP_PX = 10;

export type ScrubHitTest = (clientX: number, clientY: number) => number | null;

export function useScrub({
  surfaceRef,
  hitTest,
  onPull,
  onScrubbing,
}: {
  surfaceRef: RefObject<HTMLElement | null>;
  hitTest: ScrubHitTest;
  onPull: (bookId: number) => void;
  onScrubbing: (scrubbing: boolean) => void;
}): void {
  const latest = useRef({ hitTest, onPull, onScrubbing });
  latest.current = { hitTest, onPull, onScrubbing };

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    let timer = 0;
    let frame = 0;
    let scrubbing = false;
    let start: { x: number; y: number } | null = null;
    let point = { x: 0, y: 0 };
    let lastId: number | null = null;

    const pullAtPoint = () => {
      frame = 0;
      const id = latest.current.hitTest(point.x, point.y);
      if (id === null || id === lastId) return;
      lastId = id;
      latest.current.onPull(id);
    };
    const reset = () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      timer = 0;
      frame = 0;
      start = null;
      lastId = null;
      if (scrubbing) {
        scrubbing = false;
        latest.current.onScrubbing(false);
      }
    };
    const onTouchStart = (event: TouchEvent) => {
      reset();
      const touch = event.touches[0];
      if (event.touches.length !== 1 || !touch) return;
      start = { x: touch.clientX, y: touch.clientY };
      point = { ...start };
      timer = window.setTimeout(() => {
        timer = 0;
        scrubbing = true;
        latest.current.onScrubbing(true);
        pullAtPoint();
      }, SCRUB_HOLD_MS);
    };
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!start || !touch) return;
      point = { x: touch.clientX, y: touch.clientY };
      if (!scrubbing) {
        const moved = Math.hypot(point.x - start.x, point.y - start.y);
        if (moved > SCRUB_SLOP_PX) reset();
        return;
      }
      // iOS Safari ignores a touch-action set after the gesture began, so only preventDefault stops the scroll.
      event.preventDefault();
      event.stopPropagation();
      if (!frame) frame = requestAnimationFrame(pullAtPoint);
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (scrubbing && event.cancelable) event.preventDefault();
      reset();
    };
    const onContextMenu = (event: Event) => {
      if (start) event.preventDefault();
    };
    const active = { capture: true, passive: false };
    surface.addEventListener('touchstart', onTouchStart, active);
    surface.addEventListener('touchmove', onTouchMove, active);
    surface.addEventListener('touchend', onTouchEnd, active);
    surface.addEventListener('touchcancel', reset, active);
    surface.addEventListener('contextmenu', onContextMenu, active);
    return () => {
      reset();
      surface.removeEventListener('touchstart', onTouchStart, active);
      surface.removeEventListener('touchmove', onTouchMove, active);
      surface.removeEventListener('touchend', onTouchEnd, active);
      surface.removeEventListener('touchcancel', reset, active);
      surface.removeEventListener('contextmenu', onContextMenu, active);
    };
  }, [surfaceRef]);
}
