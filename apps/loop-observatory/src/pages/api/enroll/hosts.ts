import type { APIRoute } from 'astro';

import { readDeclarations } from '../../../lib/enroll/declarations.js';
import { readHosts } from '../../../lib/enroll/store.js';
import { readTelemetry } from '../../../lib/enroll/telemetry.js';
import { buildHostViews } from '../../../lib/enroll/view.js';

export const GET: APIRoute = () => {
  const records = readHosts();
  // Both readers, together. Records are what machines said about themselves;
  // declarations are what the owner said they should be. A view built from
  // only the first has nothing to compare against, which is how this page came
  // to report health it had never checked.
  const declarations = readDeclarations();
  // The second reading. Written hourly by the usage job, where the enrollment
  // record above is written once by hand — so these two routinely disagree about
  // whether a host is alive. The view reports the disagreement rather than
  // choosing, because choosing is what hid it: Overview reads this file and
  // called the mini fine while Setup read the other and called it stale.
  const telemetry = readTelemetry([
    ...Object.keys(records),
    ...Object.keys(declarations?.byHost ?? {}),
  ]);
  return Response.json({
    records,
    declarations,
    views: buildHostViews(records, Date.now(), declarations, telemetry),
  });
};
