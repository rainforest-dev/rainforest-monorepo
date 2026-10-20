import { type LibraryT, useLibraryT } from '@rainforest-dev/library-shell';
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
  ItemSeparator,
  ItemTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@rainforest-dev/rainforest-react';
import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import { Fragment } from 'react';

import type { QueueItem } from '@/lib';
import {
  QUEUE_SORT_KEYS,
  type QueueSortKey,
  readLabel,
  savedLabel,
  type SortDir,
  tierLabel,
} from '@/lib/desk';
import { ROOM_NAMESPACE } from '@/locales';

import { PHONE_ITEM_CLASS } from './SourceList';

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
  const t = useLibraryT(ROOM_NAMESPACE);
  const sortItems = QUEUE_SORT_KEYS.map((key) => ({
    value: key,
    label: t(`desk.sort.${key}`),
  }));
  const direction = ascending ? t('desk.sort.asc') : t('desk.sort.desc');
  return (
    <ButtonGroup
      aria-label={t('desk.sort.label')}
      className="self-start lg:hidden"
    >
      <Select
        items={sortItems}
        value={sort}
        onValueChange={(value) => {
          if (isSortKey(value) && value !== sort) onSort(value);
        }}
      >
        <SelectTrigger size="sm" aria-label={t('desk.sort.by')}>
          <span className="text-muted-foreground text-xs">
            {t('desk.sort.label')}
          </span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label={direction}
        title={direction}
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

function meta(item: QueueItem, t: LibraryT): string {
  return [
    item.siteName,
    t('desk.queue.minutes', { count: item.sort.readingMinutes }),
    savedLabel(item.sort.savedDaysAgo, t),
    readLabel(item.sort.progress, t),
  ]
    .filter(Boolean)
    .join(' · ');
}

export interface QueueListProps {
  items: readonly QueueItem[];
  labelledBy: string;
}

export function QueueList({ items, labelledBy }: QueueListProps) {
  const t = useLibraryT(ROOM_NAMESPACE);
  return (
    <ItemGroup
      aria-labelledby={labelledBy}
      className="gap-0 rounded-lg border lg:hidden"
    >
      {items.map((item) => (
        <Fragment key={item.id}>
          <ItemSeparator />
          <Item role="listitem" className={cn(PHONE_ITEM_CLASS, 'flex-nowrap')}>
            <span className="text-muted-foreground w-5 shrink-0 self-start text-right text-xs tabular-nums leading-5">
              <span className="sr-only">{t('desk.col.rank')} </span>
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
                {meta(item, t)}
              </ItemDescription>
            </ItemContent>
            <ItemActions className="shrink-0 self-start">
              <Badge variant="muted" title={tierLabel(item.tier, t)}>
                T{item.tier}
              </Badge>
            </ItemActions>
          </Item>
        </Fragment>
      ))}
    </ItemGroup>
  );
}
