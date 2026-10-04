import {
  Badge,
  type BadgeProps,
  cn,
  TableCell,
  TableRow,
} from '@rainforest-dev/rainforest-react';

import type { Decay, QueueItem } from '@/lib';
import { readLabel, savedLabel, tierLabel } from '@/lib/desk';

import { DESK_ROW_CLASS, WIDE_ONLY } from './deskRow';
import { TagBadges } from './TagBadges';

const DECAY_VARIANT: Record<Decay, BadgeProps['variant'] | null> = {
  'time-sensitive': 'warning',
  evergreen: 'muted',
  unknown: null,
};

export function DecayBadge({ decay }: { decay: Decay }) {
  const variant = DECAY_VARIANT[decay];
  return variant ? <Badge variant={variant}>{decay}</Badge> : null;
}

const NUMBER_CELL = 'text-muted-foreground text-right tabular-nums';

export function QueueRow({
  item,
  tabIndex,
}: {
  item: QueueItem;
  tabIndex: 0 | -1;
}) {
  return (
    <TableRow
      data-nav-key={item.id}
      tabIndex={tabIndex}
      className={DESK_ROW_CLASS}
    >
      <TableCell className={NUMBER_CELL}>{item.rank}</TableCell>
      <TableCell>
        <Badge variant="muted" title={tierLabel(item.tier)}>
          T{item.tier}
        </Badge>
      </TableCell>
      <TableCell className="max-w-0 whitespace-normal md:w-[34%]">
        <a
          href={item.readerUrl}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={-1}
          className="text-primary block truncate font-medium hover:underline"
          title={item.title}
        >
          {item.title}
        </a>
        <div className="mt-0.5 flex min-w-0 items-center gap-2">
          {item.siteName && (
            <span className="text-muted-foreground truncate text-xs">
              {item.siteName}
            </span>
          )}
          <TagBadges tags={item.tags} />
        </div>
      </TableCell>
      <TableCell className={cn('max-w-0 md:w-[26%]', WIDE_ONLY)}>
        <p className="text-muted-foreground truncate text-xs" title={item.why}>
          {item.why}
        </p>
      </TableCell>
      <TableCell className={WIDE_ONLY}>
        <DecayBadge decay={item.decay} />
      </TableCell>
      <TableCell className={NUMBER_CELL}>{item.sort.readingMinutes}</TableCell>
      <TableCell className={cn(NUMBER_CELL, WIDE_ONLY)}>
        {savedLabel(item.sort.savedDaysAgo)}
      </TableCell>
      <TableCell className={cn(NUMBER_CELL, WIDE_ONLY)}>
        {item.sort.wikiSources}
      </TableCell>
      <TableCell className={cn(NUMBER_CELL, 'text-xs')}>
        {readLabel(item.sort.progress)}
      </TableCell>
    </TableRow>
  );
}
