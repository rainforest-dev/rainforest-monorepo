import {
  Badge,
  Button,
  ButtonGroup,
  cn,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@rainforest-dev/rainforest-react';
import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';

import type { QueueItem } from '@/lib';
import {
  QUEUE_SORT_KEYS,
  type QueueSortKey,
  readLabel,
  savedLabel,
  type SortDir,
  tierLabel,
} from '@/lib/desk';

import { PHONE_ITEM_CLASS } from './SourceList';

const SORT_LABEL: Record<QueueSortKey, string> = {
  rank: 'Rank',
  tier: 'Tier',
  title: 'Title',
  decay: 'Decay',
  minutes: 'Minutes',
  saved: 'Saved',
  wiki: 'Wiki sources',
  read: 'Read',
};

const SORT_ITEMS = QUEUE_SORT_KEYS.map((key) => ({
  value: key,
  label: SORT_LABEL[key],
}));

const isSortKey = (value: unknown): value is QueueSortKey =>
  (QUEUE_SORT_KEYS as readonly unknown[]).includes(value);

export interface QueueSortProps {
  sort: QueueSortKey;
  dir: SortDir;
  onSort: (sort: QueueSortKey) => void;
  onFlip: () => void;
}

export function QueueSort({ sort, dir, onSort, onFlip }: QueueSortProps) {
  const ascending = dir === 'asc';
  return (
    <ButtonGroup aria-label="Sort" className="self-start lg:hidden">
      <Select
        items={SORT_ITEMS}
        value={sort}
        onValueChange={(value) => {
          if (isSortKey(value) && value !== sort) onSort(value);
        }}
      >
        <SelectTrigger size="sm" aria-label="Sort by">
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
        aria-label={ascending ? 'Ascending' : 'Descending'}
        title={ascending ? 'Ascending' : 'Descending'}
        onClick={onFlip}
      >
        {ascending ? (
          <ArrowUpIcon aria-hidden="true" />
        ) : (
          <ArrowDownIcon aria-hidden="true" />
        )}
      </Button>
    </ButtonGroup>
  );
}

function meta(item: QueueItem): string {
  return [
    item.siteName,
    `${item.sort.readingMinutes} min`,
    savedLabel(item.sort.savedDaysAgo),
    readLabel(item.sort.progress),
  ]
    .filter(Boolean)
    .join(' · ');
}

export interface QueueListProps {
  items: readonly QueueItem[];
  labelledBy: string;
}

export function QueueList({ items, labelledBy }: QueueListProps) {
  return (
    <ItemGroup
      aria-labelledby={labelledBy}
      className="gap-0 rounded-lg border lg:hidden"
    >
      {items.map((item) => (
        <Item
          key={item.id}
          role="listitem"
          className={cn(PHONE_ITEM_CLASS, 'flex-nowrap')}
        >
          <span className="text-muted-foreground w-5 shrink-0 self-start text-right text-xs tabular-nums leading-5">
            <span className="sr-only">Rank </span>
            {item.rank}
          </span>
          <ItemContent className="min-w-0 gap-0.5">
            <ItemTitle className="max-w-full">
              <a
                href={item.readerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary truncate hover:underline"
              >
                {item.title}
              </a>
            </ItemTitle>
            <ItemDescription className="line-clamp-1 text-xs">
              {meta(item)}
            </ItemDescription>
          </ItemContent>
          <ItemActions className="shrink-0 self-start">
            <Badge variant="muted" title={tierLabel(item.tier)}>
              T{item.tier}
            </Badge>
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  );
}
