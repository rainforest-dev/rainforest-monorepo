import { execFileSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { derive } from './derive.js';
import { FIXTURES } from './fixtures.js';
import { parseFactsBody } from './parse.js';
import { PROBE_VERSION, PROBES } from './probes.js';
import type { HostFacts } from './types.js';
import { UnknownFact } from './types.js';

/** Run a probe's shell exactly as the device would, under `sh`. */
function runProbe(id: keyof HostFacts, env: NodeJS.ProcessEnv): string {
  const probe = PROBES.find((p) => p.id === id);
  if (!probe) throw new Error(`no probe for ${id}`);
  return execFileSync('sh', ['-c', probe.shell], {
    encoding: 'utf8',
    env,
  }).trim();
}

describe('probe list', () => {
  it('covers every fact derivation consumes', () => {
    // The device is a dumb executor of this list. A fact derivation needs and
    // the list does not gather becomes an UnknownFact at derive time, which is
    // a refusal the owner has to diagnose.
    const needed: (keyof HostFacts)[] = [
      'tccICloud',
      'executors',
      'brewPrefix',
      'otlpListening',
      'vaultPath',
      'accounts',
    ];
    const covered = PROBES.map((p) => p.id);
    for (const n of needed) expect(covered).toContain(n);
  });

  it('explains why each probe exists', () => {
    // A probe with no stated reason is one nobody can safely delete later.
    for (const p of PROBES) expect(p.why.length).toBeGreaterThan(20);
  });

  it('reads no credential', () => {
    // Probes report what `claude` and `gh` resolved to; they never read a token.
    //
    // ── If this fires on a probe you believe is harmless, READ THIS FIRST ──
    // The pattern is a PRESENCE check on the probe's shell text, not an
    // analysis of what it does. So it fires on a probe that merely NAMES a
    // credential-shaped thing -- `printf "$API_KEY_PATH"`, a comment
    // mentioning `_TOKEN`, `echo "$GH_TOKEN is unset"` -- even though none of
    // those read a secret. **That is intentional and the guard is doing its
    // job.** These strings are served over an unauthenticated endpoint to be
    // executed verbatim on someone's machine, so "close to a credential" is
    // the line, not "provably reads one": a check that tried to judge intent
    // would have to model shell semantics and would miss the case it exists
    // for.
    //
    // The fix for a false positive is to rename the probe's variable or
    // rephrase its text, NOT to loosen this regex and NOT to delete the test.
    // Whoever weakens it re-opens a hole for every probe added afterwards.
    for (const p of PROBES) {
      expect(p.shell).not.toMatch(
        /security find-generic-password|auth token|--show-token|cat .*token|credentials|API_KEY|_TOKEN|_SECRET/,
      );
    }
  });

  it('reports tccICloud as unknown when the question cannot be asked', () => {
    // The spec is explicit: "A probe fails to run -> Reported as `unknown`,
    // never as a default." The old shell had only two outcomes, so a probe
    // that could not run answered `denied` -- which selects the osascript GUI
    // shim on a machine that may well be permitted.
    //
    // Runs the REAL probe text under a real `sh` with no usable $HOME, so this
    // asserts about the string that is actually served to devices rather than
    // a paraphrase of it. Both platforms reach `unknown` by their own branch:
    // linux fails the uname test, darwin fails the $HOME test.
    const out = runProbe('tccICloud', { PATH: process.env.PATH ?? '' });
    expect(out).toBe('unknown');
  });

  it('answers tccICloud definitively on a real macOS host', () => {
    // The other half of the previous test: `unknown` must be reachable WITHOUT
    // making it the answer everywhere. On a machine that can be asked, the
    // probe commits.
    if (process.platform !== 'darwin') return;
    const out = runProbe('tccICloud', {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? '',
    });
    expect(['permitted', 'denied']).toContain(out);
  });

  it("derive's refusal path is reachable from a real probe result", () => {
    // The `unknown` branch in derive.ts was dead against the shipped probe
    // list -- nothing the list could produce ever reached it. This walks the
    // whole chain: real probe output -> real parser -> real derivation.
    const probed = runProbe('tccICloud', { PATH: process.env.PATH ?? '' });
    const { decl, facts } = FIXTURES['rainforest-air']!;
    const parsed = parseFactsBody({
      host: decl.host,
      facts: { ...facts, tccICloud: probed },
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.facts.tccICloud).toBe('unknown');
    expect(() => derive(decl, parsed!.facts)).toThrow(UnknownFact);
  });

  it('reports no gh login as empty, never as a placeholder word', () => {
    // `|| echo unknown` made a logged-out machine report the literal string
    // "unknown", which parse.ts accepted as a real login and drift.ts then
    // reported as an account MISMATCH. Asserted on the served text because
    // running it would depend on whether this machine happens to have gh.
    const accounts = PROBES.find((p) => p.id === 'accounts');
    expect(accounts?.shell).not.toMatch(/echo unknown/);
    expect(
      parseFactsBody({
        host: 'h',
        facts: {
          ...FIXTURES['rainforest-air']!.facts,
          accounts: { claudeAvailable: 'ok', ghLogin: '' },
        },
      })!.facts.accounts.ghLogin,
    ).toBeNull();
  });

  it('asks launchd about launchd, not whatever shell is running the probe', () => {
    // The regression this exists for: the probe used to answer with
    // `[ -r <vault> ]` evaluated in the calling process. Under TCC an
    // interactive session is routinely permitted where launchd is denied, so it
    // answered a different question than the one its `why` claimed -- and
    // derive.ts picks between a direct-exec ralph plist and the osascript GUI
    // shim on that answer. Asserted on the served text, because the behaviour
    // only differs on a machine whose launchd and shell disagree, which no unit
    // test can arrange.
    const tcc = PROBES.find((p) => p.id === 'tccICloud')!;
    expect(tcc.shell).toContain('launchctl bootstrap');
    expect(tcc.shell).toContain('launchctl bootout');
    // The old form, as the whole answer rather than as the job's body.
    expect(tcc.shell).not.toMatch(/;\s*if \[ -r "\$HOME\/Library/);
  });

  it('leaves nothing behind on any path out of the tcc probe', () => {
    // It bootstraps a LaunchAgent, so "cleans up" is not a nicety: a plist left
    // in ~/Library/LaunchAgents loads again at the next login. It is written to
    // a temp dir for that reason, and every exit removes it.
    const tcc = PROBES.find((p) => p.id === 'tccICloud')!;
    expect(tcc.shell).toContain('mktemp -d');
    expect(tcc.shell).not.toContain('Library/LaunchAgents');
    // One per exit after the directory exists: the refused-bootstrap path and
    // the normal path.
    expect(tcc.shell.match(/rm -rf "\$D"/g)?.length).toBe(2);
    // A probe that hangs would hang enrollment; the wait is bounded.
    expect(tcc.shell).toMatch(/-lt 50/);
  });

  it('warns that this probe has a side effect, since one probe now does', () => {
    // A machine is told not to load LaunchAgents. This step does, on purpose
    // and briefly, and an agent following that instruction has to be able to
    // tell the difference from the served list alone.
    const tcc = PROBES.find((p) => p.id === 'tccICloud')!;
    expect(tcc.why).toMatch(/SIDE EFFECT/);
    expect(tcc.why).toMatch(/LaunchAgent/);
  });

  it('is versioned, so a device can tell the list changed', () => {
    expect(PROBE_VERSION).toBeGreaterThan(0);
  });
});
