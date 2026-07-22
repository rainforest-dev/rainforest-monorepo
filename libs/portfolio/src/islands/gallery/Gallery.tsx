import {
  type JSX,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { cx } from '../_shared/ui';
import { useReducedMotion } from '../_shared/useReducedMotion';

export interface GalleryImage {
  src?: string;
  alt: string;
  caption?: string;
}

interface GalleryProps {
  images: GalleryImage[];
}

const SWIPE_THRESHOLD_PX = 48;

/** Chevron used for the prev/next controls. */
function Chevron({ dir }: { dir: 'left' | 'right' }): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
      aria-hidden="true"
    >
      <path d={dir === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
    </svg>
  );
}

/** Placeholder shown for a slide that has no real screenshot yet. */
function Placeholder({ image }: { image: GalleryImage }): JSX.Element {
  return (
    <div className="from-muted to-muted/40 text-muted-foreground flex size-full flex-col items-center justify-center gap-3 bg-gradient-to-br p-6 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-10 opacity-60"
        aria-hidden="true"
      >
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </svg>
      <p className="text-foreground/70 max-w-xs text-sm font-medium">
        {image.caption ?? image.alt}
      </p>
      <p className="text-muted-foreground text-xs">Add a real screenshot</p>
    </div>
  );
}

/**
 * A product-screenshot carousel: a 16:9 stage with sliding transitions,
 * prev/next controls, a live counter, a thumbnail rail, and touch-swipe (pointer
 * drag) navigation. All controls are focusable buttons, so navigation is
 * keyboard-accessible. Reduced motion disables the slide animation but keeps all
 * navigation. Slides without a `src` render a labelled placeholder.
 */
export function Gallery({ images }: GalleryProps): JSX.Element | null {
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const count = images.length;
  const dragStart = useRef<number | null>(null);
  const [dragDx, setDragDx] = useState(0);

  const clamp = useCallback(
    (i: number) => (count === 0 ? 0 : (i + count) % count),
    [count],
  );
  const go = useCallback(
    (delta: number) => setIndex((i) => clamp(i + delta)),
    [clamp],
  );

  // Keep index valid if the images array shrinks.
  useEffect(() => {
    if (index > count - 1) setIndex(count === 0 ? 0 : count - 1);
  }, [count, index]);

  const onPointerDown = (event: ReactPointerEvent) => {
    dragStart.current = event.clientX;
    setDragDx(0);
  };
  const onPointerMove = (event: ReactPointerEvent) => {
    if (dragStart.current === null) return;
    setDragDx(event.clientX - dragStart.current);
  };
  const onPointerUp = () => {
    if (dragStart.current === null) return;
    if (Math.abs(dragDx) > SWIPE_THRESHOLD_PX) go(dragDx < 0 ? 1 : -1);
    dragStart.current = null;
    setDragDx(0);
  };

  if (count === 0) return null;

  return (
    <section
      className="not-prose"
      aria-roledescription="carousel"
      aria-label="Product screenshots"
    >
      {/* Swipe container: pointer-drag to change slide. Keyboard/click nav is
          handled by the prev/next and thumbnail buttons below (all focusable). */}
      <div
        className="border-border bg-card group relative overflow-hidden rounded-xl border"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* stage */}
        <div className="aspect-video w-full overflow-hidden">
          <div
            className={cx(
              'flex size-full',
              reducedMotion || dragStart.current !== null
                ? ''
                : 'transition-transform duration-300 ease-out',
            )}
            style={{
              transform: `translateX(calc(-${index * 100}% + ${dragStart.current !== null ? dragDx : 0}px))`,
            }}
          >
            {images.map((image, i) => (
              <div
                key={i}
                className="size-full shrink-0 basis-full select-none"
                aria-hidden={i !== index}
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${count}`}
              >
                {image.src ? (
                  <img
                    src={image.src}
                    alt={image.alt}
                    draggable={false}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    className="size-full object-cover"
                  />
                ) : (
                  <Placeholder image={image} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* prev / next */}
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous screenshot"
              className="border-border/60 bg-background/70 text-foreground hover:bg-background absolute top-1/2 left-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border opacity-0 backdrop-blur transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
            >
              <Chevron dir="left" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next screenshot"
              className="border-border/60 bg-background/70 text-foreground hover:bg-background absolute top-1/2 right-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border opacity-0 backdrop-blur transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
            >
              <Chevron dir="right" />
            </button>
          </>
        )}

        {/* counter */}
        {count > 1 && (
          <div className="bg-background/70 text-foreground absolute right-3 bottom-3 rounded-full px-2.5 py-1 font-mono text-xs backdrop-blur">
            {index + 1} / {count}
          </div>
        )}
      </div>

      {/* caption */}
      {images[index]?.caption && images[index]?.src && (
        <p className="text-muted-foreground mt-3 text-center text-sm">
          {images[index].caption}
        </p>
      )}

      {/* thumbnail rail */}
      {count > 1 && (
        <div
          className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Choose a screenshot"
        >
          {images.map((image, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Screenshot ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cx(
                'relative aspect-video h-14 shrink-0 snap-start overflow-hidden rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                i === index
                  ? 'border-primary ring-primary/40 ring-1'
                  : 'border-border opacity-60 hover:opacity-100',
              )}
            >
              {image.src ? (
                <img
                  src={image.src}
                  alt=""
                  draggable={false}
                  loading="lazy"
                  className="size-full object-cover"
                />
              ) : (
                <span className="bg-muted text-muted-foreground flex size-full items-center justify-center font-mono text-xs">
                  {i + 1}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export default Gallery;
