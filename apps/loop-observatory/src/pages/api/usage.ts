import type { APIRoute } from 'astro';

import { readUsage } from '../../lib/ledger.js';

export const GET: APIRoute = () => {
  try {
    return Response.json(readUsage());
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
