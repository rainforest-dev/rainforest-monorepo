import {
  COLLECTION_OF_KIND,
  getCollection,
  type HallGroupPrefix,
  hallGroupValue,
  type HallItem,
  type HallItemKind,
} from '@rainforest-dev/library-contract';

/** How the hall can sort its bookcases: by a group prefix, or by the item's own collection. */
export const HALL_GROUP_BYS = [
  'tag',
  'collection',
  'series',
  'author',
  'month',
] as const;
export type HallGroupBy = (typeof HALL_GROUP_BYS)[number];
export const DEFAULT_GROUP_BY: HallGroupBy = 'tag';

export const GROUP_LABELS: Record<HallGroupBy, string> = {
  tag: '依主題',
  collection: '依館藏',
  series: '依系列',
  author: '依作者',
  month: '依時間',
};

export function isHallGroupBy(value: unknown): value is HallGroupBy {
  return HALL_GROUP_BYS.some((g) => g === value);
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
  groups: Record<HallGroupPrefix, string | null>;
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
        tag: hallGroupValue(item.groups, 'tag'),
        series: hallGroupValue(item.groups, 'series'),
        author: hallGroupValue(item.groups, 'author'),
        month: hallGroupValue(item.groups, 'month'),
      },
    });
  }
  return out;
}

/** The label of an item kind's collection, as the shell names it. */
export function kindLabel(kind: HallItemKind): string {
  return getCollection(COLLECTION_OF_KIND[kind]).label;
}

/** Groupings with something to sort by. Sorting by collection always works. */
export function availableGroupBys(
  books: readonly HallBook[],
): readonly HallGroupBy[] {
  return HALL_GROUP_BYS.filter(
    (g) => g === 'collection' || books.some((b) => b.groups[g] !== null),
  );
}

export function itemsLabel(n: number): string {
  return `${n} 件`;
}
