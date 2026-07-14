import { describe, expect, it } from 'vitest';

import {
  combinedBudget,
  parseMachineBudget,
  providerStale,
  sourceLagMinutes,
  type MachineBudgetMap,
} from './budget.js';

// A fixed "now" so stale_minutes is deterministic. FRESH.written_at below is
// ~120s (2 min) before this; STALE.written_at is ~3120s (52 min) before.
const NOW_MS = 1_784_000_441_000; // Unix ms

// Mirrors the real Angibles-MacBook-Air snapshot (plan team; claude 5h + weekly-all,
// no by-model; codex weekly present, 5-hour absent; agy null). The Claude
// `source_ts` deliberately lags `written_at` by ~24h — the "looks fresh but is
// 24h old" case that must surface a per-provider stale tag.
const FRESH = JSON.stringify({
  claude: {
    plan: 'team',
    source_ts: 1783914161.719549, // ~24h before written_at
    five_hour: { used_pct: 35.4, resets_at: 1752000000 },
    weekly_all: { used_pct: 61.2, resets_at: 1752000000 },
    weekly_by_model: null,
  },
  codex: {
    plan: 'team',
    source_ts: 1784000201.719549, // ~2 min before written_at → fresh
    weekly: { used_pct: 2.0, resets_at: 1784509271 },
    five_hour: null,
  },
  agy: null,
  machine: 'Angibles-MacBook-Air',
  written_at: 1784000321.719549,
});

// Synthetic snapshot exercising every non-Air path in one file: plan pro; claude
// 5h + weekly-all + weekly by-model (fable); codex weekly + 5-hour; and an agy
// estimated block (cost + activity, no quota).
const STALE = JSON.stringify({
  machine: 'mac-mini',
  written_at: 1783997321.719549,
  claude: {
    plan: 'pro',
    source_ts: 1783997021.719549, // 5 min before written_at → fresh
    five_hour: { used_pct: 89.0, resets_at: 1784006090 },
    weekly_all: { used_pct: 49.0, resets_at: 1784261810 },
    weekly_by_model: { fable: { used_pct: 0.0, resets_at: 1784261810 } },
  },
  codex: {
    plan: 'pro',
    source_ts: 1783997021.719549,
    weekly: { used_pct: 33.0, resets_at: 1784434610 },
    five_hour: { used_pct: 62.0, resets_at: 1784009810 },
  },
  agy: {
    estimated: true,
    source_ts: 1783997321.719549,
    cost_est_usd: 18.4,
    activity: { prompts_7d: 214, sessions_7d: 19 },
    quota: null,
  },
});

