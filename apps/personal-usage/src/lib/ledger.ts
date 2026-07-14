import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A single line of an AI-usage ledger partition. One JSON object per line in
 * `${VAULT_PATH}/_system/usage/ledger.*.jsonl`.
 */
export interface LedgerRecord {
  notion_task_id: string | null;
  provisional_key: string | null;
  notion_ref: string | null;
  machine: string;
  tool: string;
  model: string;
  session_id: string;
  ts: string;
  tokens_in: number;
  tokens_out: number;
  cache: number;
  cost_est_usd: number;
  source: string;
}

export interface Totals {
  cost_est_usd: number;
  tokens_in: number;
  tokens_out: number;
  cache: number;
  record_count: number;
  session_count: number;
}

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  cost: number;
  tokens_in: number;
  tokens_out: number;
}

export interface Breakdown {
  key: string;
  cost: number;
  tokens: number;
  count: number;
}

/** A per-machine breakdown that also tracks the latest activity timestamp. */
export interface MachineBreakdown extends Breakdown {
  /** ISO timestamp of the most recent record for this machine. */
  last_ts: string | null;
}

export interface TaskRow {
  task: string;
  notion_ref: string | null;
  cost: number;
  tokens_in: number;
  tokens_out: number;
  count: number;
  tools: string[];
}

export interface UsageAggregates {
  totals: Totals;
  dailySeries: DailyPoint[];
  byTool: Breakdown[];
  byModel: Breakdown[];
  byMachine: MachineBreakdown[];
  byTask: TaskRow[];
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function round(n: number, dp = 4): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/**
 * Parse one partition's raw content into records. Blank lines and lines that
 * are not valid JSON objects (or lack a usable `ts`) are skipped so a single
 * malformed line never poisons the whole partition.
 */
export function parseLedger(content: string): LedgerRecord[] {
  const records: LedgerRecord[] = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let obj: unknown;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      continue; // malformed line
    }
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) continue;

    const o = obj as Record<string, unknown>;
    if (typeof o.ts !== 'string' || o.ts.length === 0) continue; // unusable

    records.push({
      notion_task_id: strOrNull(o.notion_task_id),
      provisional_key: strOrNull(o.provisional_key),
      notion_ref: strOrNull(o.notion_ref),
      machine: str(o.machine),
      tool: str(o.tool),
      model: str(o.model),
      session_id: str(o.session_id),
      ts: o.ts,
      tokens_in: num(o.tokens_in),
      tokens_out: num(o.tokens_out),
      cache: num(o.cache),
      cost_est_usd: num(o.cost_est_usd),
      source: str(o.source),
    });
  }
  return records;
}

function bump(map: Map<string, Breakdown>, key: string, r: LedgerRecord): void {
  const b = map.get(key) ?? { key, cost: 0, tokens: 0, count: 0 };
  b.cost += r.cost_est_usd;
  b.tokens += r.tokens_in + r.tokens_out;
  b.count += 1;
  map.set(key, b);
}

function finishBreakdown<T extends Breakdown>(map: Map<string, T>): T[] {
  return [...map.values()]
    .map((b) => ({ ...b, cost: round(b.cost) }))
    .sort((a, b) => b.cost - a.cost);
}

/** Reduce parsed records into the aggregates the dashboard renders. */
export function aggregate(records: LedgerRecord[]): UsageAggregates {
  const totals: Totals = {
    cost_est_usd: 0,
    tokens_in: 0,
    tokens_out: 0,
    cache: 0,
    record_count: 0,
    session_count: 0,
  };
  const sessions = new Set<string>();
  const daily = new Map<string, DailyPoint>();
  const tool = new Map<string, Breakdown>();
  const model = new Map<string, Breakdown>();
  const machine = new Map<string, MachineBreakdown>();
  const task = new Map<string, TaskRow & { toolSet: Set<string> }>();

  for (const r of records) {
    totals.cost_est_usd += r.cost_est_usd;
    totals.tokens_in += r.tokens_in;
    totals.tokens_out += r.tokens_out;
    totals.cache += r.cache;
    totals.record_count += 1;
    if (r.session_id) sessions.add(r.session_id);

    const date = r.ts.slice(0, 10);
    const dp = daily.get(date) ?? { date, cost: 0, tokens_in: 0, tokens_out: 0 };
    dp.cost += r.cost_est_usd;
    dp.tokens_in += r.tokens_in;
    dp.tokens_out += r.tokens_out;
    daily.set(date, dp);

    bump(tool, r.tool || '(unknown)', r);
    bump(model, r.model || '(unknown)', r);

    const machineKey = r.machine || '(unknown)';
    const mb = machine.get(machineKey) ?? {
      key: machineKey,
      cost: 0,
      tokens: 0,
      count: 0,
      last_ts: null,
    };
    mb.cost += r.cost_est_usd;
    mb.tokens += r.tokens_in + r.tokens_out;
    mb.count += 1;
    if (!mb.last_ts || r.ts > mb.last_ts) mb.last_ts = r.ts;
    machine.set(machineKey, mb);

    const taskKey = r.notion_task_id ?? r.provisional_key ?? '(untagged)';
    const t =
      task.get(taskKey) ??
      ({
        task: taskKey,
        notion_ref: r.notion_ref,
        cost: 0,
        tokens_in: 0,
        tokens_out: 0,
        count: 0,
        tools: [],
        toolSet: new Set<string>(),
      } satisfies TaskRow & { toolSet: Set<string> });
    t.cost += r.cost_est_usd;
    t.tokens_in += r.tokens_in;
    t.tokens_out += r.tokens_out;
    t.count += 1;
    if (r.notion_ref && !t.notion_ref) t.notion_ref = r.notion_ref;
    if (r.tool) t.toolSet.add(r.tool);
    task.set(taskKey, t);
  }

  totals.session_count = sessions.size;
  totals.cost_est_usd = round(totals.cost_est_usd);

  const dailySeries = [...daily.values()]
    .map((d) => ({ ...d, cost: round(d.cost) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byTask = [...task.values()]
    .map(({ toolSet, ...t }) => ({
      ...t,
      cost: round(t.cost),
      tools: [...toolSet].sort(),
    }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 50);

  return {
    totals,
    dailySeries,
    byTool: finishBreakdown(tool),
    byModel: finishBreakdown(model),
    byMachine: finishBreakdown(machine),
    byTask,
  };
}

/** Directory holding the ledger partitions and quota snapshot. */
export function usageDir(): string {
  const base = process.env.VAULT_PATH ?? '/vault';
  return join(base, '_system', 'usage');
}

/** Absolute paths of every `ledger.*.jsonl` partition, sorted for stability. */
export function ledgerPartitionPaths(): string[] {
  let entries: string[];
  try {
    entries = readdirSync(usageDir());
  } catch {
    return []; // usage dir missing → no data yet
  }
  return entries
    .filter((f) => /^ledger\..+\.jsonl$/.test(f))
    .sort()
    .map((f) => join(usageDir(), f));
}

/** Read and union every ledger partition on disk. */
export function readAllRecords(): LedgerRecord[] {
  const records: LedgerRecord[] = [];
  for (const path of ledgerPartitionPaths()) {
    let content: string;
    try {
      content = readFileSync(path, 'utf-8');
    } catch {
      continue; // skip an unreadable partition rather than fail the request
    }
    records.push(...parseLedger(content));
  }
  return records;
}

/** Read all partitions and compute the dashboard aggregates. */
export function readUsage(): UsageAggregates {
  return aggregate(readAllRecords());
}
