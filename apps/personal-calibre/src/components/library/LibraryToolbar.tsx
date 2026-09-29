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

import { FilterChips } from './FilterChips';
import { useLibrary } from './LibraryProvider';
import { GroupSelect, SortControls } from './SortControls';

interface Props {
  labels: FilterLabels;
  matchingBooks: number;
  libraryTotal: number;
}

export function LibraryToolbar({ labels, matchingBooks, libraryTotal }: Props) {
  const params = parseLibraryParams(useSearchParams());
  const { selectMode, setSelectMode, setFiltersOpen, clear } = useLibrary();
  const count = filterCount(params);
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-heading font-semibold">
          {scopeTitle(params, labels)}
        </h1>
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
