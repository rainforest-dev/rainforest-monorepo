'use client';

import { Button } from '@rainforest-dev/rainforest-react';
import { X } from 'lucide-react';
import {
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import {
  clampPitch,
  faceAt,
  INSPECT_DRAG_RAD_PER_PX,
  INSPECT_KEY_PITCH,
  INSPECT_KEY_YAW,
  type InspectFace,
  inspectHeightPx,
  type ScreenRect,
  type StudyBook,
  yawDegrees,
} from '@/lib';

import { CssBook, cssBookSize } from './css/CssBook';
import type { InspectStage } from './useStudyInspect';

export interface InspectDialogProps {
  book: StudyBook;
  three: boolean;
  reducedMotion: boolean;
  stage: RefObject<InspectStage>;
  surface: () => HTMLElement | null;
  slotRect: () => ScreenRect | null;
  onClose: () => void;
}

const TAP_SLOP_PX = 6;
const INERTIA_DECAY = 0.88;
const INERTIA_START = 0.5;
const INERTIA_STOP = 0.0004;
const FLY_MS = 420;
const FLY_EASING = 'cubic-bezier(0.2, 0.7, 0.25, 1)';
const SCRIM = 'color-mix(in oklch, black 45%, transparent)';
const FACE_TEXT: Record<InspectFace, string> = {
  front: 'Front cover',
  spine: 'Spine',
  back: 'Back cover',
  edge: 'Page edges',
};

function visibleRect(element: HTMLElement): ScreenRect {
  const rect = element.getBoundingClientRect();
  const left = Math.max(rect.left, 0);
  const top = Math.max(rect.top, 0);
  const right = Math.min(rect.right, window.innerWidth);
  const bottom = Math.min(rect.bottom, window.innerHeight);
  return {
    left,
    top,
    width: Math.max(right - left, 0),
    height: Math.max(bottom - top, 0),
  };
}

const inside = (rect: ScreenRect | null, x: number, y: number) =>
  rect !== null &&
  x >= rect.left &&
  x <= rect.left + rect.width &&
  y >= rect.top &&
  y <= rect.top + rect.height;

export function InspectDialog({
  book,
  three,
  reducedMotion,
  stage,
  surface,
  slotRect,
  onClose,
}: InspectDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const control = useRef<HTMLDivElement>(null);
  const flyer = useRef<HTMLDivElement>(null);
  const cssBook = useRef<HTMLDivElement>(null);
  const inertia = useRef(0);
  const closing = useRef(false);
  const opened = useRef(false);
  const drag = useRef<{
    x: number;
    y: number;
    moved: boolean;
    vYaw: number;
    vPitch: number;
  } | null>(null);
  const [rect, setRect] = useState<ScreenRect | null>(null);
  const titleId = useId();
  const hintId = useId();
  const aspect = book.dims.depth / book.dims.height;
  const height = rect ? inspectHeightPx(rect, aspect) : 0;
  const { width } = cssBookSize(book, height);

  const apply = useCallback(() => {
    const { yaw, pitch } = stage.current;
    stage.current.invalidate();
    if (cssBook.current) {
      cssBook.current.style.transform = `rotateX(${-pitch}rad) rotateY(${yaw}rad)`;
    }
    const slider = control.current;
    if (slider) {
      slider.setAttribute('aria-valuenow', String(yawDegrees(yaw)));
      slider.setAttribute('aria-valuetext', FACE_TEXT[faceAt(yaw)]);
    }
  }, [stage]);

  const rotateBy = useCallback(
    (yaw: number, pitch: number) => {
      stage.current.yaw += yaw;
      stage.current.pitch = clampPitch(stage.current.pitch + pitch);
      apply();
    },
    [stage, apply],
  );

  const stopInertia = () => {
    cancelAnimationFrame(inertia.current);
    inertia.current = 0;
  };

  const dismiss = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    cancelAnimationFrame(inertia.current);
    const from = slotRect();
    const element = flyer.current;
    if (three || reducedMotion || !from || !element) {
      onClose();
      return;
    }
    const to = element.getBoundingClientRect();
    element
      .animate(
        [
          { transform: 'none' },
          {
            transform: `translate(${from.left + from.width / 2 - (to.left + to.width / 2)}px, ${from.top + from.height / 2 - (to.top + to.height / 2)}px) scale(${from.height / to.height})`,
            opacity: 0.4,
          },
        ],
        { duration: FLY_MS * 0.6, easing: FLY_EASING, fill: 'forwards' },
      )
      .finished.then(onClose, onClose);
  }, [three, reducedMotion, slotRect, onClose]);

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!element.open) element.showModal();
    const measure = () => {
      const target = surface();
      if (target) setRect(visibleRect(target));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      cancelAnimationFrame(inertia.current);
      if (element.open) element.close();
    };
  }, [surface]);

  useLayoutEffect(() => {
    if (!rect || opened.current) return;
    opened.current = true;
    apply();
    control.current?.focus({ preventScroll: true });
    const element = flyer.current;
    const from = slotRect();
    if (three || reducedMotion || !element || !from) return;
    const to = element.getBoundingClientRect();
    element.animate(
      [
        {
          transform: `translate(${from.left + from.width / 2 - (to.left + to.width / 2)}px, ${from.top + from.height / 2 - (to.top + to.height / 2)}px) scale(${from.height / to.height}) rotateY(90deg)`,
        },
        { transform: 'none' },
      ],
      { duration: FLY_MS, easing: FLY_EASING },
    );
  }, [rect, three, reducedMotion, apply, slotRect]);

  useEffect(() => {
    const element = control.current;
    if (!element) return;
    // iOS Safari can still scroll the page behind a modal dialog, so the drag cancels touchmove itself.
    const onTouchMove = (event: TouchEvent) => event.preventDefault();
    element.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => element.removeEventListener('touchmove', onTouchMove);
  }, [rect]);

  const bookRect = (): ScreenRect | null => {
    if (three) return stage.current.bookRect();
    const box = cssBook.current?.getBoundingClientRect();
    return box
      ? { left: box.left, top: box.top, width: box.width, height: box.height }
      : null;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    stopInertia();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      moved: false,
      vYaw: 0,
      vPitch: 0,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.moved && Math.hypot(dx, dy) < TAP_SLOP_PX) return;
    current.moved = true;
    current.x = event.clientX;
    current.y = event.clientY;
    current.vYaw = dx * INSPECT_DRAG_RAD_PER_PX;
    current.vPitch = dy * INSPECT_DRAG_RAD_PER_PX;
    rotateBy(current.vYaw, current.vPitch);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    drag.current = null;
    if (!current) return;
    if (!current.moved) {
      if (!inside(bookRect(), event.clientX, event.clientY)) dismiss();
      return;
    }
    if (reducedMotion) return;
    let vYaw = current.vYaw * INERTIA_START;
    let vPitch = current.vPitch * INERTIA_START;
    const step = () => {
      vYaw *= INERTIA_DECAY;
      vPitch *= INERTIA_DECAY;
      if (Math.abs(vYaw) + Math.abs(vPitch) < INERTIA_STOP) {
        inertia.current = 0;
        return;
      }
      rotateBy(vYaw, vPitch);
      inertia.current = requestAnimationFrame(step);
    };
    inertia.current = requestAnimationFrame(step);
  };

  const onSliderKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const turns: Record<string, [number, number]> = {
      ArrowLeft: [-INSPECT_KEY_YAW, 0],
      ArrowRight: [INSPECT_KEY_YAW, 0],
      ArrowUp: [0, -INSPECT_KEY_PITCH],
      ArrowDown: [0, INSPECT_KEY_PITCH],
    };
    const turn = turns[event.key];
    if (event.key === 'Home') {
      stage.current.yaw = 0;
      stage.current.pitch = 0;
      apply();
    } else if (turn) {
      rotateBy(...turn);
    } else {
      return;
    }
    stopInertia();
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      data-inspect
      data-book-id={book.id}
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        dismiss();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) dismiss();
      }}
      className="fixed inset-0 m-0 size-full max-h-none max-w-none overflow-hidden bg-transparent p-0 backdrop:bg-transparent"
    >
      <h2 id={titleId} className="sr-only">
        {`${book.title}, 3D view`}
      </h2>
      <p id={hintId} className="sr-only">
        Drag or use the arrow keys to turn the book. Escape closes.
      </p>
      {rect && (
        <>
          <div
            aria-hidden="true"
            data-inspect-scrim
            className="pointer-events-none absolute rounded-lg"
            style={{
              ...rect,
              background: three ? 'transparent' : SCRIM,
              boxShadow: `0 0 0 100vmax ${SCRIM}`,
            }}
          />
          <div
            ref={control}
            role="slider"
            tabIndex={0}
            aria-label={`Turn ${book.title}`}
            aria-describedby={hintId}
            aria-valuemin={0}
            aria-valuemax={359}
            aria-valuenow={0}
            aria-valuetext={FACE_TEXT.front}
            data-inspect-stage
            onKeyDown={onSliderKey}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              drag.current = null;
            }}
            className="focus-visible:outline-ring absolute touch-none select-none rounded-lg outline-none focus-visible:outline-2 focus-visible:-outline-offset-4"
            style={rect}
          >
            {!three && (
              <div
                ref={flyer}
                className="absolute"
                style={{
                  left: rect.width / 2 - width / 2,
                  top: rect.height / 2 - height / 2,
                  perspective: '1100px',
                }}
              >
                <CssBook
                  ref={cssBook}
                  book={book}
                  height={height}
                  className="bk-inspect"
                />
              </div>
            )}
          </div>
          <Button
            size="icon"
            variant="secondary"
            aria-label="Close 3D view"
            onClick={dismiss}
            className="absolute"
            style={{
              top: rect.top + 8,
              left: rect.left + rect.width - 48,
            }}
          >
            <X />
          </Button>
        </>
      )}
    </dialog>
  );
}
