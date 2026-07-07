import { Hono } from 'hono';

const app = new Hono();
app.get('/healthz', (c) => c.text('ok'));

export default app;
