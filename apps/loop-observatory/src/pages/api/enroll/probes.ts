import type { APIRoute } from 'astro';

import { PROBE_VERSION, PROBES } from '../../../lib/enroll/probes.js';

export const GET: APIRoute = () =>
  Response.json({ version: PROBE_VERSION, probes: PROBES });
