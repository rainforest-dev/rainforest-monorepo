/**
 * The registry shapes, kept apart from `registry.ts` because that module pulls
 * in `node:fs`: the client islands need the types but must not drag the file
 * system into the browser bundle.
 */

/**
 * `feed-dead` and `delivery-gap` have opposite remedies. A dead feed should be
 * retired; a delivery gap means the feed is alive and Readwise stopped
 * delivering, so retiring it destroys a working source to route around someone
 * else's bug. `unspecified` is a legacy flag written before the type existed.
 */
export type StaleType =
  'feed-dead' | 'delivery-gap' | 'low-value' | 'unspecified';

export type Stale = { type: StaleType; note: string };

export type Source = {
  name: string;
  /** The feed itself — XML, not something to hand a reader. */
  url: string;
  /**
   * The site the feed belongs to: where a click on the source should land.
   * Empty when the feed URL does not say what the site is.
   */
  siteUrl: string;
  tags: string[];
  status: 'active' | 'proposed' | 'no-rss' | 'retired';
  category: string;
  proposedDate?: string;
  stale?: Stale;
};

export type Topic = {
  name: string;
  tags: string[];
  description: string;
  status: 'active' | 'proposed' | 'declined';
  proposedDate?: string;
  stale?: Stale;
};

/** One wording for the read-only vault, so the two sides cannot drift apart. */
export const READ_ONLY_NOTE =
  'The vault is mounted read-only, so the registry cannot be edited from here.';
