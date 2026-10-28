import {
  clipSnippet,
  type HallItem,
  LIBRARY_SEARCH_LIMIT,
  type LibrarySearchHit,
} from '@rainforest-dev/library-contract';
import type { LibraryT } from '@rainforest-dev/library-shell';
import { lexicalRank, whitespaceTerms } from '@rainforest-dev/search';

import { tierLabel } from '@/lib/desk';

import { RACK_PATH } from './paths';
import { type QueueItem, type ReadingQueue } from './readingQueue';

export interface Shelf {
  tier: number;
  label: string;
  items: QueueItem[];
}

/** The queue as shelves, one per tier in tier order, each in the skill's rank order. */
export function rackShelves(queue: ReadingQueue, t: LibraryT): Shelf[] {
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
      label: tierLabel(tier, t),
      items: [...items].sort((a, b) => a.rank - b.rank),
    }));
}

/** The element id of an article's card on the rack, the target of its hall link. */
export const articleAnchor = (id: string): string => `article-${id}`;

/** Where an article's card is on the rack. */
const articleHref = (id: string): string =>
  `${RACK_PATH}#${encodeURIComponent(articleAnchor(id))}`;

/** An article's picture from the library's own origin, for the hall's 3D stand and its cards. */
export const articleCoverHref = (id: string): string =>
  `${RACK_PATH}/api/articles/cover/${encodeURIComponent(id)}`;

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

const DAY_MS = 86_400_000;

/** `YYYY-MM` of the day an article was saved, counted back from when the queue was generated. */
export function savedMonth(
  generated: string,
  savedDaysAgo: number,
): string | null {
  const at = Date.parse(generated);
  if (Number.isNaN(at)) return null;
  return new Date(at - savedDaysAgo * DAY_MS).toISOString().slice(0, 7);
}

/**
 * The rack's shelf for the hall: every queued article, linked to its card on `/rack`. The site
 * stands in for the creator, and the month is when the article was saved to Reader.
 */
export function rackHallItems(queue: ReadingQueue | null): HallItem[] {
  if (!queue) return [];
  return queue.queue.map((item) => {
    const month = savedMonth(queue.generated, item.sort.savedDaysAgo);
    return {
      kind: 'article',
      id: item.id,
      title: item.title,
      color: TIER_COLORS[item.tier] ?? FALLBACK_COLOR,
      groups: [
        `tier:${item.tier}`,
        `decay:${item.decay}`,
        ...(item.siteName
          ? [`site:${item.siteName}`, `creator:${item.siteName}`]
          : []),
        ...item.tags.map((tag) => `topic:${tag}`),
        ...(month ? [`month:${month}`] : []),
      ],
      href: articleHref(item.id),
      ...(item.imageUrl ? { cover: articleCoverHref(item.id) } : {}),
    };
  });
}

/**
 * Queued articles for the library-wide search, best first: every term must appear in the title,
 * site, tags or the reason it was queued, and title and tag hits rank first.
 */
export function searchRack(
  queue: ReadingQueue | null,
  query: string,
  limit = LIBRARY_SEARCH_LIMIT,
): LibrarySearchHit[] {
  const terms = whitespaceTerms(query);
  if (!queue || terms.length === 0) return [];
  const byId = new Map(queue.queue.map((item) => [item.id, item]));
  const ids = lexicalRank(queue.queue, terms, {
    id: (item) => item.id,
    text: (item) =>
      [item.title, item.siteName, item.tags.join(' '), item.why].join('\n'),
    facets: [
      { values: (item) => [item.title, ...item.tags], match: 'substring' },
    ],
    tieBreak: (a, b) => a.tier - b.tier || a.rank - b.rank,
  });
  return ids.slice(0, limit).flatMap((id) => {
    const item = byId.get(id);
    if (!item) return [];
    return [
      {
        kind: 'article' as const,
        id: item.id,
        title: item.title,
        ...(item.siteName && { subtitle: item.siteName }),
        ...(item.why && { snippet: clipSnippet(item.why) }),
        href: articleHref(item.id),
      },
    ];
  });
}
