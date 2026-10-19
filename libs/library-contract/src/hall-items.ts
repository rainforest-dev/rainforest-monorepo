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
});
export type HallItem = z.infer<typeof hallItemSchema>;

export const hallItemsResponseSchema = z.object({
  items: z.array(hallItemSchema),
});
export type HallItemsResponse = z.infer<typeof hallItemsResponseSchema>;

/** Every collection serves its shelf at `<basePath>/api/hall-items`. */
export const HALL_ITEMS_PATH = '/api/hall-items';
