import type { APIRoute } from 'astro';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { verifyRegistration } from '../../../lib/webauthn.js';
import { saveCredential } from '../../../lib/db.js';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json()) as RegistrationResponseJSON;
    const verification = await verifyRegistration(body);
    if (!verification.verified || !verification.registrationInfo) {
      return Response.json({ error: 'Verification failed' }, { status: 400 });
    }
    const { credential } = verification.registrationInfo;
    saveCredential({
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      transports: (body.response.transports ?? []) as string[],
    });
    return Response.json({ verified: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 400 });
  }
};
