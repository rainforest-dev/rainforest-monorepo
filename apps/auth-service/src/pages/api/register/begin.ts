import type { APIRoute } from 'astro';
import { createRegistrationOptions } from '../../../lib/webauthn.js';

export const POST: APIRoute = async () => {
  try {
    const options = await createRegistrationOptions();
    return Response.json(options);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
