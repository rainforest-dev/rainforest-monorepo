'use client';

import {
  Button,
  ButtonGroup,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@rainforest-dev/rainforest-react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import {
  GROUP_BYS,
  parseLibraryParams,
  SORT_BYS,
  type SortBy,
} from '@/lib/library-params';

import { useLibrary } from './LibraryProvider';

const GROUP_ITEMS = [
  { value: 'none', label: 'None' },
  { value: 'series', label: 'Series' },
  { value: 'tag', label: 'Tag' },
  { value: 'author', label: 'Author' },
];

const SORT_ITEMS: Array<{ value: SortBy; label: string }> = [
  { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
  { value: 'added', label: 'Date added' },
  { value: 'pubdate', label: 'Published' },
  { value: 'rating', label: 'Rating' },
];

export function GroupSelect({ className }: { className?: string }) {
  const params = parseLibraryParams(useSearchParams());
  const { replaceParams } = useLibrary();
  return (
    <Select
      items={GROUP_ITEMS}
      value={params.groupBy ?? 'none'}
      onValueChange={(value) => {
        const next = GROUP_BYS.find((g) => g === value) ?? null;
        replaceParams({ groupBy: next });
      }}
    >
      <SelectTrigger size="sm" aria-label="Group" className={className}>
        <span className="text-muted-foreground text-xs">Group</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {GROUP_ITEMS.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SortControls() {
  const params = parseLibraryParams(useSearchParams());
  const { replaceParams } = useLibrary();
  const descending = params.sortDir === 'desc';
  return (
    <ButtonGroup>
      <Select
        items={SORT_ITEMS}
        value={params.sortBy}
        onValueChange={(value) => {
          const next = SORT_BYS.find((s) => s === value);
          if (next) replaceParams({ sortBy: next });
        }}
      >
        <SelectTrigger size="sm" aria-label="Sort">
          <span className="text-muted-foreground text-xs">Sort</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label={`Sort direction: ${descending ? 'descending' : 'ascending'}`}
        onClick={() => replaceParams({ sortDir: descending ? 'asc' : 'desc' })}
      >
        {descending ? <ArrowDown aria-hidden /> : <ArrowUp aria-hidden />}
      </Button>
    </ButtonGroup>
  );
}
