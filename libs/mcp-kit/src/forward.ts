import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { toolContent, ToolInputError } from './result';
import type { McpTool, ToolContext } from './tool';

/** Calls one tool on another MCP server and returns its result as that server sent it. */
export type RemoteToolCall = (
  name: string,
  input: Record<string, unknown>,
  context: ToolContext,
) => Promise<CallToolResult>;

const textOf = (result: CallToolResult): string =>
  result.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('\n');

/**
 * Serves `tools` from this server but runs them on another: each keeps its name, schema and
 * annotations, and its call goes to `call`. The remote result comes back as it was sent, and a
 * remote error keeps its message, since the remote server already chose what an agent may see.
 */
export function forwardTools(
  tools: readonly McpTool[],
  call: RemoteToolCall,
): McpTool[] {
  return tools.map((tool) => ({
    ...tool,
    run: async (input, context) => {
      const result = await call(tool.name, input, context);
      if (result.isError) throw new ToolInputError(textOf(result));
      return toolContent(result.content, result.structuredContent);
    },
  }));
}

export interface HttpToolCallerOptions {
  /** The remote server's streamable HTTP endpoint. */
  url: string;
  /** Sent with every call, e.g. the remote's gateway secret. */
  headers?: Record<string, string>;
  /** Sends the caller's gateway user on, under this header. */
  userHeader?: string;
  fetch?: typeof fetch;
}

/**
 * A `RemoteToolCall` over stateless streamable HTTP with JSON responses, as
 * `createMcpFetchHandler` serves it: one `tools/call` request per call, no session.
 */
export function httpToolCaller({
  url,
  headers = {},
  userHeader,
  fetch: fetchImpl = fetch,
}: HttpToolCallerOptions): RemoteToolCall {
  let next = 0;
  return async (name, input, { user }) => {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        ...headers,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...(userHeader && user ? { [userHeader]: user } : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: ++next,
        method: 'tools/call',
        params: { name, arguments: input },
      }),
    });
    if (!response.ok)
      throw new Error(`${name}: the remote server answered ${response.status}`);
    const body = (await response.json()) as {
      result?: CallToolResult;
      error?: { message?: string };
    };
    if (!body.result)
      throw new Error(
        `${name}: the remote server failed: ${body.error?.message ?? 'no result'}`,
      );
    return body.result;
  };
}