describe('parseMachineBudget', () => {
  it('parses the nested Claude/Codex shape with plan, buckets and stale_minutes', () => {
    const mb = parseMachineBudget(FRESH, 'from-file', NOW_MS);
    expect(mb).not.toBeNull();
    expect(mb!.machine).toBe('Angibles-MacBook-Air');

    expect(mb!.claude!.plan).toBe('team');
    expect(mb!.claude!.five_hour).toEqual({ used_pct: 35.4, resets_at: 1752000000 });
    expect(mb!.claude!.weekly_all).toEqual({ used_pct: 61.2, resets_at: 1752000000 });
    expect(mb!.claude!.weekly_by_model).toBeNull();

    expect(mb!.codex!.plan).toBe('team');
    expect(mb!.codex!.weekly).toEqual({ used_pct: 2, resets_at: 1784509271 });
    expect(mb!.codex!.five_hour).toBeNull();

    expect(mb!.written_at).toBe(1784000321.719549);
    // (1784000441 - 1784000321.72) / 60 ≈ 1.99 min
    expect(mb!.stale_minutes).toBeCloseTo(2, 0);
  });

  it('exposes per-provider source_ts and a null agy block', () => {
    const mb = parseMachineBudget(FRESH, 'a', NOW_MS)!;
    expect(mb.claude!.source_ts).toBe(1783914161.719549);
    expect(mb.codex!.source_ts).toBe(1784000201.719549);
    expect(mb.agy).toBeNull();
  });

  it('parses the agy estimated block (cost + activity, quota null, no bars)', () => {
    const mb = parseMachineBudget(STALE, 'b', NOW_MS)!;
    expect(mb.agy).toEqual({
      estimated: true,
      source_ts: 1783997321.719549,
      cost_est_usd: 18.4,
      activity: { prompts_7d: 214, sessions_7d: 19 },
      quota: null,
    });
    // agy has no `bars` field at all — it never renders a quota bar.
    expect((mb.agy as unknown as { bars?: unknown }).bars).toBeUndefined();
  });

  it('degrades an agy block with neither cost nor activity to null', () => {
    const mb = parseMachineBudget(
      JSON.stringify({ machine: 'm', written_at: 100, agy: { estimated: true } }),
      'm',
      NOW_MS,
    )!;
    expect(mb.agy).toBeNull();
  });

  it('builds Claude bars in order: 5-hour, Weekly · all models', () => {
    const mb = parseMachineBudget(FRESH, 'a', NOW_MS)!;
    expect(mb.claude!.bars).toEqual([
      { label: '5-hour', used_pct: 35.4, resets_at: 1752000000 },
      { label: 'Weekly · all models', used_pct: 61.2, resets_at: 1752000000 },
    ]);
  });

  it('builds a single Codex bar (Weekly) when 5-hour is absent', () => {
    const mb = parseMachineBudget(FRESH, 'a', NOW_MS)!;
    expect(mb.codex!.bars).toEqual([
      { label: 'Weekly', used_pct: 2, resets_at: 1784509271 },
    ]);
  });

  it('appends a title-cased Weekly · <model> bar for each weekly_by_model key', () => {
    const mb = parseMachineBudget(STALE, 'b', NOW_MS)!;
    expect(mb.claude!.plan).toBe('pro');
    expect(mb.claude!.bars).toEqual([
      { label: '5-hour', used_pct: 89, resets_at: 1784006090 },
      { label: 'Weekly · all models', used_pct: 49, resets_at: 1784261810 },
      { label: 'Weekly · Fable', used_pct: 0, resets_at: 1784261810 },
    ]);
  });

  it('builds Codex bars in order: Weekly then 5-hour', () => {
    const mb = parseMachineBudget(STALE, 'b', NOW_MS)!;
    expect(mb.codex!.bars).toEqual([
      { label: 'Weekly', used_pct: 33, resets_at: 1784434610 },
      { label: '5-hour', used_pct: 62, resets_at: 1784009810 },
    ]);
  });

  it('computes a large stale_minutes for an old snapshot', () => {
    const mb = parseMachineBudget(STALE, 'from-file', NOW_MS);
    expect(mb!.stale_minutes).toBeCloseTo(52.0, 0);
  });

  it('falls back to the filename-derived machine when JSON omits it', () => {
    const mb = parseMachineBudget(
      JSON.stringify({ claude: null, codex: null, written_at: 1 }),
      'mac-mini',
      NOW_MS,
    );
    expect(mb!.machine).toBe('mac-mini');
    expect(mb!.claude).toBeNull();
    expect(mb!.codex).toBeNull();
  });

  it('carries a null resets_at through the bucket', () => {
    const mb = parseMachineBudget(
      JSON.stringify({
        machine: 'm',
        written_at: 100,
        claude: { plan: 'pro', five_hour: { used_pct: 12.5 }, weekly_all: null, weekly_by_model: null },
      }),
      'm',
      NOW_MS,
    );
    expect(mb!.claude!.five_hour).toEqual({ used_pct: 12.5, resets_at: null });
    expect(mb!.claude!.bars).toEqual([
      { label: '5-hour', used_pct: 12.5, resets_at: null },
    ]);
  });

  it('degrades a malformed provider to null without failing the snapshot', () => {
    const mb = parseMachineBudget(
      JSON.stringify({
        claude: { five_hour: { used_pct: 'oops' }, weekly_all: null, weekly_by_model: null },
        codex: { weekly: { used_pct: 5 } },
        machine: 'm',
        written_at: 100,
      }),
      'm',
      NOW_MS,
    );
    expect(mb!.claude).toBeNull();
    expect(mb!.codex!.weekly).toEqual({ used_pct: 5, resets_at: null });
    expect(mb!.codex!.bars).toEqual([{ label: 'Weekly', used_pct: 5, resets_at: null }]);
  });

  it('returns null written_at / stale_minutes when written_at is absent', () => {
    const mb = parseMachineBudget(
      JSON.stringify({ machine: 'm', claude: null }),
      'm',
      NOW_MS,
    );
    expect(mb!.written_at).toBeNull();
    expect(mb!.stale_minutes).toBeNull();
  });

  it('returns null for non-object content', () => {
    expect(parseMachineBudget('not json', 'm', NOW_MS)).toBeNull();
    expect(parseMachineBudget('[1,2]', 'm', NOW_MS)).toBeNull();
  });
});

describe('sourceLagMinutes / providerStale', () => {
  it('measures how far the provider source lags the snapshot', () => {
    const mb = parseMachineBudget(FRESH, 'a', NOW_MS)!;
    // Claude source is ~24h behind written_at (86160s / 60 = 1436 min).
    expect(sourceLagMinutes(mb.written_at, mb.claude!.source_ts)).toBeCloseTo(1436, 0);
    // Codex source is ~2 min behind written_at.
    expect(sourceLagMinutes(mb.written_at, mb.codex!.source_ts)).toBeCloseTo(2, 0);
  });

  it('flags a provider stale only when its source lags written_at by > 10 min', () => {
    const air = parseMachineBudget(FRESH, 'a', NOW_MS)!;
    expect(providerStale(air.written_at, air.claude!.source_ts)).toBe(true); // 24h old
    expect(providerStale(air.written_at, air.codex!.source_ts)).toBe(false); // 2 min

    const mini = parseMachineBudget(STALE, 'b', NOW_MS)!;
    expect(providerStale(mini.written_at, mini.claude!.source_ts)).toBe(false); // 5 min
  });

  it('is null / not-stale when a timestamp is missing', () => {
    expect(sourceLagMinutes(null, 100)).toBeNull();
    expect(sourceLagMinutes(100, null)).toBeNull();
    expect(providerStale(null, 100)).toBe(false);
    expect(providerStale(100, undefined)).toBe(false);
  });
});

describe('combinedBudget', () => {
  it('picks the freshest (lowest stale_minutes) machine snapshot', () => {
    const map: MachineBudgetMap = {
      'Angibles-MacBook-Air': parseMachineBudget(FRESH, 'a', NOW_MS)!,
      'mac-mini': parseMachineBudget(STALE, 'b', NOW_MS)!,
    };
    const combined = combinedBudget(map);
    expect(combined!.claude!.five_hour!.used_pct).toBe(35.4);
    expect(combined!.codex!.weekly!.used_pct).toBe(2);
  });

  it('returns null for an empty map', () => {
    expect(combinedBudget({})).toBeNull();
  });
});
