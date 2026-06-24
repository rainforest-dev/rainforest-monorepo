import type { APIRoute } from 'astro';

import { readSources } from '../../lib/registry.js';

export const GET: APIRoute = () => {
  try {
    const sources = readSources();
    return Response.json(sources);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
