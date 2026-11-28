'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * How much room the page has, in Material's window size classes: a phone or a foldable's
 * cover screen is `compact`, a foldable's inner screen upright is `medium`, opened sideways
 * or on a tablet it is `expanded`.
 */
export type FoldSize = 'compact' | 'medium' | 'expanded';

/**
 * How the screen is held. `book` is folded with the hinge upright, two segments side by side;
 * `tabletop` is folded with the hinge across, one segment above the other. Only browsers with
 * the Viewport Segments API report either (Chromium on Android foldables; Safari behind a flag),
 * so everywhere else it stays `flat`.
 */
export type FoldPosture = 'flat' | 'book' | 'tabletop';

export interface FoldState {
  size: FoldSize;
  posture: FoldPosture;
  /** Each segment's rectangle when the window spans a hinge, in CSS px; else empty. */
  segments: readonly DOMRectReadOnly[];
}

/** Material's breakpoints: compact below 600px, expanded from 840px. */
export const FOLD_MEDIUM_MIN = 600;
export const FOLD_EXPANDED_MIN = 840;

/**
 * A fold or unfold fires two or three resizes, through a size that belongs to neither screen.
 * Waiting this long after the last one reports only the screen the reader ends on.
 */
export const FOLD_SETTLE_MS = 150;

interface ViewportWithSegments {
  segments?: readonly DOMRectReadOnly[] | null;
}

interface DevicePosture extends EventTarget {
  type: 'continuous' | 'folded';
}

function segmentsOf(win: Window): readonly DOMRectReadOnly[] {
  const viewport = (win as Window & { viewport?: ViewportWithSegments })
    .viewport;
  const segments = viewport?.segments;
  return segments && segments.length > 1 ? [...segments] : [];
}

function postureOf(segments: readonly DOMRectReadOnly[]): FoldPosture {
  if (segments.length < 2) return 'flat';
  const [first, second] = segments;
  return second.left >= first.right ? 'book' : 'tabletop';
}

function sizeOf(width: number): FoldSize {
  if (width >= FOLD_EXPANDED_MIN) return 'expanded';
  if (width >= FOLD_MEDIUM_MIN) return 'medium';
  return 'compact';
}

/** The fold state of `win` right now, with no settling. */
export function readFoldState(win: Window = window): FoldState {
  const segments = segmentsOf(win);
  return {
    size: sizeOf(win.innerWidth),
    posture: postureOf(segments),
    segments,
  };
}

const key = (state: FoldState) =>
  `${state.size}:${state.posture}:${state.segments
    .map((s) => `${s.left},${s.top},${s.width},${s.height}`)
    .join(';')}`;

let current: FoldState | null = null;
let currentKey = '';
const listeners = new Set<() => void>();
let teardown: (() => void) | null = null;

function update() {
  const next = readFoldState();
  const nextKey = key(next);
  if (nextKey === currentKey) return;
  current = next;
  currentKey = nextKey;
  for (const listener of listeners) listener();
}

function start() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const settle = () => {
    clearTimeout(timer);
    timer = setTimeout(update, FOLD_SETTLE_MS);
  };
  const posture = (navigator as Navigator & { devicePosture?: DevicePosture })
    .devicePosture;
  window.addEventListener('resize', settle);
  posture?.addEventListener('change', settle);
  // The window may have changed while nothing was listening.
  update();
  return () => {
    clearTimeout(timer);
    window.removeEventListener('resize', settle);
    posture?.removeEventListener('change', settle);
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) teardown = start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      teardown?.();
      teardown = null;
    }
  };
}

function snapshot(): FoldState {
  if (!current) {
    current = readFoldState();
    currentKey = key(current);
  }
  return current;
}

/**
 * The window's size class and posture, updated once a fold or unfold settles. `null` on the
 * server and in the first client render, so markup that depends on it does not mismatch.
 */
export function useFoldState(): FoldState | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

/** The attribute that marks an element worth keeping on screen across a fold. */
export const FOLD_ANCHOR_ATTR = 'data-fold-anchor';

function topmostAnchor(): Element | null {
  for (const el of document.querySelectorAll(`[${FOLD_ANCHOR_ATTR}]`)) {
    if (el.getBoundingClientRect().bottom > 0) return el;
  }
  return null;
}

/**
 * Keeps the reader's place when the screen folds or unfolds. While the reader scrolls, the
 * first `[data-fold-anchor]` element still on screen is remembered; when the size class or
 * posture settles on a new value, that element is scrolled back to the top. Recording only on
 * scroll means the resizes of the fold itself cannot replace the anchor with whatever the
 * squeezed layout put at the top.
 */
export function useFoldAnchor() {
  const state = useFoldState();
  const anchor = useRef<Element | null>(null);
  const previous = useRef<string | null>(null);

  useEffect(() => {
    let frame = 0;
    // A resize reflows the page and fires scroll events of its own; those are not the reader.
    let resizingUntil = 0;
    const resizing = () => {
      resizingUntil = performance.now() + FOLD_SETTLE_MS * 2;
    };
    const record = () => {
      if (performance.now() < resizingUntil) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        anchor.current = topmostAnchor();
      });
    };
    record();
    window.addEventListener('resize', resizing);
    window.addEventListener('scroll', record, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resizing);
      window.removeEventListener('scroll', record);
    };
  }, []);

  useEffect(() => {
    if (!state) return;
    const now = `${state.size}:${state.posture}`;
    const before = previous.current;
    previous.current = now;
    if (before === null || before === now) return;
    const el = anchor.current;
    if (el?.isConnected) el.scrollIntoView({ block: 'start' });
  }, [state]);
}
