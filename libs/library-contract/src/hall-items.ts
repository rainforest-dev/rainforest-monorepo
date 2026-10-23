import { z } from 'zod';

import { type CollectionId } from './collections';

export const HALL_ITEM_KINDS = ['book', 'notebook', 'article', 'kb'] as const;
export type HallItemKind = (typeof HALL_ITEM_KINDS)[number];

export const COLLECTION_OF_KIND: Record<HallItemKind, CollectionId> = {
  book: 'books',
  notebook: 'notebooks',
  article: 'rack',
  kb: 'kb',
};

/** A same-origin absolute path: one leading slash, never `//host` or a scheme. */
export const sameOriginPath = z
  .string()
  .regex(/^\/(?![/\\])/, 'href must be a same-origin path starting with /');

const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i, 'color must be hex');

/**
 * One object on a hall shelf. Every collection's `hall-items` API returns these, and the hall
 * shelves, re-sorts and links them with nothing else.
 */
export const hallItemSchema = z.object({
  kind: z.enum(HALL_ITEM_KINDS),
  id: z.string().min(1),
  title: z.string(),
  color: hexColor,
  /** Shelf keys the hall can group by, such as `topic:frontend` or `month:2026-08`. */
  groups: z.array(z.string().min(1)),
  /** The item's detail page in its own collection. */
  href: sameOriginPath,
  /** One line under the title on a cover or card: the authors, a page count, a site. */
  subtitle: z.string().optional(),
  /** A same-origin cover image, for items that have one. The hall draws a cover otherwise. */
  cover: sameOriginPath.optional(),
});
export type HallItem = z.infer<typeof hallItemSchema>;

export const hallItemsResponseSchema = z.object({
  items: z.array(hallItemSchema),
});
export type HallItemsResponse = z.infer<typeof hallItemsResponseSchema>;

/** Every collection serves its shelf at `<basePath>/api/hall-items`. */
export const HALL_ITEMS_PATH = '/api/hall-items';

/**
 * The dimensions every collection shelves its items by, besides the collection itself. Each
 * item answers all three in `groups`: `topic:frontend`, `creator:Ursula K. Le Guin`,
 * `month:2026-08`. Time is when the item entered the owner's life (added to Calibre, saved to
 * Reader, a notebook's first page), never a publish date. An item with no answer is shelved
 * as unsorted, and the hall says how many there are.
 */
export const HALL_DIMENSIONS = ['topic', 'creator', 'month'] as const;
export type HallDimension = (typeof HALL_DIMENSIONS)[number];

/**
 * The prefixes collections sent before the shared dimensions, still read for one release so a
 * collection deployed before the hall, or after it, keeps its bookcases.
 */
const LEGACY_PREFIX: Partial<Record<HallDimension, string>> = {
  topic: 'tag',
  creator: 'author',
};

/** Every prefix `hallGroupValue` reads, the legacy ones included. */
export const HALL_GROUP_PREFIXES = [
  ...HALL_DIMENSIONS,
  'tag',
  'author',
] as const;
export type HallGroupPrefix = (typeof HALL_GROUP_PREFIXES)[number];

export function hallGroup(prefix: HallDimension, value: string): string {
  return `${prefix}:${value}`;
}

function firstUnder(groups: readonly string[], prefix: string): string | null {
  const head = `${prefix}:`;
  const found = groups.find(
    (g) => g.startsWith(head) && g.length > head.length,
  );
  return found ? found.slice(head.length) : null;
}

/** The first group under `prefix`, without the prefix, or `null`. */
export function hallGroupValue(
  groups: readonly string[],
  prefix: HallGroupPrefix,
): string | null {
  return firstUnder(groups, prefix);
}

/**
 * The item's answer to a dimension: its first group under the dimension's prefix, or under
 * the legacy prefix the dimension replaced, or `null`.
 */
export function hallDimensionValue(
  groups: readonly string[],
  dimension: HallDimension,
): string | null {
  const legacy = LEGACY_PREFIX[dimension];
  return (
    firstUnder(groups, dimension) ??
    (legacy ? firstUnder(groups, legacy) : null)
  );
}

/**
 * The dimensions an item leaves unanswered under their current prefixes. A collection's
 * `hall-items` test asserts this is empty, or names what it cannot answer yet.
 */
export function missingHallDimensions(
  item: Pick<HallItem, 'groups'>,
): HallDimension[] {
  return HALL_DIMENSIONS.filter((d) => firstUnder(item.groups, d) === null);
}

/**
 * The `view-transition-name` an item's cover carries in the hall and on its detail page, so a
 * cross-document navigation morphs one into the other. Books are `book-<id>`.
 */
export function itemTransitionName(kind: HallItemKind, id: string): string {
  return `${kind}-${id.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}
