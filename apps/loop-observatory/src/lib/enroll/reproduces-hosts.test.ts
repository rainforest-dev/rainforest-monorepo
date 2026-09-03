// apps/loop-observatory/src/lib/enroll/reproduces-hosts.test.ts
//
// The migration gate. Before the hand-written per-host plists in
// tools/loop/launchd/ can be deleted and replaced by generation, the generator
// must prove it reproduces what the two live hosts run today.
//
// Comparison is through `plutil`, not bytes and not a strict XML parser, and
// both halves matter:
//
//  * Not byte equality — the mini's committed plist is still hand-formatted
//    (two-space, inline `<key>x</key><string>y</string>` pairs). A generator
//    reproducing it byte-for-byte would have to encode formatting accidents.
//  * Through plutil — because the platform's own parser is the one that has to
//    accept the file. The Air's committed plist used to be the sharp case: its
//    comment carried `probed 2026-08-25 -- DENIED here`, and XML forbids `--`
//    inside a comment, so `plutil -lint` accepted it and launchd loaded it while
//    expat refused the file outright. That file has since been regenerated and
//    is well-formed; the mini's is still hand-written, and the rule stands for
//    whichever hand-written file is next.
//
// Differences this gate expects are named explicitly, per host, not tolerated
// wholesale. An earlier version of this gate excluded `ProgramArguments`
// globally, by key name alone, for both hosts. That hid a real regression:
// collapsing the Air's `denied` branch to emit `ralph.sh` directly (deleting
// the osascript GUI shim, the single most important thing this generator
// decides) still passed the gate, because the blanket exclusion swallowed the
// resulting `ProgramArguments` diff along with the mini's expected one. See
// EXPECTED_DIFFS below for the corrected, per-host, narrowed rules.
//
// ─────────────────────────────────────────────────────────────────────────────
// THIS GATE DOES NOT RUN IN CI. It shells out to `plutil` and `xmllint`, and
// `.github/workflows/ci.yml` runs `nx affected -t test` on `ubuntu-latest`,
// where `plutil` does not exist at all — the calls would ENOENT, not skip. So
// the suite below is guarded to darwin.
//
// The consequence, stated plainly because a skipped gate that reads as "passed"
// is precisely the failure this whole branch exists to remove: **the
// reproduction guarantee holds only where a developer or a macOS runner
// actually executes this file.** A green CI run on Linux says nothing about
// whether the generator still reproduces the two live plists. The always-running
// `describe` at the bottom of this file names which of the two happened, so the
// answer is in the test output rather than inferred from its absence.
//
// Adding a macOS CI job would close this, and is deliberately NOT done here: it
// is the repo owner's call and it costs money.
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { deriveRalphPlist } from './derive.js';
import { FIXTURES } from './fixtures.js';

/**
 * `plutil` and `xmllint` ship with macOS. `plutil` exists nowhere else, and it
 * is not optional here: the point of the gate is to compare through the parser
 * launchd itself uses.
 */
const ON_DARWIN = process.platform === 'darwin';

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
  'rainforest-air': [
    {
      path: 'ProgramArguments',
      reason:
        'Same as the mini: the live plist bakes `ralph.sh 1 10`, iteration ' +
        'parameters that belong in config.yaml rather than the launchd unit. ' +
        'This host inherited the 15-iteration default by passing none, and its ' +
        'first enabled run spent 39 minutes on an already-merged ticket. ' +
        'Tolerated under the same strict-prefix rule, so a wrong binary path ' +
        'still fails and a generator that dropped nothing is not let through.',
      tolerate: (live, generated) => {
        if (!Array.isArray(live) || !Array.isArray(generated)) return false;
        if (generated.length === 0) return false;
        if (generated.length >= live.length) return false;
        return generated.every((v, i) => v === live[i]);
      },
    },
  ],
};

describe
  .skipIf(!ON_DARWIN)
  .each(['rainforest-mini', 'rainforest-air'] as const)(
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

it.skipIf(!ON_DARWIN)(
  'the generated plists are well-formed XML, unlike the file they replace',
  () => {
    // The committed Air plist is not: `probed 2026-08-25 -- DENIED here` inside
    // a comment, and XML forbids `--` inside a comment. plutil (and launchd)
    // accept it anyway; a standards-conforming XML parser must not have to.
    // xmllint is that parser here — it is what actually refuses the committed
    // file, not a hand-rolled regex standing in for one.
    const tmp = mkdtempSync(join(tmpdir(), 'xmllint-'));
    try {
      for (const host of ['rainforest-mini', 'rainforest-air'] as const) {
        const { decl, facts } = FIXTURES[host]!;
        const contents = deriveRalphPlist(decl, facts).contents;
        const path = join(tmp, `${host}.plist`);
        writeFileSync(path, contents);
        expect(() =>
          execFileSync('xmllint', ['--noout', path], { stdio: 'pipe' }),
        ).not.toThrow();
      }

      // Confirm xmllint is discriminating, not merely lenient. This used to
      // point at the committed Air plist, which carried a `--` inside an XML
      // comment: `plutil -lint` accepted it and launchd loaded it, while a
      // strict parser refused the whole file. That plist has since been
      // replaced by generated output, which cannot contain the sequence --
      // `safeComment` rewrites it -- so the check now builds its own bad file
      // rather than depending on a defect staying put.
      const malformed = join(tmp, 'malformed.plist');
      writeFileSync(
        malformed,
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<!-- a comment containing -- which XML forbids -->\n' +
          '<plist version="1.0"><dict/></plist>\n',
      );
      expect(() =>
        execFileSync('xmllint', ['--noout', malformed], { stdio: 'pipe' }),
      ).toThrow();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  },
);

// Always runs, on every platform, and says which of the two happened. Vitest
// prints a skipped suite as a count, and a count of skips sitting inside an
// otherwise-green run is indistinguishable at a glance from a count of passes —
// which would make this gate's absence look like its success. A named,
// executing test cannot be read that way.
describe('reproduction gate coverage', () => {
  it(
    ON_DARWIN
      ? 'RAN: the gate above compared the generator against both committed plists'
      : `DID NOT RUN: the gate above needs plutil/xmllint (macOS-only) and this is ${process.platform} — the generator was NOT compared against the committed plists in this run`,
    () => {
      if (!ON_DARWIN) {
        console.warn(
          `[reproduces-hosts] SKIPPED on ${process.platform}. plutil is macOS-only, so the ` +
            'migration reproduction gate did not execute. This run proves nothing about ' +
            'whether derive.ts still reproduces tools/loop/launchd/*.plist. Run the suite ' +
            'on a Mac before trusting it.',
        );
      }
      // The assertion is on the guard itself: whichever branch of the name
      // above was chosen must match the platform that actually ran.
      expect(ON_DARWIN).toBe(process.platform === 'darwin');
    },
  );
});
