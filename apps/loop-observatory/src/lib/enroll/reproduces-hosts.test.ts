// apps/loop-observatory/src/lib/enroll/reproduces-hosts.test.ts
//
// The migration gate. Before the hand-written per-host plists in
// tools/loop/launchd/ can be deleted and replaced by generation, the generator
// must prove it reproduces what the two live hosts run today.
//
// Comparison is through `plutil`, not bytes and not a strict XML parser, and
// both halves matter:
//
//  * Not byte equality — the two committed plists are formatted differently by
//    hand (the Air tab-indented one key per line, the mini two-space with
//    inline `<key>x</key><string>y</string>` pairs). A generator reproducing
//    both byte-for-byte would have to encode each host's formatting accidents.
//  * Through plutil — the Air's committed plist is not well-formed XML: its
//    comment contains `probed 2026-08-25 -- DENIED here`, and XML forbids `--`
//    inside a comment. `plutil -lint` accepts it and launchd loads it; Python's
//    expat (and thus plistlib) refuses the file outright. Comparison has to use
//    the parser the platform actually uses, not the strictest one available.
//
// Differences this gate expects are named explicitly, per host, not tolerated
// wholesale. An earlier version of this gate excluded `ProgramArguments`
// globally, by key name alone, for both hosts. That hid a real regression:
// collapsing the Air's `denied` branch to emit `ralph.sh` directly (deleting
// the osascript GUI shim, the single most important thing this generator
// decides) still passed the gate, because the blanket exclusion swallowed the
// resulting `ProgramArguments` diff along with the mini's expected one. See
// EXPECTED_DIFFS below for the corrected, per-host, narrowed rules.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { deriveRalphPlist } from './derive.js';
import { FIXTURES } from './fixtures.js';

const REPO_ROOT = join(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../../..',
);
const LAUNCHD_DIR = join(REPO_ROOT, 'tools/loop/launchd');

