import { type HallItem } from '@rainforest-dev/library-contract';

import { tierLabel } from '@/lib/desk/queue';
import { RACK_PATH } from '@/lib/paths';
import { type QueueItem, type ReadingQueue } from '@/lib/readingQueue';

export interface Shelf {
  tier: number;
  label: string;
  items: QueueItem[];
}

/** The queue as shelves, one per tier in tier order, each in the skill's rank order. */
export function rackShelves(queue: ReadingQueue): Shelf[] {
  const byTier = new Map<number, QueueItem[]>();
  for (const item of queue.queue) {
    const shelf = byTier.get(item.tier) ?? [];
    shelf.push(item);
    byTier.set(item.tier, shelf);
  }
  return [...byTier.entries()]
    .sort(([a], [b]) => a - b)
    .map(([tier, items]) => ({
      tier,
      label: tierLabel(tier),
      items: [...items].sort((a, b) => a.rank - b.rank),
    }));
}

/** The element id of an article's card on the rack, the target of its hall link. */
export const articleAnchor = (id: string): string => `article-${id}`;

/**
 * Spine colours for the hall, one per tier. The hall needs hex, so these are fixed shades
 * around the rack's `chart-2` blue, darker for the tiers to read first.
 */
const TIER_COLORS: Record<number, string> = {
  1: '#2f5f9e',
  2: '#3f74b8',
  3: '#6091d1',
  4: '#8fb2e0',
};
const FALLBACK_COLOR = '#a9c1e3';

/** The rack's shelf for the hall: every queued article, linked to its card on `/rack`. */
export function rackHallItems(queue: ReadingQueue | null): HallItem[] {
  if (!queue) return [];
  return queue.queue.map((item) => ({
    kind: 'article',
    id: item.id,
    title: item.title,
    color: TIER_COLORS[item.tier] ?? FALLBACK_COLOR,
    groups: [
      `tier:${item.tier}`,
      `decay:${item.decay}`,
      ...(item.siteName ? [`site:${item.siteName}`] : []),
      ...item.tags.map((tag) => `tag:${tag}`),
    ],
    href: `${RACK_PATH}#${encodeURIComponent(articleAnchor(item.id))}`,
  }));
}
