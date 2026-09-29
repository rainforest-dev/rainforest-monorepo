import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { FilterBar } from '@/components/FilterBar';
import { ViewRegion } from '@/components/library/ViewRegion';
import { Pagination } from '@/components/Pagination';
import { listDeliveryPlatforms } from '@/lib/delivery';
import {
  buildLibraryHref,
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

  return (
    <div className="flex flex-col gap-6 py-4">
      <FilterBar filters={filters} platforms={platforms} />
      <ViewRegion
        library={library}
        groupBy={params.groupBy}
        platforms={platforms}
        filtered={hasFilters(params)}
      />
      <Pagination page={library.page} pageCount={library.pageCount} />
    </div>
  );
}
