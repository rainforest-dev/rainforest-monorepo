import type { APIRoute } from 'astro';
import { checkFeedUrl } from '../../lib/feedCheck.js';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { url } = (await request.json()) as { url: string };
    if (!url || !url.startsWith('http')) {
      return Response.json({ valid: false, error: 'Invalid URL' }, { status: 400 });
    }
    const result = await checkFeedUrl(url);
    return Response.json(result);
  } catch (err) {
    return Response.json({ valid: false, error: String(err) }, { status: 500 });
  }
};
