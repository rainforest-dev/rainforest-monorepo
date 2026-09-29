'use client';

import { Badge, Button } from '@rainforest-dev/rainforest-react';
import { SlidersHorizontal } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import { booksLabel } from '@/lib/group-entries';
import {
  filterCount,
  type FilterLabels,
  parseLibraryParams,
  scopeTitle,
} from '@/lib/library-params';
import { cn } from '@/lib/utils';

import { BulkToolbar } from './BulkToolbar';
import { FilterChips } from './FilterChips';
import { useLibrary } from './LibraryProvider';
import { GroupSelect, SortControls } from './SortControls';

interface Props {
  labels: FilterLabels;
  matchingBooks: number;
  libraryTotal: number;
  matchingIds: number[];
}

export function LibraryToolbar({
  labels,
  matchingBooks,
  libraryTotal,
  matchingIds,
}: Props) {
  const params = parseLibraryParams(useSearchParams());
  const { selected, selectMode, setSelectMode, setFiltersOpen, clear } =
    useLibrary();
  const count = filterCount(params);
  const bulk = selected.size > 0;
  const scope = scopeTitle(params, labels);
  const total =
    matchingBooks === libraryTotal
      ? booksLabel(libraryTotal)
      : `${matchingBooks} of ${booksLabel(libraryTotal)}`;

  return (
    <div className="bg-background z-20 flex flex-col gap-2 border-b py-3 lg:sticky lg:top-14">
      <div className="flex items-center gap-2 lg:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal aria-hidden />
          Filters
          {count > 0 && <Badge variant="secondary">{count}</Badge>}
        </Button>
        <Button
          variant={selectMode ? 'default' : 'outline'}
          size="sm"
          className="ml-auto"
          onClick={() => {
            if (selectMode) clear();
            setSelectMode(!selectMode);
          }}
        >
          {selectMode ? 'Done' : 'Select'}
        </Button>
      </div>
      {bulk && (
        <BulkToolbar platforms={labels.platforms} matchingIds={matchingIds} />
      )}
      {bulk && <h1 className="sr-only max-lg:hidden">{scope}</h1>}
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-3 gap-y-2',
          bulk && 'lg:hidden',
        )}
      >
        <h1 className="text-heading font-semibold">{scope}</h1>
        <p className="text-muted-foreground text-sm">{total}</p>
        <div className="ml-auto flex items-center gap-2">
          <GroupSelect className="hidden lg:flex" />
          <SortControls />
        </div>
      </div>
      <FilterChips labels={labels} />
    </div>
  );
}
