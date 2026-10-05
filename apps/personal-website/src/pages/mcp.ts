import { trackMcpFetch } from '@utils/track-ai-resource';
import type { APIRoute } from 'astro';

import { createProfileMcpHandler, mcpUsageResponse } from '@/mcp/handler';

const handler = createProfileMcpHandler();

export const POST: APIRoute = async ({ request }) => {
  await trackMcpFetch(request);
  return handler(request);
};

// See mcpUsageResponse — this is the URL llms.txt links to, so it must not 404 on GET.
export const GET: APIRoute = ({ site }) =>
  mcpUsageResponse(new URL('/mcp', site ?? 'https://rainforest.tools').href);
