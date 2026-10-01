'use client';

import { seriesLine } from '@/lib/format';
import { spineClass } from '@/lib/spine';
import { cn } from '@/lib/utils';
import type { LibraryBook } from '@/types/calibre';
import type { DeliveryPlatform } from '@/types/delivery';

import { DeliveryMarks } from './DeliveryMarks';
import { SelectMark } from './SelectMark';

interface Props {
  book: LibraryBook;
  navKey: string;
  row?: string;
  selected: boolean;
  open: boolean;
  marksVisible: boolean;
  platforms: readonly DeliveryPlatform[];
  tabIndex: 0 | -1;
  onFocus?: () => void;
  onActivate: () => void;
  onToggle: () => void;
  className?: string;
}

export function BookTile({
  book,
  navKey,
  row,
  selected,
  open,
  marksVisible,
  platforms,
  tabIndex,
  onFocus,
  onActivate,
  onToggle,
  className,
}: Props) {
  return (
    <div
      role="option"
      aria-selected={selected}
      aria-label={`${book.title}, ${book.authors.join(', ')}`}
      tabIndex={tabIndex}
      data-nav-key={navKey}
      data-nav-row={row}
      data-book-id={book.id}
      onFocus={onFocus}
      onClick={onActivate}
      className={cn(
        'group/tile flex cursor-pointer flex-col gap-2 outline-none',
        className,
      )}
    >
      <div
        data-tile-cover
        className={cn(
          'relative aspect-[2/3] overflow-hidden rounded-md',
          'group-focus-visible/tile:outline-foreground group-focus-visible/tile:outline-[2.5px] group-focus-visible/tile:outline-offset-4',
          selected && 'ring-primary ring-2',
          open &&
            'after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_0_0_3px_var(--color-primary),inset_0_0_0_4px_var(--color-background)]',
        )}
      >
        {book.hasCover ? (
          <img
            src={`/api/books/${book.id}/cover`}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div
            className={cn('flex size-full items-end p-2', spineClass(book.id))}
          >
            <span className="bg-background/85 line-clamp-4 rounded px-1 text-xs font-medium">
              {book.title}
            </span>
          </div>
        )}
        <DeliveryMarks
          keys={book.deliveredTo}
          platforms={platforms}
          className="absolute right-1.5 top-1.5"
        />
        <SelectMark
          checked={selected}
          visible={marksVisible}
          onToggle={onToggle}
          className="absolute left-1.5 top-1.5"
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="line-clamp-2 text-sm font-medium leading-snug group-focus-visible/tile:underline">
          {book.title}
        </p>
        {book.authors.length > 0 && (
          <p className="text-muted-foreground line-clamp-1 text-xs">
            {book.authors.join(', ')}
          </p>
        )}
        {book.series && (
          <p className="text-muted-foreground line-clamp-1 text-xs">
            {seriesLine(book.series, book.seriesIndex)}
          </p>
        )}
        {book.formats.length > 0 && (
          <p className="text-muted-foreground font-mono text-[11px]">
            {book.formats.join(' · ')}
          </p>
        )}
      </div>
    </div>
  );
}
