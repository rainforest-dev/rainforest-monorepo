import type { APIRequestContext } from '@playwright/test';

export const MCP_SECRET =
  process.env['NOTEBOOK_MCP_SECRET'] || 'e2e-notebook-mcp-secret';
export const MCP_PATH = '/notebooks/mcp';
export const AUTHED = {
  'x-notebook-gateway': MCP_SECRET,
  'x-forwarded-login': 'e2e',
};

let nextId = 1;

export async function callTool(
  request: APIRequestContext,
  name: string,
  args: Record<string, unknown> = {},
) {
  const response = await request.post(MCP_PATH, {
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      ...AUTHED,
    },
    data: {
      jsonrpc: '2.0',
      id: nextId++,
      method: 'tools/call',
      params: { name, arguments: args },
    },
  });
  const body = await response.json();
  return body.result as {
    content: { type: string; text: string }[];
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
  };
}
