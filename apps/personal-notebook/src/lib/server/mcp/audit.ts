import {
  isToolContent,
  type ToolCall,
  ToolInputError,
} from '@rainforest-dev/mcp-kit';

export type AuditLine = {
  kind: 'mcp';
  ts: string;
  login: string;
  tool: string;
  notebookId?: number;
  pageId?: number;
  results: number;
  ms: number;
  ok: boolean;
};

const ID_FIELDS = ['notebookId', 'pageId'] as const;

export function resultCount(result: unknown): number {
  if (Array.isArray(result)) return result.length;
  if (isToolContent(result)) {
    return result.content.filter((block) => block.type === 'image').length;
  }
  if (typeof result !== 'object' || result === null) return 0;
  const record = result as Record<string, unknown>;
  return typeof record['count'] === 'number' ? record['count'] : 1;
}

export function auditLine(call: ToolCall, now = new Date()): AuditLine {
  const ids: Partial<Record<(typeof ID_FIELDS)[number], number>> = {};
  for (const key of ID_FIELDS) {
    const value = call.input[key];
    if (typeof value === 'number') ids[key] = value;
  }
  return {
    kind: 'mcp',
    ts: now.toISOString(),
    login: call.user ?? 'unknown',
    tool: call.tool,
    ...ids,
    results: call.ok ? resultCount(call.result) : 0,
    ms: Math.round(call.ms),
    ok: call.ok,
  };
}

const stdout = (line: string) => {
  process.stdout.write(`${line}\n`);
};

export const auditCall =
  (write: (line: string) => void = stdout) =>
  (call: ToolCall): void => {
    write(JSON.stringify(auditLine(call)));
    if (!call.ok && !(call.error instanceof ToolInputError))
      console.error(`[notebook] mcp ${call.tool} failed`, call.error);
  };
