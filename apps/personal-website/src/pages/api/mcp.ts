import { trackAiResourceFetch } from '@utils/track-ai-resource';
import type { APIRoute } from 'astro';

import { createProfileMcpHandler } from '../../mcp/handler';

const handler = createProfileMcpHandler('/api');

// Stateless, POST-only per the design spec — same rationale as Task 4's spike.
export const POST: APIRoute = async ({ request }) => {
  await trackAiResourceFetch('mcp', request);
  return handler(request);
};
