import type { APIRoute } from 'astro';

import { createProfileMcpHandler } from '../../mcp/handler';

const handler = createProfileMcpHandler('/api');

// Stateless, POST-only per the design spec — same rationale as Task 4's spike.
export const POST: APIRoute = ({ request }) => handler(request);
