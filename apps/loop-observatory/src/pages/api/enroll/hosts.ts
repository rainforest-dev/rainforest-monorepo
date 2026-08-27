import type { APIRoute } from 'astro';

import { readHosts } from '../../../lib/enroll/store.js';
import { buildHostViews } from '../../../lib/enroll/view.js';

export const GET: APIRoute = () => {
  const records = readHosts();
  return Response.json({ records, views: buildHostViews(records, Date.now()) });
};
