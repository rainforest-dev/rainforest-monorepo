'use client';

import { type RefObject, useEffect, useState } from 'react';

import { booksLabel, cn } from '@/lib';

import type { ProjectedLabel } from './Scene';

export type LabelsSink = (labels: readonly ProjectedLabel[]) => void;

export function ShelfLabels({
  sinkRef,
}: {
  sinkRef: RefObject<LabelsSink | null>;
}) {
  const [labels, setLabels] = useState<readonly ProjectedLabel[]>([]);
  useEffect(() => {
    sinkRef.current = setLabels;
    return () => {
      sinkRef.current = null;
    };
  }, [sinkRef]);

  return (
    <div
      aria-hidden="true"
      data-shelf-labels
      className="pointer-events-none absolute inset-0"
    >
      {labels.map((label, i) => (
        <div
          key={`${label.shelfKey}:${i}`}
          data-shelf-label={label.shelfKey}
          style={{ transform: `translate(${label.left}px, ${label.top}px)` }}
          className="absolute left-0 top-0 flex items-baseline gap-2 whitespace-nowrap pl-0.5 pt-2 text-sm"
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
