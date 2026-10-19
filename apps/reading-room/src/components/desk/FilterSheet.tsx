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
  return (
    <Sheet side="bottom" open={open} onOpenChange={onOpenChange}>
      <SheetContent
        closeLabel="Close filters"
        className="bg-sidebar text-sidebar-foreground h-auto max-h-[85dvh] gap-0"
      >
        <SheetHeader className="flex-row items-center gap-2 pb-0 pr-14">
          <SheetTitle>Filters</SheetTitle>
          {count > 0 && (
            <Badge variant="muted" className="tabular-nums">
              {count}
              <span className="sr-only"> applied</span>
            </Badge>
          )}
          {hasSourceFilters(filters) && (
            <Button
              variant="link"
              size="xs"
              className="ml-auto"
              onClick={onClear}
            >
              Clear all
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
            Show {shown} {shown === 1 ? 'source' : 'sources'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
