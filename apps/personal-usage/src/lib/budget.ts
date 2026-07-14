import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { usageDir } from './ledger.js';

/**
 * One quota window as it appears in the real provider `/usage` layouts:
 * a used-percentage plus the epoch (seconds) at which the window resets.
 * `resets_at` is `null` when the provider does not report a reset time.
 */
export interface Bucket {
  used_pct: number;
  resets_at: number | null;
}

/** A single horizontal progress bar rendered in the machine card. */
export interface QuotaBar {
  /** Left-hand label, e.g. "5-hour", "Weekly · all models", "Weekly · Fable". */
  label: string;
  used_pct: number;
  resets_at: number | null;
}

/** Claude side of a machine snapshot (mirrors Claude's `/usage` screen). */
export interface MachineClaude {
  /** Subscription plan, e.g. "team" | "pro"; `null` when unknown. */
  plan: string | null;
  /**
   * When the provider quota itself was captured — Unix seconds. This can lag
   * far behind the machine's `written_at` (the heartbeat may re-emit an old
   * reading), so it drives the per-provider "stale" tag. `null` when unknown.
   */
  source_ts: number | null;
  /** Rolling 5-hour window. */
  five_hour: Bucket | null;
  /** Weekly window across all models. */
  weekly_all: Bucket | null;
  /** Per-model weekly windows keyed by model id (e.g. `fable`). */
  weekly_by_model: Record<string, Bucket> | null;
  /** Progress bars in display order (5-hour, Weekly · all, Weekly · <model>…). */
  bars: QuotaBar[];
}

/** Codex side of a machine snapshot (mirrors Codex's `/usage` screen). */
export interface MachineCodex {
  plan: string | null;
  /** When the provider quota was captured — Unix seconds; drives the "stale" tag. */
  source_ts: number | null;
  /** Weekly window. */
  weekly: Bucket | null;
  /** Rolling 5-hour window (not always present). */
  five_hour: Bucket | null;
  /** Progress bars in display order (Weekly, then 5-hour when present). */
  bars: QuotaBar[];
}

/** agy's rough 7-day activity signal (no real quota is reported). */
export interface AgyActivity {
  prompts_7d: number;
  sessions_7d: number;
}

/**
 * agy side of a machine snapshot. agy exposes no provider quota, only an
 * *estimated* cost plus coarse activity — so it renders as an "est." block,
 * never a quota bar.
 */
export interface MachineAgy {
  /** Always `true` — the values are estimates, not billed/quota figures. */
  estimated: boolean;
  /** When the estimate was computed — Unix seconds; drives the "stale" tag. */
  source_ts: number | null;
  /** Estimated API-equivalent spend, USD. `null` when unknown. */
  cost_est_usd: number | null;
  /** Coarse 7-day activity, or `null`. */
  activity: AgyActivity | null;
  /** agy never reports quota windows. */
  quota: null;
}

/** One machine's quota snapshot, read from `quota.<machine>.json`. */
export interface MachineBudget {
  machine: string;
  claude: MachineClaude | null;
  codex: MachineCodex | null;
  agy: MachineAgy | null;
  /** When this snapshot was written — Unix seconds (may be fractional). */
  written_at: number | null;
  /** Age of the snapshot in minutes: `(now - written_at) / 60`. `null` when unknown. */
  stale_minutes: number | null;
}

/** Minutes below which a provider whose window is `stale`. */
export const PROVIDER_STALE_MIN = 10;

/**
 * How far a provider's captured `source_ts` lags behind the machine snapshot's
 * `written_at`, in minutes: `(written_at - source_ts) / 60`. A large positive
 * value means the snapshot "looks fresh" (recent `written_at`) but the provider
 * reading inside it is old — the bug the per-provider "stale" tag surfaces.
 * `null` when either timestamp is unknown.
 */
export function sourceLagMinutes(
  written_at: number | null,
  source_ts: number | null | undefined,
): number | null {
  if (written_at === null || source_ts === null || source_ts === undefined) {
    return null;
  }
  return round((written_at - source_ts) / 60);
}

/** Whether a provider window is stale (its source lags `written_at` by > 10 min). */
export function providerStale(
  written_at: number | null,
  source_ts: number | null | undefined,
): boolean {
  const lag = sourceLagMinutes(written_at, source_ts);
  return lag !== null && lag > PROVIDER_STALE_MIN;
}

