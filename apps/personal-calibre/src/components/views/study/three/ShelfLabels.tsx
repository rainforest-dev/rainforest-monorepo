'use client';

import type { LibraryT } from '@rainforest-dev/library-shell';
import { useLibraryT } from '@rainforest-dev/library-shell';
import { type RefObject, useEffect, useState } from 'react';

import { cn, groupTitle, type StudyShelf } from '@/lib';
import { CALIBRE_NAMESPACE } from '@/locales';

import type { ProjectedLabel } from './Scene';

export type LabelsSink = (labels: readonly ProjectedLabel[]) => void;

const LABEL_CLASS =
  'absolute left-0 top-0 flex items-baseline gap-2 overflow-hidden whitespace-nowrap pl-0.5 pt-2 text-sm';
const PHOTO_SCRIM_CLASS =
  'rounded-sm in-data-[photo]:bg-[color-mix(in_oklab,var(--muted)_75%,var(--background))]';

export function measureLabelPx(
  element: HTMLElement,
  t: LibraryT,
): (shelf: StudyShelf, continued: boolean) => number {
  return (shelf, continued) => {
    const probe = document.createElement('div');
    probe.className = LABEL_CLASS;
    probe.style.visibility = 'hidden';
    const name = probe.appendChild(document.createElement('span'));
    name.className = 'font-semibold';
    name.textContent = groupTitle({ ...shelf, continued }, t);
    probe.appendChild(document.createElement('span')).textContent = t('books', {
      count: shelf.count,
    });
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
  const t = useLibraryT(CALIBRE_NAMESPACE);
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
            {groupTitle(
              {
                key: label.shelfKey,
                label: label.text,
                continued: label.continued,
              },
              t,
            )}
          </span>
          <span className="text-muted-foreground shrink-0">
            {t('books', { count: label.count })}
          </span>
        </div>
      ))}
    </div>
  );
}
