'use client';

import type { ReactNode } from 'react';

import { GroupHeading } from '@/components/views/GroupHeading';
import { booksLabel, cn, type StudyModel, type StudyShelf } from '@/lib';

import type { StudyNav, StudyOptionState } from './StudyOption';

export interface StudyRendererProps {
  model: StudyModel;
  page: number;
  options: StudyOptionState[];
  focusId: number | null;
  reducedMotion: boolean;
  nav: StudyNav;
}

export interface StudyListboxProps {
  model: StudyModel;
  options: StudyOptionState[];
  visibleHeadings: boolean;
  className?: string;
  shelfClassName?: string;
  renderOption: (state: StudyOptionState) => ReactNode;
  renderShelf?: (shelf: StudyShelf, options: ReactNode) => ReactNode;
  nav: StudyNav;
}

const shelfTitle = (shelf: StudyShelf) =>
  shelf.continued ? `${shelf.label} (continued)` : shelf.label;

export function StudyListbox({
  model,
  options,
  visibleHeadings,
  className,
  shelfClassName,
  renderOption,
  renderShelf,
  nav,
}: StudyListboxProps) {
  return (
    <div
      ref={nav.containerRef}
      role="listbox"
      aria-label="Bookshelves"
      aria-multiselectable="true"
      onKeyDown={nav.onKeyDown}
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
              <div aria-hidden="true">
                <GroupHeading
                  group={{
                    key: shelf.key,
                    label: shelf.label,
                    total: shelf.count,
                    continued: shelf.continued,
                    filter: null,
                    entries: [],
                  }}
                  shown={shelf.books.length}
                />
              </div>
            )}
            {renderShelf ? renderShelf(shelf, shelfOptions) : shelfOptions}
          </div>
        );
      })}
    </div>
  );
}
