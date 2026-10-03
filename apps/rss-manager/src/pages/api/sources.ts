import type { APIRoute } from 'astro';

import {
  duplicateNameWarnings,
  handleRegistryPatch,
  isWritable,
  readSources,
  SOURCES_FILE,
  SOURCES_PATCH,
} from '@/server';

export const GET: APIRoute = () => {
  try {
    const sources = readSources();
    return Response.json({
      sources,
      writable: isWritable(SOURCES_FILE),
      warnings: duplicateNameWarnings(sources),
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

export const PATCH: APIRoute = ({ request }) =>
  handleRegistryPatch(request, SOURCES_PATCH);
