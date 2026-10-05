import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import type { AuthResult, McpAuth } from './auth';

export interface McpServerInfo {
  name: string;
  version: string;
}

export interface McpFetchHandlerOptions {
  auth?: McpAuth;
}

const jsonRpcError = (status: number, message: string): Response =>
  Response.json(
    { jsonrpc: '2.0', error: { code: -32000, message }, id: null },
    {
      status,
      headers: status === 405 ? { allow: 'POST' } : undefined,
    },
  );

const OPEN: AuthResult = { status: 'ok' };

/**
 * Builds a `(Request) => Response` MCP endpoint over stateless streamable HTTP with JSON
 * responses. It has no base path, so it mounts as a Next route handler or an Astro endpoint as
 * is. `register` runs on a fresh `McpServer` per request.
 *
 * `auth` runs first: `disabled` answers 404 and `unauthorized` 401, before the SDK sees the
 * request. Anything other than POST answers 405. An accepted `user` reaches tools as
 * `extra.authInfo.extra.user`, which `registerTools` hands to `run` and `onCall`.
 */
export function createMcpFetchHandler(
  info: McpServerInfo,
  register: (server: McpServer) => void,
  { auth }: McpFetchHandlerOptions = {},
): (request: Request) => Promise<Response> {
  return async (request) => {
    const verdict = auth ? await auth(request) : OPEN;
    if (verdict.status === 'disabled') {
      return new Response('Not Found', { status: 404 });
    }
    if (verdict.status === 'unauthorized') {
      return jsonRpcError(401, 'Unauthorized');
    }
    if (request.method !== 'POST') {
      return jsonRpcError(405, 'Method not allowed');
    }

    const server = new McpServer(info);
    register(server);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    return transport.handleRequest(request, {
      authInfo: {
        token: '',
        clientId: info.name,
        scopes: [],
        extra: verdict.user ? { user: verdict.user } : {},
      },
    });
  };
}
