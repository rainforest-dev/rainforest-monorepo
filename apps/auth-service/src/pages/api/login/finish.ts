import type { APIRoute } from 'astro';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { verifyAuthentication } from '../../../lib/webauthn.js';
import { updateCounter } from '../../../lib/db.js';
import { signSession } from '../../../lib/session.js';

function safeRedirect(url: string | undefined): string {
  if (!url) return '/';
  if (url.startsWith('/')) return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'rainforest.tools' || parsed.hostname.endsWith('.rainforest.tools')) {
      return url;
    }
  } catch {
    // invalid URL
  }
  return '/';
}

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: AuthenticationResponseJSON & { redirect?: string };
  try {
    body = (await request.json()) as AuthenticationResponseJSON & { redirect?: string };
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { redirect, ...authResponse } = body;

  let verification;
  try {
    verification = await verifyAuthentication(authResponse);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 400 });
  }

  if (!verification.verified) {
    return Response.json({ error: 'Authentication failed' }, { status: 401 });
  }

  try {
    updateCounter(authResponse.id, verification.authenticationInfo.newCounter);
  } catch (err) {
    return Response.json({ error: 'Failed to update credential counter' }, { status: 500 });
  }

  let token: string;
  try {
    token = await signSession();
  } catch (err) {
    return Response.json({ error: 'Failed to create session' }, { status: 500 });
  }

  const cookieDomain = process.env.COOKIE_DOMAIN ?? '.rainforest.tools';
  cookies.set('rf_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: cookieDomain,
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });

  return Response.json({ verified: true, redirect: safeRedirect(redirect) });
};
