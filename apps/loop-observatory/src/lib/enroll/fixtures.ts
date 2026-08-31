// apps/loop-observatory/src/lib/enroll/fixtures.ts
//
// The two live hosts, as the unit tests and the migration reproduction gate
// (reproduces-hosts.test.ts) both need them. One definition, so a fixture that
// drifts from reality fails in both places rather than only in whichever one
// someone remembered to update.
import type { HostDeclaration, HostFacts } from './types.js';

export const FIXTURES: Record<
  string,
  { decl: HostDeclaration; facts: HostFacts }
> = {
  'rainforest-mini': {
    decl: {
      host: 'rainforest-mini',
      home: '/Users/rainforest',
      roles: ['engine', 'ralph', 'loop-sync', 'usage-hourly'],
      scope: 'personal',
      otlpBind: '0.0.0.0',
      intervalSeconds: 1800,
    },
    facts: {
      tccICloud: 'permitted',
      executors: ['claude', 'agy'],
      brewPrefix: '/opt/homebrew',
      otlpListening: true,
      vaultPath:
        '/Users/rainforest/Library/Mobile Documents/iCloud~md~obsidian/Documents/rainforest-obsidian',
      accounts: { claudeAvailable: 'ok', ghLogin: 'rainforest-dev' },
      probedAt: '2026-08-27T06:00:00.000Z',
    },
  },
  'rainforest-angible': {
    decl: {
      host: 'rainforest-angible',
      home: '/Users/rainforest',
      roles: [
        'engine',
        'ralph',
        'relay-pull',
        'usage-hourly',
        'usage-publish',
        'telemetry-sink',
      ],
      scope: 'work',
      otlpBind: '127.0.0.1',
      intervalSeconds: 1800,
    },
    facts: {
      tccICloud: 'permitted',
      executors: ['claude', 'codex'],
      brewPrefix: '/opt/homebrew',
      otlpListening: true,
      vaultPath: null,
      accounts: { claudeAvailable: 'ok', ghLogin: 'rainforest-angible' },
      probedAt: '2026-08-27T06:00:00.000Z',
    },
  },
};
