import {
  Button,
  Checkbox,
  cn,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
  Spinner,
} from '@rainforest-dev/rainforest-react';
import { Fragment } from 'react';

import { READ_ONLY_NOTE, type Topic } from '@/lib';
import {
  ACTION_LABEL,
  TOPIC_RULES,
  type TopicAction,
  topicSummary,
} from '@/lib/desk';

import { PHONE_ITEM_CLASS } from './SourceList';
import { StaleBadge, TopicStatusBadge } from './StatusBadges';
import type { TopicActionsState } from './useRegistryActions';
import type { RowSelection } from './useRowSelection';

const ACTIONS: readonly TopicAction[] = ['activate', 'decline'];

export interface TopicListProps {
  topics: readonly Topic[];
  labelledBy: string;
  actions: TopicActionsState;
  selection: RowSelection;
}

export function TopicList({
  topics,
  labelledBy,
  actions,
  selection,
}: TopicListProps) {
  const { selectMode, selected } = selection;
  return (
    <ItemGroup
      aria-labelledby={labelledBy}
      className="gap-0 rounded-lg border lg:hidden"
    >
      {topics.map((topic) => {
        const summary = topicSummary(topic.description);
        const busy = actions.pending.has(topic.name);
        const isSelected = selectMode && selected.has(topic.name);
        const writes = ACTIONS.filter((action) => TOPIC_RULES[action](topic));
        return (
          <Fragment key={topic.name}>
            <ItemSeparator />
            <Item
              role="listitem"
              data-pending={busy || undefined}
              data-selected={isSelected || undefined}
              className={cn(
                PHONE_ITEM_CLASS,
                'flex-nowrap',
                selectMode && 'cursor-pointer',
              )}
              onClick={
                selectMode ? () => selection.toggle(topic.name) : undefined
              }
            >
              {selectMode && (
                <Checkbox
                  aria-label={`Select ${topic.name}`}
                  checked={isSelected}
                  onCheckedChange={() => selection.toggle(topic.name)}
                  onClick={(event) => event.stopPropagation()}
                />
              )}
              <ItemContent className="min-w-0 gap-1">
                <ItemTitle className="max-w-full">
                  <span className="truncate">{topic.name}</span>
                </ItemTitle>
                {summary && (
                  <ItemDescription className="line-clamp-1 text-xs">
                    {summary}
                  </ItemDescription>
                )}
                <div className="flex flex-wrap gap-1">
                  <TopicStatusBadge status={topic.status} />
                  {topic.stale && <StaleBadge stale={topic.stale} />}
                </div>
              </ItemContent>
              {!selectMode && writes.length > 0 && (
                <ItemActions className="shrink-0 gap-1.5">
                  {writes.map((action) => (
                    <Button
                      key={action}
                      size="xs"
                      variant={action === 'activate' ? 'default' : 'secondary'}
                      onClick={() =>
                        void actions.run([topic.name], action, 'row')
                      }
                      disabled={busy || !actions.writable}
                      title={actions.writable ? undefined : READ_ONLY_NOTE}
                    >
                      {actions.isRunning('row', action, topic.name) && (
                        <Spinner data-icon="inline-start" />
                      )}
                      {ACTION_LABEL[action]}
                    </Button>
                  ))}
                </ItemActions>
              )}
            </Item>
          </Fragment>
        );
      })}
    </ItemGroup>
  );
}
