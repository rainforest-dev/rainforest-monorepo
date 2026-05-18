import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { BookCard } from '@/components/BookCard';
import { BulkSelectionWrapper } from '@/components/BulkSelectionWrapper';
import { FilterBar } from '@/components/FilterBar';
import { buildPageUrl, Pagination } from '@/components/Pagination';
import { listDeliveryPlatforms } from '@/lib/delivery';
import { getBookList, getFilterOptions, getGroupedBookList,type GroupBy } from '@/lib/queries';
import type { BookGroup } from '@/types/calibre';

interface Props {
  searchParams: Promise<{
    page?: string; q?: string; author?: string; tag?: string; series?: string;
    platform?: string; delivered?: string; groupBy?: string; sortBy?: string; sortDir?: string;
  }>;
}

export default function LibraryPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<div className="space-y-6" />}>
      <LibraryPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LibraryPageContent({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1') || 1);
  const authorId = params.author ? (parseInt(params.author) || undefined) : undefined;
  const tagId = params.tag ? (parseInt(params.tag) || undefined) : undefined;
  const seriesId = params.series ? (parseInt(params.series) || undefined) : undefined;
  const delivered = params.delivered === 'true' ? true : params.delivered === 'false' ? false : undefined;
  const groupBy = (['series', 'tag', 'author'] as const).find((v) => v === params.groupBy);
  const sortBy = (['title', 'author', 'pubdate', 'added', 'rating'] as const).find((v) => v === params.sortBy);
  const sortDir = params.sortDir === 'desc' ? 'desc' : 'asc';

  const [filters, platforms] = await Promise.all([getFilterOptions(), listDeliveryPlatforms()]);

  if (groupBy) {
    const { groups } = await getGroupedBookList({
      q: params.q, authorId, tagId, seriesId,
      platformKey: params.platform, delivered, groupBy, sortBy, sortDir,
    });
    const total = groups.reduce((n, g) => n + g.total, 0);

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Books</h1>
            <p className="text-muted-foreground text-sm">{total} books</p>
          </div>
          <FilterBar filters={filters} platforms={platforms} />
        </div>
        <GroupedView groups={groups} groupBy={groupBy} />
      </div>
    );
  }

  const { books, total } = await getBookList({
    page, q: params.q, authorId, tagId, seriesId,
    platformKey: params.platform, delivered, sortBy, sortDir,
  });

  const totalPages = Math.ceil(total / 30);
  if (page > totalPages && totalPages > 0) {
    redirect(buildPageUrl(1, { q: params.q, author: params.author, tag: params.tag, series: params.series }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Books</h1>
          <p className="text-muted-foreground text-sm">{total} books total</p>
        </div>
        <FilterBar filters={filters} platforms={platforms} />
      </div>
      <BulkSelectionWrapper books={books} from={params} platforms={platforms} />
      <Pagination page={page} totalPages={totalPages} searchParams={params} />
    </div>
  );
}

function GroupedView({ groups, groupBy }: { groups: BookGroup[]; groupBy: GroupBy }) {
  const filterParam = groupBy === 'series' ? 'series' : groupBy === 'tag' ? 'tag' : 'author';
  return (
    <div className="space-y-10">
      {groups.map((group) => (
        <section key={group.key}>
          <div className="mb-3 flex items-baseline justify-between border-b pb-1">
            <h2 className="text-sm font-semibold">{group.label}</h2>
            <span className="text-muted-foreground text-xs">{group.total} books</span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {group.books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
          {group.total > 6 && (
            <div className="mt-3 text-right">
              <Link href={`/?${filterParam}=${group.key}`} className="text-primary text-sm hover:underline">
                See all {group.total} →
              </Link>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
