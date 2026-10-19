import { Badge, type BadgeProps } from '@rainforest-dev/rainforest-react';
import {
  CircleOffIcon,
  FlagIcon,
  InboxIcon,
  type LucideIcon,
  TrendingDownIcon,
} from 'lucide-react';

import type { Source, Stale, StaleType, Topic } from '@/lib';
import {
  SOURCE_STATUS_LABEL,
  STALE_COPY,
  TOPIC_STATUS_LABEL,
} from '@/lib/desk';

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
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      {SOURCE_STATUS_LABEL[status]}
    </Badge>
  );
}

const TOPIC_STATUS_VARIANT: Record<Topic['status'], BadgeProps['variant']> = {
  active: 'success',
  proposed: 'info',
  declined: 'muted',
};

export function TopicStatusBadge({ status }: { status: Topic['status'] }) {
  return (
    <Badge variant={TOPIC_STATUS_VARIANT[status]}>
      {TOPIC_STATUS_LABEL[status]}
    </Badge>
  );
}

export function StaleBadge({ stale }: { stale: Stale }) {
  const Icon = STALE_ICON[stale.type];
  return (
    <Badge variant={STALE_VARIANT[stale.type]} title={stale.note || undefined}>
      <Icon data-icon="inline-start" aria-hidden="true" />
      {STALE_COPY[stale.type].label}
    </Badge>
  );
}
