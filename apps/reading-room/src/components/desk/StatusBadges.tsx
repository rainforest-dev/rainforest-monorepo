import { useLibraryT } from '@rainforest-dev/library-shell';
import { Badge, type BadgeProps } from '@rainforest-dev/rainforest-react';
import {
  CircleOffIcon,
  FlagIcon,
  InboxIcon,
  type LucideIcon,
  TrendingDownIcon,
} from 'lucide-react';

import type { Source, Stale, StaleType, Topic } from '@/lib';
import { sourceStatusLabel, staleCopy, topicStatusLabel } from '@/lib/desk';
import { ROOM_NAMESPACE } from '@/locales';

const STATUS_VARIANT: Record<Source['status'], BadgeProps['variant']> = {
  active: 'success',
  proposed: 'info',
  'no-rss': 'muted',
  retired: 'destructive',
};

export const STALE_VARIANT: Record<StaleType, BadgeProps['variant']> = {
  'feed-dead': 'destructive',
  'delivery-gap': 'warning',
  'low-value': 'warning',
  unspecified: 'muted',
};

export const STALE_ICON: Record<StaleType, LucideIcon> = {
  'feed-dead': CircleOffIcon,
  'delivery-gap': InboxIcon,
  'low-value': TrendingDownIcon,
  unspecified: FlagIcon,
};

export function StatusBadge({ status }: { status: Source['status'] }) {
  const t = useLibraryT(ROOM_NAMESPACE);
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      {sourceStatusLabel(status, t)}
    </Badge>
  );
}

const TOPIC_STATUS_VARIANT: Record<Topic['status'], BadgeProps['variant']> = {
  active: 'success',
  proposed: 'info',
  declined: 'muted',
};

export function TopicStatusBadge({ status }: { status: Topic['status'] }) {
  const t = useLibraryT(ROOM_NAMESPACE);
  return (
    <Badge variant={TOPIC_STATUS_VARIANT[status]}>
      {topicStatusLabel(status, t)}
    </Badge>
  );
}

export function StaleBadge({ stale }: { stale: Stale }) {
  const Icon = STALE_ICON[stale.type];
  const t = useLibraryT(ROOM_NAMESPACE);
  return (
    <Badge variant={STALE_VARIANT[stale.type]} title={stale.note || undefined}>
      <Icon data-icon="inline-start" aria-hidden="true" />
      {staleCopy(stale.type, t).label}
    </Badge>
  );
}
