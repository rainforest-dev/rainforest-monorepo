'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';
import { Badge, Button } from '@rainforest-dev/rainforest-react';
import { SlidersHorizontal } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import {
  cn,
  filterCount,
  type FilterLabels,
  parseLibraryParams,
  scopeTitle,
} from '@/lib';
import { CALIBRE_NAMESPACE } from '@/locales';
import { useLibrary } from '@/providers';

import { BackendBadge } from './BackendBadge';
import { BulkToolbar } from './BulkToolbar';
import { FilterChips } from './FilterChips';
import { RendererSelect } from './RendererSelect';
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
  const t = useLibraryT(CALIBRE_NAMESPACE);
  const bulk = selected.size > 0;
  const scope = scopeTitle(params, labels, t);
  const total =
    matchingBooks === libraryTotal
      ? t('books', { count: libraryTotal })
      : t('toolbar.matching', {
          matching: matchingBooks,
          total: t('books', { count: libraryTotal }),
        });

  return (
    <div className="bg-background z-20 flex flex-col gap-2 border-b py-3 lg:sticky lg:top-14">
      <div className="flex items-center gap-2 lg:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal aria-hidden />
          {t('filters.title')}
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
          {selectMode ? t('toolbar.done') : t('toolbar.select')}
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
        <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2">
          <BackendBadge />
          <RendererSelect />
          <GroupSelect className="hidden lg:flex" />
          <SortControls />
        </div>
      </div>
      <FilterChips labels={labels} />
    </div>
  );
}
