import type { APIRoute } from 'astro';

import { parseFactsBody } from '../../../lib/enroll/parse.js';
import { recordFacts } from '../../../lib/enroll/store.js';

export const POST: APIRoute = async ({ request }) => {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return new Response('invalid JSON', { status: 400 });
  }
  const parsed = parseFactsBody(raw);
  if (!parsed) return new Response('invalid facts', { status: 400 });

  try {
    recordFacts(parsed.host, parsed.facts, Date.now());
  } catch (err) {
    // readHosts() throws on a permissions/IO error rather than silently
    // reporting "nothing enrolled" -- recordFacts inherits that. Reporting 500
    // here matches this app's other store-backed routes (see usage.ts,
    // task-feedback.ts): the store failed to answer, so say so rather than
    // let the exception escape unhandled or claim success it didn't have.
    return Response.json({ error: String(err) }, { status: 500 });
  }
  return Response.json({ recorded: parsed.host });
};
