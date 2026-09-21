import type { APIRoute } from 'astro';

import {
  activateTopic,
  declineTopic,
  isWritable,
  readTopics,
  TOPICS_FILE,
} from '../../lib/registry.js';

export const GET: APIRoute = () => {
  try {
    return Response.json({
      topics: readTopics(),
      writable: isWritable(TOPICS_FILE),
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

    // See the note in sources.ts: a read-only vault is reported, not attempted.
    if (!isWritable(TOPICS_FILE))
      return Response.json(
        {
          error:
            'The vault is mounted read-only, so the registry cannot be edited.',
          writable: false,
        },
        { status: 409 },
      );

    if (action === 'activate') activateTopic(name);
    else if (action === 'decline') declineTopic(name);
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
