import type { Source, StaleType } from '@/lib/registry.types';

export const SOURCE_STATUS_LABEL: Record<Source['status'], string> = {
  active: 'Active',
  proposed: 'Proposed',
  'no-rss': 'No RSS',
  retired: 'Retired',
};

export interface StaleCopy {
  label: string;
  hint: string;
  fix: string | null;
}

export const STALE_COPY: Record<StaleType, StaleCopy> = {
  'feed-dead': {
    label: 'Feed dead',
    hint: 'The feed stopped answering or returns an error.',
    fix: 'Validate the feed below. If it is still down, retire the source.',
  },
  'delivery-gap': {
    label: 'Delivery gap',
    hint: 'The feed still publishes, but Readwise stopped delivering it.',
    fix: 'Re-subscribe in Readwise: paste the feed URL into Add feeds (Shift + A).',
  },
  'low-value': {
    label: 'Low value',
    hint: 'The feed publishes, but little of it is worth reading.',
    fix: 'Retire it unless the last few weeks changed your mind.',
  },
  unspecified: {
    label: 'Unspecified',
    hint: 'Flagged before stale comments carried a type.',
    fix: null,
  },
};

export const UNCATEGORISED = 'Uncategorised';
