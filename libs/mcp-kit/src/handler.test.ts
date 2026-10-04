import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { z } from 'zod';

import { gatewayAuth } from './auth';
import { createMcpFetchHandler } from './handler';
import { ToolInputError } from './result';
import { defineTool, registerTools, type ToolCall } from './tool';

const ENDPOINT = 'https://example.test/mcp';

const search = defineTool({
  name: 'search',
  description: 'Search the fixture',
  input: {
    query: z.string().trim().min(1).max(200),
    limit: z.number().int().min(1).max(20).default(10),
  },
  output: {
    query: z.string(),
    limit: z.number(),
    user: z.string().optional(),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  run: ({ query, limit }, { user }) => ({ query, limit, user }),
});

const listAll = defineTool({
  name: 'list_all',
  description: 'Returns an array',
  input: {},
  annotations: { readOnlyHint: true },
  run: () => [1, 2, 3],
});

const badRange = defineTool({
  name: 'bad_range',
  description: 'Always rejects its input',
  input: {},
  run: () => {
    throw new ToolInputError('from must not be after to');
  },
});

const crash = defineTool({
  name: 'crash',
  description: 'Always fails',
  input: {},
  run: async () => {
    throw new Error('ENOENT: /Users/someone/timeline.json');
  },
});

const TOOLS = [search, listAll, badRange, crash];

const buildHandler = (
  options: Parameters<typeof createMcpFetchHandler>[2] = {},
  onCall?: (call: ToolCall) => void,
) =>
  createMcpFetchHandler(
    { name: 'fixture', version: '1.2.3' },
    (server) => registerTools(server, TOOLS, { onCall }),
    options,
  );

const connect = async (
  handler: (request: Request) => Promise<Response>,
  headers: Record<string, string> = {},
) => {
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(ENDPOINT), {
      fetch: (url, init) => handler(new Request(url, init)),
      requestInit: { headers },
    }),
  );
  return client;
};

const rpc = (
  body: unknown,
  headers: Record<string, string> = {},
  method = 'POST',
) =>
  new Request(ENDPOINT, {
    method,
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      ...headers,
    },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });

