'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import { useRovingNav } from '@/hooks';
import {
  contentKey,
  type GroupBy,
  groupEntries,
  groupTitle,
  navKey,
  parseLibraryParams,
} from '@/lib';
import { CALIBRE_NAMESPACE } from '@/locales';
import { useLibrary } from '@/providers';
import type { DeliveryPlatform, LibraryEntry } from '@/types';

import { BookTile } from './BookTile';
import { GroupHeading } from './GroupHeading';

interface Props {
  entries: LibraryEntry[];
  groupBy: GroupBy | null;
  platforms: DeliveryPlatform[];
  page: number;
}

export function ShelfView({ entries, groupBy, platforms, page }: Props) {
  const key = contentKey(entries);
  const t = useLibraryT(CALIBRE_NAMESPACE);
  const groups = useMemo(
    () => (groupBy ? groupEntries(entries, groupBy) : null),
    [key, groupBy],
  );
  const navKeys = useMemo(() => entries.map(navKey), [key]);
  const { containerRef, stopKey, onItemFocus, onKeyDown } =
    useRovingNav<HTMLDivElement>({
      navKeys,
      mode: 'grid',
      page,
      contentKey: key,
    });
  const openId = parseLibraryParams(useSearchParams()).book;
  const { selected, selectMode, toggle, openBook } = useLibrary();
  const marksVisible = selectMode || selected.size > 0;

  const tile = (entry: LibraryEntry, row?: string) => {
    const k = navKey(entry);
    return (
      <BookTile
        key={k}
        book={entry.book}
        navKey={k}
        row={row}
        selected={selected.has(entry.book.id)}
        open={openId === entry.book.id}
        marksVisible={marksVisible}
        platforms={platforms}
        tabIndex={k === stopKey ? 0 : -1}
        onFocus={() => onItemFocus(k)}
        onActivate={() =>
          selectMode ? toggle(entry.book.id) : openBook(entry.book.id)
        }
        onToggle={() => toggle(entry.book.id)}
        className={row ? 'w-32 shrink-0 lg:w-[148px]' : undefined}
      />
    );
  };

  if (!groups) {
    return (
      <div
        ref={containerRef}
        role="listbox"
        aria-label={t('catalogue.books')}
        aria-multiselectable="true"
        onKeyDown={onKeyDown}
        className="grid grid-cols-2 gap-x-5 gap-y-7 lg:grid-cols-[repeat(auto-fill,minmax(148px,1fr))]"
      >
        {entries.map((entry) => tile(entry))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-8"
    >
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-3">
          <div
            role="group"
            aria-label={t('shelf.group', {
              name: groupTitle(group, t),
              books: t('books', { count: group.total }),
            })}
          >
            <GroupHeading group={group} shown={group.entries.length} />
          </div>
          <div
            role="listbox"
            aria-label={t('shelf.groupBooks', { name: groupTitle(group, t) })}
            aria-multiselectable="true"
            className="-mx-1 flex gap-5 overflow-x-auto px-1 pb-2"
          >
            {group.entries.map((entry) => tile(entry, group.key))}
          </div>
        </div>
      ))}
    </div>
  );
}
