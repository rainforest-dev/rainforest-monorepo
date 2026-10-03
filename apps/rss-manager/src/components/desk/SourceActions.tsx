import {
  Button,
  buttonVariants,
  cn,
  Spinner,
} from '@rainforest-dev/rainforest-react';

import { READ_ONLY_NOTE, type Source } from '@/lib';
import {
  canResubscribe,
  SOURCE_ACTION_LABEL,
  SOURCE_RULES,
  type SourceAction,
} from '@/lib/desk';

import type { SourceActionsState } from './useRegistryActions';

export const READER_FEEDS_URL = 'https://read.readwise.io/feed/subscriptions';

const ACTIONS: readonly SourceAction[] = ['activate', 'retire'];

export interface SourceActionsProps {
  source: Source;
  actions: SourceActionsState;
  layout: 'row' | 'pane';
}

export function SourceActions({ source, actions, layout }: SourceActionsProps) {
  const size = layout === 'row' ? 'xs' : 'sm';
  const tabIndex = layout === 'row' ? -1 : undefined;
  const width = layout === 'pane' && 'w-full';
  const busy = actions.pending.has(source.name);
  const writes = ACTIONS.filter((action) => SOURCE_RULES[action](source));
  const resubscribe = canResubscribe(source);
  if (writes.length === 0 && !resubscribe) return null;

  return (
    <div
      className={cn(
        'flex gap-1.5',
        layout === 'row' ? 'justify-end' : 'flex-col gap-2',
      )}
    >
      {writes.map((action) => (
        <Button
          key={action}
          size={size}
          variant={action === 'activate' ? 'default' : 'secondary'}
          className={cn(width)}
          tabIndex={tabIndex}
          onClick={(event) => {
            event.stopPropagation();
            void actions.run([source.name], action, layout);
          }}
          disabled={busy || !actions.writable}
          title={actions.writable ? undefined : READ_ONLY_NOTE}
        >
          {actions.isRunning(layout, action, source.name) && (
            <Spinner data-icon="inline-start" />
          )}
          {SOURCE_ACTION_LABEL[action]}
        </Button>
      ))}
      {resubscribe && (
        <a
          href={READER_FEEDS_URL}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={tabIndex}
          title={`Copies ${source.url} and opens Readwise — paste it there with Shift + A`}
          onClick={(event) => {
            event.stopPropagation();
            actions.resubscribe(source.name, source.url);
          }}
          className={buttonVariants({
            size,
            variant: 'warning',
            className: width || undefined,
          })}
        >
          {actions.copied === source.name ? 'Copied' : 'Re-subscribe'}
        </a>
      )}
    </div>
  );
}
