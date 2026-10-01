import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { KeyHints } from '@/components/library/KeyHints';
import { LibraryToolbar } from '@/components/library/LibraryToolbar';
import { ViewRegion } from '@/components/library/ViewRegion';
import { ViewSkeleton } from '@/components/library/ViewSkeleton';
import { Pagination } from '@/components/Pagination';
import {
  buildLibraryHref,
  type FilterLabels,
  hasFilters,
  PAGE_SIZE,
  parseLibraryParams,
  type RawSearchParams,
  toLibraryQuery,
} from '@/lib/library-params';
import { listDeliveryPlatforms } from '@/lib/server/delivery';
import { getFilterOptions, getLibrary } from '@/lib/server/queries';
import { applyTestHooks, FAULT_COOKIE, readTestHooks } from '@/lib/test-hooks';

interface Props {
  searchParams: Promise<RawSearchParams>;
}

export default function LibraryPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<ViewSkeleton />}>
      <LibraryContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LibraryContent({ searchParams }: Props) {
  const raw = await searchParams;
  const hooks = readTestHooks(raw, (await cookies()).get(FAULT_COOKIE)?.value);
  await applyTestHooks(hooks, 'list');
  const params = parseLibraryParams(raw);
  const [library, filters, platforms] = await Promise.all([
    getLibrary(toLibraryQuery(params, hooks.pageSize ?? PAGE_SIZE)),
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
