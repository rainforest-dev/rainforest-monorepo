import {
  Checkbox,
  cn,
  TableCell,
  TableRow,
} from '@rainforest-dev/rainforest-react';

import type { Source } from '@/lib';
import { daysAgo, feedHost, visibleStale } from '@/lib/desk';

import { DESK_ROW_CLASS, WIDE_ONLY } from './deskRow';
import { SourceActions } from './SourceActions';
import { SOURCE_DETAIL_ID } from './SourceDetail';
import { StaleBadge, StatusBadge } from './StatusBadges';
import { TagBadges } from './TagBadges';
import type { SourceActionsState } from './useRegistryActions';

export interface SourceRowProps {
  source: Source;
  open: boolean;
  tabIndex: 0 | -1;
  compact: boolean;
  actions: SourceActionsState;
  selectMode: boolean;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}

export function SourceRow({
  source,
  open,
  tabIndex,
  compact,
  actions,
  selectMode,
  selected,
  onToggle,
  onOpen,
}: SourceRowProps) {
  const stale = visibleStale(source);
  return (
    <TableRow
      data-nav-key={source.name}
      tabIndex={tabIndex}
      aria-selected={selectMode ? selected : undefined}
      data-open={open || undefined}
      data-pending={actions.pending.has(source.name) || undefined}
      onClick={onOpen}
      className={cn(
        'cursor-pointer',
        DESK_ROW_CLASS,
        open && 'shadow-[inset_3px_0_0_var(--color-primary)]',
      )}
    >
      {selectMode && (
        <TableCell className="w-10">
          <Checkbox
            tabIndex={-1}
            aria-label={`Select ${source.name}`}
            checked={selected}
            onCheckedChange={onToggle}
            onClick={(event) => event.stopPropagation()}
          />
        </TableCell>
      )}
      <TableCell className="max-w-0 whitespace-normal md:w-[40%]">
        <button
          type="button"
          tabIndex={-1}
          data-source-open
          aria-current={open || undefined}
          aria-controls={open ? SOURCE_DETAIL_ID : undefined}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="focus-visible:ring-ring/50 block max-w-full truncate rounded-sm text-left font-medium outline-none hover:underline focus-visible:ring-2"
        >
          {source.name}
        </button>
        <p className="text-muted-foreground truncate font-mono text-xs">
          {feedHost(source.url)}
        </p>
      </TableCell>
      {!compact && (
        <>
          <TableCell
            className={cn('text-muted-foreground max-w-48 truncate', WIDE_ONLY)}
          >
            {source.category || '—'}
          </TableCell>
          <TableCell className={WIDE_ONLY}>
            <TagBadges tags={source.tags} />
          </TableCell>
        </>
      )}
      <TableCell>
        <div className="flex items-center gap-1">
          <StatusBadge status={source.status} />
          {stale && <StaleBadge stale={stale} />}
        </div>
      </TableCell>
      {!compact && (
        <TableCell
          className={cn(
            'text-muted-foreground text-xs tabular-nums',
            WIDE_ONLY,
          )}
        >
          {source.status === 'proposed' && source.proposedDate
            ? daysAgo(source.proposedDate)
            : null}
        </TableCell>
      )}
      <TableCell className="text-right">
        <SourceActions source={source} actions={actions} layout="row" />
      </TableCell>
    </TableRow>
  );
}
