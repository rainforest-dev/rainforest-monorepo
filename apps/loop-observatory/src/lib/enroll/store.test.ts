import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  hostsPath,
  MAX_HOSTS,
  readHosts,
  recordFacts,
  TooManyHosts,
} from './store.js';
import type { HostFacts } from './types.js';

const FACTS: HostFacts = {
  tccICloud: 'denied',
  executors: ['claude'],
  brewPrefix: '/opt/homebrew',
  otlpListening: false,
  vaultPath: null,
  accounts: { claudeAvailable: 'ok', ghLogin: 'rainforest-angible' },
  probedAt: '2026-08-27T06:00:00.000Z',
};

/**
 * Every temp root this file has made, so afterEach can remove them.
 *
 * Without this the suite leaked one `enroll-*` directory per call, every run,
 * forever: 156 of them were sitting in $TMPDIR when this was noticed. A test
 * that quietly accumulates state on the developer's disk is the same shape as
 * everything else on this branch -- a writer succeeded and nothing checked.
 */
const tempRoots: string[] = [];

function withUsageDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'enroll-'));
  tempRoots.push(dir);
  vi.stubEnv('VAULT_PATH', dir);
  return join(dir, '_system', 'usage');
}

afterEach(() => {
  vi.unstubAllEnvs();
  // `force` so a test that never created its file is not an error, and the
  // chmod-0000 case below is restored by its own `finally` before we get here.
  while (tempRoots.length) {
    rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

describe('device records', () => {
  it('returns an empty map before anything has enrolled', () => {
    withUsageDir();
    expect(readHosts()).toEqual({});
  });

  it('records facts under the host name', () => {
    withUsageDir();
    recordFacts('Angibles-MacBook-Air', FACTS, 1_787_000_000_000);
    const hosts = readHosts();
    expect(hosts['Angibles-MacBook-Air']?.facts?.tccICloud).toBe('denied');
    expect(hosts['Angibles-MacBook-Air']?.reportedAt).toBe(1_787_000_000_000);
  });

  it('overwrites the previous facts rather than appending', () => {
    // Facts are re-read every run and are never a history. A stale entry kept
    // beside a fresh one is the snapshot-that-lies this design removes.
    withUsageDir();
    recordFacts('h', FACTS, 1);
    recordFacts('h', { ...FACTS, otlpListening: true }, 2);
    expect(readHosts()['h']?.facts?.otlpListening).toBe(true);
    expect(readHosts()['h']?.reportedAt).toBe(2);
  });

  it('survives a malformed file rather than throwing', () => {
    const usage = withUsageDir();
    // Unlike recordFacts, this test writes hostsPath() directly, so the
    // directory has to exist first.
    mkdirSync(usage, { recursive: true });
    writeFileSync(hostsPath(), '{not json');
    expect(readHosts()).toEqual({});
    expect(usage).toBeTruthy();
  });

  it('throws when the file cannot be read, rather than reporting no devices', () => {
    // A permissions or I/O error is not "nothing enrolled" -- it is the store
    // failing to answer the question at all, which drift detection built on
    // top of this must be able to tell apart from a genuinely empty install.
    const usage = withUsageDir();
    mkdirSync(usage, { recursive: true });
    const path = hostsPath();
    writeFileSync(path, '{}');
    chmodSync(path, 0o000);
    try {
      // Root (and some sandboxes) ignore file permissions entirely. A test
      // that passes only because it happened to run privileged would hide
      // exactly the bug this test exists to catch, so skip rather than
      // report a false green.
      if (process.getuid && process.getuid() === 0) return;
      expect(() => readHosts()).toThrow();
    } finally {
      chmodSync(path, 0o644);
    }
  });

  it('refuses a NEW host once the store is full', () => {
    // Host keys are attacker-chosen on an unauthenticated endpoint, so the
    // per-field bounds in parseFactsBody limit each record's size and nothing
    // about how many records there are.
    withUsageDir();
    for (let i = 0; i < MAX_HOSTS; i++) recordFacts(`h${i}`, FACTS, i);
    expect(Object.keys(readHosts()).length).toBe(MAX_HOSTS);
    expect(() => recordFacts('one-too-many', FACTS, 1)).toThrow(TooManyHosts);
    expect(readHosts()['one-too-many']).toBeUndefined();
  });

  it('still updates a host already in a full store', () => {
    // Otherwise reaching the cap would freeze every real host's facts at
    // whatever they last were -- a stale record shown as current, which is the
    // failure this design exists to remove.
    withUsageDir();
    for (let i = 0; i < MAX_HOSTS; i++) recordFacts(`h${i}`, FACTS, i);
    recordFacts('h0', { ...FACTS, otlpListening: true }, 999);
    expect(readHosts()['h0']?.facts?.otlpListening).toBe(true);
    expect(readHosts()['h0']?.reportedAt).toBe(999);
  });

  it('writes atomically', () => {
    // A reader must never see a half-written record. Same reason the usage
    // bridge publishes by rename.
    withUsageDir();
    recordFacts('h', FACTS, 1);
    expect(() => JSON.parse(readFileSync(hostsPath(), 'utf-8'))).not.toThrow();
  });
});
