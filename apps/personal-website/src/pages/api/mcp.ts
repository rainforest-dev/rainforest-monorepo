import type { APIRoute } from 'astro';
import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';

const handler = createMcpHandler(
  (server) => {
    server.tool('ping', 'Health check tool', { echo: z.string().optional() }, async ({ echo }) => ({
      content: [{ type: 'text', text: `pong${echo ? `: ${echo}` : ''}` }],
    }));
  },
  {},
  { basePath: '/api' },
);

// Stateless, POST-only per the design spec: no GET/SSE stream (no server-initiated
// push needed for a read-only server) and no DELETE (no sessions to terminate).
export const POST: APIRoute = ({ request }) => handler(request);
