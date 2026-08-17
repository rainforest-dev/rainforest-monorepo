import { trackMcpFetch } from '@utils/track-ai-resource';
import type { APIRoute } from 'astro';

import { createProfileMcpHandler, mcpUsageResponse } from '../../mcp/handler';

const handler = createProfileMcpHandler('/api');

// Stateless, POST-only per the design spec — same rationale as Task 4's spike.
export const POST: APIRoute = async ({ request }) => {
  await trackMcpFetch(request);
  return handler(request);
};

// llms.txt names this path as the alternate endpoint, so it needs the same GET note as /mcp.
export const GET: APIRoute = ({ site }) =>
  mcpUsageResponse(
    new URL('/api/mcp', site ?? 'https://rainforest.tools').href,
  );
