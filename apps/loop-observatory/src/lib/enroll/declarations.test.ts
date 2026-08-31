import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { readDeclarations } from './declarations.js';

/**
 * The real committed file, not a copy. A fixture would drift from it silently,
 * which is the failure this module exists to close.
 */
const REAL_HOSTS_YAML = join(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../../..',
  'tools/loop/hosts.yaml',
);

const temps: string[] = [];

function withYaml(body: string): void {
  const dir = mkdtempSync(join(tmpdir(), 'enroll-decl-'));
  temps.push(dir);
  const path = join(dir, 'hosts.yaml');
  writeFileSync(path, body);
  vi.stubEnv('LOOP_HOSTS_YAML', path);
}

afterEach(() => {
  vi.unstubAllEnvs();
  while (temps.length) rmSync(temps.pop()!, { recursive: true, force: true });
});

describe('readDeclarations', () => {
  it('reads both live hosts out of the committed hosts.yaml', () => {
    vi.stubEnv('LOOP_HOSTS_YAML', REAL_HOSTS_YAML);
    const { byHost, problems, error } = readDeclarations();
    expect(error).toBeNull();
    expect(problems).toEqual({});
    expect(Object.keys(byHost).sort()).toEqual([
      'rainforest-angible',
      'rainforest-mini',
    ]);

    const air = byHost['rainforest-angible']!;
    // `company` in the file, `work` in the derivation vocabulary.
    expect(air.scope).toBe('work');
    expect(air.home).toBe('/Users/rainforest');
    expect(air.otlpBind).toBe('127.0.0.1');
    expect(air.roles).toContain('telemetry-sink');
    // Prettier wraps this host's roles onto the line after `roles:`, so reading
    // it at all proves the scanner handles the wrapped flow sequence -- the
    // exact layout that install.sh's awk cannot read.
    expect(air.roles).toEqual([
      'engine',
      'ralph',
      'relay-pull',
      'usage-hourly',
      'usage-publish',
      'telemetry-sink',
    ]);

    const mini = byHost['rainforest-mini']!;
    expect(mini.scope).toBe('personal');
    // Declared wide, and only because the file says so.
    expect(mini.otlpBind).toBe('0.0.0.0');
    // No `observatory`: retired 2026-08-27 when the app became a container
    // provisioned by terraform in rainforest-homelab. install.sh installs
    // LaunchAgents, and there is no longer one to install.
    expect(mini.roles).toEqual([
      'engine',
      'ralph',
      'loop-sync',
      'usage-hourly',
    ]);
  });

  it('binds OTLP to loopback when the entry does not say otherwise', () => {
    // The spec's rule: whether a machine opens a port to the network must not
    // be a side effect of anything but a declaration, so the safe value is what
    // a forgetful entry gets.
    withYaml(
      'hosts:\n  h:\n    scope: personal\n    home: /Users/x\n    roles: [engine]\n',
    );
    expect(readDeclarations().byHost['h']?.otlpBind).toBe('127.0.0.1');
  });

  it('never infers a home directory', () => {
    // Guessing a home is the mistake vault_path() made when it fell through to
    // a retired clone and sent a machine's whole run record somewhere nothing
    // reads. An entry without one is refused, with a stated reason.
    withYaml('hosts:\n  h:\n    scope: personal\n    roles: [engine]\n');
    const { byHost, problems } = readDeclarations();
    expect(byHost['h']).toBeUndefined();
    expect(problems['h']).toContain('home');
  });

  it('refuses an entry it cannot read, rather than omitting it silently', () => {
    withYaml(
      'hosts:\n  h:\n    scope: nonsense\n    home: /Users/x\n    roles: [engine]\n' +
        '  i:\n    scope: personal\n    home: /Users/x\n    roles: [engine]\n    otlp_bind: 8.8.8.8\n',
    );
    const { byHost, problems } = readDeclarations();
    expect(byHost).toEqual({});
    expect(problems['h']).toContain('scope');
    expect(problems['i']).toContain('otlp_bind');
  });

  it('reports an unreadable source as an error, not as "nothing declared"', () => {
    // hosts.yaml is committed and always present. Its absence means the path is
    // wrong, and reporting no declarations for that would put every real host
    // into the not-declared state for a reason that is not true.
    vi.stubEnv('LOOP_HOSTS_YAML', '/nonexistent/hosts.yaml');
    const { byHost, error } = readDeclarations();
    expect(byHost).toEqual({});
    expect(error).toContain('/nonexistent/hosts.yaml');
  });

  it('ignores everything above the hosts: block', () => {
    // `roles:` at the top of the file defines roles; it does not declare hosts.
    vi.stubEnv('LOOP_HOSTS_YAML', REAL_HOSTS_YAML);
    expect(Object.keys(readDeclarations().byHost)).not.toContain('engine');
  });
});
