'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';
import type { ReactNode } from 'react';

import { cn, type StudyModel, type StudyShelf } from '@/lib';
import { HALL_NAMESPACE } from '@/locales';

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
  const t = useLibraryT(HALL_NAMESPACE);
  const shelfTitle = (shelf: StudyShelf) =>
    shelf.continued ? t('study.continued', { name: shelf.label }) : shelf.label;
  return (
    <div
      ref={nav.containerRef}
      role="listbox"
      aria-label={t('study.wall')}
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
            aria-label={t('study.shelf', {
              name: shelfTitle(shelf),
              items: t('items', { count: shelf.count }),
            })}
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
                  {t('items', { count: shelf.count })}
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
