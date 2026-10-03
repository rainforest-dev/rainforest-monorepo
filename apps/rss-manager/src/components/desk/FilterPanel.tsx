import { Button } from '@rainforest-dev/rainforest-react';

import {
  FACET_TITLE,
  facetCount,
  type FacetKey,
  type Facets,
  hasSourceFilters,
  type SourceFilters,
} from '@/lib/desk';

import { Facet } from './Facet';

const TAG_LIMIT = 8;
const ORDER: readonly FacetKey[] = ['status', 'stale', 'cat', 'tag'];

export interface FilterPanelProps {
  filters: SourceFilters;
  facets: Facets;
  onToggle: (key: FacetKey, value: string) => void;
  onClear: () => void;
}

export function FilterPanel({
  filters,
  facets,
  onToggle,
  onClear,
}: FilterPanelProps) {
  const count = facetCount(filters);
  return (
    <div className="flex flex-col gap-5 px-2 py-4">
      <div className="flex h-6 items-center gap-2 px-2">
        <h2 className="text-sm font-semibold">
          {count > 0 ? `Filters · ${count}` : 'Filters'}
        </h2>
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
      </div>
      {ORDER.map((key) => (
        <Facet
          key={key}
          title={FACET_TITLE[key]}
          options={facets[key]}
          limit={key === 'tag' ? TAG_LIMIT : undefined}
          onToggle={(value) => onToggle(key, value)}
        />
      ))}
    </div>
  );
}
