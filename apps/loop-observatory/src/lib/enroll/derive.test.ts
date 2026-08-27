// apps/loop-observatory/src/lib/enroll/derive.test.ts
import { describe, expect, it } from 'vitest';

import { deriveRalphPlist } from './derive.js';
import { UnknownFact } from './types.js';
import type { HostDeclaration, HostFacts } from './types.js';

export const MINI_DECL: HostDeclaration = {
  host: 'rainforest-mini',
  home: '/Users/rainforest',
  roles: ['engine', 'ralph', 'observatory', 'loop-sync', 'usage-hourly'],
  scope: 'personal',
  otlpBind: '0.0.0.0',
  intervalSeconds: 1800,
};

export const MINI_FACTS: HostFacts = {
  tccICloud: 'permitted',
  executors: ['claude', 'agy'],
  brewPrefix: '/opt/homebrew',
  otlpListening: true,
  vaultPath:
    '/Users/rainforest/Library/Mobile Documents/iCloud~md~obsidian/Documents/rainforest-obsidian',
  accounts: { claudePlan: 'max', ghLogin: 'rainforest-dev' },
  probedAt: '2026-08-27T06:00:00.000Z',
};

describe('deriveRalphPlist, TCC permitted', () => {
  it('runs ralph.sh directly', () => {
    const file = deriveRalphPlist(MINI_DECL, MINI_FACTS);
    expect(file.path).toBe(
      'Library/LaunchAgents/tools.rainforest.loop-ralph.plist',
    );
    expect(file.contents).toContain(
      '<string>/Users/rainforest/.claude/loop/ralph.sh</string>',
    );
    expect(file.contents).not.toContain('osascript');
  });

  it('names the machine by its host, not a short alias', () => {
    // The live plist carries LOOP_MACHINE=mini while LocalHostName is
    // rainforest-mini, and its own comment admits the absolute LOOP_QUOTA_FILE
    // exists to route around that split. `mini` was simply wrong: the vault file
    // is quota.rainforest-mini.json. Consistent generation removes the split and
    // the workaround's reason for existing.
    const out = deriveRalphPlist(MINI_DECL, MINI_FACTS).contents;
    expect(out).toContain('<string>rainforest-mini</string>');
    expect(out).not.toContain('<string>mini</string>');
  });

  it('sets LOOP_QUOTA_FILE when quota lives in the vault', () => {
    // ralph.sh:314 defaults to ~/.local/share/loop-usage-runtime/..., which is
    // the Air's layout. A host reading the vault directly needs the override
    // regardless of what LOOP_MACHINE says, so this is derived from vaultPath,
    // not from the machine name.
    const out = deriveRalphPlist(MINI_DECL, MINI_FACTS).contents;
    expect(out).toContain(
      `${MINI_FACTS.vaultPath}/_system/usage/quota.rainforest-mini.json`,
    );
  });

  it('carries the probed executors', () => {
    expect(deriveRalphPlist(MINI_DECL, MINI_FACTS).contents).toContain(
      '<string>claude,agy</string>',
    );
  });

  it('puts the brew prefix on PATH', () => {
    expect(deriveRalphPlist(MINI_DECL, MINI_FACTS).contents).toContain(
      '/opt/homebrew/bin',
    );
  });

  it('does not bake iteration parameters into ProgramArguments', () => {
    // `ralph.sh 1 10` in the live plist is policy; it belongs in config.yaml.
    const args = deriveRalphPlist(MINI_DECL, MINI_FACTS).contents.split(
      '</array>',
    )[0];
    expect(args).not.toContain('<string>1</string>');
    expect(args).not.toContain('<string>10</string>');
  });
});

const AIR_DECL: HostDeclaration = {
  host: 'Angibles-MacBook-Air',
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
};

const AIR_FACTS: HostFacts = {
  tccICloud: 'denied',
  executors: ['claude', 'codex'],
  brewPrefix: '/opt/homebrew',
  otlpListening: true,
  vaultPath: null,
  accounts: { claudePlan: 'team', ghLogin: 'rainforest-angible' },
  probedAt: '2026-08-27T06:00:00.000Z',
};

describe('deriveRalphPlist, TCC denied', () => {
  it('runs ralph through the GUI shim', () => {
    // launchd on this host cannot read ~/Library/Mobile Documents, and both
    // projects it runs read out of the vault. osascript re-enters the logged-in
    // GUI session, which holds the grant.
    const out = deriveRalphPlist(AIR_DECL, AIR_FACTS).contents;
    expect(out).toContain('<string>/usr/bin/osascript</string>');
    expect(out).toContain(
      '<string>/Users/rainforest/.claude/loop/run-ralph-gui.applescript</string>',
    );
    expect(out).not.toContain('/ralph.sh');
  });

  it('carries only PATH, because the rest moves into the AppleScript', () => {
    const out = deriveRalphPlist(AIR_DECL, AIR_FACTS).contents;
    expect(out).toContain('<key>PATH</key>');
    expect(out).not.toContain('LOOP_EXECUTORS');
    expect(out).not.toContain('LOOP_MACHINE');
  });

  it('omits LOOP_QUOTA_FILE when there is no readable vault', () => {
    // ralph.sh:314's default is this host's own runtime layout, so the override
    // would be redundant here.
    expect(deriveRalphPlist(AIR_DECL, AIR_FACTS).contents).not.toContain(
      'LOOP_QUOTA_FILE',
    );
  });

  it('still emits the same label and log paths as the permitted branch', () => {
    const out = deriveRalphPlist(AIR_DECL, AIR_FACTS).contents;
    expect(out).toContain('<string>tools.rainforest.loop-ralph</string>');
    expect(out).toContain('/Users/rainforest/.claude/loop/ralph.err.log');
  });
});

describe('unknown facts refuse rather than default', () => {
  it('refuses when the TCC probe did not run', () => {
    expect(() =>
      deriveRalphPlist(MINI_DECL, { ...MINI_FACTS, tccICloud: 'unknown' }),
    ).toThrow(UnknownFact);
  });

  it('names the fact that is missing', () => {
    // A failure that says only "cannot derive" is no better than the silent
    // default it replaces.
    try {
      deriveRalphPlist(MINI_DECL, { ...MINI_FACTS, tccICloud: 'unknown' });
      throw new Error('expected UnknownFact');
    } catch (e) {
      expect((e as UnknownFact).fact).toBe('tccICloud');
      expect((e as Error).message).toContain('tccICloud');
    }
  });

  it('refuses when the brew prefix is empty', () => {
    // An empty prefix would silently produce PATH entries like "/bin/bin".
    expect(() =>
      deriveRalphPlist(MINI_DECL, { ...MINI_FACTS, brewPrefix: '' }),
    ).toThrow(UnknownFact);
  });
});
