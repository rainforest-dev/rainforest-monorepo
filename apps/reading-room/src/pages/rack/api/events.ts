import type { APIRoute } from 'astro';

import { loadEvents } from '@/server';

/**
 * Every current or coming exhibition and market, unfiltered: `{ events, fetchedAt, failed }`.
 * The hall and the page each filter by the reader's subscriptions cookie.
 */
export const GET: APIRoute = async () => {
  try {
    return Response.json(await loadEvents(), {
      headers: { 'Cache-Control': 'private, max-age=300' },
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
