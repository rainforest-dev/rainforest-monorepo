import { useLibraryT } from '@rainforest-dev/library-shell';
import {
  Button,
  cn,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  KeyHints,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@rainforest-dev/rainforest-react';
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from 'lucide-react';
import { type ReactNode, useLayoutEffect, useMemo } from 'react';

import { type ReadingQueue, sortQueue } from '@/lib';
import {
  deskHints,
  type DeskParams,
  type DeskPatch,
  filterQueue,
  QUEUE_TIERS,
  type QueueSortKey,
  queueTiers,
  tierLabel,
  type ViewCommand,
} from '@/lib/desk';
import { ROOM_NAMESPACE } from '@/locales';

import { WIDE_ONLY } from './deskRow';
import { QueueList, QueueSort } from './QueueList';
import { QueueRow } from './QueueRow';
import { StalePanel } from './StalePanel';
import { useDeskLayout } from './useDeskLayout';
import type { ViewKeysRef } from './useDeskShortcuts';
import { useRovingRows } from './useRovingRows';

interface Column {
  key: QueueSortKey | null;
  /** The column's `desk.col.*` string. */
  label: string;
  className?: string;
}

const NUMERIC = 'text-right [&>button]:-mr-2 [&>button]:ml-auto';

const COLUMNS: readonly Column[] = [
  { key: 'rank', label: 'rank', className: cn('w-14', NUMERIC) },
  { key: 'tier', label: 'tier', className: 'w-16' },
  { key: 'title', label: 'item' },
  { key: null, label: 'why', className: cn('text-xs', WIDE_ONLY) },
  { key: 'decay', label: 'decay', className: WIDE_ONLY },
  { key: 'minutes', label: 'min', className: NUMERIC },
  { key: 'saved', label: 'saved', className: cn(NUMERIC, WIDE_ONLY) },
  { key: 'wiki', label: 'wiki', className: cn(NUMERIC, WIDE_ONLY) },
  { key: 'read', label: 'read', className: NUMERIC },
];

const ALL = 'all';

export interface QueueViewProps {
  data: ReadingQueue | null;
  params: DeskParams;
  navigate: (patch: DeskPatch) => void;
  keys?: ViewKeysRef;
}

export function QueueView({ data, params, navigate, keys }: QueueViewProps) {
  const queue = data?.queue;
  const t = useLibraryT(ROOM_NAMESPACE);
  const columnLabel = (column: Column): ReactNode =>
    column.key === 'rank' ? (
      <>
        <span aria-hidden="true">#</span>
        <span className="sr-only">{t('desk.col.rank')}</span>
      </>
    ) : (
      t(`desk.col.${column.label}`)
    );
  const items = useMemo(
    () =>
      sortQueue(filterQueue(queue ?? [], params.tier), params.sort, params.dir),
    [queue, params.tier, params.sort, params.dir],
  );
  const ids = items.map((item) => item.id);
  const roving = useRovingRows(ids, { page: 1, data: queue });
  const tiers = queueTiers(queue ?? []);
  const { showTable, showList } = useDeskLayout();

  const runKey = (command: ViewCommand, target: Element | null) => {
    if (command.type === 'move') roving.move(command.key);
    else if (command.type === 'open')
      target?.querySelector<HTMLAnchorElement>('a[href]')?.click();
  };

  useLayoutEffect(() => {
    if (!keys) return;
    keys.current = {
      state: {
        paneOpen: false,
        hasSelection: false,
        selectMode: false,
        page: 1,
        pageCount: 1,
        writable: false,
      },
      rowAt: (target) => {
        const id = roving.rowAt(target);
        return id ? { name: id, queueItem: true, pending: false } : null;
      },
      run: (command, _id, target) => runKey(command, target),
    };
    return () => {
      keys.current = null;
    };
  });

  const sortBy = (key: QueueSortKey) => {
    if (key === params.sort)
      navigate({ dir: params.dir === 'asc' ? 'desc' : 'asc' });
    else navigate({ sort: key, dir: 'asc' });
  };

  return (
    <section
      aria-labelledby="queue-heading"
      className="flex min-h-[calc(100dvh-var(--library-top))] min-w-0 flex-col px-4 pb-6 lg:px-6"
    >
      <div className="bg-background lg:top-(--library-top) z-[5] flex flex-col gap-3 py-4 lg:sticky">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2
            id="queue-heading"
            className="text-lg font-semibold max-lg:sr-only"
          >
            {t('desk.queue.heading')}
          </h2>
          {data && (
            <p className="text-muted-foreground text-sm">
              {t('desk.queue.counts', {
                queued: data.counts.queued,
                backlog: data.counts.backlog,
                stale: data.counts.stale,
                scanned: data.counts.scanned,
                generated: data.generated,
              })}
            </p>
          )}
        </div>
        {data && tiers.length > 0 && (
          <ToggleGroup
            aria-label={t('desk.queue.tierLabel')}
            variant="outline"
            size="sm"
            className="max-w-full overflow-x-auto"
            value={[params.tier === null ? ALL : String(params.tier)]}
            onValueChange={(values) => {
              const value = values[0];
              if (value === undefined) return;
              const tier = QUEUE_TIERS.find((t) => String(t) === value) ?? null;
              if (value !== ALL && tier === null) return;
              if (tier !== params.tier) navigate({ tier });
            }}
          >
            <ToggleGroupItem value={ALL}>{t('desk.queue.all')}</ToggleGroupItem>
            {tiers.map((tier) => (
              <Tooltip key={tier}>
                <TooltipTrigger
                  aria-label={`T${tier}: ${tierLabel(tier, t)}`}
                  render={<ToggleGroupItem value={String(tier)} />}
                >
                  T{tier}
                </TooltipTrigger>
                {/* Base UI portals the popup outside every landmark and links it to nothing; the trigger's aria-label already carries the text. */}
                <TooltipContent aria-hidden>
                  {tierLabel(tier, t)}
                </TooltipContent>
              </Tooltip>
            ))}
          </ToggleGroup>
        )}
        {items.length > 0 && (
          <QueueSort
            sort={params.sort}
            dir={params.dir}
            onSort={(sort) => navigate({ sort, dir: 'asc' })}
            onFlip={() =>
              navigate({ dir: params.dir === 'asc' ? 'desc' : 'asc' })
            }
          />
        )}
      </div>

      {!data ? (
        <Empty className="border py-12">
          <EmptyHeader>
            <EmptyTitle>{t('desk.queue.noneTitle')}</EmptyTitle>
            <EmptyDescription>
              {t('desk.queue.noneBefore')}
              <code className="text-primary">reading-queue</code>
              {t('desk.queue.noneAfter')}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : items.length === 0 ? (
        <Empty className="border py-12">
          <EmptyHeader>
            <EmptyTitle>
              {params.tier === null
                ? t('desk.queue.empty')
                : t('desk.queue.emptyTier', { tier: params.tier })}
            </EmptyTitle>
            <EmptyDescription>
              {params.tier === null
                ? t('desk.queue.emptyHint')
                : t('desk.queue.emptyTierHint')}
            </EmptyDescription>
          </EmptyHeader>
          {params.tier !== null && (
            <EmptyContent>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate({ tier: null })}
              >
                {t('desk.queue.allTiers')}
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        showTable && (
          <Table
            ref={roving.ref}
            role="grid"
            aria-labelledby="queue-heading"
            className="table-fixed max-lg:hidden md:table-auto"
          >
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {COLUMNS.map((column, i) => {
                  if (!column.key)
                    return (
                      <TableHead key={i} className={column.className}>
                        {columnLabel(column)}
                      </TableHead>
                    );
                  const active = column.key === params.sort;
                  const Icon = !active
                    ? ArrowUpDownIcon
                    : params.dir === 'asc'
                      ? ArrowUpIcon
                      : ArrowDownIcon;
                  const key = column.key;
                  return (
                    <TableHead
                      key={key}
                      className={column.className}
                      aria-sort={
                        active
                          ? params.dir === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                    >
                      <Button
                        variant="ghost"
                        size="xs"
                        className="-ml-2 flex"
                        onClick={() => sortBy(key)}
                      >
                        {columnLabel(column)}
                        <Icon
                          data-icon="inline-end"
                          aria-hidden="true"
                          className={active ? undefined : 'opacity-40'}
                        />
                      </Button>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <QueueRow
                  key={item.id}
                  item={item}
                  tabIndex={item.id === roving.stop ? 0 : -1}
                />
              ))}
            </TableBody>
          </Table>
        )
      )}
      {showList && items.length > 0 && (
        <QueueList items={items} labelledBy="queue-heading" />
      )}

      {data && data.stale.length > 0 && <StalePanel stale={data.stale} />}

      <KeyHints
        hints={deskHints('queue', false, t)}
        className="bg-background sticky bottom-0 z-[5] mt-auto hidden border-t py-2 lg:flex"
      />
    </section>
  );
}
