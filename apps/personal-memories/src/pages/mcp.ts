import type { APIRoute } from 'astro';

import { memoriesMcpHandler } from '@/lib/server/mcp';

let handler: ((request: Request) => Promise<Response>) | undefined;

export const ALL: APIRoute = ({ request }) =>
  (handler ??= memoriesMcpHandler(process.env))(request);
