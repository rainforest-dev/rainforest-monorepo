'use client';

import {
  type PointerEvent,
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { pageImageUrl } from '@/components/notebooks/api';
import {
  type BookMode,
  cn,
  commitsTurn,
  easeTurn,
  edgeWidth,
  pageNumberOf,
  type Spread,
  stackDepth,
  TURN_MS,
} from '@/lib';
import type { NotebookPage } from '@/types';

export interface FlipBookHandle {
  /** Turns one spread forward (1) or back (-1), animated; ignored past either board. */
  turn(dir: 1 | -1): void;
}

interface Turn {
  dir: 1 | -1;
  progress: number;
}

interface Drag {
  pointerId: number;
  x0: number;
  lastX: number;
  lastT: number;
  speed: number;
  turning: boolean;
}

const DRAG_SLOP = 6;

function PageFace({
  page,
  side,
}: {
  page: NotebookPage | undefined;
  side: 'left' | 'right' | 'single';
}) {
  if (!page) return <div className="bg-card size-full" />;
  return (
    <div className="bg-card relative size-full overflow-hidden">
      <img
        src={pageImageUrl(page.id)}
        alt={`Page ${pageNumberOf(page)}`}
        draggable={false}
        className="size-full object-contain"
      />
      {/* Shadows stay black in both schemes: paper darkens toward the spine. */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0',
          side === 'left' &&
            'bg-gradient-to-r from-transparent from-80% to-black/20',
          side === 'right' &&
            'bg-gradient-to-l from-transparent from-85% to-black/20',
          side === 'single' &&
            'from-92% bg-gradient-to-l from-transparent to-black/15',
        )}
      />
    </div>
  );
}

function Edge({ pages, side }: { pages: number; side: 'left' | 'right' }) {
  const width = edgeWidth(pages);
  if (width === 0) return null;
  return (
    <div
      aria-hidden
      style={{ width }}
      className={cn(
        'absolute bottom-[-4px] top-1 bg-[repeating-linear-gradient(90deg,var(--color-card)_0_1px,var(--color-border)_1px_2px)]',
        side === 'left' ? 'right-full rounded-l-sm' : 'left-full rounded-r-sm',
      )}
    />
  );
}

/**
 * Notebook pages as an open book: two facing pages on a wide screen, one on a phone. A page turns
 * about the spine, following a drag or animating on a click or key, with its back showing the next
 * page. The parent owns which spread is open; this owns the turn in flight.
 */
