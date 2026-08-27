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
// Differences this gate expects are named explicitly, not tolerated wholesale:
// `LOOP_MACHINE` (the live mini plist says `mini`, the generator emits the full
// host name `rainforest-mini`) and `ProgramArguments` (the live mini plist bakes
// in `1 10` iteration parameters that belong in config, not in the launchd
// unit). Any other difference is a generator bug or a committed-file accident,
// and this test must fail on it rather than swallow it.
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

const EXPECTED_DIFF_PATHS = new Set(['LOOP_MACHINE', 'ProgramArguments']);

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

      const differences = diff(live, generated).filter(
        (d) => !EXPECTED_DIFF_PATHS.has(d.path.split('.').pop() ?? d.path),
      );

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
