'use client';

import { Button } from '@rainforest-dev/rainforest-react';
import { X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import { activeFilters, type FilterLabels, parseLibraryParams } from '@/lib';
import { useLibrary } from '@/providers';

export function FilterChips({ labels }: { labels: FilterLabels }) {
  const params = parseLibraryParams(useSearchParams());
  const { replaceParams, clearFilters } = useLibrary();
  const chips = activeFilters(params, labels);
  if (chips.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:flex-wrap lg:pb-0">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="bg-muted inline-flex shrink-0 items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-xs"
        >
          {chip.label}
          <button
            type="button"
            aria-label={`Remove filter ${chip.label}`}
            onClick={() => replaceParams(chip.patch)}
            className="hover:bg-foreground/10 rounded-full p-0.5"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <Button
        variant="link"
        size="xs"
        className="shrink-0"
        onClick={clearFilters}
      >
        Clear all
      </Button>
    </div>
  );
}
