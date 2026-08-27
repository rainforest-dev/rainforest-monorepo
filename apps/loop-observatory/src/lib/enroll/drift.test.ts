import { describe, expect, it } from 'vitest';

import { driftFor, STALE_AFTER_MS } from './drift.js';
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

  it('reports a host with facts and no declaration, rather than nothing', () => {
    // Returning [] here made the setup page print "matches its declaration" in
    // green for a host that had no declaration to match.
    const d = driftFor({ ...AIR, declaration: null }, NOW);
    expect(d.map((x) => x.kind)).toEqual(['not-declared']);
    expect(d[0]?.detail).toContain('hosts.yaml');
  });

  it('distinguishes "gh reported no login" from "gh reported the wrong one"', () => {
    // Two opposite bugs, one condition. A logged-out machine reported the
    // literal word "unknown" and came out as an account MISMATCH; a genuinely
    // null login came out silent. Neither is right and they are not the same.
    const unverified = driftFor(
      {
        ...AIR,
        facts: {
          ...AIR.facts!,
          accounts: { claudeAvailable: 'ok', ghLogin: null },
        },
      },
      NOW,
    );
    expect(unverified.map((x) => x.kind)).toEqual(['account-unverified']);
    expect(unverified[0]?.detail).toContain('no login');

    const mismatch = driftFor(
      {
        ...AIR,
        facts: {
          ...AIR.facts!,
          accounts: { claudeAvailable: 'ok', ghLogin: 'rainforest-dev' },
        },
      },
      NOW,
    );
    expect(mismatch.map((x) => x.kind)).toEqual(['account-mismatch']);
  });

  it('says nothing about accounts on a personal machine', () => {
    // Only `work` carries an account expectation, so only `work` can fail one.
    // A personal host with no gh login is not a finding.
    const d = driftFor(
      {
        ...AIR,
        declaration: { ...AIR.declaration!, scope: 'personal' },
        facts: {
          ...AIR.facts!,
          accounts: { claudeAvailable: 'ok', ghLogin: null },
        },
      },
      NOW,
    );
    expect(d).toEqual([]);
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
