import { useLibraryT } from '@rainforest-dev/library-shell';
import { Button } from '@rainforest-dev/rainforest-react';

import {
  facetCount,
  type FacetKey,
  type Facets,
  facetTitle,
  hasSourceFilters,
  type SourceFilters,
} from '@/lib/desk';
import { ROOM_NAMESPACE } from '@/locales';

import { Facet } from './Facet';

const TAG_LIMIT = 8;
const ORDER: readonly FacetKey[] = ['status', 'stale', 'cat', 'tag'];

export interface FilterPanelProps {
  filters: SourceFilters;
  facets: Facets;
  onToggle: (key: FacetKey, value: string) => void;
  onClear: () => void;
  header?: boolean;
}

export function FilterPanel({
  filters,
  facets,
  onToggle,
  onClear,
  header = true,
}: FilterPanelProps) {
  const count = facetCount(filters);
  const t = useLibraryT(ROOM_NAMESPACE);
  return (
    <div className="flex flex-col gap-5 px-2 py-4">
      {header && (
        <div className="flex h-6 items-center gap-2 px-2">
          <h2 className="text-sm font-semibold">
            {count > 0
              ? t('desk.filters.titleCount', { count })
              : t('desk.filters.title')}
          </h2>
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
        </div>
      )}
      {ORDER.map((key) => (
        <Facet
          key={key}
          title={facetTitle(key, t)}
          options={facets[key]}
          limit={key === 'tag' ? TAG_LIMIT : undefined}
          onToggle={(value) => onToggle(key, value)}
        />
      ))}
    </div>
  );
}
