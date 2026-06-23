import type { APIRoute } from 'astro';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { verifyRegistration } from '../../../lib/webauthn.js';
import { saveCredential } from '../../../lib/db.js';

export const POST: APIRoute = async ({ request }) => {
  let body: RegistrationResponseJSON;
  try {
    body = (await request.json()) as RegistrationResponseJSON;
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  let verification;
  try {
    verification = await verifyRegistration(body);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return Response.json({ error: 'Verification failed' }, { status: 400 });
  }

  try {
    const { credential } = verification.registrationInfo;
    saveCredential({
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      transports: (body.response.transports ?? []) as string[],
    });
  } catch (err) {
    return Response.json({ error: 'Failed to save credential' }, { status: 500 });
  }

  return Response.json({ verified: true });
};
