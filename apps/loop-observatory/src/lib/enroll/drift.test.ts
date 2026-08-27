import { describe, expect, it } from 'vitest';

import { STALE_AFTER_MS, driftFor } from './drift.js';
import type { HostRecord } from './store.js';

const NOW = 1_787_000_000_000;

const AIR: HostRecord = {
  declaration: {
    host: 'Angibles-MacBook-Air',
    home: '/Users/rainforest',
    roles: ['engine', 'ralph', 'telemetry-sink'],
    scope: 'work',
    otlpBind: '127.0.0.1',
    intervalSeconds: 1800,
  },
  facts: {
    tccICloud: 'denied',
    executors: ['claude'],
    brewPrefix: '/opt/homebrew',
    otlpListening: true,
    vaultPath: null,
    accounts: { claudeAvailable: 'ok', ghLogin: 'rainforest-angible' },
    probedAt: '2026-08-27T06:00:00.000Z',
  },
  reportedAt: NOW - 60_000,
};

describe('driftFor', () => {
  it('reports nothing when declared and actual agree', () => {
    expect(driftFor(AIR, NOW)).toEqual([]);
  });

  it('reports a declared role the machine cannot satisfy', () => {
    // This is the whole product. The Air declared telemetry-sink and had nothing
    // listening on 4318 for its entire life; that single boolean is the reason it
    // never emitted a claude_code metric.
    const d = driftFor(
      { ...AIR, facts: { ...AIR.facts!, otlpListening: false } },
      NOW,
    );
    expect(d.map((x) => x.kind)).toContain('role-unsatisfied');
    expect(d[0]?.detail).toContain('4318');
  });

  it('reports stale rather than showing the last known good state', () => {
    const d = driftFor({ ...AIR, reportedAt: NOW - STALE_AFTER_MS - 1 }, NOW);
    expect(d.map((x) => x.kind)).toContain('stale');
  });

  it('reports a work machine on a personal account', () => {
    const d = driftFor(
      {
        ...AIR,
        facts: {
          ...AIR.facts!,
          accounts: { claudeAvailable: 'ok', ghLogin: 'rainforest-dev' },
        },
      },
      NOW,
    );
    expect(d.map((x) => x.kind)).toContain('account-mismatch');
  });

  it('reports stale for a host that has never reported', () => {
    expect(
      driftFor({ ...AIR, facts: null, reportedAt: null }, NOW).map(
        (x) => x.kind,
      ),
    ).toContain('stale');
  });

  it('reports a declared ralph role with no executors to launch', () => {
    const d = driftFor(
      { ...AIR, facts: { ...AIR.facts!, executors: [] } },
      NOW,
    );
    expect(d.map((x) => x.kind)).toContain('role-unsatisfied');
    expect(d.find((x) => x.kind === 'role-unsatisfied')?.detail).toContain(
      'executors',
    );
  });

  it('does not report empty executors when ralph is not declared', () => {
    const d = driftFor(
      {
        ...AIR,
        declaration: {
          ...AIR.declaration!,
          roles: AIR.declaration!.roles.filter((r) => r !== 'ralph'),
        },
        facts: { ...AIR.facts!, executors: [] },
      },
      NOW,
    );
    expect(d).toEqual([]);
  });
});
