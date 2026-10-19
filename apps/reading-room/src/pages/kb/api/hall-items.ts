import type { APIRoute } from 'astro';

import { kbHallItems } from '@/lib/kb';
import { getKbIndex } from '@/server';

/** The knowledge base's shelf for the hall: `{ items: HallItem[] }`, every visible page. */
export const GET: APIRoute = () => {
  try {
    return Response.json({ items: kbHallItems(getKbIndex().docs) });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
