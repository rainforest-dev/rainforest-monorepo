import {
  eventSubscriptionsFromCookieHeader,
  parseEventSubscriptions,
  taipeiDay,
} from '@rainforest-dev/library-contract';
import { connection } from 'next/server';

import { rackOf } from '@/lib/hall';
import { loadHallEvents } from '@/lib/server';

/**
 * The magazine rack: the events the reader subscribes to (the `library-events` cookie the
 * reading room's page writes), one tier per shelf.
 */
export async function GET(request: Request) {
  await connection();
  const events = await loadHallEvents();
  const subscriptions = parseEventSubscriptions(
    eventSubscriptionsFromCookieHeader(request.headers.get('cookie')),
  );
  return Response.json(
    { rack: rackOf(events, subscriptions, taipeiDay()) },
    // The answer follows the subscriptions cookie, which the rack page can change at any time;
    // the events themselves are already cached on the server.
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
