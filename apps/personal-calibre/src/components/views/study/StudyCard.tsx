'use client';

import { Button } from '@rainforest-dev/rainforest-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type PointerEvent, type RefObject, useRef } from 'react';

import { cn, type StudyBook } from '@/lib';

const SWIPE_PX = 40;

export interface StudyCardProps {
  book: StudyBook | null;
  hasPrevious: boolean;
  hasNext: boolean;
  scrubbing: boolean;
  inspecting: boolean;
  thumbRef: RefObject<HTMLButtonElement | null>;
  onInspect: () => void;
  onStep: (delta: -1 | 1) => void;
  onOpen: (bookId: number) => void;
}

export function StudyCard({
  book,
  hasPrevious,
  hasNext,
  scrubbing,
  inspecting,
  thumbRef,
  onInspect,
  onStep,
  onOpen,
}: StudyCardProps) {
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onPointerUp = (event: PointerEvent) => {
    const from = swipe.current;
    swipe.current = null;
    if (!from) return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && hasNext) onStep(1);
    if (dx > 0 && hasPrevious) onStep(-1);
  };

  return (
    <div className="pointer-events-none sticky bottom-3 z-10 mt-3 flex justify-center">
      <div aria-live="polite" className="sr-only">
        {book ? `${book.title}, ${book.authors.join(', ')}` : ''}
      </div>
      {book && (
        <section
          aria-label="Pulled book"
          data-study-card
          data-book-id={book.id}
          data-scrubbing={scrubbing || undefined}
          onPointerDown={(event) => {
            swipe.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            swipe.current = null;
          }}
          className={cn(
            'bg-card text-card-foreground pointer-events-auto flex w-full max-w-md touch-pan-y select-none items-center gap-3 rounded-xl border p-2 shadow-lg',
            scrubbing && 'ring-primary ring-2',
            inspecting && 'invisible',
          )}
        >
          <button
            ref={thumbRef}
            type="button"
            aria-label={`Inspect ${book.title} in 3D`}
            data-study-card-thumb
            onClick={onInspect}
            className="focus-visible:ring-ring relative h-16 w-11 shrink-0 cursor-zoom-in overflow-hidden rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ background: `var(--chart-${book.tone})` }}
          >
            {book.hasCover && (
              <img
                src={`/api/books/${book.id}/cover`}
                alt=""
                draggable={false}
                className="size-full object-cover"
              />
            )}
          </button>
          <div
            className="min-w-0 flex-1"
            lang={book.cjk ? 'zh-Hant' : undefined}
          >
            <p data-study-card-title className="truncate text-sm font-semibold">
              {book.title}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {book.authors.join(', ')}
            </p>
            <Button
              size="xs"
              variant="link"
              className="h-auto px-0"
              onClick={() => onOpen(book.id)}
            >
              Open details
            </Button>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              size="icon-sm"
              variant="outline"
              aria-label="Previous book"
              disabled={!hasPrevious}
              onClick={() => onStep(-1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              size="icon-sm"
              variant="outline"
              aria-label="Next book"
              disabled={!hasNext}
              onClick={() => onStep(1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
