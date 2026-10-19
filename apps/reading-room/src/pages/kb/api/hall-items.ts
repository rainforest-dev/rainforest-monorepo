import type { APIRoute } from 'astro';

import { kbHallItems } from '@/lib/kb';
import { getKbIndex } from '@/server';

/** The knowledge base's shelf for the hall: `{ items: HallItem[] }`, every visible page. */
export const GET: APIRoute = () => {
  try {
    return Response.json({ items: kbHallItems(getKbIndex().docs) });
  } catch (err) {
    // The error can name mount paths and hidden files, so it stays in the server log.
    console.error('[kb]', err);
    return Response.json({ error: 'kb unavailable' }, { status: 500 });
  }
};
