import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export const MCP_SECRET = 'test-secret';
export const GATEWAY_HEADERS = {
  'x-memories-gateway': MCP_SECRET,
  'x-forwarded-login': 'e2e-agent',
};

export async function mcpClient(baseURL: string) {
  const client = new Client({ name: 'memories-e2e', version: '0.0.0' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL('/mcp', baseURL), {
      requestInit: { headers: GATEWAY_HEADERS },
    }),
  );
  return client;
}

export async function callTool<T = Record<string, unknown>>(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) throw new Error(JSON.stringify(result.content));
  return result.structuredContent as T;
}
