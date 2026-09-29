import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { KeyHints } from '@/components/library/KeyHints';
import { LibraryToolbar } from '@/components/library/LibraryToolbar';
import { ViewRegion } from '@/components/library/ViewRegion';
import { Pagination } from '@/components/Pagination';
import { listDeliveryPlatforms } from '@/lib/delivery';
import {
  buildLibraryHref,
  type FilterLabels,
  hasFilters,
  PAGE_SIZE,
  parseLibraryParams,
  type RawSearchParams,
  toLibraryQuery,
} from '@/lib/library-params';
import { getFilterOptions, getLibrary } from '@/lib/queries';

interface Props {
  searchParams: Promise<RawSearchParams>;
}

export default function LibraryPage({ searchParams }: Props) {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          aria-busy="true"
          aria-label="Loading books"
          className="min-h-[60vh]"
        />
      }
    >
      <LibraryContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LibraryContent({ searchParams }: Props) {
  const raw = await searchParams;
  const params = parseLibraryParams(raw);
  const [library, filters, platforms] = await Promise.all([
    getLibrary(toLibraryQuery(params, PAGE_SIZE)),
    getFilterOptions(),
    listDeliveryPlatforms(),
  ]);
  if (params.page > library.pageCount) {
    redirect(buildLibraryHref(raw, { page: library.pageCount }));
  }

  const labels: FilterLabels = { ...filters, platforms };
  return (
    <div className="flex flex-col gap-4">
      <LibraryToolbar
        labels={labels}
        matchingBooks={library.matchingIds.length}
        libraryTotal={library.libraryTotal}
        matchingIds={library.matchingIds}
      />
      <ViewRegion
        library={library}
        groupBy={params.groupBy}
        platforms={platforms}
        filtered={hasFilters(params)}
      />
      <Pagination page={library.page} pageCount={library.pageCount} />
      <KeyHints />
    </div>
  );
}
