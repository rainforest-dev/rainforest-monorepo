import { createReadStream, statSync } from 'node:fs';

import type { APIRoute } from 'astro';

/**
 * Serve the mounted release artifact.
 *
 * The app serves a build product, never its own working tree: the mini's
 * worktree carries uncommitted changes routinely, and "what code is on the
 * executor" must be a released version rather than whatever a folder happened
 * to contain. The same artifact is on GitHub Releases if this host is down.
 */
export const GET: APIRoute = () => {
  const path = process.env.LOOP_ENGINE_BUNDLE;
  if (!path)
    return new Response('LOOP_ENGINE_BUNDLE is not configured', {
      status: 503,
    });
  try {
    const stat = statSync(path);
    // statSync() succeeds on a directory too -- without this check the
    // response would 200 with a bogus content-length, and the real failure
    // (EISDIR) would only surface once something tried to read the body.
    if (!stat.isFile()) {
      return new Response('bundle not readable', { status: 503 });
    }
    const size = stat.size;
    return new Response(createReadStream(path) as unknown as ReadableStream, {
      headers: {
        'content-type': 'application/gzip',
        'content-length': String(size),
        'content-disposition': 'attachment; filename="loop-engine.tar.gz"',
      },
    });
  } catch {
    return new Response('bundle not readable', { status: 503 });
  }
};
