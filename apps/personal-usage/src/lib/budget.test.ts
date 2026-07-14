import { describe, expect, it } from 'vitest';

import { combinedBudget, parseMachineBudget, type MachineBudgetMap } from './budget.js';

// A fixed "now" so stale_minutes is deterministic. written_at below is 120s
// (2 min) before this, and the stale sample is 3120s (52 min) before.
const NOW_MS = 1_784_000_441_000; // Unix ms

const FRESH = JSON.stringify({
  claude: { five_hour_pct: 35.4, seven_day_pct: 61.2, ts: 1783922041.543706 },
  codex: { used_pct: 2.0, resets_at: 1784509271 },
  machine: 'Angibles-MacBook-Air',
  written_at: 1784000321.719549,
});

const STALE = JSON.stringify({
  claude: { five_hour_pct: 8.0, seven_day_pct: 22.5, ts: 1783997321.719549 },
  codex: { used_pct: 41.0, resets_at: 1784007521 },
  machine: 'mac-mini',
  written_at: 1783997321.719549,
});

describe('parseMachineBudget', () => {
  it('parses a full snapshot with providers and stale_minutes', () => {
    const mb = parseMachineBudget(FRESH, 'from-file', NOW_MS);
    expect(mb).not.toBeNull();
    expect(mb!.machine).toBe('Angibles-MacBook-Air');
    expect(mb!.claude).toEqual({
      five_hour_pct: 35.4,
      seven_day_pct: 61.2,
      ts: 1783922041.543706,
    });
    expect(mb!.codex).toEqual({ used_pct: 2, resets_at: 1784509271 });
    expect(mb!.written_at).toBe(1784000321.719549);
    // (1784000441 - 1784000321.72) / 60 ≈ 1.99 min
    expect(mb!.stale_minutes).toBeCloseTo(2, 0);
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
  });

  it('degrades a malformed provider to null without failing the snapshot', () => {
    const mb = parseMachineBudget(
      JSON.stringify({
        claude: { five_hour_pct: 'oops' },
        codex: { used_pct: 5 },
        machine: 'm',
        written_at: 100,
      }),
      'm',
      NOW_MS,
    );
    expect(mb!.claude).toBeNull();
    expect(mb!.codex).toEqual({ used_pct: 5, resets_at: 0 });
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

describe('combinedBudget', () => {
  it('picks the freshest (lowest stale_minutes) machine snapshot', () => {
    const map: MachineBudgetMap = {
      'Angibles-MacBook-Air': parseMachineBudget(FRESH, 'a', NOW_MS)!,
      'mac-mini': parseMachineBudget(STALE, 'b', NOW_MS)!,
    };
    const combined = combinedBudget(map);
    expect(combined!.claude!.five_hour_pct).toBe(35.4);
    expect(combined!.codex!.used_pct).toBe(2);
  });

  it('returns null for an empty map', () => {
    expect(combinedBudget({})).toBeNull();
  });
});
