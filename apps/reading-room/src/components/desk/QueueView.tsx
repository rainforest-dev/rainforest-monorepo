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

import { WIDE_ONLY } from './deskRow';
import { QueueList, QueueSort } from './QueueList';
import { QueueRow } from './QueueRow';
import { StalePanel } from './StalePanel';
import { useDeskLayout } from './useDeskLayout';
import type { ViewKeysRef } from './useDeskShortcuts';
import { useRovingRows } from './useRovingRows';

interface Column {
  key: QueueSortKey | null;
  label: ReactNode;
  className?: string;
}

const NUMERIC = 'text-right [&>button]:-mr-2 [&>button]:ml-auto';

const COLUMNS: readonly Column[] = [
  {
    key: 'rank',
    label: (
      <>
        <span aria-hidden="true">#</span>
        <span className="sr-only">Rank</span>
      </>
    ),
    className: cn('w-14', NUMERIC),
  },
  { key: 'tier', label: 'Tier', className: 'w-16' },
  { key: 'title', label: 'Item' },
  { key: null, label: 'Why', className: cn('text-xs', WIDE_ONLY) },
  { key: 'decay', label: 'Decay', className: WIDE_ONLY },
  { key: 'minutes', label: 'Min', className: NUMERIC },
  { key: 'saved', label: 'Saved', className: cn(NUMERIC, WIDE_ONLY) },
  { key: 'wiki', label: 'Wiki', className: cn(NUMERIC, WIDE_ONLY) },
  { key: 'read', label: 'Read', className: NUMERIC },
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
      className="flex min-h-[calc(100dvh-3.5rem)] min-w-0 flex-col px-4 pb-6 lg:px-6"
    >
      <div className="bg-background z-[5] flex flex-col gap-3 py-4 lg:sticky lg:top-14">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2
            id="queue-heading"
            className="text-lg font-semibold max-lg:sr-only"
          >
            Reading queue
          </h2>
          {data && (
            <p className="text-muted-foreground text-sm">
              {data.counts.queued} queued · {data.counts.backlog} in backlog ·{' '}
              {data.counts.stale} stale · {data.counts.scanned} scanned ·
              generated {data.generated}
            </p>
          )}
        </div>
        {data && tiers.length > 0 && (
          <ToggleGroup
            aria-label="Tier"
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
            <ToggleGroupItem value={ALL}>All</ToggleGroupItem>
            {tiers.map((tier) => (
              <Tooltip key={tier}>
                <TooltipTrigger
                  aria-label={`T${tier}: ${tierLabel(tier)}`}
                  render={<ToggleGroupItem value={String(tier)} />}
                >
                  T{tier}
                </TooltipTrigger>
                {/* Base UI portals the popup outside every landmark and links it to nothing; the trigger's aria-label already carries the text. */}
                <TooltipContent aria-hidden>{tierLabel(tier)}</TooltipContent>
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
            <EmptyTitle>No reading queue has been generated yet.</EmptyTitle>
            <EmptyDescription>
              Run the <code className="text-primary">reading-queue</code> skill
              to build one.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : items.length === 0 ? (
        <Empty className="border py-12">
          <EmptyHeader>
            <EmptyTitle>
              {params.tier === null
                ? 'Nothing queued'
                : `No items in tier ${params.tier}`}
            </EmptyTitle>
            <EmptyDescription>
              {params.tier === null
                ? 'The last reading-queue run queued no items.'
                : 'Every queued item sits in another tier.'}
            </EmptyDescription>
          </EmptyHeader>
          {params.tier !== null && (
            <EmptyContent>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate({ tier: null })}
              >
                Show all tiers
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
                        {column.label}
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
                        {column.label}
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
        hints={deskHints('queue', false)}
        className="bg-background sticky bottom-0 z-[5] mt-auto hidden border-t py-2 lg:flex"
      />
    </section>
  );
}
