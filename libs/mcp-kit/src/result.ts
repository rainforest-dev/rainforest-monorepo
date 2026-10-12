import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export class ToolInputError extends Error {
  override name = 'ToolInputError';
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const CONTENT = Symbol.for('@rainforest-dev/mcp-kit/tool-content');

/** Content blocks a tool returns as they are, from `toolContent`. */
export interface ToolContent {
  readonly [CONTENT]: true;
  readonly content: CallToolResult['content'];
}

/**
 * Returns content blocks verbatim instead of JSON text, for results plain data cannot carry, such
 * as `{ type: 'image', data, mimeType }`. `toolResult` passes it through unchanged.
 */
export function toolContent(content: CallToolResult['content']): ToolContent {
  return { [CONTENT]: true, content };
}

export const isToolContent = (value: unknown): value is ToolContent =>
  typeof value === 'object' && value !== null && CONTENT in value;

/**
 * Wraps plain data as a tool result: JSON text for every client, plus `structuredContent` when
 * the data is a plain object (MCP requires structured content to be an object). A `toolContent`
 * value goes out as its own content blocks.
 */
export function toolResult(data: unknown): CallToolResult {
  if (isToolContent(data)) return { content: data.content };
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
