import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { z } from 'zod';

import { gatewayAuth } from './auth';
import { forwardTools, httpToolCaller } from './forward';
import { createMcpFetchHandler } from './handler';
import { toolContent, ToolInputError } from './result';
import { defineTool, registerTools, type ToolCall } from './tool';

const REMOTE = 'https://remote.test/mcp';
const LOCAL = 'https://local.test/mcp';
const SECRET = 'remote-secret';

const echo = defineTool({
  name: 'echo',
  description: 'Echoes its input and the gateway user',
  input: { word: z.string().min(1), times: z.number().int().default(1) },
  annotations: { readOnlyHint: true },
  run: ({ word, times }, { user }) => ({
    words: Array(times).fill(word),
    user,
  }),
});

const picture = defineTool({
  name: 'picture',
  description: 'Returns an image block',
  input: {},
  run: () =>
    toolContent([
      { type: 'text', text: 'one page' },
      { type: 'image', data: 'aGVsbG8=', mimeType: 'image/png' },
    ]),
});

const refuse = defineTool({
  name: 'refuse',
  description: 'Always rejects its input',
  input: {},
  run: () => {
    throw new ToolInputError('Notebook 9 not found');
  },
});

const TOOLS = [echo, picture, refuse];

const remoteCalls: ToolCall[] = [];
const remote = createMcpFetchHandler(
  { name: 'remote', version: '1.0.0' },
  (server) =>
    registerTools(server, TOOLS, { onCall: (c) => remoteCalls.push(c) }),
  {
    auth: gatewayAuth({
      header: 'x-remote-gateway',
      secret: SECRET,
      userHeader: 'x-forwarded-login',
    }),
  },
);

const localFor = (call: ReturnType<typeof httpToolCaller>) =>
  createMcpFetchHandler(
    { name: 'local', version: '1.0.0' },
    (server) => registerTools(server, forwardTools(TOOLS, call)),
    {
      auth: gatewayAuth({
        header: 'x-local-gateway',
        secret: 'local',
        userHeader: 'x-forwarded-login',
      }),
    },
  );

const caller = (
  fetchImpl: typeof fetch = (url, init) => remote(new Request(url, init)),
) =>
  httpToolCaller({
    url: REMOTE,
    headers: { 'x-remote-gateway': SECRET },
    userHeader: 'x-forwarded-login',
    fetch: fetchImpl,
  });

async function connect(handler: (request: Request) => Promise<Response>) {
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(LOCAL), {
      fetch: (url, init) => handler(new Request(url, init)),
      requestInit: {
        headers: { 'x-local-gateway': 'local', 'x-forwarded-login': 'reader' },
      },
    }),
  );
  return client;
}

describe('forwardTools over httpToolCaller', () => {
  it('lists the forwarded tools with their own schemas', async () => {
    const client = await connect(localFor(caller()));
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(['echo', 'picture', 'refuse']);
    expect(tools[0]?.inputSchema).toMatchObject({
      properties: { word: { type: 'string', minLength: 1 } },
      required: ['word'],
    });
    expect(tools[0]?.annotations).toEqual({ readOnlyHint: true });
    await client.close();
  });

  it('runs the call remotely as the same user and returns its result', async () => {
    const client = await connect(localFor(caller()));
    const result = await client.callTool({
      name: 'echo',
      arguments: { word: 'tide', times: 2 },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      words: ['tide', 'tide'],
      user: 'reader',
    });
    expect(remoteCalls.at(-1)).toMatchObject({ tool: 'echo', user: 'reader' });
    await client.close();
  });

  it('passes image blocks through', async () => {
    const client = await connect(localFor(caller()));
    const result = await client.callTool({ name: 'picture', arguments: {} });
    expect(result.content).toEqual([
      { type: 'text', text: 'one page' },
      { type: 'image', data: 'aGVsbG8=', mimeType: 'image/png' },
    ]);
    await client.close();
  });

  it("keeps the remote's error message", async () => {
    const client = await connect(localFor(caller()));
    const result = await client.callTool({ name: 'refuse', arguments: {} });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: 'text', text: 'Notebook 9 not found' },
    ]);
    await client.close();
  });

  it('hides why the remote could not be reached', async () => {
    const client = await connect(
      localFor(caller(async () => new Response('no', { status: 502 }))),
    );
    const result = await client.callTool({
      name: 'echo',
      arguments: { word: 'tide' },
    });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: 'text', text: 'Internal error' }]);
    await client.close();
  });

  it('is refused by the remote without its secret', async () => {
    const call = httpToolCaller({
      url: REMOTE,
      userHeader: 'x-forwarded-login',
      fetch: (url, init) => remote(new Request(url, init)),
    });
    await expect(call('echo', { word: 'tide' }, { user: 'r' })).rejects.toThrow(
      'echo: the remote server answered 401',
    );
  });
});
