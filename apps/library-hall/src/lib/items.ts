import {
  COLLECTION_OF_KIND,
  collectionLabel,
  type HallDimension,
  hallDimensionValue,
  type HallItem,
  type HallItemKind,
  type LibraryLocale,
} from '@rainforest-dev/library-contract';

/** How the hall can sort its bookcases: by a shared dimension, or by the item's own collection. */
export const HALL_GROUP_BYS = [
  'topic',
  'creator',
  'month',
  'collection',
] as const;
export type HallGroupBy = (typeof HALL_GROUP_BYS)[number];
export const DEFAULT_GROUP_BY: HallGroupBy = 'topic';

/** `?group=` values from before the shared dimensions, so old links still land on a grouping. */
const LEGACY_GROUP_BYS: Record<string, HallGroupBy> = {
  tag: 'topic',
  author: 'creator',
};

export function isHallGroupBy(value: unknown): value is HallGroupBy {
  return HALL_GROUP_BYS.some((g) => g === value);
}

/** The grouping a `?group=` value names, an old one included, or the default. */
export function parseHallGroupBy(value: string | null): HallGroupBy {
  if (isHallGroupBy(value)) return value;
  return (value && LEGACY_GROUP_BYS[value]) || DEFAULT_GROUP_BY;
}

/**
 * One item as the hall draws it. `id` is a number because the scene indexes instanced meshes
 * and per-book maps by it; it is a stable hash of `key`, so a book keeps its look and slot
 * across reloads.
 */
export interface HallBook {
  id: number;
  key: string;
  /** The id the item's own collection gave it. */
  itemId: string;
  kind: HallItemKind;
  title: string;
  subtitle: string | null;
  color: string;
  cover: string | null;
  href: string;
  groups: Record<HallDimension, string | null>;
}

/** FNV-1a, folded to a positive 31-bit integer so it is a safe array-free map key. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 1 || 1;
}

export function itemKey(item: Pick<HallItem, 'kind' | 'id'>): string {
  return `${item.kind}:${item.id}`;
}

/**
 * The items every collection returned, as hall books. A repeated key keeps its first item; a
 * hash collision moves the later key to the next free number, in input order.
 */
export function toHallBooks(items: readonly HallItem[]): HallBook[] {
  const seen = new Set<string>();
  const taken = new Set<number>();
  const out: HallBook[] = [];
  for (const item of items) {
    const key = itemKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    let id = hash(key);
    while (taken.has(id)) id = id >= 0x7fffffff ? 1 : id + 1;
    taken.add(id);
    out.push({
      id,
      key,
      itemId: item.id,
      kind: item.kind,
      title: item.title,
      subtitle: item.subtitle?.trim() || null,
      color: item.color,
      cover: item.cover ?? null,
      href: item.href,
      groups: {
        topic: hallDimensionValue(item.groups, 'topic'),
        creator: hallDimensionValue(item.groups, 'creator'),
        month: hallDimensionValue(item.groups, 'month'),
      },
    });
  }
  return out;
}

/** The label of an item kind's collection, as the shell names it. */
export function kindLabel(kind: HallItemKind, locale: LibraryLocale): string {
  return collectionLabel(COLLECTION_OF_KIND[kind], locale);
}

/** Groupings with something to sort by. Sorting by collection always works. */
export function availableGroupBys(
  books: readonly HallBook[],
): readonly HallGroupBy[] {
  return HALL_GROUP_BYS.filter(
    (g) => g === 'collection' || books.some((b) => b.groups[g] !== null),
  );
}
