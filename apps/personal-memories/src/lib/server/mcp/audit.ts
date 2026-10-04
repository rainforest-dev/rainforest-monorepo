import { type ToolCall, ToolInputError } from '@rainforest-dev/mcp-kit';

export type AuditLine = {
  kind: 'mcp';
  ts: string;
  login: string;
  tool: string;
  from?: string;
  to?: string;
  date?: string;
  results: number;
  ms: number;
  ok: boolean;
};

const COUNTED = ['results', 'events', 'people', 'buckets'] as const;

export function resultCount(result: unknown): number {
  if (typeof result !== 'object' || result === null) return 0;
  for (const key of COUNTED) {
    const list = (result as Record<string, unknown>)[key];
    if (Array.isArray(list)) return list.length;
  }
  return 0;
}

const dateField = (input: Record<string, unknown>, key: string) => {
  const value = input[key];
  return typeof value === 'string' ? { [key]: value } : {};
};

export function auditLine(call: ToolCall, now = new Date()): AuditLine {
  return {
    kind: 'mcp',
    ts: now.toISOString(),
    login: call.user ?? 'unknown',
    tool: call.tool,
    ...dateField(call.input, 'from'),
    ...dateField(call.input, 'to'),
    ...dateField(call.input, 'date'),
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
      console.error(`[memories] mcp ${call.tool} failed`, call.error);
  };
