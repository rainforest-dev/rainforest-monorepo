import type { APIRoute } from 'astro';

import { checkFeedUrl } from '../../lib/feedCheck.js';

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ valid: false, error: 'Invalid or missing JSON body' }, { status: 400 });
  }

  const url = (body as Record<string, unknown>)?.url;
  if (typeof url !== 'string') {
    return Response.json({ valid: false, error: 'Missing url field' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return Response.json({ valid: false, error: 'Invalid URL' }, { status: 400 });
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return Response.json({ valid: false, error: 'URL must use http or https' }, { status: 400 });
  }

  try {
    const result = await checkFeedUrl(url);
    return Response.json(result);
  } catch (err) {
    return Response.json({ valid: false, error: String(err) }, { status: 500 });
  }
};
