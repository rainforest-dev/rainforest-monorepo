import { Hono } from 'hono';
import { createMcpHandler } from 'mcp-handler';

import { registerTools } from './tools';

const app = new Hono();

// Root-level endpoint, not /api/mcp — this project serves *only* mcp.rainforest.tools,
// so there's no other content on this domain competing for the root path, and no
// domain-conditional rewrite is needed the way the old colocated design required.
const mcpHandler = createMcpHandler(registerTools, {}, {
  streamableHttpEndpoint: '/',
  disableSse: true,
});

// `app.on(['GET', 'POST', 'DELETE'], ...)`, not `app.post` and not `app.all`:
// - GET/DELETE must still reach mcp-handler so *it* can respond 405 (POST-only
//   transport). A bare `app.post` route would make Hono itself reject those methods
//   with a generic 404 before the request ever reached mcp-handler's own enforcement.
// - Everything else (PUT, PATCH, OPTIONS, HEAD, ...) must NOT be routed to
//   mcp-handler — it only ever writes a response for GET, POST, and DELETE, so any
//   other verb falls through silently and the request hangs until the platform
//   times out. Letting Hono's router 404 those verbs itself is correct and instant.
app.on(['GET', 'POST', 'DELETE'], '/', (c) => mcpHandler(c.req.raw));
app.get('/healthz', (c) => c.text('ok'));

export default app;
