import { type ToolCall, ToolInputError } from '@rainforest-dev/mcp-kit';

export type AuditLine = {
  kind: 'mcp';
  ts: string;
  login: string;
  tool: string;
  bookId?: number;
  bookIds?: number;
  tagId?: number;
  deliveryId?: number;
  results: number;
  ms: number;
  ok: boolean;
};

const ID_FIELDS = ['bookId', 'tagId', 'deliveryId'] as const;

export function resultCount(result: unknown): number {
  if (Array.isArray(result)) return result.length;
  if (typeof result !== 'object' || result === null) return 0;
  const record = result as Record<string, unknown>;
  for (const key of ['books', 'groups']) {
    const list = record[key];
    if (Array.isArray(list)) return list.length;
  }
  return typeof record['count'] === 'number' ? record['count'] : 1;
}

export function auditLine(call: ToolCall, now = new Date()): AuditLine {
  const ids: Partial<Record<(typeof ID_FIELDS)[number], number>> = {};
  for (const key of ID_FIELDS) {
    const value = call.input[key];
    if (typeof value === 'number') ids[key] = value;
  }
  const bookIds = call.input['bookIds'];
  return {
    kind: 'mcp',
    ts: now.toISOString(),
    login: call.user ?? 'unknown',
    tool: call.tool,
    ...ids,
    ...(Array.isArray(bookIds) && { bookIds: bookIds.length }),
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
      console.error(`[calibre] mcp ${call.tool} failed`, call.error);
  };
