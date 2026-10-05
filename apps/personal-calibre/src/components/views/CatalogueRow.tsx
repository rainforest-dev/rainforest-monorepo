'use client';

import {
  Checkbox,
  TableCell,
  TableRow,
} from '@rainforest-dev/rainforest-react';

import { cn, seriesLine, spineClass, yearOf } from '@/lib';
import type { DeliveryPlatform, LibraryBook } from '@/types';

import { DeliveryPills } from './DeliveryPills';

interface Props {
  book: LibraryBook;
  navKey: string;
  row: string;
  tabIndex: 0 | -1;
  selected: boolean;
  open: boolean;
  compact: boolean;
  wide: boolean;
  platforms: readonly DeliveryPlatform[];
  onFocus: () => void;
  onActivate: () => void;
  onToggle: () => void;
}

function Cover({ book, className }: { book: LibraryBook; className: string }) {
  return book.hasCover ? (
    <img
      src={`/api/books/${book.id}/cover`}
      alt=""
      loading="lazy"
      className={cn('shrink-0 rounded-sm object-cover', className)}
    />
  ) : (
    <span
      aria-hidden
      className={cn('shrink-0 rounded-sm', spineClass(book.id), className)}
    />
  );
}

export function CatalogueRow({
  book,
  navKey,
  row,
  tabIndex,
  selected,
  open,
  compact,
  wide,
  platforms,
  onFocus,
  onActivate,
  onToggle,
}: Props) {
  const series = book.series ? seriesLine(book.series, book.seriesIndex) : null;
  return (
    <TableRow
      aria-selected={selected}
      tabIndex={tabIndex}
      data-nav-key={navKey}
      data-nav-row={row}
      data-book-id={book.id}
      onFocus={onFocus}
      onClick={onActivate}
      className={cn(
        'hover:bg-muted/55 cursor-pointer outline-none',
        'focus-visible:outline-foreground focus-visible:outline-[2.5px] focus-visible:-outline-offset-[2.5px]',
        selected && 'bg-primary/12 hover:bg-primary/12',
        open && !selected && 'bg-accent',
        open && 'shadow-[inset_3px_0_0_var(--color-primary)]',
      )}
    >
      <TableCell className="w-10">
        <Checkbox
          tabIndex={-1}
          aria-label={`Select ${book.title}`}
          checked={selected}
          onCheckedChange={onToggle}
          onClick={(event) => event.stopPropagation()}
        />
      </TableCell>
      {compact ? (
        <TableCell className="whitespace-normal">
          <div className="flex gap-3">
            <Cover book={book} className="h-[60px] w-10" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="line-clamp-2 font-medium">{book.title}</p>
              <p className="text-muted-foreground truncate text-xs">
                {[book.authors.join(', '), series].filter(Boolean).join(' · ')}
              </p>
              <p className="text-muted-foreground font-mono text-[11px]">
                {book.formats.join(' · ')}
              </p>
              <DeliveryPills keys={book.deliveredTo} platforms={platforms} />
            </div>
          </div>
        </TableCell>
      ) : (
        <>
          <TableCell className="whitespace-normal">
            <div className="flex items-center gap-3">
              <Cover book={book} className="h-[42px] w-7" />
              <div className="min-w-0">
                <p className="line-clamp-2 font-medium">{book.title}</p>
                {series && (
                  <p className="text-muted-foreground truncate text-xs">
                    {series}
                  </p>
                )}
              </div>
            </div>
          </TableCell>
          <TableCell className="text-muted-foreground whitespace-normal">
            {book.authors.join(', ')}
          </TableCell>
          {wide && (
            <TableCell className="font-mono text-xs">
              {book.formats.join(' · ')}
            </TableCell>
          )}
          <TableCell>
            <DeliveryPills keys={book.deliveredTo} platforms={platforms} />
          </TableCell>
          {wide && (
            <TableCell className="tabular-nums">
              {yearOf(book.pubdate) ?? '—'}
            </TableCell>
          )}
        </>
      )}
    </TableRow>
  );
}
