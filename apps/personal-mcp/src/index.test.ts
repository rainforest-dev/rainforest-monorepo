import { describe, expect, it } from 'vitest';

import app from './index';

async function jsonRpc(body: Record<string, unknown>) {
  const res = await app.request('/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  // Streamable HTTP responses are SSE-framed ("event: message\ndata: {...}\n\n") —
  // extract the JSON payload from the "data:" line.
  const dataLine = text.split('\n').find((line) => line.startsWith('data:'));
  return { status: res.status, body: dataLine ? JSON.parse(dataLine.slice('data:'.length)) : undefined };
}

describe('personal-mcp HTTP surface', () => {
  it('GET /healthz responds ok', async () => {
    const res = await app.request('/healthz');
    expect(await res.text()).toBe('ok');
  });

  it('tools/list returns all six registered tools', async () => {
    const { status, body } = await jsonRpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(status).toBe(200);
    const names = body.result.tools.map((t: { name: string }) => t.name);
    expect(names).toEqual([
      'get_profile_summary',
      'get_work_experience',
      'get_education',
      'get_projects',
      'get_skills',
      'search_by_technology',
    ]);
  });

  it('tools/call get_work_experience returns resolved data over real HTTP', async () => {
    const { body } = await jsonRpc({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'get_work_experience', arguments: { technology: 'auth0', lang: 'en' } },
    });
    const jobs = JSON.parse(body.result.content[0].text);
    expect(jobs.some((j: { id: string }) => j.id === 'en/6')).toBe(true);
  });

  it('a GET request to the MCP endpoint is rejected (POST-only transport)', async () => {
    const res = await app.request('/', {
      method: 'GET',
      headers: { Accept: 'application/json, text/event-stream' },
    });
    expect(res.status).toBe(405);
  });

  it('an unhandled method (PUT) gets an immediate 404 rather than hanging', async () => {
    // mcp-handler only ever writes a response for GET/POST/DELETE — routing any other
    // verb to it leaves the request unresolved. Hono must 404 this itself, and it must
    // do so promptly (a plain await resolving at all is the proof it isn't hanging).
    const res = await app.request('/', { method: 'PUT' });
    expect(res.status).toBe(404);
  });
});
