'use client';

import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { booksLabel, cn, rectsOverlap, type ScreenRect } from '@/lib';

import type { ProjectedLabel } from './Scene';

export type LabelsSink = (labels: readonly ProjectedLabel[]) => void;
export type PulledRectSink = (rect: ScreenRect | null) => void;

export function ShelfLabels({
  sinkRef,
  pulledSinkRef,
}: {
  sinkRef: RefObject<LabelsSink | null>;
  pulledSinkRef: RefObject<PulledRectSink | null>;
}) {
  const [labels, setLabels] = useState<readonly ProjectedLabel[]>([]);
  const container = useRef<HTMLDivElement>(null);
  const pulled = useRef<ScreenRect | null>(null);

  const fade = useCallback(() => {
    const rect = pulled.current;
    const elements =
      container.current?.querySelectorAll<HTMLElement>('[data-shelf-label]') ??
      [];
    elements.forEach((element, i) => {
      const label = labels[i];
      const overlaps =
        rect !== null &&
        label !== undefined &&
        rectsOverlap(rect, {
          left: label.left,
          top: label.top,
          width: element.offsetWidth,
          height: element.offsetHeight,
        });
      if (overlaps) element.dataset['faded'] = '';
      else delete element.dataset['faded'];
    });
  }, [labels]);

  useEffect(() => {
    sinkRef.current = setLabels;
    return () => {
      sinkRef.current = null;
    };
  }, [sinkRef]);

  useEffect(() => {
    pulledSinkRef.current = (rect) => {
      pulled.current = rect;
      fade();
    };
    return () => {
      pulledSinkRef.current = null;
    };
  }, [pulledSinkRef, fade]);

  useLayoutEffect(fade, [fade]);

  return (
    <div
      ref={container}
      aria-hidden="true"
      data-shelf-labels
      className="pointer-events-none absolute inset-0"
    >
      {labels.map((label, i) => (
        <div
          key={`${label.shelfKey}:${i}`}
          data-shelf-label={label.shelfKey}
          style={{ transform: `translate(${label.left}px, ${label.top}px)` }}
          className="data-faded:opacity-0 absolute left-0 top-0 flex items-baseline gap-2 whitespace-nowrap pl-0.5 pt-2 text-sm transition-opacity duration-150 motion-reduce:transition-none"
        >
          <span
            className={cn(
              'font-semibold',
              label.continued ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {label.continued ? `${label.text} (continued)` : label.text}
          </span>
          <span className="text-muted-foreground">
            {booksLabel(label.count)}
          </span>
        </div>
      ))}
    </div>
  );
}
