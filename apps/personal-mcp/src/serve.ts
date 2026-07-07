import { serve } from '@hono/node-server';

import app from './index';

const port = 3005;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`personal-mcp listening on http://localhost:${info.port}`);
});
