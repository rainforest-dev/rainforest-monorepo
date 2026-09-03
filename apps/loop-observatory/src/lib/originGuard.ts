/**
 * Which cross-origin POSTs this app accepts.
 *
 * Astro's own `security.checkOrigin` compares the `Origin` header against the
 * origin of the request as the server received it. That is correct on a server
 * a browser talks to directly, and wrong behind a TLS-terminating proxy: the
 * browser sends `Origin: https://loop.rainforest.tools`, cloudflared forwards
 * the request to the container over plain HTTP, and Astro compares that Origin
 * against `http://…`. The schemes differ, so every state-changing request from
 * the public URL was rejected with "Cross-site POST form submissions are
 * forbidden" -- reliably, not intermittently. Measured 2026-09-03: a POST to
 * `/api/refresh` returned 200 with `Origin: http://100.86.67.66:3099` and 403
 * with the origin a browser actually sends.
 *
 * Adding `X-Forwarded-Proto` does not help; the running build does not consult
 * it. So the check is replaced rather than repaired: `checkOrigin` is off in
 * `astro.config.mjs` and this decides instead, on an allowlist that can name an
 * origin whose scheme the server never sees.
 *
 * It is deliberately not `checkOrigin: false` alone. The mutating routes here
 * are `/api/refresh`, which runs shell steps on the host, and
 * `/api/task-decision`, which clears a task for an unattended executor to run.
 * Those are precisely the two a forged cross-site POST should not reach.
 */

/** Methods that change something and therefore need an origin they can trust. */
const GUARDED = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Origins allowed in addition to the request's own.
 *
 * `SITE_URL` is already the deployment's public address -- `astro.config.mjs`
 * feeds the same variable to `site` -- so the common case needs no second
 * setting. `OBSERVATORY_ALLOWED_ORIGINS` is the escape hatch for another name
 * in front of the same container, comma-separated.
 */
export function allowedOrigins(
  env: Record<string, string | undefined>,
): Set<string> {
  const out = new Set<string>();
  for (const raw of [
    env.SITE_URL ?? 'https://loop.rainforest.tools',
    ...(env.OBSERVATORY_ALLOWED_ORIGINS ?? '').split(','),
  ]) {
    const value = raw.trim();
    if (!value) continue;
    try {
      // Normalise through URL so a trailing slash or a path in SITE_URL cannot
      // silently fail to match the bare origin a browser sends.
      out.add(new URL(value).origin);
    } catch {
      // An unparseable entry is a configuration typo. Skipping it keeps the
      // request path working on the origins that did parse, and the entry is
      // simply never matched -- it can never widen the allowlist by accident.
    }
  }
  return out;
}

export type OriginVerdict =
  | { ok: true }
  | { ok: false; status: number; reason: string };

/**
 * Whether one request may proceed.
 *
 * A safe method is never blocked: `GET`/`HEAD` cannot be the thing CSRF
 * exploits, and blocking them would break every page load.
 *
 * A missing `Origin` on a guarded method is refused, which is what Astro did
 * before and what the deployment already depends on. Browsers attach `Origin`
 * to every POST, same-origin included, so only a non-browser client can omit
 * it -- and nothing in this system POSTs to the app from a script. The host
 * sync service is called BY this app, never the other way round.
 */
export function checkRequestOrigin(
  request: { method: string; headers: { get(name: string): string | null } },
  requestUrl: string,
  allowed: Set<string>,
): OriginVerdict {
  if (!GUARDED.has(request.method.toUpperCase())) return { ok: true };

  const origin = request.headers.get('origin');
  if (!origin) {
    return {
      ok: false,
      status: 403,
      reason: 'no Origin header on a state-changing request',
    };
  }

  let sent: string;
  try {
    sent = new URL(origin).origin;
  } catch {
    return { ok: false, status: 403, reason: `unparseable Origin: ${origin}` };
  }

  // Same-origin stays allowed without configuration, which keeps direct access
  // over the tailnet working when SITE_URL names only the public address.
  try {
    if (sent === new URL(requestUrl).origin) return { ok: true };
  } catch {
    // An unparseable request URL should not turn into an allow.
  }

  if (allowed.has(sent)) return { ok: true };

  return {
    ok: false,
    status: 403,
    reason: `Origin ${sent} is not allowed; set OBSERVATORY_ALLOWED_ORIGINS to permit it`,
  };
}
