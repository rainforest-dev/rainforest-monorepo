import type { APIRoute } from 'astro';

import {
  activateSource,
  isWritable,
  readSources,
  registryFilePath,
  retireSource,
  SOURCES_FILE,
} from '../../lib/registry.js';
import { writeErrorResponse } from '../../lib/registryApi.js';

export const GET: APIRoute = () => {
  try {
    return Response.json({
      sources: readSources(),
      writable: isWritable(SOURCES_FILE),
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  const { name, action } = ((await request.json().catch(() => ({}))) ?? {}) as {
    name?: string;
    action?: string;
  };

  if (!name || !action)
    return Response.json({ error: 'Missing name or action' }, { status: 400 });
  // Checked before the write is attempted, so a client bug is never reported as
  // a vault problem.
  if (action !== 'activate' && action !== 'retire')
    return Response.json(
      { error: `Unknown action: ${action}` },
      { status: 400 },
    );

  try {
    if (action === 'activate') activateSource(name);
    else retireSource(name);
    return Response.json({ ok: true });
  } catch (err) {
    return writeErrorResponse(err, registryFilePath(SOURCES_FILE));
  }
};