export function FlipBook({
  pages,
  spreads,
  spreadIndex,
  mode,
  reducedMotion,
  onChange,
  ref,
}: {
  pages: readonly NotebookPage[];
  spreads: readonly Spread[];
  spreadIndex: number;
  mode: BookMode;
  reducedMotion: boolean;
  onChange: (index: number) => void;
  ref?: Ref<FlipBookHandle>;
}) {
  const [turn, setTurn] = useState<Turn | null>(null);
  const frame = useRef(0);
  const drag = useRef<Drag | null>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const current = spreads[spreadIndex];

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const canTurn = (dir: 1 | -1) =>
    spreads[spreadIndex + dir] !== undefined && !turn;

  function animate(dir: 1 | -1, from: number, to: 0 | 1) {
    cancelAnimationFrame(frame.current);
    const finish = () => {
      setTurn(null);
      if (to === 1) onChange(spreadIndex + dir);
    };
    if (reducedMotion) {
      finish();
      return;
    }
    const duration = TURN_MS * Math.max(0.25, Math.abs(to - from));
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setTurn({ dir, progress: from + (to - from) * easeTurn(t) });
      if (t < 1) frame.current = requestAnimationFrame(step);
      else finish();
    };
    frame.current = requestAnimationFrame(step);
  }

  function startTurn(dir: 1 | -1) {
    if (!canTurn(dir)) return;
    setTurn({ dir, progress: 0 });
    animate(dir, 0, 1);
  }

  useImperativeHandle(ref, () => ({ turn: startTurn }));

  const pageWidth = () => {
    const width = bookRef.current?.getBoundingClientRect().width ?? 1;
    return mode === 'spread' ? width / 2 : width;
  };

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (turn || event.button !== 0) return;
    drag.current = {
      pointerId: event.pointerId,
      x0: event.clientX,
      lastX: event.clientX,
      lastT: event.timeStamp,
      speed: 0,
      turning: false,
    };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const dx = event.clientX - state.x0;
    const dt = Math.max(1, event.timeStamp - state.lastT);
    state.speed = Math.abs(event.clientX - state.lastX) / dt;
    state.lastX = event.clientX;
    state.lastT = event.timeStamp;
    if (!state.turning) {
      if (Math.abs(dx) < DRAG_SLOP) return;
      const dir = dx < 0 ? 1 : -1;
      if (spreads[spreadIndex + dir] === undefined) {
        drag.current = null;
        return;
      }
      state.turning = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const dir: 1 | -1 = dx < 0 ? 1 : -1;
    const reach = pageWidth() * (mode === 'spread' ? 1.5 : 1);
    setTurn({ dir, progress: Math.min(1, Math.abs(dx) / reach) });
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    drag.current = null;
    if (!state || state.pointerId !== event.pointerId) return;
    if (state.turning && turn) {
      animate(
        turn.dir,
        turn.progress,
        commitsTurn(turn.progress, state.speed) ? 1 : 0,
      );
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const share = (event.clientX - rect.left) / rect.width;
    startTurn(share >= (mode === 'spread' ? 0.5 : 0.4) ? 1 : -1);
  }

  function onPointerCancel() {
    drag.current = null;
    if (turn) animate(turn.dir, turn.progress, 0);
  }

  if (!current) return null;
  const target = turn ? spreads[spreadIndex + turn.dir] : undefined;
  const at = (index: number | null | undefined) =>
    index === null || index === undefined ? undefined : pages[index];

  let staticLeft = current.left;
  let staticRight = current.right;
  let leaf:
    | {
        side: 'left' | 'right';
        front: number | null;
        back: number | null;
        angle: number;
      }
    | undefined;
  if (turn && target) {
    const p = turn.progress;
    if (mode === 'single') {
      staticRight = turn.dir === 1 ? target.right : current.right;
      leaf =
        turn.dir === 1
          ? { side: 'right', front: current.right, back: null, angle: -180 * p }
          : {
              side: 'right',
              front: target.right,
              back: null,
              angle: -180 * (1 - p),
            };
    } else if (turn.dir === 1) {
      staticRight = target.right;
      leaf = {
        side: 'right',
        front: current.right,
        back: target.left,
        angle: -180 * p,
      };
    } else {
      staticLeft = target.left;
      leaf = {
        side: 'left',
        front: current.left,
        back: target.right,
        angle: 180 * p,
      };
    }
  }
  const depth = stackDepth(current, pages.length);
  const shade = leaf ? Math.sin((Math.abs(leaf.angle) * Math.PI) / 180) : 0;
  const neighbours = [spreads[spreadIndex - 1], spreads[spreadIndex + 1]]
    .flatMap((spread) => (spread ? [spread.left, spread.right] : []))
    .filter((index): index is number => index !== null);

  return (
    <div
      className={cn(
        'relative mx-auto w-full',
        mode === 'spread'
          ? 'aspect-[3/2] max-w-[min(56rem,calc((100dvh-15rem)*1.5))]'
          : 'aspect-[3/4] max-w-[min(28rem,calc((100dvh-15rem)*0.75))]',
      )}
    >
      <Edge pages={depth.before} side="left" />
      <Edge pages={depth.after} side="right" />
      <div
        ref={bookRef}
        role="presentation"
        data-testid="flip-book"
        data-spread={spreadIndex}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        className={cn(
          'relative grid size-full cursor-pointer touch-pan-y select-none rounded-md shadow-[0_18px_40px_-12px_rgb(0_0_0/0.35)] [perspective:2400px]',
          mode === 'spread' ? 'grid-cols-2' : 'grid-cols-1',
        )}
      >
        {mode === 'spread' && (
          <div className="overflow-hidden rounded-l-md">
            {staticLeft !== null && (
              <PageFace page={at(staticLeft)} side="left" />
            )}
          </div>
        )}
        <div
          className={cn(
            'relative overflow-hidden',
            mode === 'spread' ? 'rounded-r-md' : 'rounded-md',
          )}
        >
          {staticRight !== null && (
            <PageFace
              page={at(staticRight)}
              side={mode === 'spread' ? 'right' : 'single'}
            />
          )}
          {leaf && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-black"
              style={{ opacity: 0.18 * shade }}
            />
          )}
        </div>
        {leaf && (
          <div
            aria-hidden
            className={cn(
              'absolute inset-y-0 [transform-style:preserve-3d]',
              mode === 'single'
                ? 'inset-x-0 origin-left'
                : leaf.side === 'right'
                  ? 'left-1/2 right-0 origin-left'
                  : 'left-0 right-1/2 origin-right',
            )}
            style={{ transform: `rotateY(${leaf.angle}deg)` }}
          >
            <div className="absolute inset-0 overflow-hidden [backface-visibility:hidden]">
              <PageFace
                page={at(leaf.front)}
                side={
                  mode === 'single'
                    ? 'single'
                    : leaf.side === 'right'
                      ? 'right'
                      : 'left'
                }
              />
              <div
                className="absolute inset-0 bg-black"
                style={{ opacity: 0.22 * shade }}
              />
            </div>
            <div className="absolute inset-0 overflow-hidden [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <PageFace
                page={at(leaf.back)}
                side={leaf.side === 'right' ? 'left' : 'right'}
              />
              <div
                className="absolute inset-0 bg-black"
                style={{ opacity: 0.12 * shade }}
              />
            </div>
          </div>
        )}
      </div>
      <div hidden>
        {neighbours.map((index) => {
          const page = pages[index];
          return page ? (
            <img key={page.id} src={pageImageUrl(page.id)} alt="" />
          ) : null;
        })}
      </div>
    </div>
  );
}
