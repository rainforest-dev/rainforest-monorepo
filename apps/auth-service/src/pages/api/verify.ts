import type { APIRoute } from 'astro';
import { verifySession } from '../../lib/session.js';

export const GET: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get('rf_session')?.value ?? '';

  if (await verifySession(token)) {
    return new Response(null, { status: 200 });
  }

  // Build original URL from Traefik forwarded headers
  const host = request.headers.get('X-Forwarded-Host') ?? '';
  const proto = request.headers.get('X-Forwarded-Proto') ?? 'https';
  const uri = request.headers.get('X-Forwarded-Uri') ?? '/';

  const loginBase = process.env.WEBAUTHN_ORIGIN ?? 'https://auth.rainforest.tools';
  const loginUrl = new URL(`${loginBase}/login`);
  if (host) {
    loginUrl.searchParams.set('redirect', `${proto}://${host}${uri}`);
  }

  return Response.redirect(loginUrl.toString(), 302);
};
