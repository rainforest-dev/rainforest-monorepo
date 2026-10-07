'use client';

import { type RefObject, useEffect, useState } from 'react';

import { booksLabel, cn, type StudyShelf } from '@/lib';

import type { ProjectedLabel } from './Scene';

export type LabelsSink = (labels: readonly ProjectedLabel[]) => void;

const LABEL_CLASS =
  'absolute left-0 top-0 flex items-baseline gap-2 overflow-hidden whitespace-nowrap pl-0.5 pt-2 text-sm';
const PHOTO_SCRIM_CLASS =
  'rounded-sm in-data-[photo]:bg-[color-mix(in_oklab,var(--muted)_75%,var(--background))]';

const labelText = (text: string, continued: boolean) =>
  continued ? `${text} (continued)` : text;

export function measureLabelPx(
  element: HTMLElement,
): (shelf: StudyShelf, continued: boolean) => number {
  return (shelf, continued) => {
    const probe = document.createElement('div');
    probe.className = LABEL_CLASS;
    probe.style.visibility = 'hidden';
    const name = probe.appendChild(document.createElement('span'));
    name.className = 'font-semibold';
    name.textContent = labelText(shelf.label, continued);
    probe.appendChild(document.createElement('span')).textContent = booksLabel(
      shelf.count,
    );
    element.appendChild(probe);
    const width = probe.getBoundingClientRect().width;
    probe.remove();
    return Math.ceil(width);
  };
}

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
          style={{
            transform: `translate(${label.left}px, ${label.top}px)`,
            maxWidth: `${label.width}px`,
          }}
          className={cn(LABEL_CLASS, PHOTO_SCRIM_CLASS)}
        >
          <span
            className={cn(
              'min-w-0 truncate font-semibold',
              label.continued ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {labelText(label.text, label.continued)}
          </span>
          <span className="text-muted-foreground shrink-0">
            {booksLabel(label.count)}
          </span>
        </div>
      ))}
    </div>
  );
}
