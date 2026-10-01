'use client';

import { useEffect } from 'react';

import { CatalogueView, ShelfView } from '@/components/views';
import { cn, type GroupBy, VIEW_LABELS } from '@/lib';
import { useLibrary } from '@/providers';
import type { DeliveryPlatform, LibraryResult } from '@/types';

import { EmptyResult } from './EmptyResult';

interface Props {
  library: LibraryResult;
  groupBy: GroupBy | null;
  platforms: DeliveryPlatform[];
  filtered: boolean;
}

export function ViewRegion({ library, groupBy, platforms, filtered }: Props) {
  const { view, isPending, pageInfo, setPageInfo } = useLibrary();
  const { page, pageCount, entries } = library;
  useEffect(
    () => setPageInfo({ page, pageCount }),
    [page, pageCount, setPageInfo],
  );
  const ready = pageInfo.page === page && pageInfo.pageCount === pageCount;

  return (
    <section
      aria-label={`${VIEW_LABELS[view]} view`}
      aria-busy={isPending}
      data-view-region={view}
      data-view-ready={ready || undefined}
      className={cn('transition-opacity', isPending && 'opacity-60')}
    >
      {entries.length === 0 ? (
        <EmptyResult filtered={filtered} />
      ) : view === 'catalogue' ? (
        <CatalogueView
          entries={entries}
          groupBy={groupBy}
          platforms={platforms}
          page={page}
        />
      ) : (
        <ShelfView
          entries={entries}
          groupBy={groupBy}
          platforms={platforms}
          page={page}
        />
      )}
    </section>
  );
}
