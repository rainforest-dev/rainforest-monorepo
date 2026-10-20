'use client';

import type { ReactNode } from 'react';

import { booksLabel, cn, type StudyModel, type StudyShelf } from '@/lib';

import type { StudyNav, StudyOptionState } from './StudyOption';
import type { StudyInspect } from './useStudyInspect';
import type { StudyPull } from './useStudyPull';

export interface StudyRendererProps {
  model: StudyModel;
  page: number;
  options: StudyOptionState[];
  focusId: number | null;
  reducedMotion: boolean;
  nav: StudyNav;
  pull: StudyPull;
  inspect: StudyInspect;
}

export interface StudyListboxProps {
  model: StudyModel;
  options: StudyOptionState[];
  visibleHeadings: boolean;
  className?: string;
  shelfClassName?: string;
  renderOption: (state: StudyOptionState) => ReactNode;
  renderShelf?: (shelf: StudyShelf, options: ReactNode) => ReactNode;
  onBackgroundClick?: () => void;
  nav: StudyNav;
}

const shelfTitle = (shelf: StudyShelf) =>
  shelf.continued ? `${shelf.label}（續）` : shelf.label;

export function StudyListbox({
  model,
  options,
  visibleHeadings,
  className,
  shelfClassName,
  renderOption,
  renderShelf,
  onBackgroundClick,
  nav,
}: StudyListboxProps) {
  return (
    <div
      ref={nav.containerRef}
      role="listbox"
      aria-label="書牆"
      onKeyDown={nav.onKeyDown}
      onClick={(event) => {
        const target = event.target as Element;
        if (!target.closest('[role="option"]')) onBackgroundClick?.();
      }}
      className={className}
    >
      {model.shelves.map((shelf) => {
        const shelfOptions = options
          .filter((option) => option.shelfKey === shelf.key)
          .map(renderOption);
        return (
          <div
            key={shelf.key}
            role="group"
            aria-label={`${shelfTitle(shelf)}, ${booksLabel(shelf.count)}`}
            data-shelf={shelf.key}
            className={cn('min-w-0', shelfClassName)}
          >
            {visibleHeadings && (
              <div aria-hidden="true" className="flex items-baseline gap-3">
                <h2
                  className={cn(
                    'text-heading font-semibold',
                    shelf.continued && 'text-muted-foreground',
                  )}
                >
                  {shelfTitle(shelf)}
                </h2>
                <span className="text-muted-foreground text-sm">
                  {booksLabel(shelf.count)}
                </span>
              </div>
            )}
            {renderShelf ? renderShelf(shelf, shelfOptions) : shelfOptions}
          </div>
        );
      })}
    </div>
  );
}
