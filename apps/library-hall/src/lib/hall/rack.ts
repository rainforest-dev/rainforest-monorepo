import {
  EVENT_SHELVES,
  eventCoverHref,
  type EventShelf,
  type EventSubscriptions,
  type LibraryEvent,
  matchesSubscriptions,
  shelveEvents,
} from '@rainforest-dev/library-contract';

import { RACK_COVERS_PER_TIER } from './layout';

/** A cover on the rack; `image` is the event's picture on the library's own origin, if any. */
export interface RackCover {
  id: string;
  title: string;
  image?: string;
}

/** One tier of the magazine rack: how many events are on that shelf, and the first few. */
export interface RackTier {
  shelf: EventShelf;
  count: number;
  covers: RackCover[];
}

/** What the hall's magazine rack shows: the reader's subscribed events, one tier per shelf. */
export interface HallRack {
  total: number;
  tiers: RackTier[];
}

/** The rack for these events, filtered to the reader's subscriptions and shelved as of `today`. */
export function rackOf(
  events: readonly LibraryEvent[],
  subscriptions: EventSubscriptions,
  today: string,
): HallRack {
  const shelves = shelveEvents(
    events.filter((event) => matchesSubscriptions(event, subscriptions)),
    today,
  );
  const tiers = EVENT_SHELVES.map((shelf) => ({
    shelf,
    count: shelves[shelf].length,
    covers: shelves[shelf]
      .slice(0, RACK_COVERS_PER_TIER)
      .map(({ id, title, image }) =>
        image ? { id, title, image: eventCoverHref(id) } : { id, title },
      ),
  }));
  return { total: tiers.reduce((n, t) => n + t.count, 0), tiers };
}
