import type { APIRequestContext } from '@playwright/test';

export const MCP_SECRET = process.env['CALIBRE_MCP_SECRET'] || 'e2e-mcp-secret';
export const MCP_PATHS = ['/mcp', '/api/mcp'] as const;
export const AUTHED = {
  'x-calibre-gateway': MCP_SECRET,
  'x-forwarded-login': 'e2e',
};

let nextId = 1;

export const rpc = (
  request: APIRequestContext,
  path: string,
  method: string,
  params: Record<string, unknown> = {},
  headers: Record<string, string> = AUTHED,
) =>
  request.post(path, {
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      ...headers,
    },
    data: { jsonrpc: '2.0', id: nextId++, method, params },
  });

export async function callTool(
  request: APIRequestContext,
  name: string,
  args: Record<string, unknown> = {},
) {
  const response = await rpc(request, '/mcp', 'tools/call', {
    name,
    arguments: args,
  });
  const body = await response.json();
  return body.result as {
    content: { type: string; text: string }[];
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
  };
}
