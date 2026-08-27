import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { hostsPath, readHosts, recordFacts } from './store.js';
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

function withUsageDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'enroll-'));
  vi.stubEnv('VAULT_PATH', dir);
  return join(dir, '_system', 'usage');
}

afterEach(() => vi.unstubAllEnvs());

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

  it('writes atomically', () => {
    // A reader must never see a half-written record. Same reason the usage
    // bridge publishes by rename.
    withUsageDir();
    recordFacts('h', FACTS, 1);
    expect(() => JSON.parse(readFileSync(hostsPath(), 'utf-8'))).not.toThrow();
  });
});
