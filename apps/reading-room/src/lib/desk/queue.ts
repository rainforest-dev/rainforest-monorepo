import type { LibraryT } from '@rainforest-dev/library-shell';

import type { QueueItem, StaleItem, StaleReason } from '@/lib/readingQueue';

import { QUEUE_TIERS, type QueueTier } from './params.js';

/** A tier's shelf name; a tier outside 1 to 4 gets its number. */
export const tierLabel = (tier: number, t: LibraryT): string =>
  (QUEUE_TIERS as readonly number[]).includes(tier)
    ? t(`tier.${tier}`)
    : t('tier.other', { tier });

/** The stale panel's reasons, in the order it lists them. */
const STALE_REASON_ORDER: readonly StaleReason[] = [
  'done-unfiled',
  'expired',
  'off-stack',
  'deferred-dead',
  'abandoned',
  'duplicate',
  'malformed',
];

export interface StaleGroup {
  reason: StaleReason;
  label: string;
  items: StaleItem[];
}

export function groupStale(
  items: readonly StaleItem[],
  t: LibraryT,
): StaleGroup[] {
  return STALE_REASON_ORDER.map((reason) => ({
    reason,
    label: t(`staleReason.${reason}`),
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

export function readLabel(progress: number, t: LibraryT): string {
  return progress > 0
    ? t('queue.read', { percent: Math.round(progress * 100) })
    : '';
}

export function savedLabel(daysAgo: number, t: LibraryT): string {
  return daysAgo === 0
    ? t('queue.savedToday')
    : t('queue.savedAgo', { days: daysAgo });
}
