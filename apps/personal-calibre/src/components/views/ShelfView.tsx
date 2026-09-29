'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import { useLibrary } from '@/components/library/LibraryProvider';
import {
  booksLabel,
  contentKey,
  groupEntries,
  groupTitle,
  navKey,
} from '@/lib/group-entries';
import { type GroupBy, parseLibraryParams } from '@/lib/library-params';
import type { LibraryEntry } from '@/types/calibre';
import type { DeliveryPlatform } from '@/types/delivery';

import { BookTile } from './BookTile';
import { GroupHeading } from './GroupHeading';

interface Props {
  entries: LibraryEntry[];
  groupBy: GroupBy | null;
  platforms: DeliveryPlatform[];
  page: number;
}

export function ShelfView({ entries, groupBy, platforms }: Props) {
  const key = contentKey(entries);
  const groups = useMemo(
    () => (groupBy ? groupEntries(entries, groupBy) : null),
    [key, groupBy],
  );
  const openId = parseLibraryParams(useSearchParams()).book;
  const { selected, selectMode, toggle, openBook } = useLibrary();
  const marksVisible = selectMode || selected.size > 0;

  const tile = (entry: LibraryEntry, row?: string) => (
    <BookTile
      key={navKey(entry)}
      book={entry.book}
      navKey={navKey(entry)}
      row={row}
      selected={selected.has(entry.book.id)}
      open={openId === entry.book.id}
      marksVisible={marksVisible}
      platforms={platforms}
      tabIndex={0}
      onActivate={() =>
        selectMode ? toggle(entry.book.id) : openBook(entry.book.id)
      }
      onToggle={() => toggle(entry.book.id)}
      className={row ? 'w-32 shrink-0 lg:w-[148px]' : undefined}
    />
  );

  if (!groups) {
    return (
      <div
        role="listbox"
        aria-label="Books"
        aria-multiselectable="true"
        className="grid grid-cols-2 gap-x-5 gap-y-7 lg:grid-cols-[repeat(auto-fill,minmax(148px,1fr))]"
      >
        {entries.map((entry) => tile(entry))}
      </div>
    );
  }

  return (
    <div
      role="listbox"
      aria-label="Books"
      aria-multiselectable="true"
      className="flex flex-col gap-8"
    >
      {groups.map((group) => (
        <div
          key={group.key}
          role="group"
          aria-label={`${groupTitle(group)}, ${booksLabel(group.total)}`}
          className="flex flex-col gap-3"
        >
          <GroupHeading group={group} shown={group.entries.length} />
          <div className="-mx-1 flex gap-5 overflow-x-auto px-1 pb-2">
            {group.entries.map((entry) => tile(entry, group.key))}
          </div>
        </div>
      ))}
    </div>
  );
}
