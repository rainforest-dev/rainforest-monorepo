'use client';

import { Button } from '@rainforest-dev/rainforest-react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import {
  CatalogueView,
  HallSkeleton,
  HallView,
  ShelfView,
  StudySkeleton,
  StudyView,
} from '@/components/views';
import {
  cn,
  type GroupBy,
  type HallBook,
  isStudyGroupBy,
  VIEW_LABELS,
} from '@/lib';
import { useLibrary } from '@/providers';
import type { DeliveryPlatform, FilterOptions, LibraryResult } from '@/types';

import { EmptyResult } from './EmptyResult';

interface Props {
  library: LibraryResult;
  groupBy: GroupBy | null;
  platforms: DeliveryPlatform[];
  filtered: boolean;
  /** Present only for the hall view, which shows the whole library rather than one page. */
  hall?: { books: HallBook[]; filters: FilterOptions };
}

export function ViewRegion({
  library,
  groupBy,
  platforms,
  filtered,
  hall,
}: Props) {
  const { view, isPending, pageInfo, setPageInfo, hallReturn, returnToHall } =
    useLibrary();
  const { page, pageCount, entries } = library;
  useEffect(
    () => setPageInfo({ page, pageCount }),
    [page, pageCount, setPageInfo],
  );
  const ready = pageInfo.page === page && pageInfo.pageCount === pageCount;
  const router = useRouter();
  const needsHall = view === 'hall' && !hall;
  // Switching view is client state; the server only loads the hall's books once it renders the hall.
  useEffect(() => {
    if (needsHall) router.refresh();
  }, [needsHall, router]);

  return (
    <section
      aria-label={`${VIEW_LABELS[view]} view`}
      aria-busy={isPending}
      data-view-region={view}
      data-view-ready={ready || undefined}
      className={cn('transition-opacity', isPending && 'opacity-60')}
    >
      {view === 'study' && hallReturn && (
        <Button
          variant="ghost"
          size="sm"
          data-hall-back
          onClick={returnToHall}
          className="mb-2"
        >
          <ArrowLeft aria-hidden />
          Back to the hall
        </Button>
      )}
      {view === 'hall' ? (
        hall ? (
          <HallView
            books={hall.books}
            filters={hall.filters}
            groupBy={groupBy ?? 'series'}
          />
        ) : (
          <HallSkeleton />
        )
      ) : entries.length === 0 ? (
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
