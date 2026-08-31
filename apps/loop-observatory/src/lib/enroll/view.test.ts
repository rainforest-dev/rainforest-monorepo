// apps/loop-observatory/src/lib/enroll/view.test.ts
import { describe, expect, it } from 'vitest';

import type { Declarations } from './declarations.js';
import { FIXTURES } from './fixtures.js';
import type { HostRecordMap } from './store.js';
import { buildHostViews } from './view.js';

const NOW = 1_787_000_000_000;

const RECORDS: HostRecordMap = {
  'rainforest-angible': {
    declaration: {
      host: 'rainforest-angible',
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

const DECLARATIONS: Declarations = {
  byHost: {
    'declared-only': {
      host: 'declared-only',
      home: '/Users/rainforest',
      roles: ['engine', 'ralph'],
      scope: 'personal',
      otlpBind: '127.0.0.1',
      intervalSeconds: 1800,
    },
  },
  problems: {},
  error: null,
};

describe('buildHostViews', () => {
  it('pairs each host with its drift and derived files', () => {
    const views = buildHostViews(RECORDS, NOW);
    const air = views['rainforest-angible'];
    expect(air?.state).toBe('drift');
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
        ...RECORDS['rainforest-angible']!,
        facts: {
          ...RECORDS['rainforest-angible']!.facts!,
          tccICloud: 'unknown',
        },
      },
    };
    const views = buildHostViews(broken, NOW);
    expect(views['bad']?.state).toBe('refused');
    expect(views['bad']?.files).toEqual([]);
    expect(views['bad']?.error).toContain('tccICloud');
    expect(views['rainforest-angible']?.files.length).toBeGreaterThan(0);
  });

  it('does not call a host healthy when nothing declares it', () => {
    // The bug this replaces: no declaration -> driftFor returned [] -> the
    // page printed "matches its declaration" in green, for a host with zero
    // derived files and nothing to match.
    const views = buildHostViews(
      {
        ...RECORDS,
        undeclared: { ...RECORDS['rainforest-angible']!, declaration: null },
      },
      NOW,
      { byHost: {}, problems: {}, error: null },
    );
    expect(views['undeclared']?.state).toBe('not-declared');
    expect(views['undeclared']?.files).toEqual([]);
    expect(views['undeclared']?.drift.map((d) => d.kind)).toContain(
      'not-declared',
    );
    expect(views['undeclared']?.state).not.toBe('ok');
  });

  it('derives files for a host declared only in hosts.yaml', () => {
    // App state carries no declaration for anything today, so without this the
    // declaration source has no reader at all and every host is undeclared.
    const records: HostRecordMap = {
      'declared-only': {
        declaration: null,
        facts: RECORDS['rainforest-angible']!.facts,
        reportedAt: NOW - 60_000,
      },
    };
    const view = buildHostViews(records, NOW, DECLARATIONS)['declared-only'];
    expect(view?.state).not.toBe('not-declared');
    expect(view?.files.map((f) => f.path)).toContain(
      'Library/LaunchAgents/tools.rainforest.loop-ralph.plist',
    );
  });

  it('shows a declared host that has never reported, rather than omitting it', () => {
    // Union of "reported" and "declared". An enrolled machine missing from the
    // page entirely is the same unchecked-writer shape as everything else here.
    const view = buildHostViews({}, NOW, DECLARATIONS)['declared-only'];
    expect(view?.state).toBe('stale');
    expect(view?.files).toEqual([]);
  });

  it('explains WHY a host is undeclared when the source itself failed', () => {
    // "hosts.yaml is unreadable" and "this host is not in hosts.yaml" put every
    // host in the same state, so the state has to carry which one it was.
    const views = buildHostViews(
      { air: { ...RECORDS['rainforest-angible']!, declaration: null } },
      NOW,
      {
        byHost: {},
        problems: {},
        error: 'cannot read /nope/hosts.yaml: ENOENT',
      },
    );
    expect(views['air']?.state).toBe('not-declared');
    expect(views['air']?.detail).toContain('ENOENT');
  });

  it('surfaces a per-host declaration problem instead of "not in the file"', () => {
    const views = buildHostViews(
      { air: { ...RECORDS['rainforest-angible']!, declaration: null } },
      NOW,
      {
        byHost: {},
        problems: { air: 'home is missing or not an absolute path' },
        error: null,
      },
    );
    expect(views['air']?.detail).toContain('home is missing');
  });

  it('yields no files for a host that has never reported', () => {
    const views = buildHostViews(
      { fresh: { declaration: null, facts: null, reportedAt: null } },
      NOW,
    );
    expect(views['fresh']?.files).toEqual([]);
    expect(views['fresh']?.drift.map((d) => d.kind)).toContain('stale');
    // Neither declared nor reported: the missing declaration is the first
    // thing to fix, so that is what the state names.
    expect(views['fresh']?.state).toBe('not-declared');
  });
});

describe('two readings, attributed', () => {
  const DECL = FIXTURES['rainforest-mini']!.decl;
  const FACTS = FIXTURES['rainforest-mini']!.facts;
  const NOW = 1_800_000_000_000;

  it('reports the disagreement instead of choosing a winner', () => {
    // The live state on 2026-08-29: hosts.json a day old, quota.<host>.json
    // written minutes earlier. Overview called the machine fine, Setup called
    // it stale, and no page showed both.
    const views = buildHostViews(
      {
        'rainforest-mini': {
          declaration: DECL,
          facts: FACTS,
          reportedAt: NOW - 23 * 60 * 60 * 1000,
        },
      },
      NOW,
      null,
      {
        'rainforest-mini': { at: NOW - 4 * 60 * 1000, source: 'quota.x.json' },
      },
    );
    const r = views['rainforest-mini']!.readings;
    expect(r.enrollment?.source).toBe('hosts.json');
    expect(r.telemetry?.source).toBe('quota.x.json');
    // Both ages survive; neither is dropped in favour of the other.
    expect(r.enrollment!.ageMs).toBeGreaterThan(r.telemetry!.ageMs);
    expect(r.conflict).toMatch(/disagree/);
    expect(r.conflict).toMatch(/unverified rather than wrong/);
  });

  it('stays silent when both readings agree', () => {
    // A conflict banner that fires when nothing is wrong trains the reader to
    // ignore it, which is how the next real one gets missed.
    const views = buildHostViews(
      {
        'rainforest-mini': {
          declaration: DECL,
          facts: FACTS,
          reportedAt: NOW - 60 * 1000,
        },
      },
      NOW,
      null,
      { 'rainforest-mini': { at: NOW - 60 * 1000, source: 'quota.x.json' } },
    );
    expect(views['rainforest-mini']!.readings.conflict).toBeNull();
  });

  it('does not claim a conflict when telemetry is stale too', () => {
    // Both silent is a dead machine, not a contradiction.
    const views = buildHostViews(
      {
        'rainforest-mini': {
          declaration: DECL,
          facts: FACTS,
          reportedAt: NOW - 23 * 60 * 60 * 1000,
        },
      },
      NOW,
      null,
      {
        'rainforest-mini': {
          at: NOW - 20 * 60 * 60 * 1000,
          source: 'quota.x.json',
        },
      },
    );
    expect(views['rainforest-mini']!.readings.conflict).toBeNull();
  });

  it('never prints a raw millisecond count', () => {
    // The live Setup page read "stale: last reported 77955536ms ago".
    const views = buildHostViews(
      {
        h: { declaration: DECL, facts: FACTS, reportedAt: NOW - 77_955_536 },
      },
      NOW,
      null,
      null,
    );
    const stale = views['h']!.drift.find((d) => d.kind === 'stale')!;
    expect(stale.detail).not.toMatch(/\d{6,}ms/);
    expect(stale.detail).toMatch(/21 h 39 min/);
  });
});
