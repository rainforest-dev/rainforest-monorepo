import { describe, expect, it } from 'vitest';

import {
  disagreement,
  HALT_AT_PCT,
  HALT_MARKER_LABEL,
  type HostReadings,
  isFiveHourWindow,
  isWindowUnknown,
  readingPills,
  remainingPct,
  remainingStatus,
  unknownNote,
} from './machineReadings.js';

const MIN = 60_000;
const HOUR = 60 * MIN;

describe('quota read as what is left', () => {
  it('turns consumption into headroom', () => {
    expect(remainingPct(94)).toBe(6);
    expect(remainingPct(0)).toBe(100);
  });

  it('clamps readings outside 0–100 rather than drawing past the track', () => {
    expect(remainingPct(120)).toBe(0);
    expect(remainingPct(-5)).toBe(100);
    expect(remainingPct(Number.NaN)).toBe(0);
  });

  it('scores low as bad, because the number is what remains', () => {
    expect(remainingStatus(60)).toBe('ok');
    expect(remainingStatus(26)).toBe('ok');
    expect(remainingStatus(25)).toBe('warn');
    expect(remainingStatus(11)).toBe('warn');
    expect(remainingStatus(10)).toBe('bad');
    expect(remainingStatus(0)).toBe('bad');
  });

  it('marks the window the halt threshold is defined against', () => {
    expect(isFiveHourWindow('5-hour')).toBe(true);
    expect(isFiveHourWindow('5-Hour · Opus')).toBe(true);
    expect(isFiveHourWindow('Weekly · all models')).toBe(false);
  });

  it('names the halt threshold in the label so it needs no recall', () => {
    expect(HALT_AT_PCT).toBe(10);
    expect(HALT_MARKER_LABEL).toBe('loop halts at 10% left');
  });
});

describe('a window nobody has a figure for', () => {
  const now = Date.UTC(2026, 8, 2, 12, 0, 0);

  it('is unknown once its reset has passed, and while it has none', () => {
    expect(isWindowUnknown(now / 1000 + 3600, now)).toBe(false);
    expect(isWindowUnknown(now / 1000 - 60, now)).toBe(true);
    expect(isWindowUnknown(null, now)).toBe(true);
  });

  it('says unknown rather than letting an empty bar read as zero', () => {
    expect(unknownNote({ resets_at: (now - 3 * HOUR) / 1000 }, now)).toBe(
      'no figure since 3 h ago — unknown, not zero',
    );
    expect(unknownNote({ resets_at: null }, now)).toBe(
      'no figure reported — unknown, not zero',
    );
  });
});

describe('two readings, each named by its own source', () => {
  it('labels both, and marks the enrollment report expired past its window', () => {
    const pills = readingPills({
      telemetry: { ageMs: 4 * MIN, source: 'quota.rainforest-mini.json' },
      enrollment: { ageMs: 21 * HOUR + 39 * MIN, source: 'hosts.json' },
      conflict: null,
    });
    expect(pills.map((p) => p.text)).toEqual([
      'quota snapshot · 4 min old',
      'enrollment report · 21 h 39 min old · expired',
    ]);
    expect(pills.map((p) => p.source)).toEqual([
      'quota.rainforest-mini.json',
      'hosts.json',
    ]);
  });

  it('does not call a fresh enrollment report expired', () => {
    const [pill] = readingPills({
      telemetry: null,
      enrollment: { ageMs: 5 * MIN, source: 'hosts.json' },
      conflict: null,
    });
    expect(pill!.expired).toBe(false);
    expect(pill!.text).toBe('enrollment report · 5 min old');
  });

  it('shows one pill for one reading rather than relabelling the other', () => {
    const pills = readingPills({
      telemetry: { ageMs: 2 * MIN, source: 'quota.rainforest-air.json' },
      enrollment: null,
      conflict: null,
    });
    expect(pills).toHaveLength(1);
    expect(pills[0]!.kind).toBe('telemetry');
  });

  it('has nothing to show when the host has no readings block', () => {
    expect(readingPills(null)).toEqual([]);
  });
});

describe('stating a disagreement without settling it', () => {
  const conflicting: HostReadings = {
    telemetry: { ageMs: 4 * MIN, source: 'quota.rainforest-mini.json' },
    enrollment: { ageMs: 21 * HOUR, source: 'hosts.json' },
    conflict: 'these two disagree: nothing re-sends the enrollment report.',
  };

  it('is silent unless the server found the two in conflict', () => {
    expect(disagreement({ ...conflicting, conflict: null })).toBeNull();
    expect(disagreement(null)).toBeNull();
  });

  it('gives each source its own sentence and keeps the server’s reasoning', () => {
    const d = disagreement(conflicting)!;
    expect(d.snapshotSays).toBe(
      'running — quota.rainforest-mini.json written 4 min ago',
    );
    expect(d.enrollmentSays).toBe('unverified — hosts.json is 21 h old');
    expect(d.why).toBe(conflicting.conflict);
  });

  it('reports a never-enrolled host as such instead of inferring one', () => {
    const d = disagreement({ ...conflicting, enrollment: null })!;
    expect(d.enrollmentSays).toBe(
      'unverified — this machine has never enrolled',
    );
  });

  it('offers no verdict field for a caller to render as the answer', () => {
    expect(Object.keys(disagreement(conflicting)!).sort()).toEqual([
      'enrollmentSays',
      'snapshotSays',
      'why',
    ]);
  });
});
