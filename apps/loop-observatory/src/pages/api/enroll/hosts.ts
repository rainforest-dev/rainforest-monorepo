import type { APIRoute } from 'astro';

import { readDeclarations } from '../../../lib/enroll/declarations.js';
import { readHosts } from '../../../lib/enroll/store.js';
import { buildHostViews } from '../../../lib/enroll/view.js';

export const GET: APIRoute = () => {
  const records = readHosts();
  // Both readers, together. Records are what machines said about themselves;
  // declarations are what the owner said they should be. A view built from
  // only the first has nothing to compare against, which is how this page came
  // to report health it had never checked.
  const declarations = readDeclarations();
  return Response.json({
    records,
    declarations,
    views: buildHostViews(records, Date.now(), declarations),
  });
};
