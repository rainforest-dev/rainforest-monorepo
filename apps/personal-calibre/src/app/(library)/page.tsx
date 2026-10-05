import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import {
  KeyHints,
  LibraryToolbar,
  Pagination,
  ViewRegion,
  ViewSkeleton,
} from '@/components/library';
import {
  applyTestHooks,
  buildLibraryHref,
  FAULT_COOKIE,
  type FilterLabels,
  hasFilters,
  isStudyGroupBy,
  PAGE_SIZE,
  parseLibraryParams,
  type RawSearchParams,
  readTestHooks,
  resolveView,
  toLibraryQuery,
  toSearchParams,
} from '@/lib';
import {
  getFilterOptions,
  getLibrary,
  listDeliveryPlatforms,
  readPrefs,
} from '@/lib/server';

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
  const prefs = await readPrefs();
  const view = resolveView(prefs.view, toSearchParams(raw).get('view'));
  if (view === 'study' && !isStudyGroupBy(params.groupBy)) {
    redirect(buildLibraryHref(raw, { groupBy: 'series' }));
  }
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