/** Per-machine map keyed by machine name. */
export type MachineBudgetMap = Record<string, MachineBudget>;

/** Back-compat combined shape (freshest machine's providers, machine-agnostic). */
export interface Budget {
  claude: MachineClaude | null;
  codex: MachineCodex | null;
}

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

/** Title-case a model id for display: `fable` → `Fable`. */
function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/** Parse a `{ used_pct, resets_at }` bucket; `null` when unusable. */
function parseBucket(v: unknown): Bucket | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const used = num(o.used_pct);
  if (used === null) return null;
  return { used_pct: used, resets_at: num(o.resets_at) };
}

function bar(label: string, b: Bucket): QuotaBar {
  return { label, used_pct: b.used_pct, resets_at: b.resets_at };
}

function parseClaude(o: Record<string, unknown>): MachineClaude | null {
  if (!o.claude || typeof o.claude !== 'object' || Array.isArray(o.claude)) return null;
  const c = o.claude as Record<string, unknown>;

  const five_hour = parseBucket(c.five_hour);
  const weekly_all = parseBucket(c.weekly_all);

  let weekly_by_model: Record<string, Bucket> | null = null;
  if (c.weekly_by_model && typeof c.weekly_by_model === 'object' && !Array.isArray(c.weekly_by_model)) {
    const wbm: Record<string, Bucket> = {};
    for (const [model, val] of Object.entries(c.weekly_by_model as Record<string, unknown>)) {
      const b = parseBucket(val);
      if (b) wbm[model] = b;
    }
    if (Object.keys(wbm).length > 0) weekly_by_model = wbm;
  }

  const plan = str(c.plan);
  // Entirely empty / malformed provider degrades to null.
  if (!plan && !five_hour && !weekly_all && !weekly_by_model) return null;

  // Bars in the real `/usage` order.
  const bars: QuotaBar[] = [];
  if (five_hour) bars.push(bar('5-hour', five_hour));
  if (weekly_all) bars.push(bar('Weekly · all models', weekly_all));
  if (weekly_by_model) {
    for (const [model, b] of Object.entries(weekly_by_model)) {
      bars.push(bar(`Weekly · ${titleCase(model)}`, b));
    }
  }

  return { plan, source_ts: num(c.source_ts), five_hour, weekly_all, weekly_by_model, bars };
}

function parseCodex(o: Record<string, unknown>): MachineCodex | null {
  if (!o.codex || typeof o.codex !== 'object' || Array.isArray(o.codex)) return null;
  const x = o.codex as Record<string, unknown>;

  const weekly = parseBucket(x.weekly);
  const five_hour = parseBucket(x.five_hour);
  const plan = str(x.plan);
  if (!plan && !weekly && !five_hour) return null;

  const bars: QuotaBar[] = [];
  if (weekly) bars.push(bar('Weekly', weekly));
  if (five_hour) bars.push(bar('5-hour', five_hour));

  return { plan, source_ts: num(x.source_ts), weekly, five_hour, bars };
}

/** Parse agy's `{ prompts_7d, sessions_7d }` activity block; `null` when unusable. */
function parseAgyActivity(v: unknown): AgyActivity | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const prompts = num(o.prompts_7d);
  const sessions = num(o.sessions_7d);
  if (prompts === null && sessions === null) return null;
  return { prompts_7d: prompts ?? 0, sessions_7d: sessions ?? 0 };
}

/**
 * Parse the `agy` block: an estimated cost + coarse activity, `quota: null`.
 * Degrades to `null` when neither a cost estimate nor activity is present.
 */
function parseAgy(o: Record<string, unknown>): MachineAgy | null {
  if (!o.agy || typeof o.agy !== 'object' || Array.isArray(o.agy)) return null;
  const a = o.agy as Record<string, unknown>;
  const cost_est_usd = num(a.cost_est_usd);
  const activity = parseAgyActivity(a.activity);
  if (cost_est_usd === null && !activity) return null;
  return {
    estimated: a.estimated === true,
    source_ts: num(a.source_ts),
    cost_est_usd,
    activity,
    quota: null,
  };
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
    agy: parseAgy(o),
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
