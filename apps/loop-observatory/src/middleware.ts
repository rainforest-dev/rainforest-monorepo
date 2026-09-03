import type { MiddlewareHandler } from 'astro';

import { allowedOrigins, checkRequestOrigin } from './lib/originGuard.js';

/**
 * Replaces Astro's `security.checkOrigin`, which cannot see through the proxy
 * this app is deployed behind. See `lib/originGuard.ts` for why.
 *
 * The allowlist is read per request rather than at module load so a change to
 * `SITE_URL` or `OBSERVATORY_ALLOWED_ORIGINS` takes effect on restart without
 * depending on when this module happened to be evaluated.
 */
export const onRequest: MiddlewareHandler = (context, next) => {
  const verdict = checkRequestOrigin(
    context.request,
    context.request.url,
    allowedOrigins(process.env),
  );
  if (verdict.ok) return next();

  // Plain text, and it names the origin it rejected: the failure this replaces
  // was diagnosable only by curling the container with different headers,
  // because "Cross-site POST form submissions are forbidden" says nothing about
  // which origin was sent or which were acceptable.
  return new Response(`Forbidden — ${verdict.reason}\n`, {
    status: verdict.status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
