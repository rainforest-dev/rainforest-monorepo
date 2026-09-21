import type { APIRoute } from 'astro';

import {
  activateTopic,
  declineTopic,
  isWritable,
  readTopics,
  registryFilePath,
  TOPICS_FILE,
} from '../../lib/registry.js';
import { writeErrorResponse } from '../../lib/registryApi.js';

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
  const { name, action } = ((await request.json().catch(() => ({}))) ?? {}) as {
    name?: string;
    action?: string;
  };

  if (!name || !action)
    return Response.json({ error: 'Missing name or action' }, { status: 400 });
  // See sources.ts: the action is validated before anything touches the vault.
  if (action !== 'activate' && action !== 'decline')
    return Response.json(
      { error: `Unknown action: ${action}` },
      { status: 400 },
    );

  try {
    if (action === 'activate') activateTopic(name);
    else declineTopic(name);
    return Response.json({ ok: true });
  } catch (err) {
    return writeErrorResponse(err, registryFilePath(TOPICS_FILE));
  }
};
