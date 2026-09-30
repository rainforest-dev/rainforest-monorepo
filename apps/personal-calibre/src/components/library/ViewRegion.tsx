'use client';

import { useEffect } from 'react';

import { CatalogueView } from '@/components/views/CatalogueView';
import { ShelfView } from '@/components/views/ShelfView';
import type { GroupBy } from '@/lib/library-params';
import { VIEW_LABELS } from '@/lib/prefs';
import { cn } from '@/lib/utils';
import type { LibraryResult } from '@/types/calibre';
import type { DeliveryPlatform } from '@/types/delivery';

import { EmptyResult } from './EmptyResult';
import { useLibrary } from './LibraryProvider';

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
