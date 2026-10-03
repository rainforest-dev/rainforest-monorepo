import {
  Button,
  buttonVariants,
  cn,
  Spinner,
} from '@rainforest-dev/rainforest-react';

import { READ_ONLY_NOTE, type Source } from '@/lib';
import { canResubscribe } from '@/lib/desk';

import type { SourceAction, SourceActionsState } from './useSourceActions';

export const READER_FEEDS_URL = 'https://read.readwise.io/feed/subscriptions';

export interface SourceActionsProps {
  source: Source;
  actions: SourceActionsState;
  layout: 'row' | 'pane';
}

export function SourceActions({ source, actions, layout }: SourceActionsProps) {
  const size = layout === 'row' ? 'xs' : 'sm';
  const width = layout === 'pane' && 'w-full';
  const busy = actions.pending.has(source.name);

  const write = (action: SourceAction, label: string) => (
    <Button
      size={size}
      variant={action === 'activate' ? 'default' : 'secondary'}
      className={cn(width)}
      onClick={(event) => {
        event.stopPropagation();
        void actions.run(source.name, action);
      }}
      disabled={busy || !actions.writable}
      title={actions.writable ? undefined : READ_ONLY_NOTE}
    >
      {busy && <Spinner data-icon="inline-start" />}
      {label}
    </Button>
  );

  if (source.status === 'proposed') return write('activate', 'Activate');
  if (canResubscribe(source))
    return (
      <a
        href={READER_FEEDS_URL}
        target="_blank"
        rel="noopener noreferrer"
        title={`Copies ${source.url} and opens Readwise — paste it there with Shift + A`}
        onClick={(event) => {
          event.stopPropagation();
          void actions.copyFeedUrl(source.name, source.url);
        }}
        className={buttonVariants({
          size,
          variant: 'warning',
          className: width || undefined,
        })}
      >
        {actions.copied === source.name ? 'Copied ✓' : 'Re-subscribe'}
      </a>
    );
  if (source.status === 'active') return write('retire', 'Retire');
  return null;
}
