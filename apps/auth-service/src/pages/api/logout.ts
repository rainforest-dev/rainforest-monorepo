import type { APIRoute } from 'astro';

export const POST: APIRoute = ({ cookies }) => {
  cookies.delete('rf_session', {
    domain: process.env.COOKIE_DOMAIN ?? '.rainforest.tools',
    path: '/',
  });
  const loginBase = process.env.WEBAUTHN_ORIGIN ?? 'https://auth.rainforest.tools';
  return Response.redirect(`${loginBase}/login`, 302);
};
