import type { APIRoute } from 'astro';

import { rackHallItems } from '@/lib';
import { readReadingQueue } from '@/server';

/** The rack's shelf for the hall: `{ items: HallItem[] }`, empty until the queue exists. */
export const GET: APIRoute = () => {
  try {
    return Response.json({ items: rackHallItems(readReadingQueue()) });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
