'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';
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

import { useIsDesktop, useRovingNav } from '@/hooks';
import {
  contentKey,
  type EntryGroup,
  type GroupBy,
  groupEntries,
  navKey,
  pageCheckState,
  parseLibraryParams,
} from '@/lib';
import { CALIBRE_NAMESPACE } from '@/locales';
import { useLibrary } from '@/providers';
import type { DeliveryPlatform, LibraryEntry } from '@/types';

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
  const t = useLibraryT(CALIBRE_NAMESPACE);
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
      aria-label={t('catalogue.books')}
      aria-multiselectable="true"
      onKeyDown={onKeyDown}
    >
      {compact ? (
        <TableHeader className="sr-only">
          <TableRow>
            <TableHead>{t('catalogue.select')}</TableHead>
            <TableHead>{t('catalogue.book')}</TableHead>
          </TableRow>
        </TableHeader>
      ) : (
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                aria-label={t('catalogue.selectPage')}
                checked={headerState === 'all'}
                indeterminate={headerState === 'some'}
                onCheckedChange={() =>
                  headerState === 'all' ? removeMany(pageIds) : addMany(pageIds)
                }
              />
            </TableHead>
            <TableHead>{t('catalogue.title')}</TableHead>
            <TableHead>{t('catalogue.author')}</TableHead>
            {wide && <TableHead>{t('catalogue.formats')}</TableHead>}
            <TableHead>{t('catalogue.delivered')}</TableHead>
            {wide && <TableHead>{t('catalogue.year')}</TableHead>}
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
