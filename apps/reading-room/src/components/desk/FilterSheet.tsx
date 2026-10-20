import { useLibraryT } from '@rainforest-dev/library-shell';
import {
  Badge,
  Button,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@rainforest-dev/rainforest-react';

import {
  facetCount,
  type FacetKey,
  type Facets,
  hasSourceFilters,
  type SourceFilters,
} from '@/lib/desk';
import { ROOM_NAMESPACE } from '@/locales';

import { FilterPanel } from './FilterPanel';

export interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: SourceFilters;
  facets: Facets;
  shown: number;
  onToggle: (key: FacetKey, value: string) => void;
  onClear: () => void;
}

export function FilterSheet({
  open,
  onOpenChange,
  filters,
  facets,
  shown,
  onToggle,
  onClear,
}: FilterSheetProps) {
  const count = facetCount(filters);
  const t = useLibraryT(ROOM_NAMESPACE);
  return (
    <Sheet side="bottom" open={open} onOpenChange={onOpenChange}>
      <SheetContent
        closeLabel={t('desk.filters.close')}
        className="bg-sidebar text-sidebar-foreground h-auto max-h-[85dvh] gap-0"
      >
        <SheetHeader className="flex-row items-center gap-2 pb-0 pr-14">
          <SheetTitle>{t('desk.filters.title')}</SheetTitle>
          {count > 0 && (
            <Badge variant="muted" className="tabular-nums">
              {count}
              <span className="sr-only">{t('desk.filters.applied')}</span>
            </Badge>
          )}
          {hasSourceFilters(filters) && (
            <Button
              variant="link"
              size="xs"
              className="ml-auto"
              onClick={onClear}
            >
              {t('desk.filters.clearAll')}
            </Button>
          )}
        </SheetHeader>
        <SheetBody className="px-0">
          <FilterPanel
            filters={filters}
            facets={facets}
            header={false}
            onToggle={onToggle}
            onClear={onClear}
          />
        </SheetBody>
        <SheetFooter className="border-t">
          <Button onClick={() => onOpenChange(false)}>
            {t('desk.filters.show', { count: shown })}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
