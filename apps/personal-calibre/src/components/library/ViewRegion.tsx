'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';
import { useEffect } from 'react';

import {
  CatalogueView,
  ShelfView,
  StudySkeleton,
  StudyView,
} from '@/components/views';
import { cn, type GroupBy, isStudyGroupBy } from '@/lib';
import { CALIBRE_NAMESPACE } from '@/locales';
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
  const t = useLibraryT(CALIBRE_NAMESPACE);
  const { page, pageCount, entries } = library;
  useEffect(
    () => setPageInfo({ page, pageCount }),
    [page, pageCount, setPageInfo],
  );
  const ready = pageInfo.page === page && pageInfo.pageCount === pageCount;

  return (
    <section
      aria-label={t('view.region', { name: t(`view.${view}`) })}
      aria-busy={isPending}
      data-view-region={view}
      data-view-ready={ready || undefined}
      className={cn('transition-opacity', isPending && 'opacity-60')}
    >
      {entries.length === 0 ? (
        <EmptyResult filtered={filtered} />
      ) : view === 'study' ? (
        isStudyGroupBy(groupBy) ? (
          <StudyView
            entries={entries}
            groupBy={groupBy}
            page={page}
            nextPageCoverIds={library.nextPageCoverIds}
          />
        ) : (
          <StudySkeleton />
        )
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
