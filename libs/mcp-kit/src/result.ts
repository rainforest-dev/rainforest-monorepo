import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export class ToolInputError extends Error {
  override name = 'ToolInputError';
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/**
 * Wraps plain data as a tool result: JSON text for every client, plus `structuredContent` when
 * the data is a plain object (MCP requires structured content to be an object).
 */
export function toolResult(data: unknown): CallToolResult {
  const content: CallToolResult['content'] = [
    { type: 'text', text: JSON.stringify(data ?? null) },
  ];
  return isPlainObject(data)
    ? { content, structuredContent: data }
    : { content };
}

/**
 * Maps a thrown error to an `isError` result. A `ToolInputError` keeps its message, which is
 * meant for the agent; anything else becomes a generic message so internals never leak.
 */
export function toolError(error: unknown): CallToolResult {
  const text =
    error instanceof ToolInputError ? error.message : 'Internal error';
  return { content: [{ type: 'text', text }], isError: true };
}