function plutilToJson(plistPath: string): unknown {
  const tmp = mkdtempSync(join(tmpdir(), 'plutil-'));
  const out = join(tmp, 'out.json');
  try {
    execFileSync('plutil', ['-convert', 'json', '-o', out, plistPath]);
    return JSON.parse(execFileSync('cat', [out], { encoding: 'utf8' }));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function writeAndParseGenerated(host: string, contents: string): unknown {
  const tmp = mkdtempSync(join(tmpdir(), 'derived-'));
  const plistPath = join(tmp, `${host}.plist`);
  try {
    writeFileSync(plistPath, contents);
    // Prove plutil (the parser launchd itself uses) accepts the generated
    // file before comparing its contents.
    execFileSync('plutil', ['-lint', plistPath]);
    return plutilToJson(plistPath);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** Diff two parsed plist dictionaries, key path by key path. */
function diff(
  a: unknown,
  b: unknown,
  path = '',
): Array<{ path: string; live: unknown; generated: unknown }> {
  if (
    a !== null &&
    b !== null &&
    typeof a === 'object' &&
    typeof b === 'object' &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  ) {
    const keys = new Set([
      ...Object.keys(a as Record<string, unknown>),
      ...Object.keys(b as Record<string, unknown>),
    ]);
    const out: Array<{ path: string; live: unknown; generated: unknown }> = [];
    for (const k of keys) {
      out.push(
        ...diff(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k],
          path ? `${path}.${k}` : k,
        ),
      );
    }
    return out;
  }
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  return [{ path, live: a, generated: b }];
}

interface ExpectedDiffRule {
  path: string;
  reason: string;
  /** Returns true when this specific (live, generated) pair is the tolerated
   * accident described in `reason`, not merely "any difference at this path". */
  tolerate: (live: unknown, generated: unknown) => boolean;
}

/**
 * Per host, because a rule that is correct for one host is a hole for the
 * other. `ProgramArguments` used to be excluded globally, by key name alone,
 * for both hosts — which meant collapsing the Air's `denied` branch to emit
 * `ralph.sh` directly (deleting the osascript GUI shim) still passed: the
 * blanket exclusion swallowed that regression's `ProgramArguments` diff along
 * with the mini's expected one. The Air has no rule at all below, because its
 * generated `ProgramArguments` already matches the committed plist exactly —
 * confirmed by an empty diff array on a clean run — so nothing there needs
 * tolerating and any future difference must fail.
 */
const EXPECTED_DIFFS: Record<string, ExpectedDiffRule[]> = {
  'rainforest-mini': [
    {
      path: 'EnvironmentVariables.LOOP_MACHINE',
      reason:
        'The live plist carries the short alias `mini` while LocalHostName is ' +
        '`rainforest-mini`; the generator emits the full host name and removes ' +
        'the split. Tolerated only for this exact live/generated pair, so a ' +
        'generator that emitted some other wrong value still fails.',
      tolerate: (live, generated) =>
        live === 'mini' && generated === 'rainforest-mini',
    },
    {
      path: 'ProgramArguments',
      reason:
        'The live plist bakes `ralph.sh 1 10` -- iteration parameters that ' +
        'belong in config.yaml, not the launchd unit. Tolerated ONLY when the ' +
        'generated array is a strict, non-empty-deficit prefix of the live ' +
        'array: every generated element must equal the live element at the ' +
        'same index (so a wrong binary path still fails), and the live array ' +
        'must be strictly longer (so a generator that dropped nothing is not ' +
        'accidentally let through as "prefix of itself").',
      tolerate: (live, generated) => {
        if (!Array.isArray(live) || !Array.isArray(generated)) return false;
        if (generated.length === 0) return false;
        if (generated.length >= live.length) return false;
        return generated.every((v, i) => v === live[i]);
      },
    },
  ],
  'Angibles-MacBook-Air': [],
};

describe.each(['rainforest-mini', 'Angibles-MacBook-Air'] as const)(
  'deriveRalphPlist reproduces the live %s plist',
  (host) => {
    it('derives without error', () => {
      const { decl, facts } = FIXTURES[host]!;
      expect(() => deriveRalphPlist(decl, facts)).not.toThrow();
    });

    it('produces a plist accepted by plutil', () => {
      const { decl, facts } = FIXTURES[host]!;
      const file = deriveRalphPlist(decl, facts);
      expect(() => writeAndParseGenerated(host, file.contents)).not.toThrow();
    });

    it('has no unexplained difference from the committed plist', () => {
      const { decl, facts } = FIXTURES[host]!;
      const file = deriveRalphPlist(decl, facts);

      const live = plutilToJson(
        join(LAUNCHD_DIR, `${host}.tools.rainforest.loop-ralph.plist`),
      );
      const generated = writeAndParseGenerated(host, file.contents);

      const rules = EXPECTED_DIFFS[host] ?? [];
      const differences = diff(live, generated).filter((d) => {
        const rule = rules.find((r) => r.path === d.path);
        return !rule || !rule.tolerate(d.live, d.generated);
      });

      expect(
        differences,
        `unexplained differences: ${JSON.stringify(differences, null, 2)}`,
      ).toEqual([]);
    });
  },
);

it('the generated plists are well-formed XML, unlike the file they replace', () => {
  // The committed Air plist is not: `probed 2026-08-25 -- DENIED here` inside
  // a comment, and XML forbids `--` inside a comment. plutil (and launchd)
  // accept it anyway; a standards-conforming XML parser must not have to.
  // xmllint is that parser here — it is what actually refuses the committed
  // file, not a hand-rolled regex standing in for one.
  const tmp = mkdtempSync(join(tmpdir(), 'xmllint-'));
  try {
    for (const host of ['rainforest-mini', 'Angibles-MacBook-Air'] as const) {
      const { decl, facts } = FIXTURES[host]!;
      const contents = deriveRalphPlist(decl, facts).contents;
      const path = join(tmp, `${host}.plist`);
      writeFileSync(path, contents);
      expect(() =>
        execFileSync('xmllint', ['--noout', path], { stdio: 'pipe' }),
      ).not.toThrow();
    }

    // Confirm xmllint is discriminating, not merely lenient: it must reject
    // the committed Air plist for the documented reason.
    expect(() =>
      execFileSync(
        'xmllint',
        [
          '--noout',
          join(
            LAUNCHD_DIR,
            'Angibles-MacBook-Air.tools.rainforest.loop-ralph.plist',
          ),
        ],
        { stdio: 'pipe' },
      ),
    ).toThrow();
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
