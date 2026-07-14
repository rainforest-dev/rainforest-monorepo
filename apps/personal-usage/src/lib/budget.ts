import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { usageDir } from './ledger.js';

export interface ClaudeBudget {
  /** Percent of the rolling 5-hour window consumed. */
  five_hour_pct: number;
  /** Percent of the rolling 7-day window consumed. */
  seven_day_pct: number;
  /** Snapshot time — Unix seconds (may be fractional). */
  ts: number;
}

export interface CodexBudget {
  used_pct: number;
  /** When the Codex quota window resets — Unix seconds. */
  resets_at: number;
}

/** Back-compat combined shape (one provider snapshot, machine-agnostic). */
export interface Budget {
  claude: ClaudeBudget | null;
  codex: CodexBudget | null;
}

/** One machine's quota snapshot, read from `quota.<machine>.json`. */
export interface MachineBudget {
  machine: string;
  claude: ClaudeBudget | null;
  codex: CodexBudget | null;
  /** When this snapshot was written — Unix seconds (may be fractional). */
  written_at: number | null;
  /** Age of the snapshot in minutes: `(now - written_at) / 60`. `null` when unknown. */
  stale_minutes: number | null;
}

/** Per-machine map keyed by machine name. */
export type MachineBudgetMap = Record<string, MachineBudget>;

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function parseClaude(o: Record<string, unknown>): ClaudeBudget | null {
  if (!o.claude || typeof o.claude !== 'object') return null;
  const c = o.claude as Record<string, unknown>;
  const five = num(c.five_hour_pct);
  const seven = num(c.seven_day_pct);
  if (five === null || seven === null) return null;
  return { five_hour_pct: five, seven_day_pct: seven, ts: num(c.ts) ?? 0 };
}

function parseCodex(o: Record<string, unknown>): CodexBudget | null {
  if (!o.codex || typeof o.codex !== 'object') return null;
  const x = o.codex as Record<string, unknown>;
  const used = num(x.used_pct);
  if (used === null) return null;
  return { used_pct: used, resets_at: num(x.resets_at) ?? 0 };
}

/**
 * Parse one machine's quota snapshot. `machineFromFile` is the name derived from
 * the `quota.<machine>.json` filename — used only when the JSON omits `machine`.
 * `nowMs` (Unix ms) drives the `stale_minutes` computation. Returns `null` when
 * the content is not a JSON object; a malformed provider sub-object degrades to
 * `null` for that provider rather than failing the whole snapshot.
 */
export function parseMachineBudget(
  content: string,
  machineFromFile: string,
  nowMs: number,
): MachineBudget | null {
  let obj: unknown;
  try {
    obj = JSON.parse(content);
  } catch {
    return null;
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
  const o = obj as Record<string, unknown>;

  const written_at = num(o.written_at);
  const stale_minutes =
    written_at !== null ? round(nowMs / 1000 / 60 - written_at / 60) : null;

  return {
    machine: str(o.machine) ?? machineFromFile,
    claude: parseClaude(o),
    codex: parseCodex(o),
    written_at,
    stale_minutes,
  };
}

/** Absolute paths + derived machine name of every `quota.*.json` file, sorted. */
export function quotaPartitionPaths(): { path: string; machine: string }[] {
  let entries: string[];
  try {
    entries = readdirSync(usageDir());
  } catch {
    return []; // usage dir missing → no data yet
  }
  const out: { path: string; machine: string }[] = [];
  for (const f of entries.sort()) {
    const m = /^quota\.(.+)\.json$/.exec(f);
    if (!m) continue;
    out.push({ path: join(usageDir(), f), machine: m[1] });
  }
  return out;
}

/**
 * Read every `quota.<machine>.json` snapshot into a per-machine map. Missing
 * dir or unreadable/malformed files are skipped rather than failing the request.
 */
export function readMachineBudgets(nowMs: number = Date.now()): MachineBudgetMap {
  const map: MachineBudgetMap = {};
  for (const { path, machine } of quotaPartitionPaths()) {
    let content: string;
    try {
      content = readFileSync(path, 'utf-8');
    } catch {
      continue;
    }
    const mb = parseMachineBudget(content, machine, nowMs);
    if (mb) map[mb.machine] = mb;
  }
  return map;
}

/**
 * Back-compat combined snapshot: the freshest (lowest `stale_minutes`) machine's
 * providers, machine-agnostic. Returns `null` when no snapshot exists.
 */
export function combinedBudget(map: MachineBudgetMap): Budget | null {
  const machines = Object.values(map);
  if (machines.length === 0) return null;
  const freshest = machines.reduce((best, m) =>
    (m.stale_minutes ?? Infinity) < (best.stale_minutes ?? Infinity) ? m : best,
  );
  return { claude: freshest.claude, codex: freshest.codex };
}
