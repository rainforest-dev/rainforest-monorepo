import type { APIRoute } from 'astro';

import { readLoopState } from '../../lib/loop.js';

export const GET: APIRoute = () => {
  try {
    return Response.json(readLoopState());
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
