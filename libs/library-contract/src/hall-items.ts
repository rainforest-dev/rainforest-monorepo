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
const sameOriginPath = z
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
  /** Shelf keys the hall can group by, such as `tag:frontend` or `series:dune`. */
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
 * The `groups` prefixes the hall can sort by, besides the item's own collection. A collection
 * emits the ones it knows, such as `tag:frontend`, `series:dune` or `month:2026-08`; the hall
 * shelves an item by the first group under each prefix.
 */
export const HALL_GROUP_PREFIXES = [
  'tag',
  'series',
  'author',
  'month',
] as const;
export type HallGroupPrefix = (typeof HALL_GROUP_PREFIXES)[number];

export function hallGroup(prefix: HallGroupPrefix, value: string): string {
  return `${prefix}:${value}`;
}

/** The first group under `prefix`, without the prefix, or `null`. */
export function hallGroupValue(
  groups: readonly string[],
  prefix: HallGroupPrefix,
): string | null {
  const head = `${prefix}:`;
  const found = groups.find(
    (g) => g.startsWith(head) && g.length > head.length,
  );
  return found ? found.slice(head.length) : null;
}

/**
 * The `view-transition-name` an item's cover carries in the hall and on its detail page, so a
 * cross-document navigation morphs one into the other. Books are `book-<id>`.
 */
export function itemTransitionName(kind: HallItemKind, id: string): string {
  return `${kind}-${id.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}
