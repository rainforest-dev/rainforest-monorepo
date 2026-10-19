import type { QueueItem, StaleItem, StaleReason } from '@/lib/readingQueue';

import { QUEUE_TIERS, type QueueTier } from './params.js';

export const TIER_LABELS: Record<QueueTier, string> = {
  1: 'Finish what you started',
  2: 'Blind spot in your stack',
  3: 'Wiki leverage',
  4: 'Covered interest',
};

export const tierLabel = (tier: number): string =>
  TIER_LABELS[tier as QueueTier] ?? `Tier ${tier}`;

export const STALE_REASON_LABELS: Record<StaleReason, string> = {
  'done-unfiled': 'Read but never archived',
  expired: 'Time-sensitive and past its window',
  'off-stack': 'Evergreen, but off your current stack',
  'deferred-dead': 'Deferred to Later and never opened',
  abandoned: 'Abandoned part-way',
  duplicate: 'Duplicate of another saved item',
  malformed: 'Malformed title',
};

const STALE_REASON_ORDER = Object.keys(STALE_REASON_LABELS) as StaleReason[];

export interface StaleGroup {
  reason: StaleReason;
  label: string;
  items: StaleItem[];
}

export function groupStale(items: readonly StaleItem[]): StaleGroup[] {
  return STALE_REASON_ORDER.map((reason) => ({
    reason,
    label: STALE_REASON_LABELS[reason],
    items: items.filter((item) => item.reason === reason),
  })).filter((group) => group.items.length > 0);
}

export function queueTiers(items: readonly QueueItem[]): QueueTier[] {
  const present = new Set(items.map((item) => item.tier));
  return QUEUE_TIERS.filter((tier) => present.has(tier));
}

export function filterQueue(
  items: readonly QueueItem[],
  tier: QueueTier | null,
): QueueItem[] {
  return tier === null
    ? [...items]
    : items.filter((item) => item.tier === tier);
}

export function readLabel(progress: number): string {
  return progress > 0 ? `${Math.round(progress * 100)}% read` : '';
}

export function savedLabel(daysAgo: number): string {
  return daysAgo === 0 ? 'today' : `${daysAgo}d ago`;
}
