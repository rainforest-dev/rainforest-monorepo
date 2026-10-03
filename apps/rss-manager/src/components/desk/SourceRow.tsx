import {
  Badge,
  Checkbox,
  cn,
  TableCell,
  TableRow,
} from '@rainforest-dev/rainforest-react';

import type { Source } from '@/lib';
import { daysAgo, feedHost, visibleStale } from '@/lib/desk';

import { SourceActions } from './SourceActions';
import { SOURCE_DETAIL_ID } from './SourceDetail';
import { StaleBadge, StatusBadge } from './StatusBadges';
import type { SourceActionsState } from './useSourceActions';

const SHOWN_TAGS = 2;

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

export const WIDE_ONLY = 'max-md:hidden';

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
  const extraTags = source.tags.length - SHOWN_TAGS;
  return (
    <TableRow
      data-nav-key={source.name}
      tabIndex={tabIndex}
      aria-selected={selectMode ? selected : undefined}
      data-open={open || undefined}
      data-pending={actions.pending.has(source.name) || undefined}
      onClick={onOpen}
      className={cn(
        'cursor-pointer outline-none data-[pending]:opacity-60',
        'focus-visible:outline-foreground focus-visible:outline-solid focus-visible:outline-[2.5px] focus-visible:-outline-offset-[2.5px]',
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
            <div className="flex items-center gap-1">
              {source.tags.slice(0, SHOWN_TAGS).map((tag) => (
                <Badge key={tag} variant="muted">
                  {tag}
                </Badge>
              ))}
              {extraTags > 0 && (
                <span
                  className="text-muted-foreground text-xs"
                  title={source.tags.slice(SHOWN_TAGS).join(', ')}
                >
                  +{extraTags}
                </span>
              )}
            </div>
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
