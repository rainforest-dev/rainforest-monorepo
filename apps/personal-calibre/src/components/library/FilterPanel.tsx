'use client';

import { Button } from '@rainforest-dev/rainforest-react';
import { PanelLeftClose } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import { cn, filterCount, parseLibraryParams } from '@/lib';
import { useLibrary } from '@/providers';
import type { DeliveryPlatform, FilterOptions } from '@/types';

import { DeliveredToggle } from './DeliveredToggle';
import { Facet, type FacetOption } from './Facet';
import { GroupSelect } from './SortControls';

const toOptions = (
  rows: ReadonlyArray<{
    id: number;
    name: string | null;
    sort?: string | null;
  }>,
): FacetOption[] =>
  rows.map((r) => ({
    value: String(r.id),
    label: r.name ?? r.sort ?? `#${r.id}`,
  }));

const toId = (value: string | null) => (value === null ? null : Number(value));

export function FilterPanel({
  options,
  platforms,
}: {
  options: FilterOptions;
  platforms: DeliveryPlatform[];
}) {
  const params = parseLibraryParams(useSearchParams());
  const { replaceParams, clearFilters, togglePanel } = useLibrary();
  const count = filterCount(params);

  return (
    <div className="flex flex-col gap-5 px-2 py-4">
      <div className="flex items-center gap-2 px-2">
        <h2 className="text-sm font-semibold">
          {count > 0 ? `Filters · ${count}` : 'Filters'}
        </h2>
        {count > 0 && (
          <Button
            variant="link"
            size="xs"
            className="ml-auto"
            onClick={clearFilters}
          >
            Clear all
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Collapse filters"
          onClick={togglePanel}
          className={cn('hidden lg:inline-flex', count === 0 && 'ml-auto')}
        >
          <PanelLeftClose aria-hidden />
        </Button>
      </div>
      <GroupSelect className="mx-2 lg:hidden" />
      <Facet
        title="Delivery"
        allLabel="Any platform"
        options={platforms.map((p) => ({ value: p.key, label: p.name }))}
        value={params.platform}
        onChange={(platform) => replaceParams({ platform })}
      >
        <DeliveredToggle
          delivered={params.delivered !== false}
          onChange={(delivered) => replaceParams({ delivered })}
        />
      </Facet>
      <Facet
        title="Tags"
        allLabel="All tags"
        options={toOptions(options.tags)}
        value={params.tag === null ? null : String(params.tag)}
        onChange={(v) => replaceParams({ tag: toId(v) })}
      />
      <Facet
        title="Series"
        allLabel="All series"
        options={toOptions(options.series)}
        value={params.series === null ? null : String(params.series)}
        onChange={(v) => replaceParams({ series: toId(v) })}
      />
      <Facet
        title="Authors"
        allLabel="All authors"
        options={toOptions(options.authors)}
        value={params.author === null ? null : String(params.author)}
        onChange={(v) => replaceParams({ author: toId(v) })}
      />
    </div>
  );
}
