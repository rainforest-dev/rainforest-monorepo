import { BookGrid } from '@/components/BookGrid';
import { FilterPanel } from '@/components/FilterPanel';
import { getBookList, getFilterOptions } from '@/lib/queries';

interface Props {
  searchParams: Promise<{
    page?: string;
    q?: string;
    author?: string;
    tag?: string;
    series?: string;
  }>;
}

export default async function LibraryPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1') || 1);
  const authorId = params.author ? (parseInt(params.author) || undefined) : undefined;
  const tagId = params.tag ? (parseInt(params.tag) || undefined) : undefined;
  const seriesId = params.series ? (parseInt(params.series) || undefined) : undefined;

  const [{ books, total }, filters] = await Promise.all([
    getBookList({ page, q: params.q, authorId, tagId, seriesId }),
    getFilterOptions(),
  ]);

  const totalPages = Math.ceil(total / 30);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Books</h1>
          <p className="text-muted-foreground text-sm">{total} books total</p>
        </div>
        <FilterPanel filters={filters} />
      </div>
      <BookGrid books={books} />
      {totalPages > 1 && (
        <div className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
          <span>
            Page {page} of {totalPages}
          </span>
        </div>
      )}
    </div>
  );
}
