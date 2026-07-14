import type { APIRoute } from 'astro';

import { readTasks } from '../../lib/tasks.js';

export const GET: APIRoute = () => {
  try {
    // `null` (no snapshot yet) is a valid response — the panel renders empty.
    return Response.json(readTasks());
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
