/**
 * Record one host's probed facts.
 *
 * ## This endpoint is UNAUTHENTICATED, by design and with a known consequence
 *
 * It is reachable by anything that can reach the app, which the tailnet is the
 * only thing bounding — the same door `/api/task-decision` already stands
 * behind. Two properties follow, and neither is a bug to be fixed here:
 *
 *  * **Any caller can post facts for any host name.** In particular a caller
 *    can post `otlpListening: true` for a real host and thereby silence the
 *    `role-unsatisfied` drift finding that exists to catch this project's
 *    motivating failure — the Air exporting into a closed socket for its entire
 *    life. Whoever can do that can already POST to `/api/task-decision`.
 *  * **Facts are all it accepts.** `parseFactsBody` drops every key it does not
 *    know, so a body carrying `roles` declares nothing. Derivation is pure and
 *    application happens on the device, so this write surface cannot change
 *    what any machine is told to be — only what it is *recorded as having
 *    said*.
 *
 * The mitigation is the network boundary and nothing else. Do not read this
 * route as authenticated, and do not build anything on the assumption that a
 * recorded fact came from the machine it names. Closing the door properly is
 * its own piece of work — see "Risks" in the design doc.
 *
 * ## Bounds
 *
 * Records land in `_system/usage/hosts.json`, which is iCloud-synced, so every
 * unbounded input here is a way to fill that disk. The body is capped before it
 * is buffered, each field is capped in `parseFactsBody`, and the number of
 * distinct host keys is capped in `recordFacts`. All three reject rather than
 * truncate: a truncated fact is not what the machine reported.
 */
import type { APIRoute } from 'astro';

import { parseFactsBody } from '../../../lib/enroll/parse.js';
import { recordFacts, TooManyHosts } from '../../../lib/enroll/store.js';

/**
 * A real report is under 1 KB. 64 KB is far above anything a probe run can
 * legitimately produce and far below anything worth writing to a synced disk.
 */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * Read the body with a hard ceiling.
 *
 * `request.json()` buffers whatever arrives, so the cap has to happen while
 * reading, not after. Content-Length is checked first as a courtesy — it is
 * caller-supplied and therefore not trusted, which is why the streaming count
 * below is the actual limit.
 */
async function readCappedBody(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;

  const body = request.body;
  if (!body) return '';

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(joined);
}

export const POST: APIRoute = async ({ request }) => {
  let text: string | null;
  try {
    text = await readCappedBody(request);
  } catch {
    return new Response('could not read request body', { status: 400 });
  }
  if (text === null)
    return new Response(`body over ${MAX_BODY_BYTES} bytes`, { status: 413 });

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return new Response('invalid JSON', { status: 400 });
  }
  const parsed = parseFactsBody(raw);
  if (!parsed) return new Response('invalid facts', { status: 400 });

  try {
    recordFacts(parsed.host, parsed.facts, Date.now());
  } catch (err) {
    // A new host beyond the cap is a refusal to grow the store, not a server
    // fault -- 507 says exactly that, and distinguishes it from the 500 below.
    if (err instanceof TooManyHosts)
      return new Response(err.message, { status: 507 });
    // readHosts() throws on a permissions/IO error rather than silently
    // reporting "nothing enrolled" -- recordFacts inherits that. Reporting 500
    // here matches this app's other store-backed routes (see usage.ts,
    // task-feedback.ts): the store failed to answer, so say so rather than
    // let the exception escape unhandled or claim success it didn't have.
    return Response.json({ error: String(err) }, { status: 500 });
  }
  return Response.json({ recorded: parsed.host });
};
