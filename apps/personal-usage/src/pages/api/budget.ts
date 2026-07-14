import type { APIRoute } from 'astro';

import { readMachineBudgets } from '../../lib/budget.js';

export const GET: APIRoute = () => {
  try {
    // Per-machine map keyed by machine name; `{}` (no snapshots yet) is valid.
    return Response.json(readMachineBudgets());
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
