import { trackMcpFetch } from '@utils/track-ai-resource';
import type { APIRoute } from 'astro';

import { createProfileMcpHandler, mcpUsageResponse } from '../mcp/handler';

// Same MCP tool surface as /api/mcp, mounted at the site root instead — added so the
// server is reachable at rainforest.tools/mcp directly, without depending on
// vercel.json's mcp.rainforest.tools host rewrite (which doesn't reliably take effect
// ahead of Astro's own generated routing; see the routing-fix PR for the investigation).
const handler = createProfileMcpHandler();

export const POST: APIRoute = async ({ request }) => {
  await trackMcpFetch(request);
  return handler(request);
};

// See mcpUsageResponse — this is the URL llms.txt links to, so it must not 404 on GET.
export const GET: APIRoute = ({ site }) =>
  mcpUsageResponse(new URL('/mcp', site ?? 'https://rainforest.tools').href);
