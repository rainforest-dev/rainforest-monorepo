import type { APIRoute } from 'astro';

import {
  activateSource,
  isWritable,
  readSources,
  retireSource,
  SOURCES_FILE,
} from '../../lib/registry.js';

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
  try {
    const { name, action } = (await request.json()) as {
      name: string;
      action: string;
    };
    if (!name || !action)
      return Response.json(
        { error: 'Missing name or action' },
        { status: 400 },
      );

    // Checked up front so a read-only vault reports itself instead of surfacing
    // as an EROFS stack trace after the entry has already been spliced.
    if (!isWritable(SOURCES_FILE))
      return Response.json(
        {
          error:
            'The vault is mounted read-only, so the registry cannot be edited.',
          writable: false,
        },
        { status: 409 },
      );

    if (action === 'activate') activateSource(name);
    else if (action === 'retire') retireSource(name);
    else
      return Response.json(
        { error: `Unknown action: ${action}` },
        { status: 400 },
      );

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
