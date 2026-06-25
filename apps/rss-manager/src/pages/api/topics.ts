import type { APIRoute } from 'astro';

import { activateTopic, declineTopic, readTopics } from '../../lib/registry.js';

export const GET: APIRoute = () => {
  try {
    const topics = readTopics();
    return Response.json(topics);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  try {
    const { name, action } = (await request.json()) as { name: string; action: string };
    if (!name || !action) return Response.json({ error: 'Missing name or action' }, { status: 400 });

    if (action === 'activate') activateTopic(name);
    else if (action === 'decline') declineTopic(name);
    else return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
