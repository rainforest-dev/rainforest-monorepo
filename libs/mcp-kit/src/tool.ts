import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { toolError, toolResult } from './result';

export interface ToolContext {
  user?: string;
}

type ToolOutput<O> = O extends z.ZodRawShape
  ? z.input<z.ZodObject<O>>
  : unknown;

export interface ToolSpec<
  I extends z.ZodRawShape,
  O extends z.ZodRawShape | undefined,
> {
  name: string;
  title?: string;
  description: string;
  input: I;
  output?: O;
  annotations?: ToolAnnotations;
  run: (
    input: z.output<z.ZodObject<I>>,
    context: ToolContext,
  ) => ToolOutput<O> | Promise<ToolOutput<O>>;
}

export interface McpTool {
  name: string;
  title?: string;
  description: string;
  input: z.ZodRawShape;
  output?: z.ZodRawShape;
  annotations?: ToolAnnotations;
  run: (input: Record<string, unknown>, context: ToolContext) => unknown;
}

/**
 * Defines a tool from one zod v4 shape. `run` receives the parsed input typed from `input`, and
 * returns plain data typed from `output` when given. The result erases to `McpTool` so tools of
 * different shapes collect into one array.
 */
export function defineTool<
  I extends z.ZodRawShape,
  O extends z.ZodRawShape | undefined = undefined,
>(tool: ToolSpec<I, O>): McpTool {
  return tool as unknown as McpTool;
}

export interface ToolCall {
  tool: string;
  input: Record<string, unknown>;
  user?: string;
  ok: boolean;
  ms: number;
  result?: unknown;
  error?: unknown;
}

export interface RegisterToolsOptions {
  onCall?: (call: ToolCall) => void;
}

const userOf = (authInfo: AuthInfo | undefined): string | undefined => {
  const user = authInfo?.extra?.['user'];
  return typeof user === 'string' ? user : undefined;
};

const report = (
  onCall: RegisterToolsOptions['onCall'],
  call: ToolCall,
): void => {
  try {
    onCall?.(call);
  } catch (error) {
    console.error('mcp-kit: onCall hook threw', error);
  }
};

/**
 * Registers each tool on `server`. Its `run` result goes out through `toolResult`, and a thrown
 * error through `toolError`. `onCall` sees every call that passed input validation, with the
 * gateway user, the outcome and its duration; it is the place to audit or log errors.
 */
export function registerTools(
  server: McpServer,
  tools: readonly McpTool[],
  { onCall }: RegisterToolsOptions = {},
): void {
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.input,
        outputSchema: tool.output,
        annotations: tool.annotations,
      },
      async (input: Record<string, unknown>, extra) => {
        const user = userOf(extra.authInfo);
        const started = performance.now();
        const call = { tool: tool.name, input, user };
        try {
          const result = await tool.run(input, { user });
          report(onCall, {
            ...call,
            ok: true,
            ms: performance.now() - started,
            result,
          });
          return toolResult(result);
        } catch (error) {
          report(onCall, {
            ...call,
            ok: false,
            ms: performance.now() - started,
            error,
          });
          return toolError(error);
        }
      },
    );
  }
}

export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  annotations?: ToolAnnotations;
}

/**
 * Describes a tool with JSON Schema instead of zod, for WebMCP and llms.txt. It is the same
 * `z.toJSONSchema(z.object(shape))` the website's descriptors use, so a field with a default is
 * listed as required there, unlike in the SDK's `tools/list`.
 */
export function toJsonSchema(tool: McpTool): ToolDescriptor {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: z.toJSONSchema(z.object(tool.input)),
    ...(tool.output && {
      outputSchema: z.toJSONSchema(z.object(tool.output)),
    }),
    ...(tool.annotations && { annotations: tool.annotations }),
  };
}
