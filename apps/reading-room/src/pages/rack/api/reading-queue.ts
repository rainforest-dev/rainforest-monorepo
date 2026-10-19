import type { APIRoute } from 'astro';

import { readReadingQueue } from '@/server';

export const GET: APIRoute = () => {
  try {
    const queue = readReadingQueue();
    if (queue === null) return Response.json({ generated: null });
    return Response.json(queue);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
