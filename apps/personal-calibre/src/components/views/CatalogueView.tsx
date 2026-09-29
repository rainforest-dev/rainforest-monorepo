'use client';

import {
  Checkbox,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@rainforest-dev/rainforest-react';
import { useSearchParams } from 'next/navigation';
import { Fragment, useMemo } from 'react';

import { useLibrary } from '@/components/library/LibraryProvider';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useRovingNav } from '@/hooks/useRovingNav';
import {
  contentKey,
  type EntryGroup,
  groupEntries,
  navKey,
} from '@/lib/group-entries';
import { type GroupBy, parseLibraryParams } from '@/lib/library-params';
import { pageCheckState } from '@/lib/selection';
import type { LibraryEntry } from '@/types/calibre';
import type { DeliveryPlatform } from '@/types/delivery';

import { CatalogueRow } from './CatalogueRow';
import { GroupHeading } from './GroupHeading';

interface Props {
  entries: LibraryEntry[];
  groupBy: GroupBy | null;
  platforms: DeliveryPlatform[];
  page: number;
}

export function CatalogueView({ entries, groupBy, platforms, page }: Props) {
  const key = contentKey(entries);
  const groups = useMemo<EntryGroup[]>(
    () =>
      groupBy
        ? groupEntries(entries, groupBy)
        : [
            {
              key: 'all',
              label: '',
              total: entries.length,
              continued: false,
              filter: null,
              entries,
            },
          ],
    [key, groupBy],
  );
  const navKeys = useMemo(() => entries.map(navKey), [key]);
  const pageIds = useMemo(
    () => [...new Set(entries.map((e) => e.book.id))],
    [key],
  );
  const { containerRef, stopKey, onItemFocus, onKeyDown } =
    useRovingNav<HTMLTableElement>({
      navKeys,
      mode: 'list',
      page,
      contentKey: key,
    });
  const openId = parseLibraryParams(useSearchParams()).book;
  const isDesktop = useIsDesktop();
  const { selected, selectMode, toggle, openBook, addMany, removeMany } =
    useLibrary();
  const compact = !isDesktop;
  const wide = isDesktop && openId === null;
  const columns = compact ? 2 : wide ? 6 : 4;
  const headerState = pageCheckState(selected, pageIds);

  return (
    <Table
      ref={containerRef}
      role="grid"
      aria-label="Books"
      aria-multiselectable="true"
      onKeyDown={onKeyDown}
    >
      {compact ? (
        <TableHeader className="sr-only">
          <TableRow>
            <TableHead>Select</TableHead>
            <TableHead>Book</TableHead>
          </TableRow>
        </TableHeader>
      ) : (
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                aria-label="Select all on this page"
                checked={headerState === 'all'}
                indeterminate={headerState === 'some'}
                onCheckedChange={() =>
                  headerState === 'all' ? removeMany(pageIds) : addMany(pageIds)
                }
              />
            </TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Author</TableHead>
            {wide && <TableHead>Formats</TableHead>}
            <TableHead>Delivered</TableHead>
            {wide && <TableHead>Year</TableHead>}
          </TableRow>
        </TableHeader>
      )}
      <TableBody>
        {groups.map((group) => (
          <Fragment key={group.key}>
            {groupBy && (
              <TableRow className="hover:bg-transparent">
                <TableHead
                  colSpan={columns}
                  scope="colgroup"
                  className="bg-muted/40 h-auto py-2"
                >
                  <GroupHeading group={group} shown={group.entries.length} />
                </TableHead>
              </TableRow>
            )}
            {group.entries.map((entry) => {
              const k = navKey(entry);
              return (
                <CatalogueRow
                  key={k}
                  book={entry.book}
                  navKey={k}
                  row={group.key}
                  tabIndex={k === stopKey ? 0 : -1}
                  selected={selected.has(entry.book.id)}
                  open={openId === entry.book.id}
                  compact={compact}
                  wide={wide}
                  platforms={platforms}
                  onFocus={() => onItemFocus(k)}
                  onActivate={() =>
                    selectMode ? toggle(entry.book.id) : openBook(entry.book.id)
                  }
                  onToggle={() => toggle(entry.book.id)}
                />
              );
            })}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}
