import {
  Button,
  Checkbox,
  cn,
  Spinner,
  TableCell,
  TableRow,
} from '@rainforest-dev/rainforest-react';

import { READ_ONLY_NOTE, type Topic } from '@/lib';
import {
  ACTION_LABEL,
  daysAgo,
  TOPIC_RULES,
  type TopicAction,
  topicSummary,
} from '@/lib/desk';

import { DESK_ROW_CLASS, WIDE_ONLY } from './deskRow';
import { StaleBadge, TopicStatusBadge } from './StatusBadges';
import { TagBadges } from './TagBadges';
import type { TopicActionsState } from './useRegistryActions';

const ACTIONS: readonly TopicAction[] = ['activate', 'decline'];

export interface TopicRowProps {
  topic: Topic;
  tabIndex: 0 | -1;
  actions: TopicActionsState;
  selectMode: boolean;
  selected: boolean;
  onToggle: () => void;
}

export function TopicRow({
  topic,
  tabIndex,
  actions,
  selectMode,
  selected,
  onToggle,
}: TopicRowProps) {
  const summary = topicSummary(topic.description);
  const busy = actions.pending.has(topic.name);
  const writes = ACTIONS.filter((action) => TOPIC_RULES[action](topic));
  return (
    <TableRow
      data-nav-key={topic.name}
      tabIndex={tabIndex}
      aria-selected={selectMode ? selected : undefined}
      data-pending={busy || undefined}
      onClick={selectMode ? onToggle : undefined}
      className={cn(DESK_ROW_CLASS, selectMode && 'cursor-pointer')}
    >
      {selectMode && (
        <TableCell className="w-10">
          <Checkbox
            tabIndex={-1}
            aria-label={`Select ${topic.name}`}
            checked={selected}
            onCheckedChange={onToggle}
            onClick={(event) => event.stopPropagation()}
          />
        </TableCell>
      )}
      <TableCell className="max-w-0 whitespace-normal md:w-[45%]">
        <p className="truncate font-medium">{topic.name}</p>
        {summary && (
          <p className="text-muted-foreground truncate text-xs" title={summary}>
            {summary}
          </p>
        )}
      </TableCell>
      <TableCell className={WIDE_ONLY}>
        <TagBadges tags={topic.tags} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <TopicStatusBadge status={topic.status} />
          {topic.stale && <StaleBadge stale={topic.stale} />}
        </div>
      </TableCell>
      <TableCell
        className={cn('text-muted-foreground text-xs tabular-nums', WIDE_ONLY)}
      >
        {topic.status === 'proposed' && topic.proposedDate
          ? daysAgo(topic.proposedDate)
          : null}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1.5">
          {writes.map((action) => (
            <Button
              key={action}
              size="xs"
              variant={action === 'activate' ? 'default' : 'secondary'}
              tabIndex={-1}
              onClick={(event) => {
                event.stopPropagation();
                void actions.run([topic.name], action, 'row');
              }}
              disabled={busy || !actions.writable}
              title={actions.writable ? undefined : READ_ONLY_NOTE}
            >
              {actions.isRunning('row', action, topic.name) && (
                <Spinner data-icon="inline-start" />
              )}
              {ACTION_LABEL[action]}
            </Button>
          ))}
        </div>
      </TableCell>
    </TableRow>
  );
}