describe('createMcpFetchHandler through the SDK client', () => {
  it('initializes with the server info', async () => {
    const client = await connect(buildHandler());
    expect(client.getServerVersion()).toMatchObject({
      name: 'fixture',
      version: '1.2.3',
    });
    await client.close();
  });

  it('lists tools with JSON Schema and annotations', async () => {
    const client = await connect(buildHandler());
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual([
      'search',
      'list_all',
      'bad_range',
      'crash',
    ]);
    const [listed] = tools;
    expect(listed.annotations).toEqual({
      readOnlyHint: true,
      openWorldHint: false,
    });
    expect(listed.inputSchema).toMatchObject({
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 1, maxLength: 200 },
        limit: { type: 'integer', minimum: 1, maximum: 20, default: 10 },
      },
      required: ['query'],
    });
    expect(listed.outputSchema).toMatchObject({
      type: 'object',
      required: ['query', 'limit'],
    });
    await client.close();
  });

  it('calls a tool and returns text plus structuredContent', async () => {
    const client = await connect(buildHandler());
    const result = await client.callTool({
      name: 'search',
      arguments: { query: '  ramen ' },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ query: 'ramen', limit: 10 });
    expect(result.content).toEqual([
      { type: 'text', text: JSON.stringify({ query: 'ramen', limit: 10 }) },
    ]);
    await client.close();
  });

  it('returns non-object data as text only', async () => {
    const client = await connect(buildHandler());
    const result = await client.callTool({ name: 'list_all', arguments: {} });
    expect(result.structuredContent).toBeUndefined();
    expect(result.content).toEqual([{ type: 'text', text: '[1,2,3]' }]);
    await client.close();
  });

  it('turns an input validation failure into an isError result', async () => {
    const client = await connect(buildHandler());
    const result = await client.callTool({
      name: 'search',
      arguments: { query: 'ramen', limit: 50 },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('Input validation error');
    await client.close();
  });

  it('maps a ToolInputError to its message and anything else to a generic one', async () => {
    const client = await connect(buildHandler());
    expect(
      await client.callTool({ name: 'bad_range', arguments: {} }),
    ).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'from must not be after to' }],
    });
    const crashed = await client.callTool({ name: 'crash', arguments: {} });
    expect(crashed).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'Internal error' }],
    });
    expect(JSON.stringify(crashed)).not.toContain('/Users/');
    await client.close();
  });

  it('passes the gateway user to run and onCall', async () => {
    const calls: ToolCall[] = [];
    const handler = buildHandler(
      {
        auth: gatewayAuth({
          header: 'x-gateway',
          secret: 'test-secret',
          userHeader: 'x-forwarded-login',
        }),
      },
      (call) => calls.push(call),
    );
    const client = await connect(handler, {
      'x-gateway': 'test-secret',
      'x-forwarded-login': 'octocat',
    });

    const result = await client.callTool({
      name: 'search',
      arguments: { query: 'ramen', limit: 2 },
    });
    await client.callTool({ name: 'crash', arguments: {} });

    expect(result.structuredContent).toEqual({
      query: 'ramen',
      limit: 2,
      user: 'octocat',
    });
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      tool: 'search',
      input: { query: 'ramen', limit: 2 },
      user: 'octocat',
      ok: true,
      result: { query: 'ramen', limit: 2, user: 'octocat' },
    });
    expect(calls[0].ms).toBeGreaterThanOrEqual(0);
    expect(calls[1]).toMatchObject({ tool: 'crash', ok: false });
    expect(calls[1].error).toBeInstanceOf(Error);
    await client.close();
  });

  it('still answers when onCall throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = await connect(
      buildHandler({}, () => {
        throw new Error('audit sink down');
      }),
    );
    const result = await client.callTool({
      name: 'search',
      arguments: { query: 'ramen' },
    });
    expect(result.structuredContent).toEqual({ query: 'ramen', limit: 10 });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    await client.close();
  });
});

describe('createMcpFetchHandler over raw JSON-RPC', () => {
  it('answers tools/list without a session', async () => {
    const response = await buildHandler()(
      rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    const body = await response.json();
    expect(body.result.tools).toHaveLength(TOOLS.length);
  });

  it.each(['GET', 'DELETE', 'PUT'])('returns 405 on %s', async (method) => {
    const response = await buildHandler()(rpc(undefined, {}, method));
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
  });

  describe('with gatewayAuth', () => {
    const handler = buildHandler({
      auth: gatewayAuth({
        header: 'x-gateway',
        secret: 'test-secret',
        userHeader: 'x-forwarded-login',
      }),
    });
    const list = { jsonrpc: '2.0', id: 1, method: 'tools/list' };

    it.each<Record<string, string>>([
      {},
      { 'x-gateway': 'wrong' },
      { 'x-gateway': 'test-secret' },
      { 'x-gateway': 'test-secret', 'x-forwarded-login': '' },
    ])('returns 401 for %j', async (headers) => {
      const response = await handler(rpc(list, headers));
      expect(response.status).toBe(401);
    });

    it('returns 401 on GET without the secret, before the method check', async () => {
      expect((await handler(rpc(undefined, {}, 'GET'))).status).toBe(401);
    });

    it('accepts the right secret and a login', async () => {
      const response = await handler(
        rpc(list, { 'x-gateway': 'test-secret', 'x-forwarded-login': 'me' }),
      );
      expect(response.status).toBe(200);
    });
  });

  it.each(['POST', 'GET'])(
    'returns 404 on %s while the secret is unset',
    async (method) => {
      const handler = buildHandler({
        auth: gatewayAuth({ header: 'x-gateway', secret: undefined }),
      });
      const response = await handler(
        rpc(
          { jsonrpc: '2.0', id: 1, method: 'tools/list' },
          { 'x-gateway': 'anything' },
          method,
        ),
      );
      expect(response.status).toBe(404);
    },
  );
});
