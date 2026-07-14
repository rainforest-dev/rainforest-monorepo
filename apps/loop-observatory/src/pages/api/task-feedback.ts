import type { APIRoute } from 'astro';

import { writeTaskFeedback } from '../../lib/taskNote.js';

/**
 * Persist tuning feedback into a task's local note (`## Notes` section only).
 * The vault is the source of truth; this never writes to Notion — applying the
 * feedback there is the `tune` skill's job (Claude/MCP), not the app's.
 */
export const POST: APIRoute = async ({ url, request }) => {
  const id = url.searchParams.get('id');
  if (!id) {
    return Response.json({ error: 'missing id' }, { status: 400 });
  }

  let feedback = '';
  try {
    const body = (await request.json()) as { feedback?: unknown };
    if (typeof body.feedback === 'string') feedback = body.feedback;
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  try {
    const note = writeTaskFeedback(id, feedback);
    if (!note) {
      return Response.json({ found: false, id }, { status: 404 });
    }
    return Response.json({ found: true, ...note });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
