// apps/loop-observatory/src/lib/enroll/view.test.ts
import { describe, expect, it } from 'vitest';

import { buildHostViews } from './view.js';
import type { HostRecordMap } from './store.js';

const NOW = 1_787_000_000_000;

const RECORDS: HostRecordMap = {
  'Angibles-MacBook-Air': {
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
      otlpListening: false,
      vaultPath: null,
      accounts: { claudeAvailable: 'ok', ghLogin: 'rainforest-angible' },
      probedAt: '2026-08-27T06:00:00.000Z',
    },
    reportedAt: NOW - 60_000,
  },
};

describe('buildHostViews', () => {
  it('pairs each host with its drift and derived files', () => {
    const views = buildHostViews(RECORDS, NOW);
    const air = views['Angibles-MacBook-Air'];
    expect(air?.drift.map((d) => d.kind)).toContain('role-unsatisfied');
    expect(air?.files.map((f) => f.path)).toContain(
      'Library/LaunchAgents/tools.rainforest.loop-ralph.plist',
    );
  });

  it('surfaces a refusal instead of throwing the page away', () => {
    // One host whose probe did not run must not blank the whole view.
    const broken: HostRecordMap = {
      ...RECORDS,
      bad: {
        ...RECORDS['Angibles-MacBook-Air']!,
        facts: {
          ...RECORDS['Angibles-MacBook-Air']!.facts!,
          tccICloud: 'unknown',
        },
      },
    };
    const views = buildHostViews(broken, NOW);
    expect(views['bad']?.files).toEqual([]);
    expect(views['bad']?.error).toContain('tccICloud');
    expect(views['Angibles-MacBook-Air']?.files.length).toBeGreaterThan(0);
  });

  it('yields no files for a host that has never reported', () => {
    const views = buildHostViews(
      { fresh: { declaration: null, facts: null, reportedAt: null } },
      NOW,
    );
    expect(views['fresh']?.files).toEqual([]);
    expect(views['fresh']?.drift.map((d) => d.kind)).toContain('stale');
  });
});
