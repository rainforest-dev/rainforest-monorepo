import { trackAiResourceFetch } from '@utils/track-ai-resource';
import type { APIRoute } from 'astro';

import { createProfileMcpHandler } from '../mcp/handler';

// Same MCP tool surface as /api/mcp, mounted at the site root instead — added so the
// server is reachable at rainforest.tools/mcp directly, without depending on
// vercel.json's mcp.rainforest.tools host rewrite (which doesn't reliably take effect
// ahead of Astro's own generated routing; see the routing-fix PR for the investigation).
const handler = createProfileMcpHandler();

export const POST: APIRoute = async ({ request }) => {
  await trackAiResourceFetch('mcp', request);
  return handler(request);
};
