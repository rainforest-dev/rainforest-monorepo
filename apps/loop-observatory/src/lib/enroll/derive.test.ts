// apps/loop-observatory/src/lib/enroll/derive.test.ts
import { describe, expect, it } from 'vitest';

import { derive, deriveAlloyConfig, deriveRalphPlist } from './derive.js';
import { FIXTURES } from './fixtures.js';
import type { HostFacts } from './types.js';
import { UnknownFact } from './types.js';

const MINI_DECL = FIXTURES['rainforest-mini']!.decl;
const MINI_FACTS = FIXTURES['rainforest-mini']!.facts;

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

const AIR_DECL = FIXTURES['rainforest-air']!.decl;
const AIR_FACTS = FIXTURES['rainforest-air']!.facts;

// `denied` is a code path, not a property of any particular machine. It used to
// be taken straight from the Air's fixture, which meant that when that host's
// TCC grant actually changed on 2026-08-28 -- and the fixture was corrected to
// match -- three tests of the shim branch went red without the branch changing
// at all. The input is constructed here so the branch is tested whether or not
// a real host is currently in that state.
const DENIED_FACTS = { ...AIR_FACTS, tccICloud: 'denied' as const };

describe('deriveRalphPlist, TCC denied', () => {
  it('runs ralph through the GUI shim', () => {
    // launchd on this host cannot read ~/Library/Mobile Documents, and both
    // projects it runs read out of the vault. osascript re-enters the logged-in
    // GUI session, which holds the grant.
    const out = deriveRalphPlist(AIR_DECL, DENIED_FACTS).contents;
    expect(out).toContain('<string>/usr/bin/osascript</string>');
    expect(out).toContain(
      '<string>/Users/rainforest/.claude/loop/run-ralph-gui.applescript</string>',
    );
    expect(out).not.toContain('/ralph.sh');
  });

  it('carries only PATH, because the rest moves into the AppleScript', () => {
    const out = deriveRalphPlist(AIR_DECL, DENIED_FACTS).contents;
    expect(out).toContain('<key>PATH</key>');
    expect(out).not.toContain('LOOP_EXECUTORS');
    expect(out).not.toContain('LOOP_MACHINE');
  });

  it('omits LOOP_QUOTA_FILE when there is no readable vault', () => {
    // ralph.sh:314's default is this host's own runtime layout, so the override
    // would be redundant here.
    expect(deriveRalphPlist(AIR_DECL, DENIED_FACTS).contents).not.toContain(
      'LOOP_QUOTA_FILE',
    );
  });

  it('still emits the same label and log paths as the permitted branch', () => {
    const out = deriveRalphPlist(AIR_DECL, DENIED_FACTS).contents;
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

describe('deriveAlloyConfig', () => {
  it('declares an OTLP receiver on the declared bind address', () => {
    const file = deriveAlloyConfig(AIR_DECL, AIR_FACTS);
    expect(file?.path).toBe('.config/dev-telemetry/alloy/loop-otlp.alloy');
    expect(file?.contents).toContain('otelcol.receiver.otlp');
    expect(file?.contents).toContain('endpoint = "127.0.0.1:4318"');
  });

  it('forwards both metrics and logs', () => {
    // ralph exports both. A metrics-only path silently drops half of what it
    // measures, and the drop is invisible: the OTel SDK does not complain.
    const out = deriveAlloyConfig(AIR_DECL, AIR_FACTS)?.contents ?? '';
    expect(out).toContain('otelcol.exporter.prometheus');
    expect(out).toContain('otelcol.exporter.loki');
  });

  it('binds wide only when the declaration says so', () => {
    const wide =
      deriveAlloyConfig({ ...AIR_DECL, otlpBind: '0.0.0.0' }, AIR_FACTS)
        ?.contents ?? '';
    expect(wide).toContain('endpoint = "0.0.0.0:4318"');
  });

  it('no combination of facts can produce a wide bind', () => {
    // Security defaults are declared, never derived. Whether a machine opens a
    // port to the network must not be a side effect of what a probe found.
    const variants: HostFacts[] = [
      { ...AIR_FACTS, otlpListening: false },
      { ...AIR_FACTS, executors: [] },
      { ...AIR_FACTS, vaultPath: '/somewhere' },
      { ...AIR_FACTS, accounts: { claudeAvailable: null, ghLogin: null } },
    ];
    for (const f of variants) {
      const code = (deriveAlloyConfig(AIR_DECL, f)?.contents ?? '').replace(
        /\/\/.*$/gm,
        '',
      );
      expect(code).not.toContain('0.0.0.0');
    }
  });

  it('is omitted for a host without the telemetry-sink role', () => {
    // The mini's sink is the homelab's containerised Alloy, provisioned by
    // terraform. The role names the requirement; the absence names the exception.
    expect(deriveAlloyConfig(MINI_DECL, MINI_FACTS)).toBeNull();
  });

  it('does not overwrite the hand-maintained config', () => {
    // The live host's launchd plist points Alloy's last ProgramArguments entry
    // at a single file, `config.alloy`, which already defines
    // prometheus.scrape "host", prometheus.remote_write "rpi",
    // local.file_match "dev_events", loki.process "dev_events", and
    // loki.write "rpi". Writing the derived OTLP intake to that same path
    // would delete those definitions -- Alloy would fail to load entirely,
    // and the machine would lose all telemetry rather than merely fail to
    // gain the new receiver. The derived file must land beside it as a
    // fragment, not on top of it.
    const file = deriveAlloyConfig(AIR_DECL, AIR_FACTS);
    expect(file?.path).not.toBe('.config/dev-telemetry/alloy/config.alloy');
  });
});

describe('derive', () => {
  it('returns every file a host needs, and only those', () => {
    const air = derive(AIR_DECL, AIR_FACTS).map((f) => f.path);
    expect(air).toContain(
      'Library/LaunchAgents/tools.rainforest.loop-ralph.plist',
    );
    expect(air).toContain('.config/dev-telemetry/alloy/loop-otlp.alloy');

    const mini = derive(MINI_DECL, MINI_FACTS).map((f) => f.path);
    expect(mini).toContain(
      'Library/LaunchAgents/tools.rainforest.loop-ralph.plist',
    );
    expect(mini).not.toContain('.config/dev-telemetry/alloy/loop-otlp.alloy');
  });

  it('is deterministic', () => {
    const a = JSON.stringify(derive(AIR_DECL, AIR_FACTS));
    const b = JSON.stringify(derive(AIR_DECL, AIR_FACTS));
    expect(a).toBe(b);
  });

  it('emits no credential-shaped string', () => {
    const all = derive(AIR_DECL, AIR_FACTS)
      .map((f) => f.contents)
      .join('\n');
    expect(all).not.toMatch(
      /sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{20,}/,
    );
  });
});
