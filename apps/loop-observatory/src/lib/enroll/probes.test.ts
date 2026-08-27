import { describe, expect, it } from 'vitest';

import { PROBE_VERSION,PROBES } from './probes.js';
import type { HostFacts } from './types.js';

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
    for (const p of PROBES) {
      expect(p.shell).not.toMatch(
        /auth token|--show-token|cat .*token|\.credentials/,
      );
    }
  });

  it('is versioned, so a device can tell the list changed', () => {
    expect(PROBE_VERSION).toBeGreaterThan(0);
  });
});
